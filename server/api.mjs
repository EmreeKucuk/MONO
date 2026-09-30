import { sanitizeWorkspace } from '../public/state-schema.js';

const cookieName='mono_session';
const config=()=>{
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'')||'',key=process.env.SUPABASE_ANON_KEY||'';
  if(/YOUR_|your-project|your-anon|placeholder|BURAYA/i.test(url+' '+key))return {url:'',key:''};
  return {url,key};
};
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(part=>part.trim().split(/=(.*)/s).slice(0,2)).filter(([key,value])=>key&&value));
const secure=req=>req.headers['x-forwarded-proto']==='https'||req.socket?.encrypted;
function setSession(req,res,value){const body=value?Buffer.from(JSON.stringify(value)).toString('base64url'):'';res.setHeader('Set-Cookie',`${cookieName}=${body}; Path=/; HttpOnly; SameSite=Strict${secure(req)?'; Secure':''}${value?'; Max-Age=2592000':'; Max-Age=0'}`);}
function readSession(req){try{const raw=cookies(req)[cookieName];if(!raw||raw.length>8000)return null;const value=JSON.parse(Buffer.from(raw,'base64url').toString());return value?.access_token&&value?.refresh_token?value:null;}catch{return null;}}
async function body(req){
  // Serverless runtimes may already have parsed the JSON body.
  if(req.body!==undefined){
    const raw=typeof req.body==='string'?req.body:JSON.stringify(req.body);
    if(Buffer.byteLength(raw)>2_000_000)throw Object.assign(Error('İstek çok büyük.'),{status:413});
    try{return JSON.parse(raw);}catch{throw Object.assign(Error('Geçersiz JSON.'),{status:400});}
  }
  let value='';for await(const chunk of req){value+=chunk;if(Buffer.byteLength(value)>2_000_000)throw Object.assign(Error('İstek çok büyük.'),{status:413});}
  try{return JSON.parse(value||'{}');}catch{throw Object.assign(Error('Geçersiz JSON.'),{status:400});}
}
async function supabase(path,{method='GET',token,body:payload,headers={}}={}){
  const {url,key}=config();if(!url||!key)throw Object.assign(Error('Supabase henüz bağlı değil.'),{status:503});
  const response=await fetch(url+path,{method,headers:{apikey:key,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{Authorization:`Bearer ${key}`}),...headers},body:payload===undefined?undefined:JSON.stringify(payload)});
  const raw=await response.text();let data;try{data=raw?JSON.parse(raw):null;}catch{data=null;}
  if(!response.ok)throw Object.assign(Error(data?.msg||data?.error_description||data?.message||'Sunucu isteği başarısız.'),{status:response.status===401?401:response.status>=500?502:400});
  return data;
}
async function authenticated(req,res){let session=readSession(req);if(!session)return null;
  if(session.expires_at<Date.now()+60_000){try{const fresh=await supabase('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:session.refresh_token}});session={access_token:fresh.access_token,refresh_token:fresh.refresh_token,expires_at:Date.now()+fresh.expires_in*1000};setSession(req,res,session);}catch(error){if(![400,401].includes(error.status))throw error;setSession(req,res,null);return null;}}
  try{return {session,user:await supabase('/auth/v1/user',{token:session.access_token})};}catch(error){if(![400,401].includes(error.status))throw error;setSession(req,res,null);return null;}
}
export async function handleApi(req,res){
  const path=new URL(req.url,'http://localhost').pathname;
  if(!path.startsWith('/api/'))return false;
  const {url,key}=config();
  try{
    if(req.method!=='GET'){
      const origin=req.headers.origin,host=req.headers.host;
      if((origin&&new URL(origin).host!==host)||req.headers['sec-fetch-site']==='cross-site')throw Object.assign(Error('İstek kaynağı geçersiz.'),{status:403});
      if(req.headers['content-type']?.split(';')[0]!=='application/json')throw Object.assign(Error('JSON gerekli.'),{status:415});
    }
    if(path==='/api/session'&&req.method==='GET'){const auth=await authenticated(req,res);json(res,200,{configured:Boolean(url&&key),user:auth?.user||null});return true;}
    if(path==='/api/login'&&req.method==='POST'){
      const {email,password}=await body(req);const data=await supabase('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
      setSession(req,res,{access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+data.expires_in*1000});json(res,200,{user:data.user});return true;
    }
    if(path==='/api/signup'&&req.method==='POST'){
      const {email,password}=await body(req);const data=await supabase('/auth/v1/signup',{method:'POST',body:{email,password}});
      if(data?.access_token)setSession(req,res,{access_token:data.access_token,refresh_token:data.refresh_token,expires_at:Date.now()+data.expires_in*1000});
      json(res,200,{user:data?.access_token?data.user:null,confirmationRequired:!data?.access_token});return true;
    }
    if(path==='/api/logout'&&req.method==='POST'){
      const session=readSession(req);if(session)try{await supabase('/auth/v1/logout',{method:'POST',token:session.access_token});}catch{}
      setSession(req,res,null);json(res,200,{ok:true});return true;
    }
    if(path==='/api/workspace'&&['GET','PUT'].includes(req.method)){
      const auth=await authenticated(req,res);if(!auth)throw Object.assign(Error('Oturum gerekli.'),{status:401});
      if(req.method==='GET'){
        const rows=await supabase('/rest/v1/workspaces?select=state,revision&limit=1',{token:auth.session.access_token});
        json(res,200,{state:rows[0]?.state?sanitizeWorkspace(rows[0].state):null,revision:rows[0]?.revision||0});return true;
      }
      const input=await body(req),expected=Number(input.revision);
      if(!Number.isSafeInteger(expected)||expected<0)throw Object.assign(Error('Geçersiz kayıt sürümü.'),{status:400});
      let state;
      try{state=sanitizeWorkspace(input.state);}catch(error){throw Object.assign(error,{status:400});}
      const rows=await supabase('/rest/v1/rpc/save_workspace_cas',{method:'POST',token:auth.session.access_token,body:{expected_revision:expected,next_state:state}});
      if(!rows?.length){json(res,409,{error:'Bu çalışma alanı başka bir sekmede değişti. Yenilemeden önce değişikliklerini dışa aktar.'});return true;}
      json(res,200,{revision:rows[0].new_revision});return true;
    }
    json(res,404,{error:'Bulunamadı.'});
  }catch(error){json(res,error.status||500,{error:error.message||'İstek başarısız.'});}
  return true;
}
