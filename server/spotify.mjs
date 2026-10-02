import {createCipheriv,createDecipheriv,createHash,randomBytes,timingSafeEqual} from 'node:crypto';
const scopes='playlist-read-private playlist-read-collaborative user-read-playback-state user-modify-playback-state streaming user-read-email user-read-private';
const fail=(status,message)=>Object.assign(Error(message),{status});
const spotifyId=id=>typeof id==='string'&&/^[a-zA-Z0-9]{22}$/.test(id);
function artwork(value){try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='i.scdn.co'&&!url.username&&!url.password&&!url.port?url.href:null;}catch{return null;}}
export function spotifyConfig(){
  const clientId=process.env.SPOTIFY_CLIENT_ID||'',clientSecret=process.env.SPOTIFY_CLIENT_SECRET||'',redirectUri=process.env.SPOTIFY_REDIRECT_URI||'',key=Buffer.from(process.env.SPOTIFY_COOKIE_SECRET||'','base64');
  let valid=false;
  try{const u=new URL(redirectUri);valid=u.pathname==='/api/spotify/callback'&&!u.username&&!u.password&&(u.protocol==='https:'||(u.protocol==='http:'&&u.hostname==='127.0.0.1'));}catch{}
  return {clientId,clientSecret,redirectUri,key,configured:Boolean(clientId&&clientSecret&&key.length===32&&valid)};
}
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(p=>p.trim().split(/=(.*)/s).slice(0,2)));
function seal(value,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');}
function open(value,key){try{if(!value||value.length>6000)return null;const b=Buffer.from(value,'base64url'),cipher=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));cipher.setAuthTag(b.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString());}catch{return null;}}
function cookie(req,res,name,value,oauth=false){
  const previous=res.getHeader('Set-Cookie')||[],secure=req.headers['x-forwarded-proto']==='https'||req.socket?.encrypted;
  res.setHeader('Set-Cookie',[...(Array.isArray(previous)?previous:[previous]),`${name}=${value}; Path=/; HttpOnly; SameSite=${oauth?'Lax':'Strict'}${secure?'; Secure':''}; Max-Age=${value?(oauth?600:2592000):0}`]);
}
export function clearSpotify(req,res){cookie(req,res,'mono_spotify','');cookie(req,res,'mono_spotify_oauth','',true);}
async function token(config,parameters){
  const response=await fetch('https://accounts.spotify.com/api/token',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Basic '+Buffer.from(config.clientId+':'+config.clientSecret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(parameters)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.access_token)throw fail(response.status>=500?502:401,'Spotify bağlantısı yenilenemedi. Hesabını yeniden bağla.');
  return data;
}
async function session(req,res,config,user){
  let value=open(cookies(req).mono_spotify,config.key);
  if(!value||value.uid!==user.id||!value.refresh||!value.access)throw fail(401,'Spotify hesabını bağla.');
  if(value.expires<Date.now()+60000){const fresh=await token(config,{grant_type:'refresh_token',refresh_token:value.refresh});value={...value,access:fresh.access_token,refresh:fresh.refresh_token||value.refresh,expires:Date.now()+fresh.expires_in*1000};cookie(req,res,'mono_spotify',seal(value,config.key));}
  return value;
}
async function api(value,path,method='GET',body){
  const response=await fetch('https://api.spotify.com/v1'+path,{method,signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${value.access}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!response.ok){const messages={401:'Spotify oturumu sona erdi. Yeniden bağlan.',403:'Spotify izin vermedi. Premium hesabını ve uygulamanın kullanıcı izin listesini kontrol et.',404:'Spotify cihazı bulunamadı. Spotify uygulamasını aç veya bu tarayıcıyı etkinleştir.',429:'Spotify istek sınırına ulaşıldı. Bir süre sonra yeniden dene.'};throw fail(response.status>=500?502:response.status,messages[response.status]||'Spotify isteği tamamlanamadı. Yeniden dene.');}
  return response.status===204?null:response.json();
}
const redirect=(res,result)=>{res.writeHead(303,{Location:'/?spotify='+result,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end();};
export async function handleSpotify(req,res,{authenticated,body,json}){
  const url=new URL(req.url,'http://localhost'),action=url.pathname.slice('/api/spotify/'.length),config=spotifyConfig();
  if(action==='callback'&&req.method==='GET'){
    try{
      if(!config.configured)throw Error();
      const pending=open(cookies(req).mono_spotify_oauth,config.key),state=url.searchParams.get('state')||'';
      cookie(req,res,'mono_spotify_oauth','',true);
      if(!pending||pending.expires<Date.now()||Buffer.byteLength(state)!==Buffer.byteLength(pending.state)||!timingSafeEqual(Buffer.from(state),Buffer.from(pending.state)))throw Error();
      if(url.searchParams.has('error')){redirect(res,'denied');return;}
      const code=url.searchParams.get('code');if(!code||code.length>2000)throw Error();
      const fresh=await token(config,{grant_type:'authorization_code',code,redirect_uri:config.redirectUri,code_verifier:pending.verifier});
      if(!fresh.refresh_token||typeof fresh.expires_in!=='number')throw Error();
      cookie(req,res,'mono_spotify',seal({uid:pending.uid,access:fresh.access_token,refresh:fresh.refresh_token,expires:Date.now()+fresh.expires_in*1000},config.key));redirect(res,'connected');
    }catch{redirect(res,'failed');}
    return;
  }
  const auth=await authenticated(req,res);
  if(action==='status'&&req.method==='GET'){const value=config.configured?open(cookies(req).mono_spotify,config.key):null;json(res,200,{configured:config.configured,loginRequired:!auth,connected:Boolean(auth&&value?.uid===auth.user.id&&value?.refresh)});return;}
  if(!auth)throw fail(401,'Önce MONO hesabına giriş yap.');
  if(action==='disconnect'&&req.method==='POST'){clearSpotify(req,res);json(res,200,{ok:true});return;}
  if(!config.configured)throw fail(503,'Spotify sunucu ayarları henüz yapılmadı.');
  if(action==='connect'&&req.method==='POST'){
    const state=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
    cookie(req,res,'mono_spotify_oauth',seal({uid:auth.user.id,state,verifier,expires:Date.now()+600000},config.key),true);
    const target=new URL('https://accounts.spotify.com/authorize');target.search=new URLSearchParams({response_type:'code',client_id:config.clientId,redirect_uri:config.redirectUri,scope:scopes,state,code_challenge_method:'S256',code_challenge:createHash('sha256').update(verifier).digest('base64url')}).toString();json(res,200,{url:target.href});return;
  }
  const value=await session(req,res,config,auth.user);
  if(action==='token'&&req.method==='GET'){json(res,200,{access_token:value.access});return;}
  if(action==='state'&&req.method==='GET'){
    const data=await api(value,'/me/player'),track=data?.item;
    let cover=null;
    try{const image=new URL(track?.album?.images?.[0]?.url);if(image.protocol==='https:'&&image.hostname==='i.scdn.co'&&!image.username&&!image.password)cover=image.href;}catch{}
    json(res,200,{playing:data?.is_playing===true,shuffle:data?.shuffle_state===true,position:Math.max(0,Number(data?.progress_ms)||0),duration:Math.max(0,Number(track?.duration_ms)||0),track:track?{name:String(track.name||'').slice(0,300),album:String(track.album?.name||'').slice(0,300),artist:(track.artists||[]).map(artist=>String(artist.name||'')).join(', ').slice(0,300),cover}:null});return;
  }
  if(action==='playlists'&&req.method==='GET'){
    const offset=Number(url.searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>100000)throw fail(400,'Geçersiz sayfa.');
    const data=await api(value,`/me/playlists?limit=50&offset=${offset}`);
    json(res,200,{items:(data.items||[]).filter(item=>/^[a-zA-Z0-9]{22}$/.test(item?.id)).map(item=>({id:item.id,name:String(item.name||'Çalma listesi').slice(0,300),owner:String(item.owner?.display_name||'').slice(0,100)})),nextOffset:data.next&&offset+50<=100000?offset+50:null});return;
  }
  if(action==='playlist'&&req.method==='GET'){
    const id=url.searchParams.get('id'),offset=Number(url.searchParams.get('offset')||0);
    if(!spotifyId(id)||!Number.isSafeInteger(offset)||offset<0||offset>100000)throw fail(400,'Geçersiz çalma listesi veya sayfa.');
    let data,meta;
    try{[data,meta]=await Promise.all([api(value,`/playlists/${id}/items?limit=50&offset=${offset}`),offset===0?api(value,`/playlists/${id}`):null]);}
    catch(error){if(error.status===403)throw fail(403,'Spotify bu listenin şarkılarına erişim vermedi. Kendi oluşturduğun veya ortak düzenlediğin bir liste seç.');throw error;}
    json(res,200,{name:meta?String(meta.name||'Çalma listesi').slice(0,300):null,cover:artwork(meta?.images?.[0]?.url),items:(data.items||[]).slice(0,50).map((entry,index)=>{
      const track=entry?.item||entry?.track;
      return {position:offset+index,name:String(track?.name||'Kullanılamayan şarkı').slice(0,300),artist:(track?.artists||[]).map(a=>String(a.name||'')).join(', ').slice(0,300),duration:Math.max(0,Number(track?.duration_ms)||0),playable:Boolean(spotifyId(track?.id)&&track?.type==='track'&&!entry?.is_local&&track?.is_playable!==false)};
    }),nextOffset:data.next&&offset+50<=100000?offset+50:null});return;
  }
  if(action==='devices'&&req.method==='GET'){const data=await api(value,'/me/player/devices');json(res,200,{devices:(data.devices||[]).filter(d=>!d.is_restricted&&typeof d.id==='string').map(d=>({id:d.id,name:String(d.name).slice(0,100),active:d.is_active}))});return;}
  if(action==='playback'&&req.method==='POST'){
    const input=await body(req),device=input.deviceId;
    if(typeof device!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(device))throw fail(400,'Bir Spotify cihazı seç.');
    const suffix='?device_id='+encodeURIComponent(device);
    if(input.action==='play'){
      if(!spotifyId(input.playlistId))throw fail(400,'Bir çalma listesi seç.');
      if(input.position!==undefined&&(!Number.isSafeInteger(input.position)||input.position<0||input.position>100000))throw fail(400,'Geçersiz şarkı konumu.');
      await api(value,'/me/player/play'+suffix,'PUT',{context_uri:'spotify:playlist:'+input.playlistId,...(input.position===undefined?{}:{offset:{position:input.position},position_ms:0})});
    }
    else if(input.action==='shuffle'){
      if(typeof input.enabled!=='boolean')throw fail(400,'Karışık çalma durumu geçersiz.');
      await api(value,'/me/player/shuffle'+suffix+'&state='+input.enabled,'PUT');
    }
    else if(input.action==='seek'){
      if(!Number.isSafeInteger(input.positionMs)||input.positionMs<0||input.positionMs>86400000)throw fail(400,'Geçersiz oynatma konumu.');
      await api(value,'/me/player/seek'+suffix+'&position_ms='+input.positionMs,'PUT');
    }
    else if(['pause','resume'].includes(input.action))await api(value,'/me/player/'+(input.action==='pause'?'pause':'play')+suffix,'PUT',{});
    else if(['next','previous'].includes(input.action))await api(value,'/me/player/'+input.action+suffix,'POST');
    else throw fail(400,'Geçersiz oynatma komutu.');
    json(res,200,{ok:true});return;
  }
  json(res,404,{error:'Spotify işlemi bulunamadı.'});
}
