// The playlist model is transient: only the selected URL is persisted.
export function bindTracks(area,{request,play,setName}){
  const panel=area.querySelector('[data-spotify-tracks]');
  const list=panel.querySelector('ol'),status=panel.querySelector('[role=status]');
  const more=panel.querySelector('[data-tracks-more]'),retry=panel.querySelector('[data-tracks-retry]'),cover=panel.querySelector('img');
  let id='',generation=0,next=null,failedOffset=0,loading=false;
  async function load(offset=0){
    const version=generation,playlist=id;
    loading=true;more.disabled=true;retry.hidden=true;status.textContent='Şarkılar yükleniyor…';
    try{
      const data=await request('playlist?id='+playlist+'&offset='+offset);
      if(version!==generation||!panel.isConnected)return;
      if(offset===0){
        list.replaceChildren();setName(data.name||'Çalma listesi');
        let safeCover=null;
        try{const url=new URL(data.cover);if(url.protocol==='https:'&&url.hostname==='i.scdn.co'&&!url.username&&!url.password&&!url.port)safeCover=url.href;}catch{}
        cover.hidden=!safeCover;if(safeCover)cover.src=safeCover;else cover.removeAttribute('src');
        cover.onerror=()=>{cover.hidden=true;};
      }
      for(const track of data.items||[]){
        const item=document.createElement('li'),button=document.createElement('button');
        button.type='button';button.className='spotify-track-row';button.disabled=!track.playable;
        button.setAttribute('aria-label',track.name+' — '+track.artist+(track.playable?' çal':' kullanılamıyor'));
        const number=document.createElement('span'),text=document.createElement('span'),name=document.createElement('strong'),artist=document.createElement('span'),duration=document.createElement('span');
        number.textContent=String(track.position+1);name.textContent=track.name;artist.textContent=track.artist;
        text.className='spotify-row-text';text.append(name,artist);
        const seconds=Math.floor(Math.max(0,track.duration)/1000);duration.textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
        button.append(number,text,duration);button.onclick=()=>play(playlist,track.position);
        item.append(button);list.append(item);
      }
      next=data.nextOffset;more.hidden=next===null;
      status.textContent=list.children.length?'Şarkıyı seçerek tam oynat.':'Bu listede şarkı bulunamadı.';
    }catch(error){
      if(version!==generation||!panel.isConnected)return;
      failedOffset=offset;status.textContent=error.message;retry.hidden=false;more.hidden=true;
    }finally{if(version===generation){loading=false;more.disabled=false;}}
  }
  more.onclick=()=>{if(!loading&&next!==null)load(next);};
  retry.onclick=()=>{if(!loading)load(failedOffset);};
  return {select(playlist,connected){
    if(id===playlist&&!panel.hidden&&connected)return;
    generation++;id=playlist;next=null;loading=false;panel.hidden=!connected||!id;
    list.replaceChildren();cover.hidden=true;cover.removeAttribute('src');more.hidden=true;retry.hidden=true;
    if(!panel.hidden)load();
  }};
}
