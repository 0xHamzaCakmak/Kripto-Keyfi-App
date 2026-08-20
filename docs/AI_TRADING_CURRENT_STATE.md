# KriptoKeyfi AI Trading — Mevcut Sistem Denetimi

## 1. Kapsam ve Sonuç

Bu belge PROMPT 0 kapsamında, 20 Ağustos 2026 tarihindeki repository durumu üzerinden hazırlanmıştır. İnceleme salt okunur yapılmış; mevcut manual trade, grid bot, exchange entegrasyonu, veritabanı şeması veya production davranışı değiştirilmemiştir.

Depoda istenen `docs/AI_TRADING_IMPLEMENTATION_PROMPTS.md` yerine PROMPT 0–38'i içeren `docs/AI_TRADING_IMPLEMENTATION_PROMPTS_UPDATED.md` bulunduğu için denetimde bu güncel dosya kaynak alınmıştır.

Sistem sıfırdan başlamamaktadır. Mevcut yapı şunları halihazırda sağlar:

- Admin-only Node.js Trade Operations API ve React yönetim ekranları
- Binance Futures testnet ve Bybit V5 demo adapterları
- İki adımlı ve idempotent manual order akışı
- TypeScript ve hesap bazlı Go executor seçimi
- Go tarafında fail-closed risk kontrolü, execution claim, reconciliation ve outbox
- SCALPING/GRID için SHADOW/PAPER bot scheduler'ı
- Basit fee/slippage içeren paper fill, pozisyon ve PnL defteri
- Karşılaştırma amaçlı, emir yetkisi olmayan opsiyonel AI observer

Hedef Autonomous AI Trading mimarisinin Strategy Registry, versiyonlu strategy/bot domain'i, Arena, gelişmiş paper simulation, performans/skor, rejim, Champion/Challenger, Memory, Teacher, Researcher ve Evolution katmanları henüz yoktur.

## 2. Mevcut Mimari

```text
React Admin (/admin/trading)
        |
        v
Node.js / Express Admin API
  - auth + ADMIN rolü
  - exchange account / manual order / bot / risk API
  - Prisma + MySQL
  - SSE outbox gateway
        |
        +---------------- TypeScript executor ----------------+
        |  Binance/Bybit adapter -> demo/testnet exchange      |
        |
        +---------------- Go trading engine -------------------+
           internal token + account-level cutover
           -> validation -> central risk -> idempotent claim
           -> Binance/Bybit writer -> demo/testnet exchange

Go bot scheduler (ayrı yol)
  MySQL lease -> safety gate -> public mark-price poll
  -> SCALPING/GRID rule evaluation
  -> SHADOW decision veya PAPER fill/position ledger
  -> signal + decision + outbox
  -> exchange order executor'a bağlı değil
```

### 2.1 Node.js backend

Ana trade modülü `backend/src/modules/trading` altındadır:

- `trading.routes.ts`: Tüm trade endpointlerini `authenticate` ve `ADMIN` rol kontrolü arkasında toplar.
- `exchange-account.service.ts`: Borsa hesabı oluşturma/test etme, AES-256-GCM credential vault kullanımı, bakiye okuma ve executor cutover kontrolü.
- `manual-trading.service.ts`: Symbol listesi, order preview, idempotent submit, open order, cancel, position listesi ve reduce-only close.
- `exchanges/*`: Ortak `ExchangeAdapter` sözleşmesi ile Binance Futures ve Bybit V5 implementasyonları.
- `bot.service.ts`: Bot oluşturma, doğrulama, start/pause/resume/stop/emergency-stop ve audit/outbox yazımı.
- `grid-plan.service.ts`: Futures grid seviyelerini ve tahmini margin/notional değerlerini hesaplayan, emir göndermeyen planlayıcı.
- `risk.service.ts`: Risk profili ve global/account kill switch admin yönetimi ile risk olaylarını okuma.
- `trading-engine.client.ts`: Internal token ile Go shadow snapshot ve execution endpointlerine erişim.
- `shadow-compare.ts`: TypeScript reader sonuçlarını Go shadow snapshot ile karşılaştıran, response'u etkilemeyen arka plan kontrolü.
- `trading-events.service.ts`: MySQL outbox'ını cursor tabanlı SSE ile admin frontend'e aktarır.
- `trading.service.ts`: Genel trade overview ve `liveTradingEnabled: false` güvenlik bildirimi.

