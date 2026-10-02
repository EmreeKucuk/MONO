import { spotifyContent } from './spotify-url.js';
import { escape } from './ui-utils.js';
import {bindSpotifyAccount} from './spotify-account.js';
import {renderMedia} from './spotify-media.js';

export function renderSpotify(widget) {
  const content=spotifyContent(widget.spotifyUrl);
  const playlist=content?.type==='playlist'?content:null;
  return `<div class="spotify-widget">
    <section class="spotify-account" aria-label="Spotify hesabı">
      ${renderMedia()}
      <section class="spotify-playlist" data-spotify-playlist ${playlist?'':'hidden'} aria-label="Seçili çalma listesindeki şarkılar">
        <h3 data-spotify-playlist-name>Seçili çalma listesi</h3>
        <div class="spotify-native-list" data-spotify-tracks hidden>
          <img class="spotify-list-cover" alt="Çalma listesi kapağı" hidden>
          <p role="status"></p><ol aria-label="Çalma listesindeki şarkılar"></ol>
          <button type="button" data-tracks-more hidden>Daha fazla şarkı</button>
          <button type="button" data-tracks-retry hidden>Yeniden dene</button>
        </div>
        ${playlist?`<iframe class="spotify-player spotify-playlist-player" title="Spotify çalma listesindeki şarkılar" src="${escape(playlist.embed)}" width="100%" height="360" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`:''}
        <a data-spotify-playlist-link ${playlist?`href="${escape(playlist.url)}"`:''} target="_blank" rel="noopener noreferrer">Listeyi Spotify’da aç ↗</a>
        <button type="button" data-spotify-remove>Listeyi kaldır</button>
      </section>
      <button type="button" data-spotify-connect>Spotify’a bağlan</button>
      <p data-spotify-message role="status">Spotify bağlantısı kontrol ediliyor…</p>
      <div data-spotify-controls hidden>
        <details class="spotify-settings"><summary>Çalma listesi ve cihaz</summary>
        <label>Çalma listelerin<select data-spotify-lists aria-label="Spotify çalma listelerin"></select></label>
        <button type="button" data-spotify-more hidden>Daha fazla liste</button>
        <label>Oynatma cihazı<select data-spotify-devices aria-label="Spotify oynatma cihazı"></select></label>
        <div class="spotify-buttons"><button type="button" data-spotify-browser>Bu tarayıcıda oynat</button><button type="button" data-spotify-refresh>Listeleri ve cihazları yenile</button></div>
        <button type="button" data-spotify-disconnect>Hesap bağlantısını kaldır</button>
        </details>
      </div>
    </section>
    <details class="spotify-settings spotify-legacy" ${content?'open':''}><summary>Bağlantıdan oynat</summary>
    ${content&&!playlist?`<iframe class="spotify-player" title="Spotify ${content.type==='track'?'şarkı':'çalma listesi veya albüm'} oynatıcısı" src="${escape(content.embed)}" height="352" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      <div class="spotify-actions"><a href="${escape(content.url)}" target="_blank" rel="noopener noreferrer">Spotify’da aç ↗</a><button type="button" data-spotify-remove>Bağlantıyı kaldır</button></div>`:
      '<div class="spotify-empty"><strong>Çalışma alanının ritmi.</strong><p>Spotify’da şarkı, albüm veya çalma listesini aç. Paylaş → Bağlantıyı kopyala; buraya yapıştır.</p></div>'}
    <form class="spotify-form" novalidate>
      <label>Spotify bağlantısı<input name="spotifyUrl" type="url" maxlength="2048" aria-label="Spotify şarkı veya çalma listesi bağlantısı" placeholder="https://open.spotify.com/playlist/…" value="${escape(content?.url||'')}" required></label>
      <button type="submit">${content?'Değiştir':'Oynatıcıyı ekle'}</button>
      <p class="spotify-error" role="alert" hidden></p>
    </form>
    <p class="spotify-help">Oynatıcı açılmazsa Spotify’da aç bağlantısını kullan. Tam oynatma Spotify oturumuna ve tarayıcıya bağlıdır.</p>
    </details>
  </div>`;
}

export function bindSpotify(widget,root,{changed,render,beforeConnect}) {
  bindSpotifyAccount(root,beforeConnect,{selectedUrl:widget.spotifyUrl,onPlaylist:url=>{
    if(widget.spotifyUrl===url)return;
    widget.spotifyUrl=url;
    root.querySelector('.spotify-form input').value=url;
    changed();
  }});
  root.querySelector('.spotify-form').addEventListener('submit',event=>{
    event.preventDefault();
    const input=event.target.elements.spotifyUrl,content=spotifyContent(input.value);
    if(!content) {
      input.setAttribute('aria-invalid','true');
      const error=root.querySelector('.spotify-error');
      error.textContent='Spotify’dan kopyalanmış bir https://open.spotify.com/track/, /playlist/ veya /album/ bağlantısı gir.';
      error.hidden=false;
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    if(widget.spotifyUrl===content.url) {
      root.querySelector('.spotify-error').hidden=true;
      input.value=content.url;
      return;
    }
    widget.spotifyUrl=content.url;
    changed();
    render();
  });
  root.querySelectorAll('[data-spotify-remove]').forEach(button=>button.addEventListener('click',()=>{
    widget.spotifyUrl='';
    changed();
    render();
    document.querySelector(`.widget[data-id="${widget.id}"] .spotify-form input`)?.focus();
  }));
}
