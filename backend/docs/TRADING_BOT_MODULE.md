# KriptoKeyfi Çok Borsalı Trading Bot Modülü

Bu belge, KriptoKeyfi admin paneline eklenecek çok borsalı, kaldıraçlı işlem ve bot yönetim modülünün ürün ve teknik yol haritasıdır. Kaynak çalışma 1 Ağustos 2026 tarihinde proje kapsamına alınmıştır. Uygulama fazlar halinde geliştirilecek; gerçek para ile işlem ilk sürümlerde kapalı kalacaktır.

## Ürün hedefi

- Botlar tarayıcıda değil, sunucu tarafında sürekli çalışır.
- İlk sürümde modüle yalnızca `ADMIN` rolü erişir.
- Frontend yalnızca yönetim, izleme ve açık kullanıcı onayı sağlar.
- API secret, passphrase ve şifreleme anahtarları hiçbir zaman frontend'e gönderilmez veya loglanmaz.
- Mimari ileride kullanıcı bazlı erişim, abonelik ve kripto ödeme yetkilendirmesine genişleyebilir.
- Her borsa hesabı, bot, emir ve pozisyon gelecekte kullanıcı/tenant sahipliğine bağlanır.

## Mevcut sistem analizi

| Alan | Mevcut durum |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, React Router, Tailwind CSS 4, Axios |
| Backend | Node.js, Express, TypeScript strict mode, Zod, Pino |
| Authentication | JWT access token + HttpOnly refresh cookie, session rotation |
| Yetkilendirme | Prisma `UserRole`; admin endpointlerinde backend `authorize(ADMIN)` kontrolü |
| Veritabanı | MySQL 8+, Prisma ORM |
| Gerçek zamanlı altyapı | Henüz WebSocket/SSE veya Redis bulunmuyor |
| Deployment | Şu aşamada repo içinde Docker/Compose veya ayrı trading engine yok |

## Hedef mimari

```text
React Frontend
      ↓ HTTPS / SSE veya WebSocket
Node.js / TypeScript API
      ↓ Redis Queue veya Internal API
Trading Engine (ileride ayrı Go servisi)
      ↓
Binance Futures / Bybit V5 / diğer adapterlar
```

Backend katmanları controller içine borsa kodu koymadan ayrılmalıdır:

```text
trading/
├── domain
├── exchange-adapters
├── credentials
├── accounts
├── market-data
├── orders
├── positions
├── strategies
├── risk
├── reconciliation
├── notifications
├── audit
└── system-health
```

## Admin bilgi mimarisi

Kalıcı admin menüsü masaüstünde sidebar, mobilde hamburger/drawer olarak çalışır:

- Genel Bakış
- Trading Bot
- Borsa Hesapları
- Botlarım
- Manuel İşlem
- Grid Bot
- Açık Pozisyonlar
- Açık Emirler
- İşlem Geçmişi
- Kâr/Zarar
- Risk Yönetimi
- Bot Logları
- Sistem Durumu

İlk arayüz yalnızca gerçek backend durumunu gösterir. Henüz bağlı bir trading engine veya borsa hesabı yoksa veri uydurulmaz; açıkça “yapılandırılmadı” gösterilir.

## Güvenlik ilkeleri

- Bütün trading endpointleri `authenticate` ve backend rol kontrolünden geçer.
- Frontend'de menüyü gizlemek güvenlik sayılmaz.
- Credential'lar AES-256-GCM veya eşdeğer authenticated encryption ile, kayıt başına ayrı nonce kullanılarak şifrelenir.
- Master key kaynak koda, Git'e veya API response'una girmez.
- Para çekme yetkisi açık anahtarlar reddedilir veya açık admin onayı gerektirir.
- Testnet varsayılandır; live trading feature flag ile kapalıdır.
- Isolated margin, düşük kaldıraç, zorunlu stop-loss, günlük zarar limiti ve en az `%20` rezerv güvenli varsayılanlardır.
- Emirler idempotency key kullanır. Borsa timeout'unda kör retry yapılmaz; reconciliation uygulanır.
- Kill switch yeni emirleri engeller, fakat mevcut pozisyonları kullanıcı onayı olmadan otomatik kapatmaz.
- Para/miktar hesabında JavaScript floating point yerine Decimal kullanılır.
- Kritik değişiklikler secret içermeyen audit loga yazılır.

## Desteklenecek hesap ve işlem kapsamı

İlk adapterlar Binance Futures testnet ve Bybit V5 demo olacaktır. Yapı daha sonra OKX, Bitget, Gate.io, MEXC ve KuCoin Futures adapterlarına açılacaktır.

Borsa hesabı; hesap adı, borsa, ortam, hesap türü, API key/secret, gerekirse passphrase, açıklama, sub-account ve aktiflik bilgilerini taşır. Aynı kullanıcı aynı borsada birden fazla hesap bağlayabilir. Secret daha sonra hiçbir endpointten geri dönmez.

İlk işlem kapsamı:

- Bakiye, sembol, tick/step size, minimum notional ve kaldıraç limitlerini dinamik okuma
- Manuel emir önizleme ve açık onay
- Market, limit, stop market ve stop limit emirleri
- Reduce-only pozisyon kapatma
- Açık emir/pozisyon takibi ve iptal
- Temel risk motoru, kill switch ve reconciliation
- WebSocket kopma/yeniden bağlanma yönetimi

Bot stratejileri scalping, grid, manuel kontrollü bot ve fiyat tetiklemeli emir olarak genişleyebilir. Martingale veya kontrolsüz pozisyon büyütme ilk sürümlerde bulunmaz.

## Fazlar

### Faz 1 — Admin iskeleti ve güvenli temel

- Mevcut mimari ve rol analizi
- Admin-only Trading Bot menüsü ve route koruması
- Modül durum endpointi
- Live trading kapalı feature durumu
- Kalıcı admin sidebar ve mobil hamburger menü
- Teknik dokümantasyon

### Faz 2 — Borsa hesapları

- Prisma veri modeli ve migration
- Credential encryption
- Çoklu hesap yönetimi
- Binance testnet ve Bybit demo adapterları
- Bağlantı testi ve bakiye görünümü

### Faz 3 — Manuel testnet işlemleri

- Sembol kuralları ve kaldıraç
- Emir önizleme/onay
- Açık emirler, pozisyonlar, iptal ve reduce-only kapatma
- Idempotency ve audit log

### Faz 4 — Gerçek zamanlı sistem

- Market/account WebSocket
- Reconnect ve heartbeat
- SSE/WebSocket frontend güncellemeleri
- Reconciliation worker

### Faz 5 — Risk motoru

- Günlük zarar ve pozisyon limitleri
- Bakiye rezervi ve kaldıraç sınırı
- Global kill switch
- Risk eventleri ve bildirim altyapısı

### Faz 6–9

- Grid bot
- Scalping/strateji interface'i
- PnL, funding, komisyon ve performans raporları
- Live trading için güçlü onay, failure testleri ve deployment sertleştirmesi

## Planlanan API yüzeyi

```text
GET    /api/admin/trading/overview
GET    /api/admin/trading/exchange-accounts
POST   /api/admin/trading/exchange-accounts
POST   /api/admin/trading/exchange-accounts/:id/test
GET    /api/admin/trading/exchange-accounts/:id/balances
GET    /api/admin/trading/exchange-accounts/:id/symbols

GET    /api/admin/trading/bots
POST   /api/admin/trading/bots
POST   /api/admin/trading/bots/:id/start
POST   /api/admin/trading/bots/:id/stop

POST   /api/admin/trading/orders/preview
POST   /api/admin/trading/orders
GET    /api/admin/trading/orders
POST   /api/admin/trading/orders/:id/cancel

GET    /api/admin/trading/positions
POST   /api/admin/trading/positions/:id/close
POST   /api/admin/trading/positions/:id/partial-close

GET    /api/admin/trading/reports/overview
GET    /api/admin/trading/reports/pnl
GET    /api/admin/trading/system-health
```

## Faz 1 kabul kriterleri

- Admin olmayan kullanıcı backend endpointine erişemez.
- Admin menüsünden panele ve Trading Bot ekranına gidilebilir.
- Alt sayfalardan admin genel bakışına açık bir dönüş yolu vardır.
- Masaüstünde sidebar, mobilde hamburger menü çalışır.
- Trading durumu backend'den gelir; sahte borsa/bakiye verisi yoktur.
- Live trading açıkça kapalı gösterilir.
- Mevcut frontend ve authentication akışı bozulmaz.

## Sonraki adım

