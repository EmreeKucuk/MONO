# MONO Spotify

ToolBox veya Widget Ara üzerinden Spotify ekle. Spotify uygulamasında şarkı, çalma listesi veya albüm için Paylaş → Bağlantıyı kopyala seç; widget'a yapıştır ve Oynatıcıyı ekle'ye bas. Yalnızca HTTPS open.spotify.com bağlantıları kabul edilir. Bağlantı çalışma alanıyla kaydedilir. Widget boyutunu büyüterek oynatıcıya daha fazla alan ayırabilirsin.

Bu sürüm Spotify'ın resmî Embed oynatıcısını kullanır; Client ID, Client Secret veya Spotify OAuth hesabı gerektirmez. Spotify içeriğinin ve tam oynatmanın erişilebilirliği Spotify oturumuna, içeriğe ve tarayıcıya bağlıdır. Spotify'da aç bağlantısı alternatif olarak kullanılabilir. Çevrimdışıyken oynatıcı müzik yükleyemez; kaydedilmiş bağlantı korunur.

## Daha sonra hesabı bağlamak için geliştirici uygulaması

1. https://developer.spotify.com/dashboard adresine Premium hesabınla gir ve Create app seç.
2. Ad: MONO. Açıklama: Kişisel çalışma alanı. API seçimi varsa Web API ve Web Playback SDK seç.
3. Gelecekteki OAuth bağlantısı için Redirect URI: https://mono-rho-eight.vercel.app/api/spotify/callback. Yerel adres: http://127.0.0.1:4173/api/spotify/callback. Bu callback uçları bu sürümde uygulanmış değildir; uygulama oluşturmaya hazırlanmak için önerilir. Yayın adresin değişirse URI'yi de değiştir. Spotify localhost yerine açık loopback IP ister.
4. Settings içindeki Client ID'yi al. View client secret gizli anahtarı gösterir. Client Secret'ı kaynak koda veya tarayıcıya koyma; gelecekte sunucu ortam değişkeni olarak saklanmalı. Mevcut Embed sürümü bu değişkenleri okumaz.
5. Birkaç kişi için hesap bağlantısı kurulduğunda Settings → Users Management → Add new user ile kullanıcıların Spotify e-postalarını izin listesine ekle. Geliştirme modunda en fazla 5 kimliği doğrulanmış kullanıcı desteklenir.

Kaynaklar:
- https://developer.spotify.com/documentation/web-api/tutorials/getting-started
- https://developer.spotify.com/documentation/web-api/concepts/redirect_uri
- https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- https://developer.spotify.com/documentation/embeds/tutorials/creating-an-embed

## Doğrulama

Otomatik testler bağlantı doğrulamasını, zararlı kayıtlı URL'lerin reddini, çalışma alanında bağlantı kalıcılığını, oynatıcı DOM'unun grid güncellemelerinde korunmasını, klavye kısayolunu, 320 px reflow'u ve yerel/Vercel CSP ayarlarını kapsar. Tarayıcı testinde Spotify ve Supabase yanıtları taklit edilir. Gerçek Spotify Premium oturumu ile ses oynatımı, gerçek Supabase hesabındaki kayıt ve canlı Vercel dağıtımı bu turda doğrulanmadı.

Yeni widget modülleri: public/spotify-url.js, public/spotify-widget.js, public/styles/spotify.css. Entegrasyon: public/extra-widgets.js, public/state-schema.js, public/widget-shortcuts.js, public/ui-utils.js, public/style.css ve public/sw.js. Oynatıcı taşımalarında gereksiz yeniden yüklemeyi önleme: public/grid-view.js. Frame izni: server.mjs ve vercel.json. Testler: tests/spotify.test.mjs ve tests/browser.test.mjs.
