import {bindMedia} from './spotify-media.js';
import {spotifyContent} from './spotify-url.js';
export async function spotifyRequest(action,method='GET',data){
  const response=await fetch('/api/spotify/'+action,{method,credentials:'same-origin',headers:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),cache:'no-store'});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(result.error||'Spotify bağlantısı tamamlanamadı. Yeniden dene.');
  return result;
}
const returnUrl=typeof window==='undefined'?null:new URL(window.location.href),oauthResult=returnUrl?.searchParams.get('spotify');
if(['connected','denied','failed'].includes(oauthResult)){
  returnUrl.searchParams.delete('spotify');
  history.replaceState(history.state,'',returnUrl.href);
}
let sdkJob,player,deviceId,readyJob;
function loadSDK(){
  if(window.Spotify?.Player)return Promise.resolve();
  if(sdkJob)return sdkJob;
  sdkJob=new Promise((resolve,reject)=>{
    const script=document.createElement('script'),timeout=setTimeout(()=>{sdkJob=null;script.remove();reject(Error('Spotify oynatıcısı yüklenemedi. Bağlantını kontrol et.'));},20000);
    window.onSpotifyWebPlaybackSDKReady=()=>{clearTimeout(timeout);resolve();};
    script.src='https://sdk.scdn.co/spotify-player.js';
    script.onerror=()=>{clearTimeout(timeout);sdkJob=null;script.remove();reject(Error('Spotify oynatıcısı yüklenemedi.'));};
    document.head.append(script);
  });
  return sdkJob;
}
const announce=message=>window.dispatchEvent(new CustomEvent('mono-spotify-player',{detail:message}));
export function stopSpotifyBrowser(){player?.disconnect();player=null;deviceId=null;readyJob=null;}
export async function activateSpotifyBrowser(){
  if(deviceId){await player.activateElement();return deviceId;}
  if(readyJob)return readyJob;
  readyJob=(async()=>{
    await loadSDK();
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{stopSpotifyBrowser();reject(Error('Tarayıcı oynatıcısı hazır olmadı. Spotify uygulamasındaki bir cihazı seçebilirsin.'));},20000);
      player=new window.Spotify.Player({name:'MONO · Bu tarayıcı',volume:.5,getOAuthToken:callback=>spotifyRequest('token').then(data=>callback(data.access_token)).catch(error=>{clearTimeout(timeout);stopSpotifyBrowser();reject(error);announce(error.message);})});
      player.addListener('ready',({device_id})=>{clearTimeout(timeout);deviceId=device_id;resolve(deviceId);});
      player.addListener('not_ready',()=>{deviceId=null;readyJob=null;announce('Tarayıcı oynatıcısı çevrimdışı. Yeniden etkinleştir.');});
      for(const event of ['initialization_error','authentication_error','account_error'])player.addListener(event,()=>{clearTimeout(timeout);stopSpotifyBrowser();const error=Error('Spotify oynatıcısı başlatılamadı. Premium hesabını, tarayıcı DRM desteğini ve bağlantını kontrol et.');reject(error);announce(error.message);});
      player.addListener('autoplay_failed',()=>announce('Ses için Oynat düğmesine yeniden bas.'));
      player.addListener('player_state_changed',state=>{
        const track=state?.track_window?.current_track;
        window.dispatchEvent(new CustomEvent('mono-spotify-state',{detail:{playing:state?!state.paused:false,position:state?.position||0,duration:state?.duration||0,track:track?{name:track.name,album:track.album?.name,artist:track.artists?.map(artist=>artist.name).join(', '),cover:track.album?.images?.[0]?.url}:null}}));
      });
      player.connect().then(ok=>{if(!ok){clearTimeout(timeout);stopSpotifyBrowser();reject(Error('Spotify oynatıcısı bağlanamadı.'));}}).catch(error=>{clearTimeout(timeout);stopSpotifyBrowser();reject(error);});
    });
  })().catch(error=>{readyJob=null;throw error;});
  return readyJob;
}

