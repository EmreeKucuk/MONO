# MONO 1.2.4 · Masaüstü ve yeni dashboard araçları

MONO artık Electron ile gerçek Windows uygulaması olarak paketlenebilir. Web/PWA sürümü de çalışır. Uygulama mevcut HTTPS yayınını açar; Node ve dosya sistemi web sayfasına açılmaz. Yalnızca doğrulanan ana pencereye dar bir preload/IPC köprüsü verilir. Spotify bağlantısı ve Supabase hesabı aynı BFF üzerinden devam eder.

## Deneme ve kurulum

Repo klasöründe Node 22.12+ ile:

```powershell
npm ci
npm run desktop:dev
```

Bu komut yerel BFF'yi ve masaüstü uygulamasını birlikte başlatır. `.env` sunucuda kullanılır; kurulum dosyasına girmez.

Üretim için önce web ve API değişikliklerini birlikte Vercel'e yayınla. Uygulamanın varsayılan adresi `https://mono-rho-eight.vercel.app`. Başka bir yayın kullanıyorsan `desktop/main.mjs` içindeki varsayılanı değiştirip tekrar paketle. Geliştirmede `MONO_APP_URL` ortam değişkeni de kullanılabilir; yalnızca HTTPS veya `http://127.0.0.1` kabul edilir.

```powershell
npm run desktop:build
```

`release/MONO-Setup-1.2.4.exe` kullanıcıya özel Windows x64 kurulum dosyasıdır. Ücretli imzalama sertifikası kullanılmadı. Pencereyi kapatmak sistem tepsisine gizler; tepsideki Çıkış uygulamayı tamamen kapatır. Hatırlatmalar uygulama tepside çalışırken devam eder. Uygulama tamamen kapalıyken, bilgisayar kapalıyken veya uyku halindeyken bildirim garantisi yoktur; yeniden çalışınca gecikmiş hatırlatmaları kontrol eder. Web arayüzü Vercel yayınından yüklenir. 1.2.4 ve sonrası yerel Electron güncellemelerini GitHub Releases üzerinden alır; ilk geçişte 1.2.4 kurulumunu elle yükle.

## Özellikler

- **Clipboard:** ToolBox’tan eklenir. Masaüstü uygulaması çalışırken otomatik metin yakalama her zaman açıktır; pencere tepsiye gizlendiğinde de devam eder. Widget yalnızca geçmişi gösterir; otomatik yakalama seçeneği, Panodan al, toplu temizleme ve arama alanı yoktur. En fazla 100 kayıt; kayıt bazında sabitleme, kopyalama ve silme vardır. Geçmiş Supabase çalışma alanına girmez. Windows `safeStorage` ile cihazda şifrelenir ve atomik dosya değiştirme ile saklanır. Şifreleme veya kayıt başarısızsa durum gösterilir ve düz metin dosyası yazılmaz. Web/PWA başka uygulamalardaki panoyu otomatik okuyamaz; bunun için masaüstü sürümü gerekir. Resim/dosya clipboard içeriği desteklenmez.
- **Notlar:** Eski varsayılan Aklımdakiler adı Notlar'a geçer; özel isimler korunur. Sayfa bazında “Şifre koy / Kilidi aç / Kilitle / Şifreyi kaldır” kontrolleri vardır. AES-256-GCM, her kayıt için rastgele IV, sayfa/widget kimliğine bağlı doğrulama, PBKDF2-SHA256 600.000 tur ve ayrı salt kullanılır. Şifre/key buluta veya depoya yazılmaz; açık içerik yalnızca bellekte/editör DOM'unda kalır. Kilitleme undo geçmişini ve aynı widget'ın açık editör kopyalarını temizler. Yeni kayıtlar, yerel taslak ve bu istemcinin güncellenen snapshot'ı şifreli içerik taşır. Sayfa başlıkları ve zaman bilgileri şifreli değildir. Önceden indirilmiş yedekler, diğer cihaz/sekme kopyaları ve Supabase'in geçmiş yedekleri geriye dönük şifrelenmez. Şifre unutulursa kurtarma yoktur.
- **Zone:** Working Zone, Study Zone ve özel profiller; dakika sınırı veya süresiz çalışma. Hatırlatma/odak/Zone bildirimleri için MONO içi istisnalar seçilir. Susturulan hatırlatmalar Zone sonrası kontrol edilir. Diğer uygulamaların bildirimlerini okumak, uygulama listesi oluşturmak ve otomatik susturmak **bu sürümde uygulanmadı**. Bunun için Windows manifest yetkisi ve kullanıcı izni olan ayrı native/MSIX bildirim dinleyicisi gerekir; bildirimi sonradan kaldırmak da ses/bannerı önceden engellemekle aynı şey değildir. Panel Windows bildirim ayarlarını açar. [Microsoft bildirim dinleyicisi](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/app-notifications/notification-listener).
- **Hızlı yakalama:** Topbar veya Ctrl+Shift+Space. `yarın 14:30 toplantı`, `pazartesi kitap oku`, `05.10.2026 saat 14 teslim`, `20 dakika sonra su iç hatırlat` gibi metinler çözümlenir. Tarih/açıklama/tür önizlemesi düzenlenerek onaylanır; takvime veya hatırlatmalara yazılır. Saat verilmezse 09:00 önerilir. Bu yerel, kurallı tarih çözümlemesidir; belirsiz ifadeleri onaylamadan otomatik kaydetmez.
- **Hava durumu:** Topbar'da şehir seçimi, sıcaklık ve durum; 30 dakikada bir yenileme. Konum izni istenmez. Anahtarsız [Open-Meteo](https://open-meteo.com/en/docs) kullanılır; ücretsiz kişisel kullanım içindir. Şehir bu cihazın tercihi olarak tutulur. Vercel `/api/weather` sabit upstream'lere erişir, şehir girdisini sınırlar ve önbellekler.
- **Hatırlatmalar:** Tarih/saat ekleme, tamamlama, silme ve bildirim izni. Web bildirimleri MONO açıkken, native bildirimler uygulama çalışırken verilir. Zone politikasına uyar. Gösterilen bildirim kimlikleri cihazda tutulur.

