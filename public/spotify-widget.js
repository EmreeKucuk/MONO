import { spotifyContent } from './spotify-url.js';
import { escape } from './ui-utils.js';

export function renderSpotify(widget) {
  const content=spotifyContent(widget.spotifyUrl);
  return `<div class="spotify-widget">
    ${content?`<iframe class="spotify-player" title="Spotify ${content.type==='track'?'şarkı':'çalma listesi veya albüm'} oynatıcısı" src="${escape(content.embed)}" height="352" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      <div class="spotify-actions"><a href="${escape(content.url)}" target="_blank" rel="noopener noreferrer">Spotify’da aç ↗</a><button type="button" data-spotify-remove>Bağlantıyı kaldır</button></div>`:
      '<div class="spotify-empty"><strong>Çalışma alanının ritmi.</strong><p>Spotify’da şarkı, albüm veya çalma listesini aç. Paylaş → Bağlantıyı kopyala; buraya yapıştır.</p></div>'}
    <form class="spotify-form" novalidate>
      <label>Spotify bağlantısı<input name="spotifyUrl" type="url" maxlength="2048" aria-label="Spotify şarkı veya çalma listesi bağlantısı" placeholder="https://open.spotify.com/playlist/…" value="${escape(content?.url||'')}" required></label>
      <button type="submit">${content?'Değiştir':'Oynatıcıyı ekle'}</button>
      <p class="spotify-error" role="alert" hidden></p>
    </form>
    <p class="spotify-help">Oynatıcı açılmazsa Spotify’da aç bağlantısını kullan. Tam oynatma Spotify oturumuna ve tarayıcıya bağlıdır.</p>
  </div>`;
}

export function bindSpotify(widget,root,{changed,render}) {
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
  root.querySelector('[data-spotify-remove]')?.addEventListener('click',()=>{
    widget.spotifyUrl='';
    changed();
    render();
    document.querySelector(`.widget[data-id="${widget.id}"] .spotify-form input`)?.focus();
  });
}