Faz 2 başlamadan önce Prisma sahiplik modeli (`userId` ve gelecekte gerekirse `tenantId`), master key yönetimi ve Binance/Bybit test credential'larının sağlanacağı secret yönetimi kesinleştirilecektir.

## Uygulama günlüğü

### 1 Ağustos 2026 — Faz 1 tamamlandı

- Admin-only trading route ve durum endpointi eklendi.
- Responsive admin sidebar ve mobil hamburger menü eklendi.
- Site içindeki profil menüsünden admin paneline dönüş bağlantısı eklendi.
- Live trading kapalı, global kill switch aktif bırakıldı.

### 1 Ağustos 2026 — Faz 2 altyapısı tamamlandı

- Gönderilen ana çalışma, tam içerikle `docs/TRADINGBOT_REFERENCES.md` dosyasına kaydedildi.
- `ExchangeAccount` Prisma modeli ve MySQL migration eklendi ve yerel veritabanına uygulandı.
- Hesap sahipliği `userId` ile tanımlandı; model ileride tenant/abonelik yetkilendirmesine genişletilebilir.
- API key, secret ve opsiyonel passphrase için AES-256-GCM credential kasası eklendi.
- Her şifreleme işleminde ayrı 96-bit nonce ve authentication tag kullanılıyor.
- Master key yalnızca `.env` üzerinden okunuyor; API response ve loglara girmiyor.
- API response'ları yalnızca maskeli `apiKeyHint` taşıyor; encrypted alanlar select katmanında dışarı kapalı.
- Binance Demo adapterı eklendi; aynı demo anahtarıyla Spot/Main (`demo-api.binance.com`, imzalı `/api/v3/account`) ve USDⓈ-M Futures (`demo-fapi.binance.com`, imzalı `/fapi/v3/account`) bakiyeleri ayrı cüzdan grupları halinde okunuyor.
- Bybit V5 demo adapterı eklendi (`api-demo.bybit.com`, imzalı `/v5/account/wallet-balance`).
- Hesap oluşturma öncesinde read-only hesap isteğiyle credential doğrulaması yapılıyor.
- Çoklu hesap listeleme, ekleme, bağlantı testi, bakiye senkronizasyonu ve silme endpointleri eklendi.
- Admin paneline Borsa Hesapları ekranı, güvenli credential formu ve Spot/Main ile Futures bakiyelerini ayrı listeler halinde gösteren bakiye görünümü eklendi.
- Spot görünümünde USDT/USDC ana varlıkları ile diğer coinler ayrı kartlarda listelenir; her coin için toplam, kullanılabilir, kilitli miktar, güncel kur ve tahmini USDT karşılığı gösterilir. Değerleme Binance Spot `/api/v3/ticker/price` verisiyle ve ondalık hassasiyet korunarak yapılır.
- Borsa hesabının ana bilgileri üstte tek yatay özet alanında, Spot ve Futures bakiyeleri altta yan yana tablo düzeninde gösterilir. Bakiye sorguları sayfa açıldığında tüm hesaplar için otomatik ve paralel başlatılır; ayrı bir bakiye butonu kullanılmaz.
- Live/production borsa ortamları uygulama input şemasında kabul edilmiyor.

Faz 2 API'leri:

```text
GET    /api/admin/trading/exchange-accounts
POST   /api/admin/trading/exchange-accounts
POST   /api/admin/trading/exchange-accounts/:id/test
GET    /api/admin/trading/exchange-accounts/:id/balances
DELETE /api/admin/trading/exchange-accounts/:id
```

Faz 2'nin gerçek borsa doğrulamasını tamamlamak için admin panelinden kullanıcıya ait Binance Demo veya Bybit demo credential'ı girilmelidir. Repoya ya da dokümana credential yazılmamalıdır.

## Gelecek gelir modeli kararı

KriptoKeyfi Trading Bot ileride yalnızca abonelikle değil, desteklenen borsaların resmî OMS/Broker/affiliate programları üzerinden işlem hacmine bağlı gelir modeliyle de çalışabilir.

Değerlendirilecek modeller:

- Aylık veya yıllık bot aboneliği
- Paket ve kullanım limitine göre ücretlendirme
- Kripto para ile abonelik ödemesi
- Borsanın resmî OMS/Broker programı üzerinden işlem başına servis ücreti veya komisyon payı
- Birden fazla borsada ayrı gelir paylaşımı anlaşmaları
- Profesyonel kullanıcılar için yüksek hacimli kurumsal paketler

Mimari kararı:

- Ücretlendirme ve entitlement sistemi bot motorundan ayrı bir servis/domain katmanı olmalıdır.
- Kullanıcının bot erişimi plan, abonelik veya özel admin izni üzerinden kontrol edilebilmelidir.
- Bir borsadaki gelir programı diğer borsa adapterlarına bağımlılık oluşturmamalıdır.
- Her borsanın ücret açıklaması, kullanıcı onayı ve mevzuat gereksinimleri ayrı uygulanmalıdır.
- Kullanıcı işlem öncesinde Binance/borsa komisyonu ile KriptoKeyfi/OMS servis ücretini ayrı ve açık şekilde görebilmelidir.
- Gizli ücret, kâr garantisi veya yanıltıcı maliyet sunumu yapılmamalıdır.
- Resmî OMS/Broker anlaşması yapılmadan normal API bağlantıları için OMS ücreti varmış gibi ücret tahsil edilmemelidir.

Bu gelir modeli Faz 3'ün testnet işlem geliştirmesini etkilemez. Ticari entegrasyon; güvenli testnet doğrulaması, risk motoru, audit, abonelik/entitlement sistemi ve hukuki inceleme tamamlandıktan sonra ayrı bir faz olarak ele alınacaktır.

## 1 Ağustos 2026 — Faz 3 tamamlandı

- Binance Demo USDⓈ-M ve Bybit V5 Demo adapterları dinamik vadeli parite, tick/step size, minimum notional ve azami kaldıraç verilerini okuyacak şekilde genişletildi.
- Kaldıraç ve margin modu yalnızca açık emir onayından sonra borsada yapılandırılır.
- Market, limit, stop-market ve stop-limit emirleri için iki adımlı önizleme/onay akışı eklendi.
- Önizlemeler iki dakika geçerlidir; miktar, fiyat, tetikleme fiyatı, kaldıraç ve notional borsanın güncel sembol kurallarına göre doğrulanır.
- Finansal adım ve notional kontrolleri JavaScript floating point yerine `BigInt` tabanlı ondalık yardımcılarla yapılır.
- Her emir kullanıcı tarafından üretilen idempotency anahtarı ve borsaya gönderilen benzersiz client order ID ile korunur.
- Borsa yanıtı kaybolduğunda otomatik tekrar yapılmaz; kayıt `RECONCILIATION_REQUIRED` koduyla mutabakat için korunur.
- Açık emir ve pozisyon listeleri doğrudan seçilen testnet/demo hesabından okunur.
- Açık emir iptali, sahiplik ve borsadaki güncel açık emir kontrolünden sonra uygulanır.
- Pozisyon kapatma tam miktarda reduce-only piyasa emriyle ve ikinci açık onayla yapılır.
- Emir gönderme, başarısız emir, mutabakat gereksinimi, iptal ve pozisyon kapatma olayları secret içermeyen audit loga yazılır.
- Admin paneline Manuel İşlem, Açık Emirler ve Açık Pozisyonlar sayfaları eklendi; masaüstü ve mobil menüye bağlandı.
- Live/production işlemler kapalı kalmaya devam eder. Faz 3 API'leri yalnızca Faz 2'de kabul edilen Binance Testnet ve Bybit Demo hesaplarıyla çalışır.

Faz 3 API'leri:

```text
GET    /api/admin/trading/symbols?exchangeAccountId=:id
POST   /api/admin/trading/orders/preview
POST   /api/admin/trading/orders
GET    /api/admin/trading/orders?exchangeAccountId=:id
POST   /api/admin/trading/orders/:id/cancel
GET    /api/admin/trading/positions?exchangeAccountId=:id
POST   /api/admin/trading/positions/:id/close
```

Veritabanı migration'ı:

```text
20260801213000_add_manual_trading
```

Yeni environment değişkeni eklenmedi. Mevcut `TRADING_CREDENTIALS_MASTER_KEY` zorunluluğu devam eder.

Doğrulama sonucu:

- Backend typecheck: başarılı
- Backend lint: başarılı
- Backend build: başarılı
- Backend test: 6 dosya, 20 test başarılı
- Frontend typecheck: başarılı
- Frontend production build: başarılı

