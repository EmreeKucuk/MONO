# MONO · Spotify hesap bağlantısı

MONO hesabına giriş yaptıktan sonra ToolBox → Spotify ekle. Spotify’a bağlan düğmesi Spotify izin ekranını açar. İzin verince MONO’ya dönersin; hesabındaki çalma listeleri ve açık Spotify cihazları yüklenir. Listeni ve cihazını seçip Oynat’a bas. Daha fazla liste düğmesi sonraki sayfayı getirir. Gizli ve takip ettiğin listeler için gereken izinler OAuth ekranında istenir.

Bu tarayıcıda oynat düğmesi Spotify Web Playback SDK ile tarayıcıyı MONO cihazı olarak etkinleştirir. Tarayıcı hazır olduktan sonra liste seçip Oynat’a bas. Duraklat, Devam et, Önceki ve Sonraki kullanılabilir. Telefon veya masaüstü Spotify uygulamasını açıp Listeleri ve cihazları yenile ile oradaki cihazı seçebilirsin. DRM desteği ve Premium gerekir. Tarayıcı otomatik sesi engellerse Oynat’a tekrar bas.

## Vercel kurulumu

Spotify Developer Dashboard → uygulaman → Settings içinde şu Redirect URI’yi ekle:



Vercel → MONO projesi → Settings → Environment Variables içinde Production ortamına şu değerleri ekle:

| Değişken | Değer |
| --- | --- |
| SPOTIFY_CLIENT_ID | Spotify Settings içindeki Client ID |
| SPOTIFY_CLIENT_SECRET | View client secret ile görülen gizli değer |
| SPOTIFY_REDIRECT_URI | |
| SPOTIFY_COOKIE_SECRET | Aşağıdaki komutla üretilen 32 baytlık Base64 anahtar |

Anahtarı kendi terminalinde üret:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Client Secret ve cookie anahtarını kaynak koda veya sohbete yapıştırma. Vercel’in sunucu ortam değişkenlerinde tut. Kod ve ortam değişkenleri güncellendikten sonra Redeploy yap. Supabase’de ek tablo veya SQL değişikliği gerekmez; mevcut MONO girişin çalışıyor olmalı.

Spotify Dashboard → Settings → Users Management → Add new user içinde bağlanacak kişilerin Spotify e-postalarını ekle. Geliştirme modunda en fazla 5 kullanıcı desteklenir. Gerekirse kendi hesabını da izin listesinde kontrol et.

Yerel kullanımda .env dosyasına aynı değişkenleri yaz; SPOTIFY_REDIRECT_URI değerini http://127.0.0.1:4173/api/spotify/callback yap ve bu URI’yi Spotify uygulamasına da ekle. Preview deployment kullanacaksan onun kesin HTTPS adresini ayrıca kaydet ve o ortamın değişkenini güncelle. Redirect URI birebir eşleşmeli; localhost kullanma.

## Güvenlik ve kalıcılık

OAuth authorization code + PKCE + rastgele state kullanılır. OAuth geçiş cookie’si 10 dakika geçerli, HttpOnly ve SameSite=Lax’tır; callback sırasında MONO’nun Strict cookie’sine ihtiyaç duyulmaz. Spotify oturumu MONO kullanıcısına bağlanır, AES-256-GCM ile şifrelenmiş HttpOnly SameSite=Strict cookie’de tutulur. HTTPS yayında Secure kullanılır. Refresh token yalnızca sunucuda işlenir. Web Playback SDK için access token kimliği doğrulanmış, no-store endpoint’inden alınır ve yalnızca bellekte kullanılır; localStorage/sessionStorage veya çalışma alanına kaydedilmez.

Bağlantı bu tarayıcıda hatırlanır; başka tarayıcı/cihazdan MONO’ya girersen Spotify’ı yeniden bağla. MONO’dan çıkış veya Hesap bağlantısını kaldır cookie’leri temizler ve tarayıcı oynatıcısını kapatır. Spotify’ın hesap sayfasından uygulamanın erişimini ayrıca kaldırabilirsin. Cookie anahtarını değiştirmek mevcut Spotify bağlantılarını geçersiz kılar.

Bağlantı tabanlı eski Embed oynatıcısı korunur. Spotify bağlantıları için yalnızca HTTPS open.spotify.com track/playlist/album URL’leri kabul edilir. Hesap listesi, cihaz seçimi ve geçici access token çalışma alanının kayıt biçimini değiştirmez. Spotify’a yönlenmeden önce bekleyen MONO kaydı tamamlanır; kayıt başarısızsa yönlendirme durur.

## Dosyalar ve doğrulama