Schema v3 eski kayıtları koruyarak ek alanları doğrular. Masa düzenleri aynı JSONB kaydında kalır; yeni Supabase tablosu/SQL gerekmez. Şifreli sayfanın bozuk veya belirsiz kimliği reddedilir; içerik sessizce silinmez. Frontend/API birlikte yayınlanmalıdır.

Spotify'ın Web Playback SDK'sı Widevine/DRM gerektirir. Standart Electron'da yerel tarayıcı oynatıcısı garanti edilmez; Spotify masaüstü/telefon cihazını seçerek Connect üzerinden oynatma mevcut akıştır. Canlı Premium hesapla bu sürüm burada doğrulanmadı.

## Doğrulama

```powershell
npm test
npm run build
npm run test:desktop
```

`npm test`: tarayıcı, veri/şema, kripto, Zone politikası, tarih çözümleme ve mevcut regresyon testleri. `test:desktop`: Windows'ta Electron'u açar, gerçek clipboard'ı geçici test metniyle kullanır ve sonunda önceki pano metnini geri getirir; otomatik yakalama, şifreli dosya, IPC, klavye odağı ve Zone kontrolünü doğrular. Masaüstü testi varsayılan web testlerinden ayrıdır; başarısız olduğunda sıfır olmayan çıkış kodu verir.

Bu geliştirme oturumunun Windows sandbox'ında Electron başlatma testi ACL/AppContainer ve DPAPI hatalarıyla engellendi. Native clipboard yakalama, Windows toast teslimi ve gerçek kullanıcı profilindeki şifreli disk kaydı normal Windows oturumunda doğrulanmalıdır; doğrulanmış gibi raporlanmaz. Electron sandbox/contextIsolation/webSecurity kapatılmadı. Canlı Supabase hesaplarıyla ve canlı Spotify hesabıyla doğrulama yapılmadı. Open-Meteo'dan Ankara için gerçek yanıt alınabildi.

## 1.2.1 Clipboard düzeltmesi

Electron 44 readText/writeText işlemleri Promise döndürür. Native yakalama, kopyalama ve temizleme artık bu işlemleri bekler. Yavaş polling istekleri birleşir; okuma/yazma/temizleme sıralanır. Temizleme tamamlanınca aynı pano metni tekrar eklenmez. Otomatik okuma hataları ana işlemi çökertmez; arayüzde durum gösterilir ve sonraki poll yeniden dener. tests/desktop-clipboard.test.mjs asenkron başarı, reddedilen/geçersiz okuma, yazma hatası, yavaş okuma, opt-out ve temizleme yarışlarını Electron bağımlılığına sınanabilir adapter üzerinden doğrular. Bu düzeltme için Vercel yayını gerekmez; masaüstü paketi güncellenmelidir.

## 1.2.2 Not sayfası PIN

