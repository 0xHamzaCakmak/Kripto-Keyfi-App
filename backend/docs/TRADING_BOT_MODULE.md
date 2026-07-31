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
