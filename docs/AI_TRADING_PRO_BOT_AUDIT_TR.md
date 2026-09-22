# AI Trading Pro bot incelemesi — 13 Eylül 2026

## İnceleme kapsamı

Kod ve backend'in yerel bağlantısındaki veritabanı incelendi. Borsaya emir gönderilmedi; VPS ve borsadaki güncel duruma ilişkin doğrulama yapılmadı. Eski AI Trading ekranı kaldırılmadı; arayüz değişiklikleri Pro'da yapıldı.

## Doğrulanan yerel durum

- Arşivlenmemiş 20 AUTONOMOUS bot var; hepsi DEMO. 19 kayıt BTCUSDT, biri PUMPUSDT üzerinde. Etkin işlem evreninde 20 ayrı coin var; evren listesi ile botun o andaki sembol ataması aynı şey değil.
- Botların hepsinde `entryPaused=true`. 19 kayıt STARTING, biri RUNNING; son gerçek karar 27 Ağustos 2026 17:01:17 UTC. Bu eski durumlar motorun bugün çalıştığının kanıtı değil.
- `AI_TRADING_EVOLUTION_ENABLED=false`. Arşivlenmemiş PAPER eğitim botu bulunmadı. Birinci nesil RUNNING kaydı tek başına öğrenmenin sürdüğünü göstermiyor.
- Kayıtlı TP 200 bps (%2 fiyat hareketi), SL 1000 bps (%10), tahmini gidiş-dönüş maliyeti 20 bps (%0,2). Kullanıcının istediği ölçü fiyat hareketi; ROE değil.
- SYSTEM koruma emirlerinde 32 STOP_MARKET FILLED, 1 TAKE_PROFIT_MARKET FILLED ve 6 TAKE_PROFIT_MARKET FAILED kaydı var. Başarısız TP kayıtlarının failureCode/failureMessage alanları boş. Bu sayılar yerel emir kayıtlarıdır; kapanmış işlem sayısı veya strateji başarı oranı değildir.

## Çalışma mantığı

Scheduler uygun botta piyasa/strateji analizini çalıştırır; yapılandırılmışsa AI mentor gözlemi ve karar politikası uygulanır. Karar ve sinyaller kaydedilir. Risk onayı ve emir niyeti varsa DEMO executor çalışır. Karar/sinyal üretimi ile borsaya emir gönderimi farklı aşamalardır.

Mevcut TESTNET profili 15m/1h analiz, 24 saniyelik bot çevrimi ve trend-grid girişleri kullanıyor. Yapılandırma `pyramidingEnabled=true` üretiyor: uygun yönde ve tahsis sınırı içinde ek giriş yapabilir. Ortalama giriş ve koruma fiyatları bu nedenle değişebilir. Bu davranış yalnızca aç-kâr al-kapat döngüsünden daha kapsamlıdır.

TP ve SL borsaya koruma emirleri olarak gönderilir. Motor aktifken HOLD kararlarında da hedef kontrolü yapar; hedef geçmişse reduce-only MARKET ile kapanmayı dener. Kapanıştan sonra yeni uygun giriş kararı yeniden işlem açabilir; kârlı işlem veya kesintisiz yeniden giriş garantisi yoktur.

`entryPaused` mevcut uygulamada hem yeni girişi hem motorun `MaintainPosition` takibini durdurur. Daha önce borsaya gönderilmiş koruma emirleri bağımsız çalışır. Bu incelemede duraklatma davranışı değiştirilmedi; mevcut pozisyonlar üzerinde sürpriz işlem yapılmadı.

Kâr hedefi giriş fiyatından hesaplanır ve maliyet payı eklenir. Örneğin giriş 100, TP %2 ve maliyet payı %0,2 ise LONG bakım hedefi yaklaşık 102,2 olur. ROE yüzdesi kaldıraçla büyür. Geçmişteki %40 ROE gözlemi, giriş/leverage/TP ve o andaki emir yanıtları olmadan kapanmama nedenini tek başına açıklamaz.

Otomatik nesil geliştirme ayrı backend worker'ıdır: PAPER işlemleri ve performans ölçümleri yeterli olduğunda seçim/evrim yapar. DEMO botlarının karar üretmesi, bu eğitim sürecinin etkin olduğu anlamına gelmez.

## Pro düzeltmeleri

- Gerçek kararların üstüne yazılan rastgele LONG/SHORT/HOLD ve güven değerleri kaldırıldı; sentetik sinyal düğmesi ve hız kontrolleri kaldırıldı.
- Son Kararlar gerçek karar kayıtlarını; Canlı Akış ayrı TradingBotSignal kayıtlarını gösteriyor. Sinyal kaynağı, durumu ve gerekçesi satırın açıklamasında bulunuyor.
- Karar gelmeyen hesapta boş durum gösteriliyor. Son gerçek kararın tarihi, analizin güncelliği, otomatik giriş ve nesil geliştirme durumu Pro genel bakışta ayrı gösteriliyor.
- Eski kararlar LIVE/AKTİF olarak sunulmuyor. Karşılığı olmayan karara varsayılan %100 güven atanmıyor.
- Orta akış 20 gerçek sembolü koruyor; hesap değişiminde akış bileşeni sıfırlanıyor.

## Test öncesi açık noktalar

Yerel motorun güncel karar üretimi, 20 coin üzerindeki gerçek atama dağılımı ve PAPER eğitim altyapısı çalışırken doğrulanmalı. Tek bir TESTNET botunun giriş fiyatı, seçilen TP/SL, borsanın kabul ettiği tetik fiyatları ve kapanış sonucu birlikte izlenmeli. Geçmiş altı başarısız TP için neden bilinmiyor; bu inceleme bunların düzeltildiği iddiasında bulunmuyor. Motor ve mevcut ayarlar kullanıcı adına otomatik etkinleştirilmedi.

## Doğrulama

Backend ve frontend TypeScript kontrolleri, iki Pro akış testi ve Go `internal/autonomousexecution` testleri başarılı. Gerçek yerel veritabanına salt-okunur `getArenaStatus` çağrısı 60 karar, 60 sinyal (RULE_ENGINE) ve `analysisFresh=false` döndürdü. Bu sonuçlar borsada uçtan uca emir/kapanış testi yerine geçmez.
