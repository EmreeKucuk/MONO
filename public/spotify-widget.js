import { spotifyContent } from './spotify-url.js';
import { escape } from './ui-utils.js';
import {bindSpotifyAccount} from './spotify-account.js';
import {renderMedia} from './spotify-media.js';
import {bindSpotifyStages} from './spotify-stages.js';

export function renderSpotify(widget) {
  const content=spotifyContent(widget.spotifyUrl);
  const playlist=content?.type==='playlist'?content:null;
  return `<div class="spotify-widget">
    <section class="spotify-account" aria-label="Spotify hesabı">
      <section class="spotify-stage" data-spotify-stage aria-label="Çalma listesi seçimi">
      <div class="spotify-picker" data-spotify-controls hidden>
        <label class="spotify-playlist-select">Çalma listesi<select data-spotify-lists aria-label="Spotify çalma listelerin"></select></label>
        <button type="button" data-spotify-more hidden>Daha fazla liste</button>
        <details class="spotify-settings"><summary>Oynatma cihazı ve hesap</summary>
          <label>Oynatma cihazı<select data-spotify-devices aria-label="Spotify oynatma cihazı"></select></label>
          <div class="spotify-buttons"><button type="button" data-spotify-browser>Bu tarayıcıda oynat</button><button type="button" data-spotify-refresh>Listeleri ve cihazları yenile</button></div>
          <button type="button" data-spotify-disconnect>Hesap bağlantısını kaldır</button>
        </details>
      </div>
      <button type="button" data-spotify-connect>Spotify’a bağlan</button>
      <p data-spotify-message role="status">Spotify bağlantısı kontrol ediliyor…</p>
      </section>
      <section class="spotify-stage" data-spotify-stage aria-label="Medya oynatıcı">
      ${renderMedia()}
      </section>
      <section class="spotify-stage spotify-stage-tracks" data-spotify-stage aria-label="Çalma listesi şarkıları">
      <p class="spotify-stage-empty">Şarkıları görmek için ilk aşamadan bir çalma listesi seç.</p>
      <section class="spotify-playlist" data-spotify-playlist ${playlist?'':'hidden'} aria-label="Seçili çalma listesindeki şarkılar">
        <h3 data-spotify-playlist-name>Seçili çalma listesi</h3>
        <div class="spotify-native-list" data-spotify-tracks hidden>
          <img class="spotify-list-cover" alt="Çalma listesi kapağı" hidden>
          <p role="status"></p><ol class="spotify-tracks-scroll" tabindex="0" aria-label="Çalma listesindeki şarkılar"></ol>
          <button type="button" data-tracks-more hidden>Daha fazla şarkı</button>
          <button type="button" data-tracks-retry hidden>Yeniden dene</button>
        </div>
        ${playlist?`<iframe class="spotify-player spotify-playlist-player" title="Spotify çalma listesindeki şarkılar" src="${escape(playlist.embed)}" width="100%" height="360" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`:''}
        <a data-spotify-playlist-link ${playlist?`href="${escape(playlist.url)}"`:''} target="_blank" rel="noopener noreferrer">Listeyi Spotify’da aç ↗</a>
        <button type="button" data-spotify-remove>Listeyi kaldır</button>
      </section>
      </section>
    </section>
    <nav class="spotify-stage-nav" aria-label="Spotify aşamaları" hidden>
      <button type="button" data-stage-go="0" aria-label="Çalma listesi seçimi" aria-pressed="true">1</button>
      <button type="button" data-stage-go="1" aria-label="Medya oynatıcı" aria-pressed="false">2</button>
      <button type="button" data-stage-go="2" aria-label="Çalma listesi şarkıları" aria-pressed="false">3</button>
    </nav>
    ${content&&!playlist?`<iframe class="spotify-player" title="Spotify kayıtlı şarkı veya albüm oynatıcısı" src="${escape(content.embed)}" height="352" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`:''}
  </div>`;
}

export function bindSpotify(widget,root,{changed,render,beforeConnect}) {
  bindSpotifyStages(root);
  bindSpotifyAccount(root,beforeConnect,{selectedUrl:widget.spotifyUrl,onPlaylist:url=>{
    if(widget.spotifyUrl===url)return;
    widget.spotifyUrl=url;
    changed();
  }});
  root.querySelectorAll('[data-spotify-remove]').forEach(button=>button.addEventListener('click',()=>{
    widget.spotifyUrl='';
    changed();
    render();
    const card=[...document.querySelectorAll('.widget')].find(card=>card.dataset.id===widget.id);
    (card?.querySelector('[data-spotify-lists]')||card?.querySelector('.widget-head'))?.focus();
  }));
}