## Faz 3.5 — Go Trading Engine'e güvenli geçiş

Faz 4 gerçek zamanlı altyapısına, risk motoruna veya otomatik bot stratejilerine başlamadan önce borsa yürütme sorumluluğu ayrı bir Go servisine taşınacaktır. Mevcut TypeScript uygulaması yeniden yazılmayacak; authentication, admin yetkilendirmesi, kullanıcı API'leri ve frontend gateway görevlerini koruyacaktır.

Hedef sorumluluk sınırı:

```text
React Frontend
  ├── REST komutları
  └── SSE durum olayları
          ↓
Node.js / TypeScript API
  ├── Authentication ve roller
  ├── Admin ve kullanıcı API'leri
  ├── Abonelik / entitlement
  ├── Açık kullanıcı onayı
  └── Go engine internal API istemcisi
          ↓ authenticated internal API
Go Trading Engine
  ├── Credential erişimi ve exchange adapterları
  ├── Emir / pozisyon state machine
  ├── Binance / Bybit private WebSocket
  ├── Idempotency ve reconciliation
  ├── Risk engine
  ├── Bot scheduler
  └── Grid / scalping strategy interface
          ↓
MySQL + kalıcı event/outbox
```

### Değişmez mimari kuralları

- Aynı hesap için aynı anda yalnızca tek aktif order executor bulunabilir.
- Go cutover tamamlandıktan sonra Node.js doğrudan borsaya emir gönderemez.
- Geçiş sırasında dual-write veya iki servisten paralel test emri gönderilmez.
- Shadow aşaması yalnızca bakiye, sembol, emir ve pozisyon gibi salt-okunur sonuçları karşılaştırır.
- Frontend ve Node.js katmanına API secret, passphrase veya master key dönmez.
- Go servisi credential'ı yalnızca emir/stream işlemi sırasında çözer; log, event ve hata yanıtlarına secret yazmaz.
- Para ve miktar hesaplarında floating point kullanılmaz.
- REST cevabı tek başına borsa gerçeği sayılmaz; private WebSocket olayı ve periyodik reconciliation birlikte kullanılır.
- WebSocket olayı yinelenebilir veya sırasız gelebilir; event işleme idempotent olmalıdır.
- Timeout alınan emir otomatik tekrar edilmez; client order ID ile borsada sorgulanıp mutabakat yapılır.
- Engine restart sırasında açık emir ve pozisyonları borsadan okuyarak yerel state'i yeniden kurar.
- Live trading bu geçiş boyunca kapalı kalır; bütün cutover testleri Binance Demo ve Bybit Demo üzerinde yapılır.

### Kaydedilmiş geçiş sırası

#### Adım 1 — Go servis temeli

- `services/trading-engine` Go module yapısını oluştur.
- Config validation, structured logging, healthcheck ve graceful shutdown ekle.
- Internal API token doğrulaması ve request correlation ID standardını tanımla.
- Dockerfile/çalıştırma dokümanı hazırla; mevcut deployment'ı bozmadan bağımsız servis olarak çalıştır.

#### Adım 2 — Ortak domain ve internal API sözleşmesi

- Exchange account reference, symbol rule, balance, order, position ve normalized exchange error modellerini tanımla.
- Node → Go komutları için versioned internal API sözleşmesi oluştur.
- İdempotency key ve client order ID alanlarını sözleşmenin zorunlu parçası yap.
- `PENDING`, `SUBMITTING`, `OPEN`, `PARTIALLY_FILLED`, `FILLED`, `CANCELING`, `CANCELED`, `CLOSING`, `FAILED`, `RECONCILIATION_REQUIRED` durumlarını merkezi state machine olarak tanımla.

#### Adım 3 — Salt-okunur adapter ve shadow doğrulama

- Binance Demo symbol, balance, open order ve position sorgularını Go adapterına taşı.
- Bybit Demo için aynı normalized adapter sözleşmesini uygula.
- TypeScript ve Go çıktısını aynı hesaplarda karşılaştır; miktar, mark fiyatı, kaldıraç, margin modu ve position side eşitliğini test et.
- Shadow aşamasında Go servisine emir gönderme yetkisi verme.

#### Adım 4 — Manuel emir cutover

- Önizleme kuralları, quantity/price rounding ve min-notional kontrollerini Go'ya taşı.
- Market, limit, stop-market ve stop-limit emirlerini Go order manager üzerinden yürüt.
- İptal ve reduce-only pozisyon kapatmayı Go'ya taşı.
- Node.js endpoint yüzeyini koru; endpointler internal API üzerinden Go'ya komut iletsin.
- Feature flag ile hesap bazlı cutover yap; Go aktifken TypeScript executor kesin olarak kapalı olsun.
- Cutover sonrasında TypeScript exchange execution kodunu yalnızca geçici rollback süresi boyunca tut, ardından kaldır.

#### Adım 5 — Private WebSocket ve canlı frontend durumu

- Binance account/order/position stream ve Bybit private order/execution/position stream bağlantılarını Go'da yönet.
- Reconnect, heartbeat, listen-key yenileme ve exponential backoff uygula.
- Exchange olaylarını normalized, secret-free kalıcı event/outbox kayıtlarına dönüştür.
- Node.js outbox/event akışını tüketip frontend'e SSE ile iletsin.
- Frontend emir ve pozisyon satırlarında `SUBMITTING`, `CANCELING` ve `CLOSING` durumlarını anında göstersin.
- WebSocket olayı geldiğinde sayfa yenilemeden emir/pozisyon tablosunu güncellesin.

#### Adım 6 — Reconciliation ve restart recovery

- Belirsiz emirleri client order ID ile borsada sorgula.
- Periyodik olarak açık emir/pozisyon snapshot'ını yerel state ile karşılaştır.
- Eksik, yinelenen veya sırasız eventleri idempotent biçimde düzelt.
- Engine başlangıcında reconciliation tamamlanmadan otomatik bot veya yeni emir kabul etme.
- Reconciliation başarısızsa ilgili hesabı `DEGRADED` durumuna getir ve yeni bot emirlerini durdur.

#### Adım 7 — Risk motoru ve botlara geçiş

- Günlük zarar, maksimum pozisyon, kaldıraç, bakiye rezervi ve kill switch kontrollerini Go engine'e ekle.
- Risk motoru hem manuel hem otomatik emirlerde aynı order manager öncesinde çalışsın.
- Grid/scalping stratejileri doğrudan exchange adapterına değil order manager ve risk engine interface'lerine bağımlı olsun.
- Bot scheduler restart recovery ve reconciliation tamamlanmadan strateji çalıştırmasın.

### Faz 3.5 kabul kriterleri

- Go servisi bağımsız başlar, healthcheck verir ve graceful shutdown yapar.
- Node ve Go arasında internal authentication olmadan komut kabul edilmez.
- Shadow-read sonuçları Binance Demo ve Bybit Demo için TypeScript sonuçlarıyla eşleşir.
- Manuel emir açma, iptal ve reduce-only kapatma yalnızca Go executor üzerinden çalışır.
- Aynı idempotency key ile ikinci borsa emri oluşmaz.
- Timeout sonrası kör retry yapılmaz ve reconciliation sonucu kayıt altına alınır.
- Emir ve pozisyon değişiklikleri sayfa yenilenmeden frontend'e ulaşır.
- WebSocket kopup bağlandığında state REST reconciliation ile doğrulanır.
- Go servisi yeniden başlatıldığında açık emir ve pozisyonlar kaybolmaz.
- API secret, authorization header ve master key hiçbir log/event/API response içinde bulunmaz.
- Live trading kapalı kalır ve bütün kabul testleri demo/testnet ortamında geçer.
- Cutover tamamlanmadan risk motoru, grid bot veya scalping bot geliştirmesine başlanmaz.

Sonraki uygulama adımı Faz 3.5 Adım 1'dir: Go servis temeli, internal healthcheck, güvenli config ve graceful shutdown. Faz 4 gerçek zamanlı altyapı, Go manuel emir cutover'ından sonra Adım 5–6 kapsamında uygulanacaktır.

### 1 Ağustos 2026 — Faz 3.5 Adım 1 tamamlandı