const bound=new WeakSet();
export function bindSpotifyAccount(root,beforeConnect=async()=>{},{selectedUrl,onPlaylist=()=>{}}={}){
  const area=root.querySelector('.spotify-account');if(!area||bound.has(area))return;bound.add(area);
  const message=area.querySelector('[data-spotify-message]'),controls=area.querySelector('[data-spotify-controls]'),connect=area.querySelector('[data-spotify-connect]');
  const lists=area.querySelector('[data-spotify-lists]'),devices=area.querySelector('[data-spotify-devices]');
  const media=bindMedia(area);
  const saved=spotifyContent(selectedUrl),playlistArea=area.querySelector('[data-spotify-playlist]');
  let selectedPlaylist=saved?.type==='playlist'?saved.id:'';
  function showPlaylist(id){
    const content=spotifyContent('https://open.spotify.com/playlist/'+id);
    if(!content){playlistArea.hidden=true;playlistArea.querySelector('iframe')?.remove();return;}
    playlistArea.hidden=false;
    let frame=playlistArea.querySelector('iframe');
    if(!frame){frame=document.createElement('iframe');frame.className='spotify-player spotify-playlist-player';frame.title='Spotify çalma listesindeki şarkılar';frame.width='100%';frame.height='360';frame.allow='autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';frame.allowFullscreen=true;frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';playlistArea.querySelector('[data-spotify-playlist-link]').before(frame);}
    if(frame.getAttribute('src')!==content.embed)frame.src=content.embed;
    const option=[...lists.options].find(option=>option.value===id);
    playlistArea.querySelector('[data-spotify-playlist-name]').textContent=option?.textContent||'Seçili çalma listesi';
    playlistArea.querySelector('[data-spotify-playlist-link]').href=content.url;
  }
  let offset=0,nextOffset=null,browserId=null,busy=false,connected=false,polling=false,pollTimer,tickTimer,failures=0;
  const say=text=>{if(area.isConnected)message.textContent=text;};
  const addOption=(select,value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);};
  const job=async action=>{
    if(busy)return;busy=true;area.setAttribute('aria-busy','true');
    area.querySelectorAll('button').forEach(button=>button.disabled=true);
    try{await action();}catch(error){say(error.message);}finally{busy=false;area.removeAttribute('aria-busy');area.querySelectorAll('button').forEach(button=>button.disabled=false);area.querySelectorAll('.spotify-transport button,[data-spotify-shuffle]').forEach(button=>button.disabled=!connected);area.querySelector('[data-spotify-more]').hidden=nextOffset===null;}
  };
  async function loadState(){
    if(!connected||polling||!area.isConnected||document.hidden)return;
    polling=true;
    try{const data=await spotifyRequest('state');if(area.isConnected&&connected){media.update(data);failures=0;}}
    catch(error){if(connected&&failures++===0)say(error.message);}
    finally{polling=false;}
  }
  function watch(){clearTimeout(pollTimer);pollTimer=setTimeout(async()=>{if(!area.isConnected)return;await loadState();watch();},failures?30000:15000);}
  async function loadLists(reset=false){
    if(reset){offset=0;lists.replaceChildren();addOption(lists,'','Çalma listesi seç');}
    const data=await spotifyRequest('playlists?offset='+offset);if(!area.isConnected)return;
    for(const item of data.items)addOption(lists,item.id,item.name+(item.owner?' · '+item.owner:''));
    nextOffset=data.nextOffset;area.querySelector('[data-spotify-more]').hidden=nextOffset===null;
    if(selectedPlaylist){
      if([...lists.options].some(option=>option.value===selectedPlaylist)){lists.value=selectedPlaylist;showPlaylist(selectedPlaylist);}
      else if(nextOffset===null){addOption(lists,selectedPlaylist,'Kaydedilmiş çalma listesi');lists.value=selectedPlaylist;showPlaylist(selectedPlaylist);}
    }
    if(lists.options.length===1)say('Hesabında çalma listesi bulunamadı. Spotify’da bir liste oluştur veya takip et.');
  }
  async function loadDevices(){
    const selected=devices.value,data=await spotifyRequest('devices');if(!area.isConnected)return;
    devices.replaceChildren();addOption(devices,'','Oynatma cihazı seç');
    for(const device of data.devices)addOption(devices,device.id,device.name+(device.active?' · aktif':''));
    if(browserId&&!data.devices.some(d=>d.id===browserId))addOption(devices,browserId,'MONO · Bu tarayıcı');
    if(selected&&[...devices.options].some(option=>option.value===selected))devices.value=selected;
    else if(browserId)devices.value=browserId;
    else devices.value=data.devices.find(device=>device.active)?.id||'';
    if(devices.options.length===1)say('Bu tarayıcıda oynat düğmesini kullan veya telefon/masaüstü Spotify uygulamasını açıp cihazları yenile.');
  }
  connect.onclick=()=>job(async()=>{await beforeConnect();const data=await spotifyRequest('connect','POST',{});const target=new URL(data.url);if(target.origin!=='https://accounts.spotify.com')throw Error('Geçersiz Spotify bağlantısı.');location.assign(target.href);});
  area.querySelector('[data-spotify-refresh]').onclick=()=>job(async()=>{say('Listeler ve cihazlar yükleniyor…');await loadLists(true);await loadDevices();});
  area.querySelector('[data-spotify-more]').onclick=()=>job(async()=>{offset=nextOffset;await loadLists();});
  area.querySelector('[data-spotify-browser]').onclick=()=>job(async()=>{say('Tarayıcı oynatıcısı hazırlanıyor…');browserId=await activateSpotifyBrowser();await loadDevices();devices.value=browserId;say('Bu tarayıcı hazır. Bir çalma listesi seçip Oynat’a bas.');});
  area.querySelector('[data-spotify-disconnect]').onclick=()=>job(async()=>{await spotifyRequest('disconnect','POST',{});connected=false;clearTimeout(pollTimer);clearInterval(tickTimer);stopSpotifyBrowser();media.clear();controls.hidden=true;connect.hidden=false;say('Spotify bağlantısı kaldırıldı.');});
  lists.onchange=()=>{
    const content=spotifyContent('https://open.spotify.com/playlist/'+lists.value);
    selectedPlaylist=content?.id||'';
    media.choose();showPlaylist(selectedPlaylist);
    root.querySelector('.spotify-legacy iframe')?.remove();
    root.querySelector('.spotify-legacy .spotify-actions')?.remove();
    onPlaylist(content?.url||'');
  };
  area.querySelector('[data-spotify-shuffle]').onclick=()=>job(async()=>{
    if(!devices.value)throw Error('Karışık çalma için bir Spotify cihazı seç.');
    const button=area.querySelector('[data-spotify-shuffle]'),enabled=button.getAttribute('aria-pressed')!=='true';
    await spotifyRequest('playback','POST',{action:'shuffle',enabled,deviceId:devices.value});
    button.setAttribute('aria-pressed',String(enabled));say(enabled?'Karışık çalma açık.':'Karışık çalma kapalı.');
  });
  area.querySelectorAll('[data-spotify-command]').forEach(button=>button.onclick=()=>job(async()=>{
    if(!devices.value)throw Error('Bir oynatma cihazı seç veya bu tarayıcıyı etkinleştir.');
    if(button.dataset.spotifyCommand==='play'&&!lists.value)throw Error('Bir çalma listesi seç.');
    if(devices.value===browserId&&browserId)await activateSpotifyBrowser();
    const action=button.dataset.spotifyCommand;
    await spotifyRequest('playback','POST',{action,playlistId:lists.value,deviceId:devices.value});media.commanded(action);say(action==='pause'?'Oynatma duraklatıldı.':'Oynatma komutu gönderildi.');await loadState();
  }));
  area.querySelector('[data-spotify-progress]').onchange=()=>job(async()=>{if(!devices.value)throw Error('Bir Spotify cihazı seç.');await spotifyRequest('playback','POST',{action:'seek',deviceId:devices.value,positionMs:Math.round(Number(area.querySelector('[data-spotify-progress]').value))});await loadState();});
  const onPlayer=event=>say(event.detail);
  const onState=event=>{if(connected&&browserId&&devices.value===browserId)media.update(event.detail);};
  window.addEventListener('mono-spotify-player',onPlayer);
  window.addEventListener('mono-spotify-state',onState);
  const observer=new MutationObserver(()=>{if(!area.isConnected){clearTimeout(pollTimer);clearInterval(tickTimer);window.removeEventListener('mono-spotify-player',onPlayer);window.removeEventListener('mono-spotify-state',onState);observer.disconnect();}});observer.observe(document.querySelector('#app'),{childList:true,subtree:true});
  job(async()=>{
    const status=await spotifyRequest('status');if(!area.isConnected)return;
    if(status.loginRequired){connect.hidden=true;say('Spotify hesabını bağlamak için önce MONO’ya giriş yap.');return;}
    if(!status.configured){connect.hidden=true;say('Spotify bağlantısı için sunucu ayarları henüz yapılmadı.');return;}
    if(!status.connected){say(oauthResult==='denied'?'Spotify izni verilmedi. İstersen yeniden bağlan.':oauthResult==='failed'?'Spotify bağlantısı tamamlanamadı. Sunucu ayarlarını kontrol edip yeniden bağlan.':'Hesabını bağla; çalma listelerin burada görünsün.');return;}
    connected=true;controls.hidden=false;connect.hidden=true;say('Spotify hesabın bağlı.');await loadLists(true);await loadDevices();await loadState();watch();tickTimer=setInterval(()=>{if(!document.hidden)media.tick();},1000);
  });
}