Node process içindeki düzenli worker'lar haber, YouTube, YouTube metrics ve chat reconciliation içindir. Trading bot scheduler Node içinde çalışmaz; Go servisinin bağımsız worker'ıdır.

### 2.2 Go trading engine

`services/trading-engine` bağımsız bir Go servisidir:

- `cmd/trading-engine/main.go`: HTTP servis, startup reconciliation, scheduler ve private realtime manager yaşam döngüsünü yönetir.
- `internal/config`: Varsayılan engine modu `shadow`; `cutover`, realtime, shadow read, scheduler ve AI observer ayrı opt-in ayarlarıdır.
- `internal/httpapi`: Health/status, shadow snapshot ve yalnızca cutover'da bağlanan write endpointleri.
- `internal/exchange`: Ortak reader/writer sözleşmesi; Binance ve Bybit demo/testnet implementasyonları.
- `internal/execution`: Stored order eşleşmesi, idempotent claim/replay, merkezi risk onayı ve exchange write sırası.
- `internal/risk`: Global/account kill switch, notional, margin, leverage, exposure, position count, bakiye rezervi ve order-rate kontrolleri.
- `internal/reconciliation`: Startup ve periyodik order/position reconciliation; hata halinde GO hesabını `DEGRADED` yapar.
- `internal/realtime`: Şu anda Binance private stream discovery/reconnect yönetimi ve durable outbox.
- `internal/bot`: Lease tabanlı scheduler, state machine, SCALPING/GRID rule runtime, PAPER fill/position muhasebesi ve comparison-only AI observer.
- `internal/storage/mysql`: Node ile aynı Prisma tablolarını doğrudan SQL üzerinden kullanır.

### 2.3 Güvenli çalışma modları

- Exchange environment enum'u yalnızca `TESTNET` ve `DEMO` içerir; production/live environment modeli yoktur.
- Bot modu `SHADOW`, `PAPER`, `DEMO` ile sınırlıdır; `LIVE` bot modu yoktur.
- Bot oluşturma yalnızca testnet/demo hesaplarına izin verir.
- `DEMO` bot start işlemi ayrıca kilitlidir; scheduler yalnız `SHADOW` ve `PAPER` çalıştırır.
- Go engine varsayılanı `shadow`'dur. Write endpointleri yalnız `cutover` + shadow read + database ownership koşulunda bağlanır.
- Node'dan Go write çağrısı ayrıca `TRADING_ENGINE_EXECUTION_ENABLED=true` gerektirir.
- AI observer varsayılan kapalıdır, yalnız shadow scheduler ile çalışır ve `orderExecutionAllowed=false`, `paperFillAllowed=false`, `submittedToExchange=false` olarak kaydedilir.
- Overview sözleşmesi live trading'i açıkça `false` döndürür.
- PAPER güvenli bir moddur fakat mevcut bot create contract'ında `mode` zorunludur; henüz otomatik PAPER varsayılanı yoktur.

## 3. Mevcut Akışlar

### 3.1 Exchange account ve credential akışı

Admin bir Binance testnet veya Bybit demo hesabı ekler. Node adapter credential/permission doğrulaması yapar; credential değerleri şifreli saklanır, API key yalnız hint olarak response'a çıkar. Her hesapla birlikte varsayılan risk profili oluşturulur. `canTrade` ve `withdrawalEnabled` gözlem alanları saklanır.

Hesap varsayılan olarak `TYPESCRIPT` executor kullanır. `GO` cutover için:

- bekleyen/reconciliation gereken emir bulunmamalı,
- risk profili aktif ve kill switch'ler kapalı olmalı,
- backend Go execution feature flag'i açık olmalı,
- Go status endpointi write-ready olmalıdır.

Cutover audit log'a yazılır.

### 3.2 Manual order lifecycle

1. Admin symbol kurallarını ve mark price'ı exchange adapter veya Go snapshot üzerinden okur.
2. Order preview tick/step, quantity, leverage, min notional ve gerekli price/stop alanlarını doğrular; kısa ömürlü `ManualOrderPreview` kaydı oluşturur.
3. Submit, preview'ı atomik olarak consume eder ve kullanıcı bazlı idempotency key ile `TradingOrder` oluşturur.
4. Hesap executor'ına göre TypeScript adapter veya Go execution servisi çağrılır.
5. Sonuç `OPEN/FILLED/FAILED/RECONCILIATION_REQUIRED` gibi durumlara yazılır; audit ve outbox event üretilir.
6. Cancel idempotency bilgisi tutulur. Position close, ters yönlü `reduceOnly` market order preview + submit akışını yeniden kullanır.

