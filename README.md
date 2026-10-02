# MONO

Koyu temalı, widget'larla düzenlenebilen kişisel çalışma alanı. Vanilla JavaScript modülleri, CSS Grid, PWA servis çalışanı ve isteğe bağlı Supabase hesabı kullanır. Web/PWA olarak kullanılabilir; Electron ile Windows uygulaması da hazırlanır. Kurulum, yeni araçlar ve sınırlar için [DESKTOP.md](DESKTOP.md) dosyasına bak.

Sol paneldeki Masa seç kutusundan düzenler arasında geçilir. Yeni masa boş başlar; adını değiştirebilir ve istediğin kadar masa ekleyebilirsin. Her masa widget'larını, notlarını, etkinliklerini, grid sütunlarını ve otomatik düzen tercihini ayrı tutar. Tema ve panel görünürlüğü mevcut tarayıcı tercihleri olarak kalır. Misafir modundaki masalar oturumluk önizlemedir; hesapla kullanılan masalar mevcut yerel kuyruk, Supabase kaydı ve revision çatışma denetimine dahildir.

Kayıt şeması v3'tür. v0/v1/v2 kayıtları içerik ve grid konumları korunarak Kişisel alan adlı ilk masaya geçirilir. Canlı masanın widgets/events alanları kökte kalır; diğer masaların düzenleri desks[].workspace içinde saklanır. activeDeskId seçimi korunur. İç içe masa koleksiyonları kabul edilmez; tüm masaların verileri aynı güvenli URL/metin/kimlik doğrulamasından geçer. Masa sayısına yapay sınır yoktur; mevcut toplam kayıt boyutu sınırları geçerlidir. Aynı JSONB çalışma alanı kaydı kullanıldığı için ek Supabase tablosu veya SQL değişikliği gerekmez. Dağıtımda frontend ve API birlikte güncellenmelidir; eski istemciler yeni şema sürümünü açamaz.

tests/desks.test.mjs şema geçişini, çoklu masa izolasyonunu ve zararlı kayıtları; tarayıcı testi ise masa oluşturma/ad değiştirme, görev/not/grid izolasyonu, çevrimdışı yenileme ve mobil görünümü doğrular. Canlı Supabase burada test edilmemiştir.