- Go 1.26.5 geliştirme ortamı doğrulandı.
- `services/trading-engine` altında bağımsız Go modülü oluşturuldu.
- Servis güvenlik gereği yalnızca `shadow` modunda başlayabilir; bu aşamada exchange executor ve emir endpointleri kapalıdır.
- En az 32 karakterlik `TRADING_ENGINE_TOKEN` zorunlu tutuldu; korumalı internal endpoint sabit zamanlı Bearer token karşılaştırması kullanır.
- Public liveness/readiness healthcheck, request correlation ID, structured logging, güvenli HTTP timeout'ları ve graceful shutdown eklendi.
- Container build tanımı ve yerel çalıştırma dokümanı eklendi; gerçek token veya credential repoya yazılmadı.
- `go test ./...`, `go vet ./...` ve `go build ./...` kontrolleri başarıyla geçti.

Sonraki uygulama adımı Faz 3.5 Adım 2'dir: ortak domain modelleri, versioned internal API sözleşmesi ve merkezi emir state machine.

### 1 Ağustos 2026 — Faz 3.5 Adım 2 tamamlandı

- Go engine için exchange account reference, sembol kuralı, bakiye, emir, pozisyon ve normalize borsa hatası domain modelleri eklendi.
- Para, fiyat, miktar ve PnL alanlarının internal JSON sözleşmesinde string taşınması zorunlu tutuldu; floating point kullanılmadı.
- `/internal/v1` tabanlı versioned sözleşme ve salt-okunur kaynak yolları tanımlandı.
- Exchange üzerinde değişiklik yapacak place, cancel ve close komutlarının tamamında `idempotencyKey` ile `clientOrderId` zorunlu hale getirildi.
- `PENDING`, `SUBMITTING`, `OPEN`, `PARTIALLY_FILLED`, `FILLED`, `CANCELING`, `CANCELED`, `CLOSING`, `FAILED` ve `RECONCILIATION_REQUIRED` durumlarını yöneten merkezi ve testli state machine eklendi.
- Yazma komutları sözleşmede tanımlandı fakat shadow güvenlik sınırı gereği HTTP router'a bağlanmadı.
- Güncel Go doğrulaması: `go test ./...`, `go vet ./...` ve `go build ./...` başarılı.

Sonraki uygulama adımı Faz 3.5 Adım 3'tür: Binance/Bybit salt-okunur adapterları ve TypeScript çıktılarıyla shadow karşılaştırması.

### 1 Ağustos 2026 — Faz 3.5 Adım 3 tamamlandı

- Binance Demo ve Bybit Demo için yalnızca `GET` yeteneği sunan Go reader adapterları eklendi; adapter interface'inde yazma metodu bulunmuyor.
- Bakiye, vadeli sembol kuralları, açık emirler ve açık pozisyonlar normalize Go domain modellerine taşındı.
- Binance `/fapi/v2/positionRisk` kaldıraç ve margin mode kaynağı olarak korundu; Bybit `tradeMode` ve `positionIdx` alanları normalize edildi.
- Her iki borsanın HMAC imzası, hata kodu normalizasyonu ve salt-okunur HTTP method sınırı sahte borsa sunucularıyla test edildi.
- Go engine, Node ile uyumlu `v1.nonce.tag.ciphertext` AES-256-GCM credential formatını çözebiliyor; credential'ı hesap sahipliği kontrolüyle doğrudan MySQL'den okuyor.
- Shadow snapshot endpointi internal Bearer token arkasında eklendi; API key, secret ve master key response veya loglara girmiyor.
- Node mevcut TypeScript sonucunu kullanıcıya döndürmeye devam ederken Go snapshot'ını arka planda karşılaştıran, hata halinde kullanıcı isteğini bozmayan shadow comparator eklendi.
- Shadow özellikleri environment flag ile varsayılan kapalıdır; Go executor ve bütün emir yazma endpointleri kapalı kalmaya devam eder.
- Gerçek Binance Demo kabul testi sonucu: bakiye `7/7`, sembol `528/528`, açık emir `0/0`, pozisyon `3/3`; dört kaynakta da uyuşmazlık sayısı `0`.
- Canlı testte üç pozisyonun gerçek kaldıraç ve margin mode alanları eksiksiz doğrulandı.
- Güncel doğrulama: Go test/vet/build, backend typecheck/lint/build ve backend 22 test başarılı.

Sonraki uygulama adımı Faz 3.5 Adım 4'tür: manuel emir yürütmesini hesap bazlı feature flag ve tek aktif executor garantisiyle Go order manager'a geçirmek.

### 1 Ağustos 2026 — Faz 3.5 Adım 4 uygulama durumu

Tamamlanan teknik işler:

- `TradingExecutionEngine` enum'u ve hesap bazlı `TYPESCRIPT`/`GO` executor sahipliği migration'ı eklendi ve yerel MySQL'e uygulandı.
- Mevcut bütün hesaplar ve eski emirler güvenli varsayılan olarak `TYPESCRIPT` üzerinde bırakıldı.
- Executor değiştirme admin API'si eklendi; in-flight veya reconciliation bekleyen emir varken geçiş reddedilir.
- Backend feature flag kapalıysa veya Go `/internal/v1/status` cevabı write-ready değilse hesap `GO` yapılamaz.
- Binance ve Bybit Go adapterlarına margin/leverage yapılandırma, emir gönderme ve iptal yetenekleri eklendi.
- Go order manager submit ve cancel öncesinde MySQL üzerinde atomik execution claim alır.
- Submit ve cancel idempotency alanları kalıcıdır; ikinci istek kör retry oluşturmaz.
- Timeout veya geçersiz write cevabı sonrası kayıt `RECONCILIATION_REQUIRED` olarak korunur.
- Preview quantity, tick/step, leverage ve min-notional kontrolleri Go string-decimal kurallarıyla yeniden doğrulanır.
- Node admin endpoint yüzeyi değiştirilmeden hesap executor'ına göre TypeScript veya Go internal API'ye yönlendirilir.
- Go hesabında Node credential çözmez ve doğrudan borsa write adapterı oluşturmaz.
- Reduce-only pozisyon kapatma mevcut onay akışını koruyarak Go place order manager üzerinden ilerler.
- Frontend hesap görünümüne aktif executor bilgisi eklendi; cancel komutları idempotency key üretir.
- `20260801234000_add_go_execution_cutover` migration'ı başarıyla uygulandı.
- Go unit/integration adapter testleri, Go test/vet/build, backend typecheck/lint/build ve 22 backend testi başarılıdır.

### 2 Ağustos 2026 — Faz 3.5 Adım 4 kabul testi

- Açık kullanıcı onayıyla gerçek Binance Demo hesabında, önceden açık emri veya pozisyonu bulunmayan `ADAUSDT` paritesi kullanıldı.
- Hesap geçici olarak `GO` executor'a geçirildi; mark fiyatının %4 altındaki `0.16690` fiyatından `36 ADA` limit emir açıldı ve borsada açık olduğu doğrulandıktan sonra iptal edildi.
- `38 ADA` büyüklüğünde, `2x ISOLATED` küçük market LONG pozisyonu açıldı; borsa snapshot'ında kaldıraç ve margin mode doğrulandı.
- Pozisyonun tamamı ters yönlü piyasa emriyle ve `reduceOnly=true` olarak kapatıldı.
- Test sonunda `ADAUSDT` için açık emir ve açık pozisyon sayılarının sıfır olduğu bağımsız olarak doğrulandı.
- Hesap executor'ı `TYPESCRIPT` durumuna geri getirildi ve geçici cutover servisleri kapatıldı.
- İlk aşırı düşük fiyat denemesi Binance dinamik percent-price bandı tarafından güvenli biçimde reddedildi; borsada emir oluşmadı ve hata yolundaki otomatik `TYPESCRIPT` geri dönüşü de doğrulandı.
- Faz 3.5 Adım 4 kabul kriterleri tamamlandı. Kalıcı Go cutover ayrıca planlanıp onaylanana kadar hesaplar güvenli varsayılan olarak `TYPESCRIPT`, Go servis modu ise `shadow` kalacaktır.

### 2 Ağustos 2026 — Faz 4 / Adım 5 gerçek zamanlı altyapı

