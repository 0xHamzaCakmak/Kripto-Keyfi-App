# KriptoKeyfi Trading Engine

Go trading engine'in Faz 3.5 Adım 1 servis temelidir. Bu sürüm zorunlu olarak `shadow` modundadır ve borsaya emir gönderemez.

## Yerel çalıştırma

En az 32 karakterlik rastgele bir internal token tanımlayın. Secret değerini repoya yazmayın.

```powershell
$env:TRADING_ENGINE_TOKEN = '<random-internal-token>'
& 'C:\Program Files\Go\bin\go.exe' run ./cmd/trading-engine
```

Endpointler:

```text
GET /health/live
GET /health/ready
GET /internal/v1/status   Authorization: Bearer <TRADING_ENGINE_TOKEN>
```

## Shadow read doğrulaması

Adım 3 ile Binance Demo ve Bybit Demo için bakiye, sembol, açık emir ve pozisyon reader adapterları eklenmiştir. Go engine'in mevcut şifreli hesap kasasını doğrudan MySQL üzerinden okuyabilmesi için backend ile aynı `DATABASE_URL` ve `TRADING_CREDENTIALS_MASTER_KEY` değerleri process environment içinde tanımlanır. Değerler repoya yazılmaz.

```powershell
$env:TRADING_ENGINE_SHADOW_READ_ENABLED = 'true'
$env:DATABASE_URL = '<mysql-url>'
$env:TRADING_CREDENTIALS_MASTER_KEY = '<64-character-hex-key>'
```

Korumalı snapshot endpointi:

```text
GET /internal/v1/shadow/accounts/{accountId}/snapshot?userId={userId}
Authorization: Bearer <TRADING_ENGINE_TOKEN>
```

Node tarafındaki arka plan karşılaştırması aşağıdaki ayarla açılır. Karşılaştırma hataları kullanıcı yanıtını etkilemez; TypeScript mevcut executor olmaya devam eder.

```text
TRADING_ENGINE_SHADOW_COMPARE_ENABLED=true
TRADING_ENGINE_URL=http://127.0.0.1:8081
TRADING_ENGINE_TOKEN=<same-internal-token>
```

Doğrulama:

```powershell
& 'C:\Program Files\Go\bin\go.exe' test ./...
& 'C:\Program Files\Go\bin\go.exe' vet ./...
& 'C:\Program Files\Go\bin\go.exe' build ./cmd/trading-engine
```

Sonraki adım manuel emir yürütmesinin hesap bazlı feature flag ile Go order manager'a geçirilmesidir. Executor cutover tamamlanana kadar `TRADING_ENGINE_MODE=active` reddedilir.

## Internal API sözleşmesi

Versioned `internal/api/v1` sözleşmesi hesap, sembol kuralı, bakiye, emir, pozisyon ve normalize borsa hatası modellerini tanımlar. Tüm finansal değerler JSON sınırından string olarak geçer. Exchange üzerinde değişiklik yapan her komut için `idempotencyKey` ve `clientOrderId` zorunludur.

Yazma komutları `shadow` modunda HTTP router'a bağlanmaz. Servis bu moddayken emir açma, iptal veya pozisyon kapatma isteği kabul etmez.

## Hesap bazlı executor cutover

Go write endpointleri yalnızca kontrollü cutover modunda açılır:

```text
TRADING_ENGINE_MODE=cutover
TRADING_ENGINE_SHADOW_READ_ENABLED=true
```

Korumalı endpointler:

```text
POST /internal/v1/execution/orders/preview
POST /internal/v1/execution/orders
POST /internal/v1/execution/orders/cancel
```

Bir isteğin write endpointine ulaşması tek başına yeterli değildir. İlgili `exchange_accounts.executionEngine` alanı `GO` olmalı; aksi durumda Go engine emri reddeder. Backend tarafında da `TRADING_ENGINE_EXECUTION_ENABLED=true` olmadan hesap Go executor'a geçirilemez.

Order submit ve cancel işlemleri borsaya çıkmadan önce MySQL üzerinde atomik claim edilir. Aynı idempotency komutu ikinci kez geldiğinde yeni borsa isteği gönderilmez; tamamlanmış sonuç replay edilir veya belirsiz deneme `RECONCILIATION_REQUIRED` olur.

## Private stream ve outbox

Binance Demo private user-data stream'i executor'dan bağımsız olarak salt-okunur `shadow` modunda çalıştırılabilir. Bu özellik açıkken aktif Binance test hesapları bulunur, bağlantıdan önce REST açık emir/pozisyon snapshot'ı alınır ve ardından private WebSocket olayları kalıcı `trading_outbox_events` tablosuna yazılır.

```text
TRADING_ENGINE_MODE=shadow
TRADING_ENGINE_SHADOW_READ_ENABLED=true
TRADING_ENGINE_REALTIME_ENABLED=true
```

- Listen key 30 dakikada bir yenilenir.
- WebSocket ping/pong heartbeat ve 1–30 saniye exponential reconnect backoff kullanır.
- Her reconnect öncesinde REST snapshot mutabakatı yapılır.
- `ORDER_TRADE_UPDATE`, `ACCOUNT_UPDATE` ve listen-key expiry olayları normalize edilir.
- Credential, internal authorization veya master key event payload'ına ve loglara yazılmaz.
- Node SSE endpointi: `GET /api/admin/trading/events?exchangeAccountId=...&cursor=...`

Kalıcı servis kurulumunda `TRADING_ENGINE_REALTIME_ENABLED=true` verilmeden private stream başlamaz. Go order executor ayrıca açılmadıkça borsaya emir gönderme endpointleri kapalı kalır.
