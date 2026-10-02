const glyph={play:'<path d="m9 5 12 7-12 7z"/>',pause:'<path d="M7 5h4v14H7zM15 5h4v14h-4z"/>',previous:'<path d="M5 5h2v14H5zM20 5 9 12l11 7z"/>',next:'<path d="M19 5h2v14h-2zM5 5l11 7-11 7z"/>'};
export const mediaIcon=name=>name==='shuffle'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h3c5 0 7 12 12 12h3M3 18h3c5 0 7-12 12-12h3M18 3l3 3-3 3M18 15l3 3-3 3"/></svg>':`<svg viewBox="0 0 26 24" fill="currentColor" aria-hidden="true">${glyph[name]}</svg>`;
export function renderMedia(){
  return `<div class="spotify-media" aria-label="Spotify medya oynatıcısı">
    <div class="spotify-track"><div class="spotify-artwork"><span aria-hidden="true">♫</span><img data-spotify-cover alt="" hidden></div><div class="spotify-track-text"><span class="spotify-kicker">SPOTIFY</span><strong data-spotify-title>Biraz müzik, biraz odak.</strong><span data-spotify-artist>Çalma listeni seç ve oynat.</span><span data-spotify-album></span></div></div>
    <div class="spotify-timeline"><input type="range" data-spotify-progress aria-label="Şarkının oynatma konumu" min="0" max="1" value="0" step="1000" disabled><div class="spotify-times"><span data-spotify-elapsed>0:00</span><span data-spotify-duration>0:00</span></div></div>
    <div class="spotify-transport"><button type="button" data-spotify-command="previous" aria-label="Önceki şarkı" disabled>${mediaIcon('previous')}</button><button type="button" class="spotify-play" data-spotify-command="play" data-spotify-toggle aria-label="Oynat" disabled>${mediaIcon('play')}</button><button type="button" data-spotify-command="next" aria-label="Sonraki şarkı" disabled>${mediaIcon('next')}</button></div>
    <button type="button" class="spotify-shuffle" data-spotify-shuffle aria-label="Karışık çal" aria-pressed="false" disabled>${mediaIcon('shuffle')}<span>Karışık çal</span></button>
  </div>`;
}
const time=value=>{const seconds=Math.floor(Math.max(0,value)/1000);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
export function bindMedia(area){
  const title=area.querySelector('[data-spotify-title]'),artist=area.querySelector('[data-spotify-artist]'),album=area.querySelector('[data-spotify-album]'),cover=area.querySelector('[data-spotify-cover]'),toggle=area.querySelector('[data-spotify-toggle]'),range=area.querySelector('[data-spotify-progress]');
  let state={playing:false,position:0,duration:0,track:null},sampled=Date.now(),choosing=false;
  function tick(){
    const position=Math.min(state.duration,state.position+(state.playing?Date.now()-sampled:0));
    if(document.activeElement!==range)range.value=String(position);
    range.style.setProperty('--progress',state.duration?`${position/state.duration*100}%`:'0%');
    range.setAttribute('aria-valuetext',`${time(position)} / ${time(state.duration)}`);
    area.querySelector('[data-spotify-elapsed]').textContent=time(position);area.querySelector('[data-spotify-duration]').textContent=time(state.duration);
  }
  function update(next){
    state={...next,position:Math.max(0,Number(next.position)||0),duration:Math.max(0,Number(next.duration)||0)};sampled=Date.now();
    title.textContent=state.track?.name||'Biraz müzik, biraz odak.';artist.textContent=state.track?.artist||'Çalma listeni seç ve oynat.';album.textContent=state.track?.album||'';
    let url=null;try{const parsed=new URL(state.track?.cover);if(parsed.protocol==='https:'&&parsed.hostname==='i.scdn.co'&&!parsed.username&&!parsed.password)url=parsed.href;}catch{}
    cover.hidden=!url;if(url){if(cover.getAttribute('src')!==url)cover.src=url;}else cover.removeAttribute('src');
    cover.onerror=()=>{cover.hidden=true;};
    if(typeof next.shuffle==='boolean')area.querySelector('[data-spotify-shuffle]').setAttribute('aria-pressed',String(next.shuffle));
    range.max=String(Math.max(1,state.duration));range.disabled=!state.duration;
    toggle.dataset.spotifyCommand=choosing||!state.track?'play':state.playing?'pause':'resume';
    toggle.setAttribute('aria-label',toggle.dataset.spotifyCommand==='pause'?'Duraklat':'Oynat');toggle.innerHTML=mediaIcon(toggle.dataset.spotifyCommand==='pause'?'pause':'play');tick();
  }
  range.oninput=()=>{area.querySelector('[data-spotify-elapsed]').textContent=time(Number(range.value));range.style.setProperty('--progress',`${Number(range.value)/Math.max(1,state.duration)*100}%`);};
  return {update,tick,choose:()=>{choosing=true;update(state);},commanded:action=>{if(action==='play'||action==='resume'){choosing=false;update({...state,playing:true});}if(action==='pause')update({...state,playing:false,position:Math.min(state.duration,state.position+(state.playing?Date.now()-sampled:0))});},clear:()=>{choosing=false;update({playing:false,position:0,duration:0,track:null});}};
}