- `20260802010000_add_trading_outbox` migration'ı ile kullanıcı ve borsa hesabı sahipliğine bağlı, artan cursor'lı ve deduplication key korumalı kalıcı event/outbox tablosu eklendi.
- Go engine aktif Binance Demo hesaplarını executor'dan bağımsız keşfeder; private stream yalnızca `TRADING_ENGINE_REALTIME_ENABLED=true` ve shadow read açıkken başlar.
- Binance listen key başlangıcı, 30 dakikalık keepalive, WebSocket ping/pong heartbeat ve 1–30 saniyelik exponential reconnect backoff uygulandı.
- Her ilk bağlantı ve reconnect öncesinde açık emir/pozisyon REST snapshot'ı alınarak `SNAPSHOT_RECONCILED` olayı yazılır.
- `ORDER_TRADE_UPDATE`, `ACCOUNT_UPDATE` ve listen-key expiry mesajları credential içermeyen normalize outbox olaylarına dönüştürülür.
- Node tarafına admin authentication ve hesap sahipliği korumalı, cursor/replay destekli SSE endpointi eklendi.
- Node manuel emir akışı `SUBMITTING`, `CANCELING`, `CLOSING` ve sonuç durumlarını outbox'a sıralı yazar.
- Frontend açık emir ve pozisyon ekranları SSE'ye bağlandı; ara durumları satır üzerinde gösterir, kesin exchange veya snapshot olayında REST listesini sayfa yenilemeden günceller.
- Canlı salt-okunur Binance Demo doğrulamasında `SNAPSHOT_RECONCILED` ve `STREAM_CONNECTED` olayları outbox'a yazıldı; Go executor kapalı ve hesap `TYPESCRIPT` kaldı.
- Güncel doğrulama: Go testleri, backend 22 test/typecheck/lint/build, frontend typecheck/build ve SSE cursor replay testi başarılıdır.

Sonraki adım Faz 4 / Adım 6'dır: belirsiz emir reconciliation worker'ı, engine restart recovery kapısı ve başarısız mutabakatta hesap `DEGRADED` güvenlik durumu.

### 2 Ağustos 2026 — Gün sonu checkpoint

Bugün bırakılan kararlı durum:

- Faz 3.5 Adım 4 Binance Demo kabul testi tamamlandı; limit aç/iptal ve küçük market aç/reduce-only kapat akışları Go executor ile doğrulandı.
- Faz 4 Adım 5 tamamlandı: Binance private WebSocket, listen-key keepalive, heartbeat, exponential reconnect, REST snapshot recovery, kalıcı event/outbox, Node SSE ve frontend canlı güncelleme hazır.
- Yerel MySQL'e `20260802010000_add_trading_outbox` migration'ı uygulandı.
- Canlı shadow testinde `SNAPSHOT_RECONCILED` ve `STREAM_CONNECTED` olayları doğrulandı.
- Frontend `3000`, Node backend `4000`, Go realtime engine `8081` portunda çalışır durumda bırakıldı.
- Go realtime engine `shadow` modunda ve exchange executor kapalıdır; Binance Demo hesabının kalıcı executor değeri `TYPESCRIPT` olarak doğrulandı.
- Go test/vet/build, backend 22 test/typecheck/lint/build, frontend typecheck/build ve SSE cursor replay testi başarılıdır.
- Mevcut Go süreci yerel geliştirme sürecidir; bilgisayar veya süreç yeniden başlarsa `TRADING_ENGINE_MODE=shadow`, `TRADING_ENGINE_SHADOW_READ_ENABLED=true` ve `TRADING_ENGINE_REALTIME_ENABLED=true` ile tekrar başlatılmalıdır. Secret değerler dokümana veya Git'e yazılmayacaktır.

Yarın başlanacak ilk iş — Faz 4 / Adım 6:

1. `RECONCILIATION_REQUIRED` emirleri client order ID ile Binance'ten sorgulayan worker.
2. Engine başlangıcında açık emir/pozisyon snapshot'ı tamamlanana kadar write/bot readiness kapısı.
3. Yerel emir state'i ile borsa snapshot'ı arasındaki farkları idempotent düzeltme.
4. Mutabakat başarısızlığında hesap için `DEGRADED` durumu ve yeni bot emirlerini engelleme.
5. Reconciliation, restart recovery ve kopma senaryoları için Go/backend testleri ve Binance Demo salt-okunur kabul testi.

### 2 Ağustos 2026 — Faz 4 / Adım 6 tamamlandı

- Go engine'e Binance emirlerini `clientOrderId` ile salt-okunur sorgulayan reconciliation worker eklendi; belirsiz write işlemleri borsaya yeniden gönderilmez.
- Worker açık emir ve pozisyon REST snapshot'ını alır; yerel `GO` emirlerini açık snapshot veya tekil emir sorgusuyla idempotent biçimde `OPEN`, `PARTIALLY_FILLED`, `FILLED`, `CANCELED` ya da `FAILED` durumuna getirir.
- Borsaya gönderilmeden önce süreç kesilmiş `SUBMITTING` kayıtları yeni emir oluşturmadan güvenli biçimde `FAILED` yapılır.
- Emir düzeltmesi ile `ORDER_RECONCILED` outbox olayı aynı MySQL transaction'ında kalıcılaştırılır.
- `ExchangeConnectionStatus.DEGRADED` eklendi. Mutabakatı başarısız bir `GO` hesabı `DEGRADED` olur; hesap çözümleme katmanı bu hesaptan yeni manuel veya bot emri kabul etmez. Sağlıklı periyodik mutabakat hesabı yeniden `CONNECTED` yapar.
- HTTP liveness servis başlangıcında erişilebilir kalır; `/health/ready` reconciliation tamamlanana kadar `503 not_ready` döner. Internal status bu sırada executor'ı `disabled` gösterir.
- Startup mutabakatı tamamlanınca servis atomik olarak `ready` olur; bundan sonra 30 saniyelik periyodik reconciliation ve private WebSocket manager başlar.
- `20260802120000_add_exchange_degraded_status` migration'ı yerel MySQL'e uygulandı.
- Binance Demo salt-okunur restart kabulünde ilk readiness cevabı `503`, snapshot sonrasında `ready` olarak doğrulandı. Hesap `TYPESCRIPT / CONNECTED`, engine `shadow` ve executor `disabled` kaldı; yeni `SNAPSHOT_RECONCILED` ile `STREAM_CONNECTED` olayları kalıcı outbox'a yazıldı.
- Doğrulamalar başarılıdır: Go test/vet/build, reconciliation ve readiness senaryo testleri, backend typecheck/lint/build ve 22 test, frontend typecheck/build.

Sonraki adım Faz 4 / Adım 7'dir: merkezi risk motoru, kill switch ve bot scheduler güvenlik kapısı. Bu katman tamamlandıktan sonra ilk otomatik strateji kontrollü biçimde geliştirilecektir.

Uygulama sırası:

1. Hesap ve strateji bazlı risk limitlerinin veri modeli: maksimum açık pozisyon/notional, günlük zarar, maksimum kaldıraç, bakiye rezervi ve işlem sıklığı.
2. Go order manager önünde hem manuel hem bot emirlerinin zorunlu geçtiği merkezi pre-trade risk engine.
3. Global, hesap ve bot seviyesinde kalıcı kill switch; `DEGRADED` veya reconciliation-not-ready durumunda fail-closed davranış.
4. Bot scheduler yaşam döngüsü ve restart recovery; yalnızca readiness ile risk motoru sağlıklı olduğunda strateji çalıştırma.
5. İlk strateji için paper/shadow sinyal üretimi, ardından Binance Demo'da düşük limitli kontrollü kabul. Gerçek/live işlem bu aşamada kapalı kalacaktır.

### 2 Ağustos 2026 — Faz 4 / Adım 7 risk motoru temeli

Tamamlanan ilk bölüm:

- `TradingRiskProfile`, global `TradingRiskControl`, kalıcı `TradingRiskEvent`, risk karar enum'ları ve emir kaynağı modeli eklendi.
- `20260802170000_add_trading_risk_engine` migration'ı yerel MySQL'e uygulandı; mevcut her borsa hesabına güvenli başlangıç profili oluşturuldu.
- Başlangıç profili Demo için emir başına `100 USDT`, başlangıç teminatı `50 USDT`, hesap açık notional `500 USDT`, maksimum `5` pozisyon, `5x` kaldıraç, `20 USDT` rezerv, dakikada `10` ve günde `100` emir sınırlarıyla oluşturulur. Bu değerler admin risk API'sinden değiştirilebilir.
- Go merkezi pre-trade risk engine; kaldıraç, emir notional/teminatı, toplam açık notional, açık pozisyon sayısı, parite pozisyon sayısı, USDT rezervi, emir sıklığı ve izinli/yasaklı sembol kurallarını string-decimal aritmetiğiyle uygular.
- Mark fiyatı, pozisyon, bakiye, risk profili veya kullanım ölçümü doğrulanamazsa yeni risk artırıcı emir fail-closed olarak engellenir.
- Reduce-only pozisyon azaltma emirleri global veya hesap kill switch sırasında güvenli çıkış yolu olarak açık kalır; yine `RISK_REDUCING_EXIT` kararıyla kayıt altına alınır. Emir iptali de engellenmez.
- Risk kontrolü Go order manager içinde exchange `ConfigurePosition` ve `PlaceOrder` çağrılarından önce zorunlu çalışır. Risk reddinde borsaya hiçbir write isteği gönderilmez ve yerel emir açık hata koduyla `FAILED` olur.
- Her risk kararı `trading_risk_events` tablosuna, aynı transaction içinde SSE'ye ulaşacak `trading.risk` outbox olayına yazılır.
- Global ve hesap seviyesinde kalıcı kill switch, zorunlu sebep, admin audit log ve outbox olayları eklendi.
- Yeni borsa hesabı risk profiliyle aynı transaction içinde oluşturulur. Risk profili hazır değilse veya kill switch aktifse hesap `GO` executor'a geçirilemez.
- `DEGRADED`, `ERROR` veya `DISABLED` hesaplarda TypeScript dahil yeni manuel işlem de engellenir.
- Günlük zarar alanı veri modelinde PnL defteri için ayrıldı; gerçek realized-PnL/fee/funding kaynağı tamamlanmadan API'den ayarlanamaz ve uygulanıyormuş gibi gösterilmez.