Yeni sayfa koruması tam olarak dört ASCII rakam ister; baştaki sıfırlar korunur. Onay girişi, PIN değiştirme ve kilit açma sayısal klavye isteğiyle gösterilir. Eski şifreli sayfalar önce eski şifreleriyle açılır, sonra PIN değiştir kontrolüyle aynı içerik yeniden şifrelenir; eski veriler otomatik olarak bilinmeyen bir PIN’e çevrilmez. Beş hatalı denemede bu açık uygulama oturumunda 30 saniyelik bekleme vardır; bu bir cihaz/donanım güvenlik kilidi değildir. Dört haneli PIN uzun şifreye göre daha az koruma sağlar; kayıtlı şifreli veri üzerinde dışarıdan deneme veya uygulamayı yeniden başlatma bu UI beklemesini aşabilir. PBKDF2 ve AES-GCM şifrelemesi korunur. PIN arayüzü ve credential alanının korunması için web ve API birlikte Vercel’e yeniden yayınlanmalıdır. Masaüstü başlığı ve preload appVersion bilgisi çalışan 1.2.2 sürümünü gösterir.


## 1.2.3 Sade clipboard

Eski kapalı yakalama tercihi başlangıçta açık olarak okunur; geçmiş korunur. Yeni web arayüzü eski masaüstü sürümünde de widget açıldığında yakalamayı etkinleştirir. Uygulama açılır açılmaz sürekli yakalama için 1.2.3 kurulumunu yükle; sade arayüz için Vercel web yayınını yenile. Tarayıcı testinde native köprü taklidiyle otomatik etkinleşme, canlı güncelleme, güvenli metin gösterimi ve klavye odağı doğrulanır.


## 1.2.4 GitHub Releases ve otomatik güncelleme

Sabit güncelleme kaynağı herkese açık `EmreeKucuk/mono` reposudur. Uygulamaya GitHub tokenı gömülmez. `electron-updater` başlangıçta ve dört saatte bir kararlı sürümleri kontrol eder, yenisini indirir. Sol panelde durum, yüzde, tekrar deneme ve Güncelle ve yeniden başlat butonu vardır. Düşürme/prerelease/web installer kapalıdır; çıkışta otomatik kurulum kapalıdır. Yeniden başlatma yalnızca açık kullanıcı eylemiyle olur.

Not şifrelemesi ve mevcut kayıt kuyruğu beklenir; kaydedilmemiş veya çakışmalı çalışma alanı varsa kurulum başlamaz. Çevrimdışı bekleyen değişiklikler senkronize edilmeden yeniden başlatılmaz. Misafir önizlemesindeki değişiklikler önce hesaba kaydedilmelidir. Clipboard şifreli disk kaydı başarısızsa native katman da yeniden başlatmayı durdurur. Güncelleme sırasında yeni düzenleme engellenir; hata halinde açılır. Aynı appId ve kullanıcı veri klasörü korunur.

Paket imzasızdır; updater indirme dosyasının metadata SHA-512 değerini kontrol eder fakat Authenticode yayıncı kimliği güvencesi yoktur. İmzalama sertifikası eklenirse CI imzalama ve yayıncı doğrulaması ayrıca yapılandırılmalıdır. Repo adını/sahibini değiştirmeden veya repoyu silmeden önce kurulu istemcilerin sabit güncelleme kaynağını dikkate al.

### İlk yayın

1. Bu değişiklikleri `main` dalına gönder, Vercel arayüzünü yeniden yayınla.
2. GitHub Settings → Actions bölümünde Actions çalışmasına izin ver. Workflow yalnızca sürüm job’u için `contents: write` ister; organization kısıtlıysa repo yöneticisi bu izni açmalıdır. Supabase/Spotify anahtarları bu workflow’da kullanılmaz.
3. Paket sürümüne eşit tag oluştur ve gönder:

```powershell
git tag v1.2.4
git push origin v1.2.4
```

`.github/workflows/release.yml` Windows üzerinde npm ci, test, build ve paket doğrulamasını çalıştırır. Kurulum, blockmap ve latest.yml tamamlanana kadar release taslak kalır; yükleme bittiğinde yayınlanır. Metadata ve installer dosya adları aynıdır. İlk kurulum için Releases’tan MONO-Setup-1.2.4.exe indir. 1.2.3 ve önceki sürümler kendi kendine bu sürüme geçemez.

### Sonraki sürümler

`npm version patch --no-git-tag-version` ile sürümü artır; değişiklikleri commit/push et, eşleşen `v1.2.5` tag’ini gönder. Aynı tag veya release üzerine dosya yazılmaz. Başarısız yükleme taslak bırakırsa Actions logunu incele, yalnızca başarısız taslağı sil ve aynı tag workflow’unu yeniden çalıştır. Yayınlanmış sürümü değiştirmek yerine daha yüksek sürüm çıkar. Otomatik güncelleme altyapısı burada test doubles ile doğrulandı; gerçek Windows kurulumundan daha yüksek yayınlanmış sürüme uçtan uca geçiş, release yayınlandıktan sonra ayrıca denenmelidir.