Go yolunda exchange write öncesi merkezi risk motoru zorunlu ve fail-closed'dur. Mevcut TypeScript manual submit yolunda aynı merkezi risk evaluator çağrısı bulunmamaktadır; bu, live/execution hardening aşamasında kırmadan ele alınması gereken kritik farktır.

### 3.3 Order ve position yönetimi

- Node, seçili executor üzerinden açık emirleri ve pozisyonları exchange'den okur.
- TypeScript reader aktifken aynı read sonucu opsiyonel Go shadow snapshot ile karşılaştırılır.
- Go execution, idempotent DB claim uygular; belirsiz exchange sonucu yeniden emir göndermek yerine reconciliation gerektirir.
- Reconciliation worker açık emir ve pozisyon snapshot'ı alır, terminal order'ı client order ID ile sorgular, lokal durumu düzeltir ve outbox'a snapshot yazar.
- Binance private stream order/account olaylarını normalize edip durable outbox'a yazar; reconnect öncesi REST reconciliation yapar. Bybit private WebSocket henüz yoktur.

### 3.4 Grid bot

- Mevcut GRID yalnız futures, neutral direction ve arithmetic spacing şemasını destekler.
- Grid planı exchange symbol rule ve mark price ile server-side hesaplanır; preview hiçbir order göndermez.
- Runtime mark price'ın grid seviyelerini geçmesini takip edip `GRID_BUY`, `GRID_SELL`, `HOLD` veya `OUT_OF_RANGE` kararı üretir.
- PAPER modunda tek bir net sanal pozisyon defterine fill işler.
- Çok seviyeli crossing, spot inventory grid, funding, liquidation ve gelişmiş fill modeli henüz yoktur.

### 3.5 Bot scheduler ve paper akışı

- Scheduler MySQL'den `desiredState=RUNNING` botları `FOR UPDATE SKIP LOCKED` ve lease ile tek tek sahiplenir.
- Restart/owner değişiminde bot `RECONCILING` olur.
- Account aktifliği, connection status, risk profile ve global/account kill switch kontrol edilmeden `RUNNING` olmaz.
- Her bot çevriminde provider'a ait public mark-price endpointi çağrılır; son bot karar fiyatı reference olarak DB'den okunur.
- Rule runtime yalnız SCALPING ve GRID destekler.
- SHADOW karar/signal kaydı üretir; PAPER ayrıca fee/slippage ile fill, realized/unrealized PnL ve net position kaydeder.
- Bot scheduler exchange execution servisini çağırmaz.

Mevcut scheduler ortak market stream kullanmaz. Aynı symbol için çok bot olduğunda mark price her bot çevriminde ayrı okunur; bu nedenle hedef 100-bot Arena için doğrudan ölçekleme noktası değildir.

### 3.6 Market data

Mevcut trade market verisi şunlarla sınırlıdır:

- REST symbol rules
- REST mark price
- private account order/position/balance snapshotları
- Binance private order/account WebSocket olayları

OHLCV/candle bus, order book, spread, funding, open interest, liquidation, volatility, dominance veya standardize `MarketContext` bulunmamaktadır. Haber, YouTube ve KOL/whale benzeri ürün modülleri olsa da trade runtime'a bağlı bir Market Intelligence katmanı yoktur.

## 4. Mevcut Veritabanı Modelleri

Trade ile doğrudan ilişkili Prisma modelleri:

- `ExchangeAccount`: Provider/environment/account type, encrypted credential, permission durumu, connection state ve executor ownership.
- `ManualOrderPreview`: Doğrulanmış, süreli manual order önizlemesi.
- `TradingOrder`: İdempotency/client order ID, execution engine, lifecycle state ve failure/reconciliation alanları.
- `TradingRiskProfile`: Hesap başına notional, margin, leverage, exposure, position, balance reserve ve frequency limitleri.
- `TradingRiskControl`: Global kill switch.
- `TradingRiskEvent`: Risk karar ledger'ı.
- `TradingAuditLog`: Admin ve lifecycle audit olayları.
- `TradingOutboxEvent`: Durable realtime/event aktarımı.
- `TradingBot`: SCALPING/GRID, SHADOW/PAPER/DEMO, runtime state, lease ve JSON configuration.
- `TradingBotDecision`: Rule runtime kararları ve hypothetical order/metrics snapshot'ı.
- `TradingBotSignal`: Rule veya comparison-only AI signal ledger'ı.
- `TradingBotPaperPosition`: Bot başına tek net paper position ve kümülatif PnL/fee.
- `TradingBotPaperFill`: Decision başına paper fill maliyet kaydı.