Admin API yüzeyi:

- `GET /api/admin/trading/exchange-accounts/:id/risk-profile`
- `PATCH /api/admin/trading/exchange-accounts/:id/risk-profile`
- `GET /api/admin/trading/exchange-accounts/:id/risk-events`
- `POST /api/admin/trading/risk/kill-switch`

Doğrulama sonucu: Go test/vet/build, merkezi risk senaryoları, backend typecheck/lint/build ve `25` test, frontend typecheck/build başarılıdır. Yerel veritabanında hesap/risk profili bire bir eşleşmesi ve kill switch'lerin kapalı başlangıç durumu doğrulandı.

Adım 7 henüz tamamen bitmedi. Sıradaki somut iş bot domain modeli ve scheduler yaşam döngüsüdür: kontrollü bot state machine, restart sırasında `RECONCILING`, lease/heartbeat, readiness-risk-kill-switch kapıları ve önce yalnızca shadow/paper runner.

### 2 Ağustos 2026 — Sohbet devir checkpoint'i

Yeni sohbet bu bölümden devam etmelidir.

#### Projenin mevcut aşaması

- Faz 3.5 Go manuel emir altyapısı ve Binance Demo kabulü tamamlandı.
- Faz 4 Adım 5 gerçek zamanlı private WebSocket, kalıcı outbox, Node SSE ve sayfa yenilemeden emir/pozisyon güncellemesi tamamlandı.
- Faz 4 Adım 6 reconciliation, restart readiness kapısı ve `DEGRADED` hesap izolasyonu tamamlandı.
- Faz 4 Adım 7'nin risk motoru bölümü tamamlandı; bot domain modeli, scheduler ve strateji runner henüz yapılmadı.
- Binance Demo hesabının kalıcı executor değeri güvenli biçimde `TYPESCRIPT` durumundadır. Kalıcı `GO` cutover yapılmadı.
- Live/gerçek para işlemi kapalıdır. Gerçek para ortamına geçiş için yetki verilmedi ve bu aşamada planlanmıyor.
- Kabul için açılan geçici Go süreçleri kapatıldı; frontend, Node ve Go servislerinin çalıştığı varsayılmamalıdır.
- Faz 4 değişiklikleri çalışma ağacındadır; yeni oturum mevcut dosyaları korumalı, reset/geri alma yapmamalıdır.

#### Neden arayüzde büyük değişiklik görülmedi?

Bu aşamaya kadar ağırlıkla altyapı ve güvenlik katmanları geliştirildi:

- Borsaya iki kez emir gönderilmesini önleyen idempotency ve execution claim.
- WebSocket kopması, restart ve kayıp borsa cevabında state kurtarma.
- Gerçek kaldıraç/margin mode ve reduce-only emir akışları.
- Kalıcı event/outbox ve SSE canlı güncelleme omurgası.
- Merkezi risk kontrolleri ve kill switch.

Risk ayar ekranı ve bot ekranları henüz frontend'e eklenmediği için son risk motoru değişiklikleri görsel değildir. Mevcut arayüzde görülebilen önceki değişiklikler executor bilgisi, doğru pozisyon kaldıraç/margin alanları ve SSE ile otomatik tablo yenilemesidir.

#### Sıradaki görünür dikey teslimat

Sadece arka uç geliştirmek yerine aşağıdaki parçalar tek bir uçtan uca teslimat olarak uygulanmalıdır:

1. `TradingBot` veri modeli, bot tipi/modu ve kontrollü state machine: `DRAFT`, `VALIDATING`, `STARTING`, `RUNNING`, `PAUSED`, `STOPPED`, `RISK_BLOCKED`, `RECONCILING`, `EMERGENCY_STOPPED`, `ERROR`.
2. Restart recovery için lease, heartbeat, desired-state ve scheduler sahipliği.
3. Admin bot API'leri: listele, oluştur, doğrula, başlat, duraklat, devam ettir, durdur ve acil durdur.
4. Frontend'de gerçek **Botlar** sayfası: bot listesi, durum rozetleri, bağlantı/risk engeli, temel oluşturma sihirbazı ve başlat/durdur kontrolleri.
5. İlk aşamada yalnızca `SHADOW/PAPER` runner: sinyal ve varsayımsal emir üretir, Binance'e write göndermez; kararları outbox/SSE üzerinden ekranda canlı gösterir.
6. Shadow kabulünden sonra mevcut merkezi order manager ve risk engine üzerinden düşük limitli Binance Demo emir kabulü. Strateji exchange adapter'a doğrudan erişemez.

İlk başlanacak somut iş: bot Prisma migration'ı + Go bot state machine + Node bot API sözleşmesi. Aynı çalışma diliminde frontend Botlar sayfasının ilk kullanılabilir görünümü de eklenmelidir.

#### Son doğrulama durumu

- Go: test, vet ve build başarılı.
- Backend: typecheck, lint, build ve `25` test başarılı.
- Frontend: typecheck ve production build başarılı.
- Uygulanan son migration'lar: `20260802120000_add_exchange_degraded_status` ve `20260802170000_add_trading_risk_engine`.
- Mevcut hesap/risk profili eşleşmesi `1/1`; global ve hesap kill switch kapalıdır.

### 2 Ağustos 2026 — Bot dikey teslimat checkpoint'i

Sohbet devir checkpoint'inde tanımlanan ilk görünür bot dilimi tamamlandı:

- `20260802190000_add_trading_bots` migration'ı yerel MySQL veritabanına uygulandı. `TradingBot` modeli; tip/mod, kontrollü state, desired-state, lease, scheduler owner, heartbeat, son karar ve optimistic version alanlarını içeriyor.
- Go engine'e merkezi ve testli bot state machine, restart sırasında `RECONCILING`, atomik MySQL lease alma/bırakma, bağlantı-risk-kill-switch kapısı ve periyodik scheduler eklendi.
- Scheduler yalnızca `SHADOW` ve `PAPER` botlarını çalıştırıyor. İlk runner exchange adapter veya order executor bağımlılığı taşımıyor; `submittedToExchange: false` varsayımsal kararını `trading.bot / BOT_SHADOW_DECISION` outbox event'i olarak yayımlıyor. `DEMO` modu kilitli.
- Node admin API sözleşmesi eklendi: listele, oluştur, doğrula, başlat, duraklat, devam ettir, durdur ve acil durdur. Bot oluşturma sözleşmesi yalnızca `SHADOW/PAPER` kabul ediyor ve testnet/demo hesap sahipliği ile merkezi güvenlik kapılarını kontrol ediyor.
- Frontend'e `/admin/trading/bots` altında gerçek Botlar sayfası, canlı SSE yenilemesi, durum/bağlantı/risk rozetleri, yaşam döngüsü kontrolleri ve üç adımlı SCALPING/GRID oluşturma sihirbazı eklendi.
- Go bot scheduler varsayılan olarak kapalıdır. Kontrollü shadow kabulü için `TRADING_ENGINE_SHADOW_READ_ENABLED=true` yanında `TRADING_ENGINE_BOT_SCHEDULER_ENABLED=true` verilmelidir.

Doğrulama sonucu: Go test/vet/build, backend typecheck/lint/build ve `30` test, frontend typecheck/build başarılıdır. Prisma client normal engine ile yeniden üretildi ve 8 migration'ın tamamının güncel olduğu doğrulandı.