- server/spotify.mjs: OAuth, encrypted cookie, token yenileme, liste/cihaz proxy ve doğrulanmış oynatma komutları.
- server/api.mjs: oturum doğrulaması, same-origin denetimi, Spotify route ve çıkış temizliği.
- api/spotify/[action].js: Vercel serverless giriş noktası.
- public/spotify-account.js: hesap arayüzü, sayfalama, cihazlar, Web Playback SDK ve bellek içi token kullanımı.
- public/spotify-widget.js, extra-widgets.js ve app.js: widget entegrasyonu ve yönlendirme öncesi kayıt.
- public/styles/spotify.css, public/sw.js, server.mjs ve vercel.json: görünüm, çevrimdışı uygulama kabuğu ve SDK için CSP izinleri.
- tests/spotify-api.test.mjs: state/PKCE, şifreli cookie, iki MONO hesabının izolasyonu, token yenileme, CSRF, hatalar ve komut doğrulaması.
- tests/browser.test.mjs: taklit Spotify SDK ile liste seçimi, harici/tarayıcı cihazı, oynat/duraklat, tokenın depolamaya yazılmaması, bağlantı kaldırma ve mobil reflow.

Gerçek Spotify Client ID/Secret, izin ekranı, Premium ses/DRM oynatımı ve canlı Vercel/Supabase dağıtımı burada doğrulanmadı. Otomatik testlerde bu dış servisler taklit edilir. Yayın sonrası yukarıdaki kurulumla gerçek hesabında test edilmeli.

Kaynaklar:
- https://developer.spotify.com/documentation/web-api/tutorials/code-flow
- https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists
- https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
- https://developer.spotify.com/documentation/web-playback-sdk/reference
- https://developer.spotify.com/documentation/web-api/concepts/quota-modes

## Medya oynatıcı görünümü

Karışık çal düğmesi, seçilen Spotify Connect cihazındaki karışık çalma durumunu açar/kapatır. Başarısız istekte düğme eski durumunu korur ve hata mesajı gösterilir. Yeni bir izin kapsamı veya API anahtarı gerekmez.

Hesap bağlıyken seçili playlistin kapağı, adı ve şarkıları MONO içinde API üzerinden gösterilir. Satıra tıklamak seçilen Connect cihazına playlist context_uri + offset.position ile tam oynatma komutu gönderir. Önce Çalma listesi ve cihaz bölümünden Bu tarayıcıda oynat ile SDK cihazını etkinleştir veya açık bir Spotify cihazı seç. Premium ve tarayıcı DRM desteği gerekir; önizleme ses dosyaları kullanılmaz. Şarkılar 50 öğelik sayfalarla yüklenir, boş/kullanılamayan/yerel kayıtlar sıra numaraları korunarak devre dışı gösterilir. Hatalar ve yeniden deneme panelde görünür. Hızlı liste değişiminde eski yanıtlar atılır.

Güncel GET /playlists/{id}/items endpoint'i yalnızca kullanıcının sahibi veya ortak düzenleyicisi olduğu listelerin içeriğine erişir; diğer listelerde Spotify 403 döndürür ve açıklama gösterilir. Eski /tracks endpoint'ine veya başka bir erişim yoluna geçilmez. Kaynak: https://developer.spotify.com/documentation/web-api/reference/get-playlists-items

Seçim mevcut spotifyUrl alanına kaydedilir; sayfa yeniden açıldığında korunur. Listeyi kaldır düğmesi bu seçimi temizler. Hesap bağlı değilken resmi Embed korunur; kendi oynatıcısını kullanır ve önizlemeyle sınırlı kalabilir. API listesi açıkken playlist Embed gizlenir; şarkı seçimi MONO içinden yapılır. Görüntülenemeyen listeler için Listeyi Spotify’da aç bağlantısı kullanılabilir.

public/spotify-tracks.js geçici liste modelini, güvenli metin/kapak render'ını, sayfalamayı ve yeniden denemeyi yönetir. Otomatik testlerde tek şarkı seçimi, sayfa konumunun korunması, başarısız yüklemeyi yeniden deneme ve zararlı metadata doğrulanır. Gerçek Premium ses oynatımı hâlâ canlı hesapla doğrulanmalıdır.

Ana yüz kapak, şarkı adı, sanatçı/albüm, geçen/toplam süre ve önceki–oynat/duraklat–sonraki kontrollerinden oluşur. Çalma listesi ve cihaz seçimi açılabilir bölümde tutulur. İlerleme çubuğu klavye okları veya sürüklemeyle şarkı konumunu değiştirir. Tarayıcıdaki SDK durum olayları anında işlenir; diğer cihazlar için oynatma bilgisi 15 saniyede bir ve komutlardan sonra yenilenir. Sekme gizliyken sorgu yapılmaz, hata halinde bekleme 30 saniyeye çıkar; widget kaldırıldığında zamanlayıcılar temizlenir.

public/spotify-media.js görünümü ve süre/kapak güncellemelerini yönetir. server/spotify.mjs içindeki state ve seek işlemleri Spotify’dan canlı metaveri ve konum değişimini sağlar. Albüm kapağı yalnızca HTTPS i.scdn.co üzerinden yüklenir. Yerel ve Vercel CSP buna izin verir. Bu görünüm yeni izin kapsamı gerektirmez; mevcut user-read-playback-state ve user-modify-playback-state kullanılır. Eski bağlantı oynatıcısı Bağlantıdan oynat bölümünde korunur.