Hedef mimarideki `Strategy`, `StrategyVersion`, `Generation`, genel `BotInstance`, zengin `PaperTrade`, `BotMetric`, `MarketRegimeSnapshot`, `ChampionCandidate` ve ayrık/yeniden kullanılabilir `RiskProfile` domain modelleri bulunmamaktadır. Mevcut `TradingBot` ve `TradingRiskProfile` sonraki promptlarda duplicate üretmeden değerlendirilmelidir.

## 5. Admin API Endpointleri

Tüm endpointler `/api/admin/trading` altında authenticate + ADMIN rolü gerektirir.

### Genel ve hesap

- `GET /overview`
- `GET|POST /exchange-accounts`
- `POST /exchange-accounts/:id/test`
- `POST /exchange-accounts/:id/execution-engine`
- `GET /exchange-accounts/:id/balances`
- `DELETE /exchange-accounts/:id`

### Manual trade ve activity

- `GET /symbols`
- `POST /orders/preview`
- `POST|GET /orders`
- `POST /orders/:id/cancel`
- `GET /positions`
- `POST /positions/:id/close`
- `GET /events` (SSE)

### Bot ve grid

- `GET|POST /bots`
- `POST /bots/grid-plan/preview`
- `GET /bots/:id/grid-plan`
- `GET /bots/:id/decisions`
- `GET /bots/:id/signals`
- `GET /bots/:id/paper-performance`
- `POST /bots/:id/{validate|start|pause|resume|stop|emergency-stop}`

### Risk

- `GET|PATCH /exchange-accounts/:id/risk-profile`
- `GET /exchange-accounts/:id/risk-events`
- `POST /risk/kill-switch`

Go internal API'si Bearer internal token gerektirir:

- `GET /health/live`, `GET /health/ready`
- `GET /internal/v1/status`
- `GET /internal/v1/shadow/accounts/:id/snapshot`
- Cutover'da: `POST /internal/v1/execution/orders/preview`, `/orders`, `/orders/cancel`

## 6. Yeniden Kullanılabilecek Parçalar

1. Prisma/MySQL migration düzeni, Decimal kullanım standardı ve transaction kalıpları.
2. `ExchangeAccount`, encrypted credential vault, provider/environment sahiplik doğrulaması.
3. Node `ExchangeAdapter` ve Go reader/writer contract'ları ile demo/testnet endpoint ayrımı.
4. `TradingOrder` idempotency, client order ID, reconciliation state ve outbox altyapısı.
5. Go execution service'in risk-before-write ve fail-closed sırası.
6. `TradingRiskProfile`, global/account kill switch ve risk event ledger'ı.
7. `TradingBot` lease/state machine altyapısı; yeni `BotInstance` ihtiyaçlarıyla kontrollü biçimde genişletilebilir veya ilişkilendirilebilir.
8. `TradingBotDecision`, `TradingBotSignal`, paper position/fill tabloları; Trade Memory ve gelişmiş PaperTrade için başlangıç verisi olabilir.
9. Go scheduler'ın lease izolasyonu ve bir bot hatasının diğer botu durdurmayan cycle modeli.
10. SSE + durable outbox; Arena, generation, promotion ve risk olayları için genişletilebilir.
11. Zod request validation, admin auth/role middleware ve stabil response helper'ları.
12. Mevcut React trade route/layout ve `tradingService.ts` API istemcisi, sonraki frontend fazlarında korunabilir.

## 7. Eksikler ve Hedef Mimariyle Farklar

### Domain ve lifecycle

- Strategy Registry ve strategy family/version/schema/range modeli yok.
- Bot ile strategy version arasında ayrık ilişki, generation ve parent lineage yok.
- Hedef lifecycle (`CANDIDATE`, `CHALLENGER`, `CHAMPION`, `LIVE_ELIGIBLE`, `LIVE`, vb.) mevcut runtime state machine'den farklı ve henüz modellenmemiştir.
- Bot mode ile lifecycle/state kavramları bugün tek `TradingBot` üzerinde runtime odaklıdır.

