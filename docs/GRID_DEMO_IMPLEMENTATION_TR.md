# Demo Grid Bot — 13 Eylül 2026

Mevcut Grid Bot kart düzeni korunarak bağlı hesap üzerinden Spot/Futures seçimi, fiyat sınırları, USDT veya yüzde işlem aralığı ve sermaye ayarları eklendi. Spot Binance demo hesabı; futures Binance USDT-M ve Bybit demo hesapları üzerinden çalışır. Nötr futures için doğrulanmış hedge modu gerekir; doğrulanamayan hesapta Long/Short seçilmelidir.

## Önizleme ve onay

- Önizleme yalnızca hesap/borsa verilerini okur ve iki dakika geçerli taslak saklar. Emir göndermez.
- Liste her girişin yönünü, fiyatını, miktarını ve gerçekleşince oluşturulacak kapanış emrini gösterir.
- Kullanıcı onayında fiyat, hesap, pozisyon modu, parite sahipliği, sermaye rezervasyonu ve merkezi risk yeniden kontrol edilir. Fiyat seviyeleri aşılmışsa yeni önizleme gerekir.
- Tekrarlanan onay aynı taslağı kullanır. Emirleri sunucudaki worker merkezi Go yürütücüsünden gönderir.

## Emir davranışı

Long grid fiyatın altına alış girişleri yerleştirir; üst seviyedeki satış mevcut long miktarını kapatır. Short grid bunun tersidir. Nötr grid ayrı long ve short girişleri içerir. Aynı yöndeki gerçekleşmeler borsanın pozisyon modeline göre birleşebilir; bot döngüleri ayrı takip eder.

Başlangıç girişleri post-only limit emirleridir. Fiyat 2500 iken 2600'e normal alış limit emri koymak, 2600'e yükselmesini bekleyen emir değildir. Yukarı kırılım girişi stop emri gerektirir; bu sürümde grid giriş stratejisi fiyatın altından long/alış ve üstünden short açmaktır.

Futures izole marjin ve 1–5x kaldıraç kullanır. Kaldıraç emir miktarını çarpmaz. Stop emirleri gerçekleşen miktar için oluşturulur. İptal kabul yanıtı yeterli sayılmaz; kesin emir durumu beklenir. Belirsiz gönderimler tekrar gönderilmez. Kısmi gerçekleşme, yeniden başlatma, stop reddi ve kullanıcı kapatma akışları test kapsamındadır.

Duraklatma yeni girişleri durdurur; mevcut pozisyonların kapanış/koruma takibi sürer. Botu sonlandırma bekleyen emirleri iptal eder ve kalan miktarı kapatır. Spot stop kontrolü sunucu worker'ına bağlıdır. Fiyat boşlukları ve kayma nedeniyle maksimum zarar kesin bir gerçekleşme garantisi değildir.

Kâr hesabı gerçekleşen ve açık sonuç, komisyon ve funding içerir. Komisyon/funding doğrulanamıyorsa toplam net sonuç gösterilmez.

## Doğrulama ve devreye alma

Grid planı, onay ve worker testleri; frontend HTML/API testleri; TypeScript ve derlemeler; ilgili Go exchange/execution/risk/reconciliation/storage testleri çalıştırıldı. Testler gerçek borsa emri göndermez.

Tarayıcı bağlantısı bulunamadığından görsel kabul tamamlanmadı. Gerçek demo borsasında uçtan uca emir kabulü ve deploy yapılmadı.

Devreye almadan önce `backend/prisma/migrations/202609120001_grid_spot_accounts/migration.sql` veritabanına uygulanmalı, Prisma istemcisi üretilmeli ve backend ile Go motoru birlikte güncellenmeli. Bu oturumda migration uygulanmadı. Çalışan Windows Prisma DLL kilidi nedeniyle `prisma generate` tam başarılı olmadı; servis yeniden başlatma bakımında yeniden çalıştırılmalı. Yeni hesap için Borsa Hesapları ekranındaki demo işlem motorunu etkinleştirme işlemi ve Risk ayarları gereklidir. Hiçbir bot kullanıcı önizleme onayı olmadan başlatılmaz.
