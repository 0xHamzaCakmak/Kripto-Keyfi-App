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
