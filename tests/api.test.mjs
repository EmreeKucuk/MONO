import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { handleApi } from '../server/api.mjs';

const listen=async server=>{server.listen(0,'127.0.0.1');await once(server,'listening');return `http://127.0.0.1:${server.address().port}`;};
const read=async req=>{let value='';for await(const part of req)value+=part;return value?JSON.parse(value):{};};

test('cookie session, account isolation and compare-and-swap conflict',async()=>{
  const records=new Map();
  let unavailable=false;
  const upstream=http.createServer(async(req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname,account=req.headers.authorization?.replace('Bearer token-','');
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
    if(path==='/auth/v1/token'){const {email}=await read(req),name=email.startsWith('a')?'a':'b';send(200,{access_token:'token-'+name,refresh_token:'refresh-'+name,expires_in:3600,user:{id:name,email}});return;}
    if(path==='/auth/v1/user'){if(unavailable){send(503,{message:'Temporary outage'});return;}send(account?200:401,account?{id:account,email:account+'@example.com'}:{message:'No user'});return;}
    if(path==='/rest/v1/workspaces'){const record=records.get(account);send(200,record?[record]:[]);return;}
    if(path==='/rest/v1/rpc/save_workspace_cas'){const input=await read(req),existing=records.get(account),revision=existing?.revision||0;if(revision!==input.expected_revision){send(200,[]);return;}const next={state:input.next_state,revision:revision+1};records.set(account,next);send(200,[{new_revision:next.revision}]);return;}
    send(404,{message:'Unknown mock route'});
  });
  const upstreamUrl=await listen(upstream);
  process.env.SUPABASE_URL=upstreamUrl;process.env.SUPABASE_ANON_KEY='anon-for-test';
  const app=http.createServer(async(req,res)=>{if(req.headers['x-preparsed'])req.body=await read(req);await handleApi(req,res);});const url=await listen(app);
  try{
    const login=async email=>{const response=await fetch(url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json','X-Forwarded-Proto':'https','X-Preparsed':'1'},body:JSON.stringify({email,password:'password'})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);assert.match(cookie,/Secure/);return cookie.split(';')[0];};
    const a=await login('a@example.com'),b=await login('b@example.com');
    const get=async cookie=>{const response=await fetch(url+'/api/workspace',{headers:{Cookie:cookie}});return response.json();};
    const put=async(cookie,revision,state)=>fetch(url+'/api/workspace',{method:'PUT',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({revision,state})});
    assert.equal((await get(a)).revision,0);
    assert.equal((await put(a,0,{widgets:[],events:[{id:'event-a',date:'2026-09-30',text:'A hesabı'}]})).status,200);
    assert.equal((await get(b)).state,null);
    const conflict=await put(a,0,{widgets:[],events:[]});assert.equal(conflict.status,409);
    assert.equal((await get(a)).state.events[0].text,'A hesabı');
    assert.equal((await put(b,0,{widgets:[],events:[{id:'event-b',date:'2026-09-30',text:'B hesabı'}]})).status,200);
    assert.equal((await get(a)).state.events[0].text,'A hesabı');
    assert.equal((await get(b)).state.events[0].text,'B hesabı');
    assert.equal((await put(a,1,{schemaVersion:99,widgets:[],events:[]})).status,400);
    const crossOrigin=await fetch(url+'/api/workspace',{method:'PUT',headers:{Cookie:a,'Content-Type':'application/json',Origin:'https://attacker.example'},body:'{}'});
    assert.equal(crossOrigin.status,403);
    unavailable=true;
    const interrupted=await fetch(url+'/api/session',{headers:{Cookie:a}});
    assert.equal(interrupted.status,502);assert.equal(interrupted.headers.get('set-cookie'),null,'A temporary outage must not erase the session.');
  }finally{app.close();upstream.close();delete process.env.SUPABASE_URL;delete process.env.SUPABASE_ANON_KEY;}
});