### Paper ve Arena

- Ortak market stream/event fan-out yok; mark price bot başına çekiliyor.
- 100 bot benchmark veya Arena coordinator yok.
- Paper engine maker/taker ayrımı, spread, funding, leverage/margin accounting, tick/lot/min-order execution guard, stop/TP, liquidation approximation, latency veya partial fill modelini desteklemiyor.
- Starting paper balance/equity curve ve çoklu pozisyon/portfolio muhasebesi yok.

### Ölçüm ve seçim

- BotMetric snapshot, ROI, drawdown, Sharpe/Sortino/Calmar, expectancy, PF, turnover ve holding metrics yok.
- Risk-adjusted score/leaderboard yok.
- Market regime classifier ve rejim bazlı performance yok.
- Minimum evidence gate, Champion/Challenger ve promotion audit akışı yok.

### Öğrenme ve intelligence

- Trade Memory/Market Memory yok.
- TeacherEvaluation, ResearchHypothesis, Mutation, Crossover, EvolutionRun ve Generation yok.
- Standardize/versioned MarketContext ve freshness/caching sözleşmesi yok.
- AI observer yalnız karşılaştırma yapar; provider-independent AI Decision pipeline veya structured autonomous decision modeli değildir.

### Risk ve live hazırlık

- Go risk motorunda max weekly loss, max drawdown, min R:R, stop-loss-required, cooldown, consecutive-loss lock ve tam günlük loss enforcement yok.
- `maxDailyLoss` şemada bulunmasına rağmen realized PnL/fee defteri tamamlanmadığı için uygulanmıyor.
- TypeScript manual execution yolu Go merkezi risk evaluator'ını kullanmıyor.
- Stale market data guard ve stop order verification eksik.
- Risk profili admin API ile değiştirilebilir; ileride AI/Teacher/Researcher/Evolution kimliklerinin bunu değiştirememesi capability/authorization sınırıyla garanti edilmelidir.
- Live environment ve live bot yolu henüz yoktur; bu güncel durumda güvenli bir eksikliktir.

### Operasyon ve test

- Trading için Node process worker/scheduler yok; mevcut Go scheduler bağımsız process olarak deploy edilmelidir.
- Bybit private realtime stream yok.
- Backend testlerinde schema, grid plan ve adapter testleri var; Node manual service lifecycle/risk integration kapsamı sınırlı.
- 100-bot, market regime, disconnect/stale-data, promotion/evolution ve end-to-end simulation suite yok.

## 8. Önerilen Entegrasyon Noktaları

1. **Core domain modelleri:** Prisma'ya additive tablolar eklenmeli. Mevcut `TradingBot` hemen yeniden adlandırılmamalı; manual/grid API contract'larını koruyacak ilişki veya kademeli genişletme tercih edilmeli.
2. **Strategy Registry:** Node backend içinde yeni autonomous trading modülü olarak başlayıp Zod/JSON schema validation standardını kullanmalı. Mevcut SCALPING/GRID runtime adapterları registry'ye bağlanan ilk built-in family'ler olabilir.
3. **Bot Factory:** Mevcut `TradingBot` create/state servisinin güvenlik kapılarını yeniden kullanmalı; default PAPER uygulama katmanında açıkça atanmalı ve mevcut request contract'ına geriye uyumluluk sağlanmalı.
4. **Paper Engine:** Go `internal/bot/paper_ledger.go` ayrık, deterministic execution servisine dönüştürülebilir. Mevcut fill/position tabloları migrate edilirken veri kaybı olmamalı.
5. **Arena/Market Stream:** Go içinde symbol/timeframe anahtarlı shared event cache/fan-out eklenmeli. Scheduler'ın bot başına REST poll'u geriye uyumlu fallback olarak korunabilir.
6. **Performance/Score:** Node orchestration/persistence ve saf hesap servisleri uygun; paper fill/decision ledger giriş kaynağıdır. Hesap fonksiyonları DB'den bağımsız deterministic test edilmelidir.
7. **Risk:** Autonomous order yolu mutlaka Go risk evaluator veya eşdeğer merkezi gateway'e bağlanmalı. TypeScript manual yolu değiştirilirken ayrı bir hardening/cutover planı ve güçlü regression test gerekir.
8. **Memory/Teacher/Researcher/Evolution:** Node backend'de ayrı modüller ve additive tablolar; ürettikleri sonuçlar öneri/candidate olmalı, execution veya mutable live risk ayarına erişmemeli.
9. **Market Intelligence:** Mevcut haber/YouTube/KOL veri servisleri yalnız doğrulanmış timestamp ve source provenance ile adapter arkasından bağlanmalı; eksik veri `unknown/null` kalmalıdır.
10. **Admin API/UI:** Mevcut `/api/admin/trading` namespace, auth ve layout korunmalı; autonomous endpointler stabil DTO'larla alt namespace veya çakışmayan route'lar olarak eklenmelidir.

