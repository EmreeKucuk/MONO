import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {handleApi} from '../server/api.mjs';

test('Spotify OAuth uses PKCE, encrypted cookies, identity isolation, refresh and validated playback',async()=>{
  const originalFetch=globalThis.fetch,env={...process.env},calls=[];
  process.env.SUPABASE_URL='https://supabase.mock';process.env.SUPABASE_ANON_KEY='mock-anon';
  process.env.SPOTIFY_CLIENT_ID='test-client';process.env.SPOTIFY_CLIENT_SECRET='test-secret';
  process.env.SPOTIFY_COOKIE_SECRET=Buffer.alloc(32,7).toString('base64');process.env.SPOTIFY_REDIRECT_URI='https://mono.example/api/spotify/callback';
  let refreshes=0,upstreamStatus=200;
  const answer=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  globalThis.fetch=async(url,options={})=>{
    const address=String(url);
    if(address.startsWith('https://supabase.mock/auth/v1/token')){const input=JSON.parse(options.body);return answer({access_token:input.email,refresh_token:'mono-refresh',expires_in:3600,user:{id:input.email}});}
    if(address==='https://supabase.mock/auth/v1/user')return answer({id:options.headers.Authorization.slice(7)});
    if(address==='https://supabase.mock/auth/v1/logout')return answer({});
    if(address==='https://accounts.spotify.com/api/token'){
      const params=new URLSearchParams(options.body);assert.match(options.headers.Authorization,/^Basic /);
      if(params.get('grant_type')==='refresh_token'){assert.equal(params.get('refresh_token'),'private-refresh');refreshes++;return answer({access_token:'renewed-access',expires_in:3600});}
      assert.equal(params.get('redirect_uri'),process.env.SPOTIFY_REDIRECT_URI);assert.ok(params.get('code_verifier').length>40);
      return answer({access_token:'first-access',refresh_token:'private-refresh',expires_in:1});
    }
    if(address.startsWith('https://api.spotify.com/v1')){
      calls.push({url:address,method:options.method,body:options.body});
      if(upstreamStatus!==200)return new Response('{}',{status:upstreamStatus});
      assert.equal(options.headers.Authorization,'Bearer renewed-access');
      if(address.includes('/me/playlists'))return answer({items:[{id:'37i9dQZF1DXcBWIGoYBM5M',name:'My playlist',owner:{display_name:'Me'}}],next:null});
      if(address.includes('/devices'))return answer({devices:[{id:'device-1',name:'Phone',is_active:true,is_restricted:false}]});
      if(address.includes('/playlists/')&&address.includes('/items'))return answer({items:[{item:null},{item:{id:'37i9dQZF1DXcBWIGoYBM5M',type:'track',name:'<img onerror=evil>',duration_ms:90000,artists:[{name:'Artist'}]}},{track:{id:'37i9dQZF1DXcBWIGoYBM5M',type:'track',name:'Legacy',is_playable:false}}],next:null});
      if(address.includes('/playlists/'))return answer({name:'My list',images:[{url:'javascript:alert(1)'}]});
      if(address.endsWith('/me/player'))return answer({shuffle_state:true,is_playing:true,progress_ms:1000,item:{name:'Song',duration_ms:180000,artists:[{name:'Artist'}],album:{name:'Album',images:[{url:'javascript:alert(1)'}]}}});
      return new Response(null,{status:204});
    }
    return originalFetch(url,options);
  };
  const app=http.createServer((req,res)=>handleApi(req,res));app.listen(0,'127.0.0.1');await once(app,'listening');const base=`http://127.0.0.1:${app.address().port}`;
  const call=(path,cookie='',method='GET',data)=>originalFetch(base+path,{method,redirect:'manual',headers:{Cookie:cookie,'Content-Type':'application/json','X-Forwarded-Proto':'https'},body:data===undefined?undefined:JSON.stringify(data)});
  const pairs=response=>response.headers.getSetCookie().map(value=>value.split(';')[0]);
  try{
    const a=pairs(await call('/api/login','','POST',{email:'a',password:'x'}))[0],b=pairs(await call('/api/login','','POST',{email:'b',password:'x'}))[0];
    const connect=await call('/api/spotify/connect',a,'POST',{}),target=new URL((await connect.json()).url),pending=pairs(connect)[0];
    assert.equal(target.origin,'https://accounts.spotify.com');assert.equal(target.searchParams.get('code_challenge_method'),'S256');assert.match(target.searchParams.get('scope'),/playlist-read-private/);
    assert.match(connect.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Secure/);
    const invalid=await call('/api/spotify/callback?state=wrong&code=x',pending);assert.equal(invalid.headers.get('location'),'/?spotify=failed');assert.equal(calls.length,0);
    const callback=await call('/api/spotify/callback?state='+target.searchParams.get('state')+'&code=good',pending);
    assert.equal(callback.headers.get('location'),'/?spotify=connected');
    const spotify=pairs(callback).find(value=>value.startsWith('mono_spotify=')),combined=a+'; '+spotify;
    assert.ok(spotify);assert.doesNotMatch(callback.headers.get('set-cookie'),/private-refresh|first-access/);assert.match(callback.headers.get('set-cookie'),/SameSite=Strict; Secure/);
    assert.equal((await (await call('/api/spotify/status',combined)).json()).connected,true);
    assert.equal((await (await call('/api/spotify/status',b+'; '+spotify)).json()).connected,false);
    assert.equal((await call('/api/spotify/token',b+'; '+spotify)).status,401);
    const playlists=await call('/api/spotify/playlists',combined);assert.equal(playlists.status,200);assert.equal(refreshes,1);
    assert.equal((await playlists.json()).items[0].name,'My playlist');
    const fresh=pairs(playlists).find(value=>value.startsWith('mono_spotify=')),current=a+'; '+fresh;
    const tokenResponse=await call('/api/spotify/token',current);assert.deepEqual(await tokenResponse.json(),{access_token:'renewed-access'});assert.equal(tokenResponse.headers.get('cache-control'),'no-store');
    assert.equal((await call('/api/spotify/playback',current,'POST',{action:'play',playlistId:'37i9dQZF1DXcBWIGoYBM5M',deviceId:'device-1'})).status,200);
    assert.equal(JSON.parse(calls.at(-1).body).context_uri,'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M');
    const items=await (await call('/api/spotify/playlist?id=37i9dQZF1DXcBWIGoYBM5M',current)).json();
    assert.equal(items.cover,null);assert.equal(items.items[0].playable,false);assert.equal(items.items[1].position,1);assert.equal(items.items[1].name,'<img onerror=evil>');assert.equal(items.items[2].playable,false);
    const page=await (await call('/api/spotify/playlist?id=37i9dQZF1DXcBWIGoYBM5M&offset=50',current)).json();assert.equal(page.items[1].position,51);
    assert.equal((await call('/api/spotify/playlist?id=bad',current)).status,400);
    assert.equal((await call('/api/spotify/playlist?id=37i9dQZF1DXcBWIGoYBM5M&offset=-1',current)).status,400);
    assert.equal((await call('/api/spotify/playback',current,'POST',{action:'play',playlistId:'37i9dQZF1DXcBWIGoYBM5M',position:1,deviceId:'device-1'})).status,200);
    assert.deepEqual(JSON.parse(calls.at(-1).body),{context_uri:'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',offset:{position:1},position_ms:0});
    assert.equal((await call('/api/spotify/playback',current,'POST',{action:'play',playlistId:'37i9dQZF1DXcBWIGoYBM5M',position:-1,deviceId:'device-1'})).status,400);
    const state=await (await call('/api/spotify/state',current)).json();assert.equal(state.track.name,'Song');assert.equal(state.track.cover,null);assert.equal(state.position,1000);
    assert.equal(state.shuffle,true);
    for(const enabled of [true,false]){
      assert.equal((await call('/api/spotify/playback',current,'POST',{action:'shuffle',enabled,deviceId:'device-1'})).status,200);
      assert.equal(calls.at(-1).method,'PUT');
      assert.equal(new URL(calls.at(-1).url).searchParams.get('state'),String(enabled));
    }
    const beforeInvalid=calls.length;
    assert.equal((await call('/api/spotify/playback',current,'POST',{action:'shuffle',enabled:'true',deviceId:'device-1'})).status,400);
    assert.equal(calls.length,beforeInvalid);
    assert.equal((await call('/api/spotify/playback',current,'POST',{action:'seek',positionMs:45000,deviceId:'device-1'})).status,200);
    assert.match(calls.at(-1).url,/seek\?device_id=device-1&position_ms=45000/);
    assert.equal((await call('/api/spotify/playback',current,'POST',{action:'seek',positionMs:-1,deviceId:'device-1'})).status,400);
    assert.equal((await call('/api/spotify/playback',current,'POST',{action:'play',playlistId:'javascript:bad',deviceId:'device-1'})).status,400);
    assert.equal((await call('/api/spotify/playlists?offset=-1',current)).status,400);
    const csrf=await originalFetch(base+'/api/spotify/connect',{method:'POST',headers:{Cookie:a,Origin:'https://attacker.test','Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
    upstreamStatus=429;assert.equal((await call('/api/spotify/devices',current)).status,429);
    upstreamStatus=403;const denied=await call('/api/spotify/playlist?id=37i9dQZF1DXcBWIGoYBM5M',current);
    assert.equal(denied.status,403);assert.match((await denied.json()).error,/ortak düzenlediğin/);
    const logout=await call('/api/logout',current,'POST',{});assert.ok(logout.headers.getSetCookie().some(value=>value.startsWith('mono_spotify=;')&&value.includes('Max-Age=0')));
  }finally{app.close();globalThis.fetch=originalFetch;for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});