Sıradaki kabul adımı servisleri kontrollü biçimde açıp bir SHADOW bot oluşturarak heartbeat, state ve `BOT_SHADOW_DECISION` SSE akışını gözlemlemektir. Bu kabul tamamlanmadan Binance Demo bot emri açılmayacak veya gönderilmeyecektir.

### 2 Ağustos 2026 — Strateji karar motoru ve kalıcı karar geçmişi

- SCALPING botları ardışık mark fiyatları arasındaki baz-puan değişimini yapılandırılan `signalThresholdBps` eşiğiyle karşılaştırır; yön filtresine göre `BUY`, `SELL` veya `HOLD` kararı üretir.
- GRID botları fiyatın tanımlı alt/üst sınırlar içindeki seviyesini izler; aşağı seviye geçişinde `GRID_BUY`, yukarı geçişinde `GRID_SELL`, aralık dışında `OUT_OF_RANGE` kararı üretir.
- İlk çevrim yalnızca referans fiyatı oluşturur ve `WARMING_UP` olarak kaydedilir.
- `TradingBotDecision` modeli ve `20260802210000_add_trading_bot_decisions` migration'ı eklendi. Her çevrimde fiyat, referans fiyat, ölçümler ve varsa varsayımsal PAPER emri aynı transaction içinde kalıcılaştırılır.
- Node API'ye son 50 kararı döndüren `GET /api/admin/trading/bots/:id/decisions` endpoint'i eklendi. Bot kartı açılır karar geçmişinde son kayıtları gösterir.
- Strateji runner yalnızca borsanın salt-okunur mark fiyatı endpoint'ini kullanır. SHADOW kararları emir oluşturmaz; PAPER kayıtlarında `submittedToExchange: false` zorunludur. Exchange write/order manager bağlantısı hâlâ yoktur ve `DEMO` modu kilitlidir.

Sıradaki iş PAPER sanal fill, pozisyon ve gerçekleşmiş/gerçekleşmemiş PnL defteridir. Bu katmandan sonra kontrollü SHADOW kabulü yapılacak; Binance Demo bot emri ayrıca açık kabul adımı ve kullanıcı onayı olmadan etkinleştirilmeyecektir.

### 2 Ağustos 2026 — PAPER fill, pozisyon ve PnL defteri

- `TradingBotPaperPosition` ve `TradingBotPaperFill` modelleri ile `20260802220000_add_trading_bot_paper_ledger` migration'ı eklendi ve yerel MySQL'e uygulandı.
- PAPER sinyalleri varsayılan `4 bps` ücret ve `2 bps` slippage ile sanal fill'e dönüştürülür. Bu varsayımlar bot yapılandırmasında saklanır; borsaya write isteği gönderilmez.
- Net miktar ve ağırlıklı ortalama giriş fiyatı tutulur. Ters yönlü fill mevcut pozisyonu kısmen/tamamen kapatabilir veya LONG/SHORT yönünü değiştirebilir.
- Her çevrimde brüt gerçekleşmiş PnL, gerçekleşmemiş PnL ve toplam sanal ücret güncellenir. Arayüzdeki net PnL, `gerçekleşmiş - ücret + gerçekleşmemiş` olarak gösterilir.
- Karar, sanal fill, pozisyon güncellemesi ve `BOT_PAPER_DECISION` outbox olayı aynı MySQL transaction'ında kaydedilir.
- `GET /api/admin/trading/bots/:id/paper-performance` endpoint'i güncel sanal pozisyonu ve son 50 fill'i döndürür. Bot kartında yön, miktar, ortalama giriş, PnL, ücret ve fill sayısı gösterilir.

Sıradaki kabul adımı scheduler'ı salt-okunur SHADOW modunda kontrollü açarak gerçek mark fiyatlarıyla heartbeat ve karar akışını gözlemlemektir. PAPER defteri bundan sonra ayrı bir kontrollü simülasyon kabulüyle çalıştırılabilir; Binance Demo order manager bağlantısı hâlâ kilitlidir.

### 2 Ağustos 2026 — Kontrollü SHADOW kabulü

- Strateji mark fiyatı okuyucusu private hesap çözümlemesinden ayrıldı. Scheduler yalnızca hesap sahipliği/provider/environment bilgisini MySQL'den, mark fiyatını ise borsanın halka açık endpoint'inden alır; credential vault ve API anahtarı kullanmaz.
- Bot scheduler `TRADING_ENGINE_MODE=shadow`, `TRADING_ENGINE_BOT_SCHEDULER_ENABLED=true`, private shadow/realtime kapalı olacak şekilde başlatıldı. Go engine `8081` üzerinde `ready` durumuna geçti.
- Mevcut `BTC TEST` SHADOW botu restart recovery ile `ERROR -> STARTING -> RECONCILING -> RUNNING` yolunu tamamladı.
- İlk gerçek çevrimde `BTCUSDT` mark fiyatı okunarak `WARMING_UP` kararı kalıcı `trading_bot_decisions` kaydına yazıldı; heartbeat, lease sahibi ve son karar zamanı güncellendi.
- Kabul sırasında exchange write endpoint'i bağlı değildi, credential çözülmedi ve Binance'e emir gönderilmedi.

Sıradaki kabul PAPER botunun arayüzden oluşturulması, iki veya daha fazla sinyal çevrimi sonrasında sanal fill/pozisyon/PnL görünümünün doğrulanmasıdır. Binance Demo bot emri bu kabulden sonra da ayrıca kilitli kalacaktır.

### 2 Ağustos 2026 — Trading admin ürün ekranları

- Admin menüsündeki `Grid Bot`, `Kâr / Zarar`, `Risk Yönetimi` ve `Sistem Durumu` placeholder'ları kaldırılarak gerçek route ve ekranlara dönüştürüldü.
- Grid Bot ekranı yalnızca GRID botlarını listeler ve sihirbazı GRID stratejisiyle kilitli açar; mevcut state/karar/PAPER kontrollerini kullanır.
- Kâr/Zarar ekranı tüm PAPER botların sanal pozisyonlarını toplar; gerçekleşmiş, gerçekleşmemiş, ücret sonrası net PnL ve fill sayılarını bot bazında gösterir.
- Risk Yönetimi ekranı hesap risk profilini, merkezi limitleri, global/hesap kill switch'lerini ve son risk kararlarını mevcut audit/outbox korumalı API'lere bağlar.
- Sistem Durumu ekranı backend/veritabanı, borsa hesabı, bot state'leri, global kill switch ve canlı işlem kilidini tek noktada gösterir. Trading overview artık global risk kontrolünü ve Go `/health/ready` durumunu dinamik okur.
- Admin-first ürün sınırı korunmaktadır. Kullanıcı hesaplarına açılmadan önce sahiplik, kota/paket, fon tahsis limiti ve kullanıcı seviyesinde kill switch modeli ayrıca uygulanacaktır.
- AI sinyal katmanı doğrudan exchange adapter'a bağlanmayacaktır. AI çıktısı sürümlü/açıklanabilir bir sinyal kaydı olarak önce SHADOW/PAPER runner'a, daha sonra merkezi risk motoru ve sınırlı Demo order manager'a girecektir.

### 2 Ağustos 2026 — PAPER yaşam döngüsü kabulü

- `BTC PAPER KABUL` botu gerçek public `BTCUSDT` mark fiyatıyla `WARMING_UP -> BUY -> SELL` kararlarını ve sanal fill'leri üretti. Pozisyon, gerçekleşen/gerçekleşmemiş PnL, ücret ve slippage kayıtları arayüzde kullanılan performans API'sinden doğrulandı.
- Duraklatma sırasında karar sayısının sabit kaldığı, devam ettirmeden sonra yeniden arttığı doğrulandı.
- Hesap kill switch'i açıldığında bot `RISK_BLOCKED` durumuna geçti; kilit kaldırılınca güvenlik kapılarından geçerek tekrar `RUNNING` oldu.
- Scheduler restart kabulünde önceki lease sahibi bırakılarak yeni süreç botları geri aldı. Son doğrulamada her iki çalışan botun scheduler sahibi `Kripto:19260`, heartbeat ve karar zamanları günceldi.
- Kabulün tamamı PAPER/SHADOW sınırında yapıldı. Credential çözülmedi, private hesap verisi okunmadı ve Binance'e emir gönderilmedi.

Kabul işlemleri tekrar çalıştırılabilir ve idempotent script'lerle belgelenmiştir: `npm run acceptance:paper`, `npm run acceptance:paper-lifecycle` ve salt-okunur `npm run acceptance:bot-signals`.