## 9. Riskli Değişiklik Alanları

### Kritik

- `TradingBot` enum/state veya tablo adını doğrudan değiştirmek mevcut Go SQL sorgularını, Node API'yi ve frontend tiplerini aynı anda kırar.
- `TradingOrder`, idempotency unique constraint'leri veya reconciliation state'lerinde destructive değişiklik duplicate exchange order riski doğurur.
- Executor cutover, Go mode/feature flag veya exchange environment davranışını değiştirmek live execution etkisi sayılmalıdır ve kullanıcı onayı gerektirir.
- TypeScript executor'a merkezi risk eklemek doğru hedef olsa da mevcut manual trade davranışını değiştirir; ayrı prompt ve açık regression doğrulaması olmadan yapılmamalıdır.
- Credential schema, master key veya API permission davranışına dokunmak onay gerektirir. Withdrawal izni istenmemeli veya kullanılmamalıdır.

### Yüksek

- Paper ledger'ı zenginleştirirken mevcut fill/PnL semantiğini geriye dönük değiştirmek raporları bozabilir; yeni version/model veya kontrollü backfill gerekir.
- Ortak market stream'e geçerken event ordering, freshness, duplicate ve reconnect semantiği bot kararlarını değiştirebilir.
- Bot lifecycle ile autonomous promotion lifecycle aynı enum'a sıkıştırılmamalıdır; runtime ve qualification durumları ayrılmalıdır.
- Risk ayarlarının AI servislerinden teknik olarak erişilemez olması yalnız convention ile değil module/API authorization ile sağlanmalıdır.

### Orta

- Outbox büyümesi için retention/archival stratejisi yoktur.
- `ExchangeAccount` silme cascade ile order/bot/history verilerini silebilir; autonomous memory eklenirken delete policy ayrıca değerlendirilmelidir.
- Scheduler saniyede tek bot lease ediyor; 100 bot hedefinde throughput ve market-data request sayısı ölçülmelidir.

## 10. Korunacak Güvenlik İnvariantları

- Live trading varsayılan kapalı kalacak.
- Yeni autonomous botlar PAPER varsayılanıyla doğacak; SHADOW hiçbir exchange order göndermeyecek.
- AI/Teacher/Researcher/Evolution doğrudan exchange writer'a erişmeyecek.
- Her gelecekteki autonomous execution merkezi Risk Engine onayı olmadan ilerlemeyecek; risk servisi hata verirse yeni pozisyon fail-closed engellenecek.
- Mevcut manual trade, grid plan/runtime, exchange adapter ve account-level executor contract'ları geriye uyumlu kalacak.
- Testlerde gerçek production exchange kullanılmayacak; mevcut demo/testnet ayrımı korunacak.

## 11. Baseline Doğrulama

PROMPT 0 sonunda çalıştırılan kontroller:

- Backend: `npm test -- --run` — PASS, 35 test dosyası / 147 test.
- Backend: `npm run typecheck` — PASS.
- Backend: `npm run build` — PASS.
- Go engine: `go test ./...` — PASS.
- Go engine: `go vet ./...` — PASS.
- Go engine: `go build ./cmd/trading-engine` — PASS.
- Frontend: `npm run lint` — PASS (`tsc --noEmit`).
- Frontend: `npm run build` — PASS.

Backend test çıktısında mevcut analytics test double'ının bulunmayan `create` fonksiyonu için yakalanıp loglanan uyarılar görülmüştür; testler başarısız olmamış ve bu PROMPT 0 dokümantasyon değişikliğiyle ilişkili değildir.

Migration oluşturulmamış, production verisi değiştirilmemiş ve exchange çağrılı acceptance testi çalıştırılmamıştır.