### 2 Ağustos 2026 — Kontrollü sinyal defteri ve AI güvenlik sınırı

- `TradingBotSignal` modeli ve `20260802230000_add_trading_bot_signal_ledger` migration'ı eklendi. Kaynak (`RULE_ENGINE`/`AI_MODEL`), yön, durum, güven seviyesi, açıklama, model/prompt sürümü, özellikler, güvenlik kontrolleri ve son kullanma zamanı tutulabilir.
- Go scheduler her strateji kararını aynı transaction içinde bir `RULE_ENGINE` sinyaline dönüştürür. `GRID_BUY/BUY -> BUY`, `GRID_SELL/SELL -> SELL`; bekleme ve ısınma kararları `HOLD` olarak kaydedilir.
- Her mevcut sinyalin güvenlik kaydı `riskGatePassed: true`, `submittedToExchange: false` ve `orderExecutionAllowed: false` değerlerini taşır. Böylece açıklama kaydı oluşsa bile sinyal exchange adapter'a erişemez.
- Node yalnızca sahiplik kontrollü `GET /api/admin/trading/bots/:id/signals` okuma endpoint'ini sunar. AI sinyali yazma veya sinyalden emir üretme endpoint'i henüz yoktur.
- Bot kartında en güncel sinyalin kaynağı, yönü, güveni, açıklaması ve emir yetkisinin kapalı olduğu görünür. Sistem Durumu ekranındaki `AI emir yetkisi: Kapalı` güvenlik göstergesi korunur.
- Restart sonrası kabulde `BTC PAPER KABUL` için `RULE_ENGINE/SELL`, `BTC TEST` için `RULE_ENGINE/HOLD` sinyalleri yeni süreç tarafından kalıcılaştırıldı.

Sıradaki güvenli adım AI model sağlayıcısını exchange katmanından tamamen ayrı, yalnızca `OBSERVED` sinyal üreten bir adapter olarak eklemektir. Bu sinyaller önce SHADOW/PAPER karşılaştırma ve kalite ölçümünden geçecek; otomatik Binance Demo emir yetkisi bu ölçümler, merkezi risk bütçesi ve ayrıca kontrollü kabul tamamlanmadan açılmayacaktır.

### 2 Ağustos 2026 — AI observer ve SHADOW karşılaştırma kabulü

- Provider bağımsız HTTP AI observer adapter'ı eklendi. Adapter yalnızca sürümlü public fiyat/kural bağlamı gönderir; exchange credential, emir miktarı ve order manager bağımlılığı taşımaz.
- Güvenli cevap sözleşmesi `HOLD/BUY/SELL`, `0..1` güven, açıklama ve `1..900` saniye geçerlilik ile sınırlandı. HTTPS zorunludur; HTTP yalnızca localhost geliştirme kabulünde kullanılabilir. Çağrı süresi en fazla 2 saniyedir.
- AI hatası botu `ERROR` durumuna düşürmez ve kural kararını engellemez. Model çıktısı yalnızca `AI_MODEL / OBSERVED` kaydıdır; `paperFillAllowed=false`, `orderExecutionAllowed=false` ve `submittedToExchange=false` değerleri transaction içinde kalıcılaştırılır.
- Aynı `TradingBotDecision` altında kural ve AI sinyalini saklamak için `20260802233000_allow_multiple_bot_signals_per_decision` migration'ı uygulandı. Toplam 12 migration günceldir.
- Bot kartına aynı decision üzerindeki `RULE_ENGINE` ve `AI_MODEL` sinyallerini, güvenlerini, açıklamalarını, model/prompt sürümünü ve son kayıtlardaki yön uyumunu yan yana gösteren SHADOW karşılaştırması eklendi.
- Yerel deterministic kabul gateway'iyle gerçek scheduler çevrimleri çalıştırıldı. `BTC PAPER KABUL` ve `BTC TEST` için `AI_MODEL / OBSERVED` kayıtları oluştu; kabul modeli `deterministic-shadow-stub`, güven `%74` olarak doğrulandı.
- Kabul gateway'i kapatıldı. Kalıcı Go scheduler PID `3268` ile AI observer kapalı güvenli varsayılanda çalışıyor; önceki OBSERVED karşılaştırma kayıtları arayüzde incelenebilir.

Sıradaki adım observer sinyallerini gelecekteki fiyat sonucu ile etiketleyen kalite ölçüm defteridir: yön doğruluğu, ücret/slippage sonrası varsayımsal sonuç, maksimum ters hareket ve model/prompt sürümü bazında karşılaştırma. Bu metrikler yeterli örnek toplamadan AI'ya PAPER fill veya Demo emir yetkisi verilmeyecektir.

### 2 Ağustos 2026 — Grid planı ve bot modülü geçiş checkpoint'i

- Grid bot sihirbazının son adımı artık kayıttan önce borsanın güncel vadeli mark fiyatını, sembol tick/quantity kurallarını ve yapılandırmayı kullanarak görünür plan oluşturur.
- Aritmetik plan alt ve üst fiyat dahil `gridLevels` adet fiyat çizgisi üretir. Örneğin 10 seviye 9 aralık demektir. Her satırda fiyat, güncel marka göre `BUY/SELL/WAIT`, miktar, notional,  kaldıraç sonrası tahmini başlangıç teminatı ve mark fiyatına uzaklık gösterilir.
- Özet bölümünde fiyat adımı, BUY/SELL sayısı, azami plan notional ve tahmini azami başlangıç teminatı görünür. Mark fiyatı aralık dışındaysa yanlış emir beklentisi oluşturmamak için bütün seviyeler `WAIT` kalır.
- Grid planı yalnızca oluşturma önizlemesi değildir. Kayıtlı bot kartındaki **Bot detayları ve grid planı** alanı kalıcı `configuration` üzerinden planı güncel mark fiyatıyla yeniden üretir. Scalping botlarında da kayıtlı parametreler aynı detay alanında gösterilir.
- Node sözleşmeleri: `POST /api/admin/trading/bots/grid-plan/preview` ve sahiplik kontrollü `GET /api/admin/trading/bots/:id/grid-plan`.
- Mevcut destek açıkça `FUTURES / NEUTRAL / ARITHMETIC` ile sınırlandırılmıştır. Sihirbazda SPOT görünür ancak seçilemez; spot envanter/bakiye tahsis modeli tamamlanmadan spot bot oluşturulamaz.
- Plan satırları açık borsa emri değildir ve `submittedToExchange=false` taşır. Mevcut runner seviye geçişinde tek `GRID_BUY/GRID_SELL` kararı üretmeye devam eder; tek çevrimde atlanan her seviyeyi ayrı fill işleme ve gerçek limit emir merdiveni ilerideki grid-runtime işidir.
- Futures planındaki teminat tahminine tasfiye, funding ve değişken komisyon dahil değildir. PAPER fill defteri ücret/slippage varsayımını ayrıca uygular; gerçek borsa sonucu garantisi vermez.
- Saf grid plan hesapları ETH `1800–1900`, 10 seviye, 10x örneği ve aralık dışı `WAIT` davranışıyla test edildi. Backend `32` test, typecheck/lint/build; frontend typecheck/build başarılıdır. Veritabanındaki 12 migration günceldir.

#### Bot modülünün bu checkpoint'teki kullanılabilir durumu

- Kullanılabilir: admin Botlar/Grid sayfaları, sihirbaz, öğretici rehber, SCALPING ve GRID SHADOW/PAPER scheduler, durum/lease/restart yönetimi, PAPER pozisyon-fill-PnL, karar ve sinyal geçmişi, risk/kill switch, AI OBSERVED karşılaştırması, futures grid plan önizleme ve kayıtlı bot detayları.
- Güvenlik kilitleri: live trading kapalı, AI emir yetkisi kapalı, Demo bot order-manager bağlantısı kapalı, spot grid kapalı.
- Bot modülünde daha sonra ele alınacak işler: spot envanter grid'i; LONG/SHORT/NEUTRAL futures grid ayrımı; geometrik grid; atlanan her seviyeyi ayrı işleyen runtime; tasfiye/funding hesabı; AI kalite etiketleri ve ancak kontrollü onaydan sonra küçük Binance Demo kabulü.

Bu checkpoint'ten sonra ürün geliştirmesi diğer admin sayfalarına taşınabilir. Bot dosyaları ve güvenlik sınırları korunmalı; yukarıdaki ertelenmiş maddeler yeni bir bot çalışma dilimi açılana kadar otomatik olarak etkinleştirilmemelidir.
