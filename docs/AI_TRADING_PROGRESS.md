# AI Trading Implementation Progress

## Current State

Last completed prompt: PROMPT 38
Current prompt: NONE
Status: COMPLETED — PAPER/SHADOW + CONTROLLED TESTNET GO EXECUTION APPROVED; PRODUCTION LIVE NOT APPROVED
Updated at: 2026-08-22

## Completed

- PROMPT 0 — COMPLETED
- PROMPT 1 — COMPLETED
- PROMPT 2 — COMPLETED
- PROMPT 3 — COMPLETED
- PROMPT 4 — COMPLETED
- PROMPT 5 — COMPLETED
- PROMPT 6 — COMPLETED
- PROMPT 7 — COMPLETED
- PROMPT 8 — COMPLETED
- PROMPT 9 — COMPLETED
- PROMPT 10 — COMPLETED
- PROMPT 11 — COMPLETED
- PROMPT 12 — COMPLETED
- PROMPT 13 — COMPLETED
- PROMPT 14 — COMPLETED
- PROMPT 15 — COMPLETED
- PROMPT 16 — COMPLETED
- PROMPT 17 — COMPLETED
- PROMPT 18 — COMPLETED
- PROMPT 19 — COMPLETED
- PROMPT 20 — COMPLETED
- PROMPT 21 — COMPLETED
- PROMPT 22 — COMPLETED
- PROMPT 23 — COMPLETED
- PROMPT 24 — COMPLETED
- PROMPT 25 — COMPLETED
- PROMPT 26 — COMPLETED
- PROMPT 27 — COMPLETED
- PROMPT 28 — COMPLETED
- PROMPT 29 — COMPLETED
- PROMPT 30 — COMPLETED
- PROMPT 31 — COMPLETED
- PROMPT 32 — COMPLETED
- PROMPT 33 — COMPLETED
- PROMPT 34 — COMPLETED
- PROMPT 35 — COMPLETED
- PROMPT 36 — COMPLETED
- PROMPT 37 — COMPLETED
- PROMPT 38 — COMPLETED

## Current Prompt

No remaining implementation prompt.

PROMPT 38 final integration audit tamamlandı. Kullanıcı onaylı post-audit hardening ile F-01/F-02 kapatıldı ve bağlı Binance TESTNET hesabında kontrollü GO executor canary kabulü geçti. Production LIVE ve autonomous LIVE activation hâlâ mevcut/onaylı değildir.

## Last Test Result

- Post-audit F-01/F-02 backend regression: PASS — 59 files, 254 tests
- Post-audit backend build: PASS
- Post-audit Go unit/integration tests: PASS — `go test ./...`
- Post-audit Go static analysis: PASS — `go vet ./...`
- Post-audit frontend typecheck/lint and production build: PASS
- Controlled Binance TESTNET GO executor acceptance: PASS — 0.01 ETHUSDT MARKET open `FILLED`, reduce-only close `FILLED`, remaining ETH position NONE
- Canary risk evidence: PASS — open `RISK_APPROVED`, close `RISK_REDUCING_EXIT`

- Backend unit/integration tests: PASS — 58 files, 252 tests
- Prisma schema validation: PASS
- Backend typecheck: PASS
- Backend build: PASS
- PROMPT 27 simulation suite: PASS — 1 file, 9 tests covering 16 named scenarios
- PROMPT 27 scoped backend ESLint: PASS
- Full backend ESLint baseline: FAIL — pre-existing user-owned `modules/kol/kol.service.ts` contains 14 `no-explicit-any` errors; PROMPT 38 AI Trading/trading/tests scope has no lint errors
- Go unit/integration tests: PASS — `go test ./...`
- Go static analysis: PASS — `go vet ./...`
- PROMPT 37 frontend typecheck/lint: PASS — `npm.cmd run lint`
- PROMPT 37 frontend production build: PASS — `npm.cmd run build`
- PROMPT 37 backend Shadow/portfolio/live-eligibility/manual/Grid regression: PASS — 6 files, 23 tests
- Frontend phase full backend regression: PASS — 58 files, 252 tests
- Frontend phase backend build: PASS
- Frontend phase Go unit/integration tests: PASS — `go test ./...`
- Frontend phase Go static analysis: PASS — `go vet ./...`
- PROMPT 38 full backend regression: PASS — 58 files, 252 tests
- PROMPT 38 backend build: PASS
- PROMPT 38 scoped AI Trading/trading/tests ESLint: PASS
- PROMPT 38 frontend typecheck/lint and production build: PASS
- PROMPT 38 Prisma validate/status: PASS — 45 migrations, schema up to date
- PROMPT 38 Go unit/integration and static analysis: PASS — `go test ./...`, `go vet ./...`
- PROMPT 38 autonomous Overview database smoke: PASS — API v1, PAPER/SHADOW, live disabled
- Manual/grid/exchange regression: PASS through existing adapter, schema, grid-plan, Go bot/risk/execution/reconciliation suites and full builds
- External exchange acceptance: NOT RUN — production exchange çağrısı yapılmadı
- Go race detector: NOT RUN — current Windows Go toolchain has CGO disabled; normal concurrency tests and `go vet` passed

Not: Backend testlerinde user-owned analytics test double'ına ait yakalanmış uyarı logları vardır; 252 testin tamamı geçmiştir.

## Last Changes

- Autonomous Strategy Registry runtime connected: `AUTONOMOUS + MOMENTUM` resolves to a PAPER/SHADOW-only momentum evaluator with dynamic stop-loss/take-profit and isolated-margin intent fields.
- Autonomous start API added with lifecycle `PAPER`, TESTNET/DEMO account, enabled risk profile and global/account kill-switch readiness gates.
- Idempotent `npm.cmd run bootstrap:ai-trading` creates one MOMENTUM strategy/version and Generation 1 population of 100 PAPER bots; repeat run creates/starts zero duplicates.
- Runtime acceptance: 100/100 bots RUNNING with 0 ERROR/RISK_BLOCKED. After warm-up, a BUY intent passed immutable risk with `RISK_APPROVED` and produced the first PAPER fill; non-manual exchange order count remained zero.
- Scheduler runtime defects found during acceptance were fixed: state-aware outbox deduplication keys and additive `AUTONOMOUS` support for `trading_bot_decisions.type`.
- F-01 resolved: risk-increasing TypeScript exchange writes fail closed with `CENTRAL_RISK_ENGINE_REQUIRED`; GO executor is mandatory. TypeScript reduce-only emergency exits and cancellations remain available.
- F-02 resolved: Arena ingress rejects events older than 2 minutes or future-skewed by more than 5 seconds before strategy/executor dispatch; immutable per-bot audit records include `STALE_MARKET_DATA` / `FUTURE_MARKET_DATA` evidence.
- Connected `Binance Test` account was moved from `TYPESCRIPT` to `GO` through the guarded service cutover and remains `TESTNET`, `CONNECTED`, withdrawal-disabled.
- Local backend runtime was configured for the TESTNET-only Go executor; Go writer continues to reject production environments.
- No schema migration, production data change, exchange permission change, withdrawal/transfer capability, or production order occurred.

- `AI_TRADING_FINAL_AUDIT.md` içinde PROMPT 38'in 13 kontrol maddesi kod, test ve runtime smoke kanıtlarıyla değerlendirildi.
- PAPER/SHADOW çalışma kilometre taşı onaylandı; autonomous production LIVE unavailable/not approved olarak bırakıldı.
- Legacy TypeScript manual executor merkezi Go Risk Engine kapsamı ve gerçek Arena absolute freshness guard eksikleri live-readiness blocker olarak kaydedildi.
- PROMPT 38 büyük refactor veya execution davranışı değişikliği yapmadı.

## Safety State

- Live trading default: OFF
- Go engine default mode: SHADOW
- Autonomous bot live mode: NOT PRESENT
- PAPER: safe supported mode; autonomous default PAPER
- AI observer: default OFF, comparison-only, no paper fill or order execution permission
- Trade Memory endpoints: read-only
- Teacher: recommendation-only; automatic application disabled
- Researcher: hypothesis-only; candidate/live creation disabled
- Mutation Engine: child candidate only; parent immutable; PAPER/SHADOW only
- Evolution: Bot Score fitness; PAPER children; LIVE/LIVE_ELIGIBLE protected
- Crossover: compatible schemas only; PAPER/CANDIDATE child; parents immutable
- Market Intelligence: versioned MarketContext v1; public read-only market data; 15-second cache and per-source freshness checks
- Missing BTC dominance/news/social/whale numeric sources: nullable with `UNKNOWN` status; no inferred or fabricated values
- Market Intelligence trade execution: NONE
- Strategy Router: deterministic PAPER-only selection; regime score, risk state and recent health gates; normalized weights
- Strategy Router audit: `AI_STRATEGY_ROUTED`; order submission and live activation paths absent
- Strategy Router fail-closed states: unknown/stale regime, kill switch, disabled risk/account, disconnected account, stale health/metrics
- Immutable autonomous Risk Engine: max trade risk, daily/weekly loss, drawdown, leverage, total/symbol exposure, concurrent positions, min R:R, required stop, margin policy, position size, cooldown, consecutive-loss lock and emergency stops
- Autonomous PAPER enforcement: risk approval is evaluated in the same DB transaction before paper fill; rejected/blocked signals cannot create fills
- Portfolio Allocator: deterministic, Champion-only, PAPER/SHADOW-only; risk-capped allocation with minimum cash reserve
- Portfolio allocation execution: NONE; outputs are persisted plans and audit records only
- Shadow market data: public live read-only endpoints; exchange writer capability is absent from strategy runner
- Shadow execution: NONE; simulated fills are isolated from PAPER and exchange order ledgers
- Live Eligibility: evidence-gated and auditable; direct lifecycle bypass disabled
- LIVE activation after eligibility: NOT PRESENT; explicit admin approval remains required
- Risk policy ownership: admin risk API only; Teacher/Researcher/Mutation/Evolution have no risk mutation or order submission path
- Manual execution hardening: risk-increasing TypeScript writes are disabled; guarded account cutover routes writes through the centralized Go Risk Engine. Grid remains plan/preview-only.
- Production exchange environment: NOT PRESENT
- Live execution hardening: stale/disconnected/production account fail-closed; post-write partial failures reconciliation-required
- Reconciliation retry: read-only and bounded; mutating exchange requests never auto-retried
- AI Decision interface: provider-independent, strict schema; Risk Gate approval is mandatory before the isolated execution port
- AI Decision exchange access: NONE
- Teacher/Researcher LLM adapters: optional, vendor-neutral, timeout-bounded, deterministic fallback enabled
- LLM code/live-risk mutation permission: NONE
- Autonomous observability: persistent-ledger metrics plus admin-only health/audit endpoints
- Error correlation: `X-Request-ID` / response `correlationId`
- Autonomous Admin API: v1 DTOs, ADMIN authorization, PAPER/SHADOW-only writes
- Manual promotion approval: audit-only pending activation; live remains unavailable
- Backend simulation suite: 16 scenarios, PAPER/SHADOW only, no exchange/network dependency

## Migration

### Autonomous decision compatibility — 2026-08-22

- Migration: `20260822060000_allow_autonomous_bot_decisions`.
- Additive only: `trading_bot_decisions.type` enum now accepts `AUTONOMOUS`; existing SCALPING/GRID rows are unchanged.
- Local `prisma migrate deploy`: PASS; repository/local database now contains 46 applied migrations.
- `prisma validate` and `prisma migrate status`: PASS; schema is up to date.
- Production database: not changed.

### Local migration application — 2026-08-22

- `prisma migrate deploy` ile bekleyen 13 migration yerel `127.0.0.1:3306/kriptokeyfi` veritabanına başarıyla uygulandı.
- Ön denetimde `DROP`, `TRUNCATE`, veri silme veya destructive dönüşüm bulunmadı; değişiklikler yeni tablolar, additive enum değerleri ve nullable/default'lu kolonlardan oluşuyor.
- `prisma migrate status`: PASS — 45 migration, database schema up to date.
- API health: PASS — HTTP 200, database connected.
- Migration sonrası backend regression: PASS — 58 test dosyası, 252 test.
- Production veritabanına migration uygulanmadı.

PROMPT 36: migration yok.

- Frontend risk/read-only exposure ve confirmation guard; schema, production veri veya execution kuralı değişmedi.

PROMPT 35: migration yok.

- Read-only performance frontend ve istemci-side metric/chart türetimi; schema veya production veri değişikliği yok.

PROMPT 34: migration yok.

- Read-only Trade Memory frontend ve typed query/DTO; schema veya production veri değişikliği yok.

PROMPT 33: migration yok.

- Read-only frontend Teacher/Researcher ekranları; schema/veri veya AI application davranışı değişmedi.

PROMPT 32: migration yok.

- Yalnız frontend Evolution ekranı ve mevcut PAPER-only admin endpointi; schema/veri migration veya live change yok.

PROMPT 31: migration yok.

- Frontend Champion ekranı ve mevcut safe admin API çağrıları; schema, production veri veya live execution değişikliği yok.

PROMPT 30: migration yok.

- Frontend Arena ve typed read contract ekleri; production schema/veri veya execution değişikliği yok.

PROMPT 29: migration yok.

- Yalnız frontend service, component ve route ekleri yapıldı; backend schema/veri ve execution davranışı değişmedi.

PROMPT 28: migration yok.

- Yalnız frontend architecture audit dokümanı eklendi; schema, production verisi ve runtime davranışı değişmedi.

PROMPT 27: migration yok.

- Yalnız test harness, testler, npm test komutu ve sonuç dokümanı eklendi; production schema/veri değişmedi.

PROMPT 26: migration yok.

- Mevcut bot, generation ve audit tabloları kullanılır; production schema/veri işlemi ve live activation yoktur.

PROMPT 25: migration yok.

- Mevcut decision metrics JSON ve trading audit ledger kullanılır; yeni tablo/kolon veya production veri işlemi yoktur.

PROMPT 24: migration yok.

- Mevcut Teacher evaluation ve Research hypothesis/audit tabloları kullanılır; production schema/veri değişmedi.

PROMPT 23: migration yok.

- Yalnız backend contract, orchestration portları ve testler eklendi; production schema/veri değişmedi.

PROMPT 22: migration yok.

- Mevcut schema korunur; Bybit reconciliation mevcut hesap/provider alanlarını kullanır.
- Production verisine veya exchange'e işlem uygulanmadı.

PROMPT 21: migration yok.

- Mevcut paper, metric, regime, shadow ve risk/audit kanıtları kullanılır; production schema veya verisi değiştirilmedi.

PROMPT 20: `20260821090000_add_shadow_trades`

- Additive migration; yalnız SHADOW action/simulation ledger'ı için `shadow_trades` tablosunu ekler.
- PAPER trade/fill tablolarını değiştirmez; mevcut tablo/kolon silmez ve production verisini dönüştürmez.
- Production verisine uygulanmadı.

PROMPT 19: `20260821080000_add_portfolio_allocations`

- Additive migration; yalnız immutable allocation plan çıktıları için `portfolio_allocations` tablosunu ekler.
- Mevcut tablo/kolon silmez, production verisini dönüştürmez veya silmez.
- Production verisine uygulanmadı.

PROMPT 18: `20260821070000_add_autonomous_risk_limits`

- Additive migration; yalnız `trading_risk_profiles` tablosuna güvenli default değerli autonomous risk policy kolonları ekler.
- Tablo/kolon silmez, mevcut veriyi dönüştürmez veya silmez; mevcut manual/live Go risk değerlendirmesi bu yeni kolonlara bağlanmadı.
- Production verisine uygulanmadı.

PROMPT 17: migration yok.

- Router kararları mevcut `trading_audit_logs` tablosuna yazılır; production schema veya verisi değiştirilmedi.

PROMPT 16: migration yok.

- Yalnızca read-only Market Intelligence servis/API katmanı eklendi; production schema veya verisi değiştirilmedi.

PROMPT 15: `20260821060000_add_bot_crossovers`

- Additive migration; `BotCreationMethod` enum'una `CROSSOVER` değerini ekler ve yalnız `bot_crossovers` lineage tablosunu oluşturur.
- Mevcut enum değerleri, tablo/kolonlar ve production verisi korunur; veri silme/dönüştürme yoktur.
- Production verisine uygulanmadı.

Önceki migration: `20260821050000_add_evolution_runs` (PROMPT 14)

- Additive migration; yalnız `evolution_runs` audit tablosunu, source/target generation foreign key'lerini ve indexleri oluşturur.
- Mevcut tablo/kolon silmez, production verisini dönüştürmez veya silmez.
- Production verisine uygulanmadı.

Önceki migration: `20260821040000_add_bot_mutations` (PROMPT 13)

- Additive migration; yalnız `bot_mutations` lineage tablosunu, foreign key'leri ve indexleri oluşturur.
- Parent bot foreign key'i `RESTRICT`; mutation mevcut parent kaydı değiştirmez.
- Mevcut tablo/kolon silmez, production verisini dönüştürmez veya silmez.
- Production verisine uygulanmadı.

Önceki migration: `20260821030000_add_research_hypotheses` (PROMPT 12)

- Additive migration; yalnız `research_hypotheses` tablosunu ve sorgu indexlerini oluşturur.
- `targetStrategyFamily` mevcut Prisma `StrategyFamily` enum değerleriyle birebir uyumludur.
- Mevcut tablo/kolon silmez, mevcut production verisini dönüştürmez veya silmez.
- Production verisine uygulanmadı.

Önceki migration: `20260821020000_add_teacher_evaluations` (PROMPT 11)

- Additive migration; yalnız `teacher_evaluations` tablosunu, foreign key'leri ve sorgu indexlerini oluşturur.
- Mevcut tablo/kolon silmez, mevcut production verisini dönüştürmez veya silmez.
- Production verisine uygulanmadı.

Önceki migration: `20260821010000_add_trade_memory_context` (PROMPT 10)

- Additive migration; mevcut `paper_trades` tablosuna nullable veya güvenli sıfır default'lu context alanları ve sorgu indexleri ekler.
- Tablo/kolon silmez, veri dönüştürmez ve mevcut trade kayıtlarını silmez.
- Production verisine uygulanmadı.

Önceki migration: `20260820020000_add_bot_factory_fields` (PROMPT 3)

- Additive migration; `TradingBotType` enum'una `AUTONOMOUS` ekler.
- Nullable factory creation method, symbols ve timeframe alanları ile additive index ekler.
- Production verisine uygulanmadı.

İlk AI trading migration: `20260820010000_add_ai_trading_core_domain` (PROMPT 1)

- Additive migration; mevcut tablo veya kolon silmez.
- Mevcut trading bot kayıtlarını değiştirmez; yeni alanlar nullable veya güvenli default içerir.
- Production verisine uygulanmadı.

## Open TODO

- F-01: RESOLVED — risk artıran TypeScript write fail-closed; kontrollü GO cutover ve merkezi Risk Engine zorunlu.
- F-02: RESOLVED — Arena absolute age/future-skew guard, kalıcı audit kararı ve boundary testleri eklendi.
- Operasyonel: 100-bot uzun süreli soak/load ve desteklenen ortamda Go race-detector kanıtı.
- Autonomous LIVE: henüz activation/order-dispatch yolu yoktur; production için ayrı tasarım, uygulama ve ikinci açık onay gerekir.

## Known Risks / Future Work

- Mevcut `TradingBot` Prisma enum/table yapısı Node, Go raw SQL ve frontend tarafından ortak kullanılıyor.
- TypeScript manual executor yalnız reduce-only acil çıkış/iptal için korunur; risk artıran write `CENTRAL_RISK_ENGINE_REQUIRED` ile reddedilir.
- Legacy bot scheduler aynı symbol için bot başına REST mark-price isteği yapıyor; yeni Go Arena shared stream fan-out kullanıyor.
- Teacher ve Researcher çıktıları daha sonraki promptlar tarafından tüketilse bile doğrudan mutation veya execution yetkisi kazanmamalı.
- PROMPT 38 kapanışında çalışma ağacı yalnız audit/progress doküman değişikliklerini içeriyor.

## Blockers

PROMPT dizisi tamamlandı. PAPER/SHADOW ve kontrollü TESTNET GO execution için teknik blocker yok. F-01/F-02 çözülmüştür. Production LIVE, production writer/account desteği ve autonomous activation bulunmadığı ve ayrıca ikinci açık onay verilmediği için varsayılan kapalı ve blokludur.

## Phase Checkpoints

### PHASE_CHECKPOINT 2 — Backend → Frontend

- Backend fazı PROMPT 27 ile tamamlandı; 58 test dosyası ve 252 test, backend typecheck/build, Go test/vet ve frontend regression build başarılıydı.
- Live trading kapalı, autonomous live activation bulunmuyor, PAPER/SHADOW güvenli modları ve fail-closed Risk Engine korunuyor.
- PROMPT 28 frontend audit'i kod değişikliği olmadan tamamlandı ve frontend planı oluşturuldu.

### PHASE_CHECKPOINT 3 — Final Audit

- PROMPT 0-38 dizisi tamamlandı ve `AI_TRADING_FINAL_AUDIT.md` oluşturuldu.
- PAPER/SHADOW approved; autonomous production LIVE unavailable/not approved.
- Full backend/frontend/Go/Prisma doğrulamaları başarılı; yalnız bilinen KOL ESLint baseline hataları kapsam dışı olarak devam ediyor.
- Production migration, gerçek exchange emri, API permission veya live execution değişikliği yapılmadı.

### PHASE_CHECKPOINT 4 — F-01/F-02 + Controlled TESTNET Cutover

- Tamamlanan kapsam: kullanıcı onaylı post-PROMPT hardening; F-01 ve F-02 resolved.
- Değişiklikler: merkezi Go Risk zorunluluğu, TypeScript risk-increasing write kilidi, Arena absolute freshness/future-skew fail-closed guard ve immutable audit persistence.
- Test: PASS — backend 59/254 + build; Go `test ./...` + `vet ./...`; frontend lint + production build.
- External acceptance: PASS — bağlı Binance TESTNET hesabı guarded service ile GO executor'a geçirildi; 0.01 ETHUSDT aç/kapat canary emirleri merkezi risk onayıyla `FILLED`, kalan pozisyon yok.
- Migration: Yok.
- API key/permission: Değişmedi; withdrawal kapalı kaldı.
- Safety: Production endpoint/account emirleri Go writer tarafından reddedilmeye devam eder; autonomous LIVE activation yoktur.
- TODO: Başlangıç strategy/version ve PAPER/SHADOW autonomous bot bootstrap; ardından uzun süreli Arena çalışması. Production LIVE ayrı onay gerektirir.

### PHASE_CHECKPOINT 5 — Autonomous PAPER Runtime Bootstrap

- Tamamlanan kapsam: Strategy Registry MOMENTUM runtime, guarded autonomous start, idempotent 100-bot PAPER bootstrap ve scheduler runtime acceptance.
- Runtime: 100/100 bot RUNNING; ilk tur 100/100 tamamlandı; warm-up sonrası karar/sinyal akışı devam ediyor, 0 ERROR/RISK_BLOCKED.
- Execution safety: ilk BUY intent `RISK_APPROVED` ile onaylandı ve 0.003 ETH, 7.55416053 USDT notional PAPER fill üretti. Audit `immutable=true` ve `submittedToExchange=false`; non-manual exchange order sayısı 0.
- Düzeltmeler: scheduler DB query strategy family join, dinamik stop/take protection, state-aware outbox dedup key, autonomous decision enum migration.
- Test: PASS — backend 59 dosya/254 test + build/typecheck; Go `test ./...` + `vet ./...`; frontend lint/build; Prisma validate/status 46/46.
- Migration: additive `20260822060000_allow_autonomous_bot_decisions`; local applied, production untouched.
- Bootstrap idempotency: PASS — second run `population=100`, `created=0`, `started=0`.
- Services: frontend 3000, backend 4000, trading engine 8081 health/readiness HTTP 200.
- Safety: Binance account TESTNET/GO/CONNECTED; withdrawal disabled; autonomous production LIVE unavailable.
- TODO: PAPER fill/risk intent gözlemi için sistemi çalışır bırakıp performans verisi biriktirmek; ardından scoring/Champion/Evolution döngüsünü gerçek persisted sonuçlarla doğrulamak.

## Prompt Checkpoints

### PROMPT 28

- Değişiklikler: Trade Operations frontend mimarisi, design system ve autonomous API contract audit'i; `AI_TRADING_FRONTEND_PLAN.md`.
- Test: PASS — frontend typecheck/lint ve production build.
- Migration: Yok.
- TODO: PROMPT 29 Overview uygulaması.

### PROMPT 29

- Değişiklikler: Typed autonomous API client, ortak AI Trading UI, nested layout ve API-backed Overview.
- Test: PASS — frontend lint/build; manual/Grid/risk 4 dosya ve 11 test.
- Migration: Yok.
- TODO: PROMPT 30 Arena ve bot detayları.

### PROMPT 30

- Değişiklikler: 100-bot Arena görünümü, metric tablosu, filtre/sıralama, regime contract ve detay drawer.
- Test: PASS — frontend lint/build; Arena, score, regime, memory, Champion, manual/Grid 6 dosya ve 18 test.
- Migration: Yok.
- TODO: PROMPT 31 Champions ekranı.

### PROMPT 31

- Değişiklikler: Lifecycle kolonları, eligibility evidence/blockers, promotion history ve audit-only confirm review.
- Test: PASS — frontend lint/build; Champion, live eligibility, autonomous admin, manual/Grid 5 dosya ve 18 test.
- Migration: Yok.
- TODO: PROMPT 32 Evolution ekranı.

### PROMPT 32

- Değişiklikler: Generation/run history, lineage, mutation diff ve confirm'li PAPER generation trigger.
- Test: PASS — frontend lint/build; Evolution, mutation, crossover, autonomous admin, manual/Grid 6 dosya ve 25 test.
- Migration: Yok.
- TODO: PROMPT 33 Teacher/Researcher ekranları.

### PROMPT 33

- Değişiklikler: Teacher ve Researcher read-only sayfaları, evidence görünümü ve zorunlu suggestion/applied ayrımı.
- Test: PASS — frontend lint/build; Teacher, Researcher, AI adapters, manual/Grid 5 dosya ve 20 test.
- Migration: Yok.
- TODO: PROMPT 34 Memory ekranı.

### PROMPT 34

- Değişiklikler: Server-side memory filtreleri, client-side date range, trade tablosu ve context detail drawer.
- Test: PASS — frontend lint/build; Trade Memory, decimal, manual/Grid 4 dosya ve 12 test.
- Migration: Yok.
- TODO: PROMPT 35 Performance ekranı.

### PROMPT 35

- Değişiklikler: Recharts equity curve, 12 performance metric ve 5 karşılaştırma kırılımı.
- Test: PASS — frontend lint/build; backend 4 dosya/12 test; Go performance/scoring 2 package.
- Migration: Yok.
- TODO: PROMPT 36 Risk ekranı.

### PROMPT 36

- Değişiklikler: Read-only autonomous Risk screen, immutable limits, exposure/rejects ve critical confirmation guard.
- Test: PASS — frontend lint/build; backend Risk/manual/Grid 4 dosya/13 test; Go risk/execution 2 package.
- Migration: Yok.
- TODO: PROMPT 37 Shadow & Live ekranı.

### PROMPT 37

- Değişiklikler: Kesin PAPER/SHADOW/LIVE ayrımı; API-backed shadow action ve sanal PnL; autonomous LIVE bot/allocation/position, risk ve exchange health için read-only görünüm.
- Test: PASS — frontend lint/build; backend 6 dosya/23 test; tam backend regression 58 dosya/252 test; backend build; tam Go test/vet.
- Migration: Yok.
- TODO: PROMPT 38 final audit. Kullanıcı talebi gereği başlanmadı.

### PROMPT 38

- Değişiklikler: Hedef mimariye karşı 13 maddelik final integration audit, evidence matrix, safety invariants, açık bulgular ve mode bazlı final gate; `AI_TRADING_FINAL_AUDIT.md`.
- Test: PASS — backend 58 dosya/252 test ve build; AI Trading/trading/tests scoped ESLint; frontend lint/build; Prisma validate/status; Go test/vet; autonomous Overview database smoke.
- Migration: Yeni migration yok. Yerel veritabanındaki 45 migration güncel; production migration uygulanmadı.
- TODO: Prompt dizisi tamamlandı. F-01/F-02 daha sonra kullanıcı onaylı PHASE_CHECKPOINT 4 kapsamında çözüldü; production LIVE ve autonomous activation ayrı uygulama ve ikinci açık onay gerektiriyor.

## Source Note

Requested prompt filenames were absent. Repository contains `docs/AI_TRADING_IMPLEMENTATION_PROMPTS_UPDATED.md`; it is used as the authoritative prompt sequence.

### PHASE_CHECKPOINT 6 — Controlled Autonomous Binance TESTNET Canary

- Tamamlanan kapsam: Kullanıcı onaylı F-01/F-02 sonrası kontrollü autonomous Binance TESTNET execution. Prompt dizisi hâlâ PROMPT 0-38 tamamlanmış durumdadır; bu çalışma post-prompt activation/hardening kapsamıdır.
- Runtime: `AI Momentum G1 #001` (`cmt3scaih0007iruk86ii9kxp`) DEMO/TESTNET execution modunda RUNNING. Lifecycle PAPER olarak korunur; bu mod production LIVE anlamına gelmez.
- Exchange acceptance: PASS — ETHUSDT 0.01, 1x ISOLATED short market entry Binance TESTNET'te FILLED (`16768461733`). Reduce-only STOP_MARKET Binance algo endpoint'inde OPEN (`1000000176721543`, trigger `2529.81`). Exchange snapshot pozisyon ve koruyucu emri birlikte doğruladı.
- Safety: Tek aktif TESTNET canary, no-pyramiding/no-reversal, zorunlu merkezi Go Risk Engine, stop preflight, stop başarısızlığında reduce-only emergency close. Production LIVE feature/endpoint kullanılamaz ve varsayılan kapalıdır.
- Binance API uyumu: 2026 USD-M conditional order akışı `/fapi/v1/algoOrder`, `/fapi/v1/openAlgoOrders` ve conditional cancel desteğine geçirildi. Normal manual/grid order endpoint'i değiştirilmedi.
- Operasyon: Açık algo stop'u önce iptal eden güvenli close/pause script'i ve salt-okunur canary status script'i eklendi.
- Test: PASS — backend 59 dosya/255 test + build; Go `test ./...` + `vet ./...`; frontend lint + production build; Prisma validate/status.
- Migration: Additive `20260822070000_allow_system_orders_without_manual_preview`; yalnız `trading_orders.previewId` nullable yapıldı, veri kaybı yok. Yerel veritabanında uygulandı; 47/47 migration güncel.
- Recovery evidence: Eski order endpoint'iyle reddedilen koruyucu stop denemelerinde pozisyonlar reduce-only emergency market close ile flat duruma getirildi; client ID ve tick-size sorunları düzeltildi. Güncel algo akışı başarıyla doğrulandı.
- API key/permission: Değişmedi; yalnız bağlı Binance TESTNET hesabı kullanılır, withdrawal/transfer yetkisi kullanılmaz.
- Runtime process: Derlenmiş engine gizli arka plan process'i olarak terminal oturumundan bağımsız çalışıyor; frontend/backend/engine sırasıyla 3000/4000/8081 portlarında dinliyor.
- TODO: Makine yeniden başlatıldığında otomatik açılış için Windows service veya container supervisor tanımlamak ve canary performansını gözlemek. Production LIVE ayrı açık onay ve ayrı gate gerektirir.

### PHASE_CHECKPOINT 7 — 100-Bot PAPER Learning + 15-Bot TESTNET Fleet

- Tamamlanan kapsam: Her biri 100 USDT sanal sermayeli 100 PAPER bot; kalıcı paper trade yaşam döngüsü; giriş/çıkış fee ve slippage muhasebesi; stop-loss/take-profit; bot bazlı bağımsız risk ve equity; otomatik metric/score yenileme; 100 botluk survivor/mutation/crossover evrim döngüsü.
- PAPER runtime kanıtı (2026-08-22): 100 PAPER bot, 233 fill, 54 açık ve 43 kapanmış paper trade, 100 botta persisted score; son 5 dakikada 344 karar (68.8 karar/dakika).
- TESTNET kapsam: En iyi PAPER adaylarından klonlanan 15 DEMO bot, 15 farklı Binance Futures sembolü, bot başına 100 USDT allocation ve %10 hedef notional. Entry ile birlikte reduce-only STOP_MARKET ve TAKE_PROFIT_MARKET; stale koruma temizliği, no-pyramiding ve merkezi Risk Engine zorunluluğu eklendi.
- Evrim: 20 değişmeden survivor + 60 mutation + 20 crossover = 100 yeni PAPER bot. CHAMPION/LIVE_ELIGIBLE/LIVE botlar immutable/protected; minimum trade gate varsayılan 200 ve zamanlanmış worker varsayılan aktiftir.
- Safety: `productionLive=false`; production gerçek para emri yolu kapalı. Manual trade, Grid Bot ve mevcut exchange order yolu değiştirilmedi. TESTNET dışında autonomous execution reddedilir. Withdrawal/transfer yetkisi kullanılmaz.
- Migration: Additive `20260822090000_add_take_profit_market_order_type`; `TAKE_PROFIT_MARKET` enum değeri eklendi, kolon/tablo silinmedi ve veri kaybı yok. Yerel DB'de 48/48 migration güncel.
- Test: PASS — backend TypeScript build; frontend typecheck/lint ve production build; Go `test ./...`; Prisma migration status. Backend Vitest bu oturum sandbox'ında esbuild'in workspace üst dizinini okuyamaması nedeniyle başlatılamadı; kod/test failure değildir.
- Runtime blocker: Port 8081'deki eski PAPER engine process'i yeni family fallback binary'sinden önce başlatıldığı için 30 bot `unsupported autonomous strategy family` hatasına düşüyor. Yeni binary derlendi ve test edildi, fakat mevcut process'i durdurma işlemi OS tarafından `Access denied` ile reddedildi. Regression giderilmeden DEMO filosu exchange execution'a alınmadı.
- Secret blocker: DB'deki Binance TESTNET credentials encrypted olarak korunuyor; engine restart/cutover için aynı `TRADING_CREDENTIALS_MASTER_KEY` ve backend ile eşleşen `TRADING_ENGINE_TOKEN` kalıcı secret olarak sağlanmalı. Secret tahmin edilmedi veya process memory'den alınmadı.
- Exchange state: Önceki ETHUSDT TESTNET canary pozisyonunun native reduce-only STOP_MARKET emri exchange tarafında koruma olarak bırakıldı; bu checkpoint yeni TESTNET emir akışını başlatmadı.
- Açık TODO: Yetkili process restart; kalıcı secret/env kurulumu; yeni engine ve backend worker restart; 100/100 PAPER RUNNING ve 0 ERROR acceptance; ardından 15 TESTNET botta entry+SL+TP ve reconciliation acceptance; VPS için systemd/Docker restart policy ve health monitoring.

### PHASE_CHECKPOINT 8 — PAPER Runtime Recovery Acceptance

- Yönetici yetkisiyle eski engine PID 2592 durduruldu ve test edilmiş güncel binary PID 8740 olarak port 8081'de başlatıldı.
- Runtime modu PAPER-safe: `mode=shadow`, bot scheduler açık, 4 worker, 250 ms poll; private shadow read, realtime ve autonomous TESTNET execution kapalı.
- Acceptance: Tam `100/100 PAPER RUNNING`, `0 ERROR`, `0 missingStrategies`, 100 botta score. Ölçüm anında 1.641 karar/5 dakika (`328.2 karar/dakika`), 236 fill, 53 açık ve 45 kapanmış paper trade.
- Bootstrap idempotency düzeltmesi: TESTNET'e taşınarak yeniden adlandırılan #001 bot için mevcut `#001 PAPER` replacement artık doğrudan bulunuyor; tekrar çalıştırma fazladan bot üretmiyor.
- Veri koruma: Bootstrap hatasıyla oluşan 101. botun fill/trade sayısı sıfır olduğu doğrulandı. Kayıt silinmedi; SHADOW/STOPPED/ARCHIVED yapılarak audit edilebilir biçimde korundu.
- Regression test: PASS — backend TypeScript build ve tam Go `test ./...`. Önceki frontend lint/production build ve Prisma 48/48 migration acceptance geçerlidir.
- Kalan TESTNET blocker: Ciphertext veritabanında mevcut fakat onu çözen `TRADING_CREDENTIALS_MASTER_KEY` dosya, process-parent environment, User veya Machine environment'da kalıcı değil. Çalışan backend eski key'i belleğinde taşıyor olabilir; in-app browser mevcut olmadığı için oturumlu “Bağlantıyı test et” akışı otomatik çalıştırılamadı.
- Sonraki güvenli karar: Ya önceki 64-hex master key kalıcı secret olarak geri konmalı ya da yeni master key üretilip aynı Binance TESTNET API key/secret mevcut hesap üzerinde yeniden şifrelenmelidir. İkinci seçenek credential rotation olduğundan kullanıcı seçimi ve API secret'ın admin formuna yeniden girilmesini gerektirir.

### PHASE_CHECKPOINT 9 — 15-Bot Binance TESTNET Runtime Acceptance

- Credential rotation tamamlandı: mevcut ExchangeAccount silinmeden yeni master key ile API Key/Secret doğrulandı ve yeniden şifrelendi. Audit action `EXCHANGE_CREDENTIALS_ROTATED`; manual/grid/bot foreign key bağlantıları korundu.
- Admin UI/API: `PATCH /exchange-accounts/:id/credentials` ve “API bilgilerini yenile” akışı eklendi. Yeni credential önce Binance TESTNET üzerinde doğrulanır, sonra transaction içinde şifreli kayıt güncellenir; plaintext saklanmaz veya response'a dönmez.
- Runtime: Backend PID 5232 port 4000; güncel trading-engine PID 12876 port 8081. Engine `mode=cutover`, `shadow_read=enabled`, `executor=enabled`, `status=ready`, `productionLive=false`.
- Filo acceptance: `15/15 DEMO RUNNING`, `100/100 PAPER RUNNING`, `0 ERROR`, `0 missingStrategies`. Ölçüm anında 1.241 karar/5 dakika (`248.2 karar/dakika`) ve PAPER tarafında 274 fill bulunuyor.
- Exchange evidence: Binance TESTNET market girişleri FILLED; native reduce-only STOP_MARKET ve TAKE_PROFIT_MARKET emirleri OPEN olarak doğrulandı. Eski ETHUSDT short, take-profit seviyesi zaten geçildiği için reduce-only market exit ile FILLED kapandı ve stale stop temizlendi.
- Fail-safe evidence: Bir TESTNET stop submission reddinde reduce-only emergency close FILLED oldu; korumasız pozisyon bırakılmadı. Engine logunda takip eden soak aralığında yeni execution error yok.
- Düzeltme: Mevcut pozisyonda hesaplanan SL/TP seviyesi mark price tarafından zaten aşılmışsa geçmiş trigger emri göndermek yerine reduce-only market exit yapılır ve bot-owned stale protectives iptal edilir. Boundary ve execution testleri eklendi.
- Test: PASS — Go full `test ./...` ve `vet ./...`; backend build; frontend lint ve production build; engine startup reconciliation ve runtime health acceptance.
- Konfigürasyon notu: Yerel `backend/.env` içinde master key ve internal token için iki tanım tespit edildi. Çalışan servisler backend ile aynı olan son tanımları kullanıyor. Kalıcı temizlikte her değişken için yalnızca son/yeni tanım bırakılmalıdır; secret değerleri dokümana veya Git'e yazılmamalıdır.
- Açık TODO: VPS systemd/Docker secret/env kurulumu, tekil env tanımları, restart policy, health monitor ve TESTNET order/PnL reconciliation soak. Production gerçek para LIVE ayrı gate olarak kapalıdır.

### PHASE_CHECKPOINT 10 — Binance Algo Order Reconciliation Recovery

- Tamamlanan kapsam: Binance USDⓈ-M Futures koşullu STOP/TAKE_PROFIT emirlerinin periyodik uzlaştırma sorgusu yeni Algo Order API ile uyumlu hale getirildi.
- Kök neden: Koruyucu emirler `/fapi/v1/algoOrder` ile oluşturulmasına rağmen client ID uzlaştırması yalnızca normal `/fapi/v1/order` uç noktasını sorguluyordu. Binance reddi hesabı `DEGRADED` yapıyor ve Risk Engine bütün autonomous botları güvenli biçimde `RISK_BLOCKED` durumuna alıyordu.
- Değişiklik: Normal emir lookup başarısız olduğunda salt-okunur `GET /fapi/v1/algoOrder?clientAlgoId=...` fallback'i eklendi. Normal manual/grid emir akışı ve yazma endpoint'leri değiştirilmedi.
- Test: PASS — yeni algo reconciliation regression testi dahil tam Go `test ./...` ve `vet ./...`.
- Runtime acceptance: Güncel engine PID 9788 ile yeniden başlatıldı; startup reconciliation tamamlandı. Hesap `CONNECTED`; `100/100 PAPER RUNNING`, `15/15 DEMO RUNNING`, `0 ERROR`, `0 RISK_BLOCKED`. Ölçümde son 5 dakikada 122 PAPER karar (`24.4/dk`), 341 fill, 52 açık ve 98 kapanmış PAPER trade vardı.
- Migration: Yok.
- Safety: `productionLive=false`; yalnızca Binance TESTNET autonomous execution açık. Merkezi Risk Engine, no-pyramiding, zorunlu reduce-only stop/take ve emergency-close korumaları değişmedi.
- Açık TODO: VPS supervisor/restart policy ve health alert kurulumu; DEMO bot bazlı allocation/equity ile Spot/Futures ayrımını tek ekranda gösteren operasyon görünümü henüz yoktur.

### PHASE_CHECKPOINT 11 — Full Futures Universe + 5x–20x TESTNET Fleet

- Tamamlanan kapsam: Autonomous PAPER ve Binance TESTNET Futures filosu 5x–20x kaldıraç bandına geçirildi. Strategy parameter schema, bootstrap/deploy scriptleri, Go intent guard ve transaction-time execution guard aynı bandı zorunlu tutuyor. Bot başına başlangıç/allocation 100 USDT ve işlem başına hedef notional %10 olarak sabit tutuluyor.
- Grafik analizi: Autonomous kararlar artık her sembol için Binance Futures'tan son 50 adet 1 dakikalık mum kapanışını okuyor; EMA9/EMA21 momentum ve mark-price doğrulaması olmadan LONG/SHORT sinyali üretmiyor. Grafik verisi alınamazsa fail-closed HOLD davranışı uygulanıyor.
- Tüm piyasa kapsamı: Binance TESTNET'te 20x destekleyen 505 USDT-M perpetual sembol risk profilinin `allowedSymbols` listesine alındı. 100 PAPER ve boş 15 DEMO bot, açık pozisyonları bozmadan 5 dakikada bir bu evren üzerinde deterministik rotasyon yapıyor; yalnız popüler coin listesiyle sınırlı değil.
- Sürekli çalışma: Universe ve Evolution worker'lar varsayılan aktif. MySQL connection-scoped named-lock sızıntısı kaldırıldı; tek backend instance içinde single-flight kilidi aynı turun üst üste binmesini engelliyor. Go scheduler lease'i uzaktaki çoklu piyasa okumalarını kapsayacak şekilde 30 saniyeye çıkarıldı.
- Emir yoğunluğu: Uygulama seviyesindeki düşük canary/cooldown sınırı kaldırıldı; profil `1000 emir/dakika`, `100000 emir/gün`, `cooldown=0`. Bu “sınırsız ve kontrolsüz” execution değildir: Binance hard limitleri, 15 açık pozisyon sınırı, tek sembolde tek pozisyon/no-pyramiding ve merkezi Risk Engine zorunlu kalır.
- Runtime acceptance (2026-08-22): Backend PID 9912 (`:4000`), Go engine PID 9404 (`:8081`); `100/100 PAPER RUNNING`, `15/15 DEMO RUNNING`, `0 ERROR`, `0 RISK_BLOCKED`. Son ölçümde 362 karar/5 dakika (`72.4/dk`), 507 PAPER fill, 60 açık ve 177 kapanmış PAPER trade vardı. Son 100 kararın 100'ünde 50 mumluk chart metriği; 40 farklı sembol ve BUY/SELL/HOLD kararları doğrulandı. İkinci otomatik 5 dakikalık evren turu da `ROTATED` tamamlandı (36 PAPER + 5 boş DEMO sembolü değişti); eski kalıcı `LOCKED` sorunu tekrarlanmadı.
- Binance TESTNET acceptance: Ölçümde 10 açık USDⓈ-M pozisyon (8 LONG, 2 SHORT), tamamı 5x–20x bandında. Her güncel pozisyon için reduce-only STOP_MARKET ve TAKE_PROFIT_MARKET koruması Go birleşik regular+Algo snapshot'ında doğrulandı. Production gerçek para LIVE kapalı (`productionLive=false`).
- Risk/iddia sınırı: Sistem “maksimum kârı” garanti etmez. Strateji parametreleri gerçekleşen PAPER performansından seçilim/mutation/crossover ile optimize edilir; yeni nesil üretimi için 100 botun her birinde varsayılan minimum 200 kapanmış trade kanıtı gerekir. Generation 1 şu anda RUNNING; bot başına kapanmış trade aralığı 0–6 olduğundan evrim worker'ı henüz kanıt topluyor. Risk Engine bypass edilmedi.
- Test: PASS — backend typecheck/build; tam backend regression 60 dosya/258 test; tam Go `test ./...` ve `vet ./...`; runtime reconciliation, chart metrics, fleet state, leverage ve native koruma emri acceptance.
- Migration: Yok.
- API key/permission: Değişmedi; yalnız kayıtlı Binance TESTNET credential kullanıldı. Withdrawal/transfer yetkisi kullanılmadı.
- Açık TODO: Hostinger VPS üzerinde tek backend instance + tek engine için systemd/Docker restart policy, secret injection ve health alert kurulumu. Bot bazlı TESTNET equity/PnL ile Spot/Futures ayrımını aynı UI ekranında gösteren operasyon görünümü ayrıca geliştirilebilir.

### PHASE_CHECKPOINT 12 — Bot Bazlı Binance TESTNET PnL ve Gerçek Fill Geçmişi

- Tamamlanan kapsam: Bot Arena'ya 15 DEMO/TESTNET bot için açık pozisyon, yön, kaldıraç, gerçekleşmiş net PnL, açık PnL, ROI, equity, fill sayısı ve kazanan/kaybeden kapanış özeti eklendi.
- Bot detayı: Arena satırının tamamı tıklanabilir. Detay çekmecesi aktif Binance TESTNET pozisyonunda entry/mark/notional/margin ile native stop-loss ve take-profit trigger seviyelerini gösteriyor.
- Gerçek işlem geçmişi: Yeni read-only Binance USDⓈ-M `/fapi/v1/userTrades` reader'ı eklendi. Binance trade/order ID'leri yalnız Go autonomous SYSTEM emirleriyle ve botun SHA-256 client-order prefix'iyle eşleştiriliyor. Detay tablosu yalnız exchange tarafından gerçekleşmiş fill'leri gösteriyor; açık conditional emirler geçmişe karıştırılmıyor.
- PnL hesabı: Gerçekleşmiş PnL Binance `realizedPnl` alanından, USDT komisyonu Binance `commission` alanından geliyor; net gerçekleşmiş PnL ikisinin farkı. Toplam bot PnL'si net gerçekleşmiş + açık pozisyon unrealized PnL olarak gösteriliyor.
- Conditional emir açıklaması: MARKET giriş emri hemen fill olur. STOP_MARKET ve TAKE_PROFIT_MARKET koruma emirlerinin Binance “Open Orders / Conditional” bölümünde trigger'a kadar OPEN kalması beklenen davranıştır; tetiklenince market kapanışına dönüşür. Bu emirler kaldırılmadı ve pozisyonlar korumasız bırakılmadı.
- Eski emir temizliği: Universe worker, açık pozisyonu kalmayan sembollerdeki yalnız `ka...` bot-owned reduce-only STOP/TAKE conditional emirlerini Go executor üzerinden iptal ediyor. İlk acceptance turunda 22 stale koruma emri kaldırıldı; manual/Grid emirlerine dokunulmadı.
- Güvenli sembol rotasyonu: TESTNET bot rotasyonu iki aşamalı pause → 15 saniye settle → pozisyonu yeniden kontrol et → rotate/resume akışına geçirildi. Böylece engine ile universe worker aynı anda eski sembolde entry açıp botu başka sembole taşıyamıyor. Yarış sırasında oluştuğu tespit edilen sahipsiz ENAUSDT TESTNET pozisyonu merkezi Risk Engine yoluyla reduce-only MARKET emriyle FILLED kapatıldı.
- Runtime acceptance (2026-08-22): 15/15 TESTNET botun tamamında gerçek Binance fill eşleşti; ilk ölçümde toplam 670 fill. Son güvenlik kabulünde `15/15 DEMO RUNNING`, 8 açık pozisyon, 0 orphan pozisyon, tam 16 bot-owned conditional emir, 8/8 pozisyonda SL+TP ve 0 stale sembol doğrulandı. Örnek en yüksek net gerçekleşmiş botta 39 gerçek fill ve `0.65385285 USDT` komisyon sonrası net PnL doğrulandı. `productionLive=false`.
- Test: PASS — backend typecheck/build; son tam backend regression 60 dosya/261 test; frontend TypeScript lint ve production build. Local in-app browser bağlı olmadığı için oturumlu click-through görsel testi yapılamadı; API gerçek veri acceptance ve UI production compilation geçti.
- Migration: Yok.
- Regression/safety: Manual trade, Grid Bot ve mevcut exchange execution davranışı değiştirilmedi. Yeni Binance çağrısı salt-okunur trade history çağrısıdır; API key/permission veya withdrawal/transfer değişikliği yoktur.
- Açık TODO: VPS deployment sonrasında aynı ekranın production URL üzerinde görsel smoke testi ve uzun dönem fill geçmişi için cursor/backfill persistence değerlendirilebilir.

### PHASE_CHECKPOINT 13 — Arena Partial-Failure Recovery

- Kök neden: Arena'nın bot, skor, PAPER özet, champion ve TESTNET operasyon istekleri tek bir `Promise.all` içinde yükleniyordu. Salt-okunur Go snapshot isteğinin geçici `422` hatası beş veri grubunun tamamını ekranda sıfır gösteriyordu.
- Değişiklik: TESTNET operasyon verisi opsiyonel/izole yüklenir; bu istek geçici olarak başarısız olsa bile PAPER botları, skorlar, trade özetleri ve champion kanıtları Arena'da gösterilir. Son başarılı TESTNET veri ekrandan silinmez ve kullanıcıya kısmi veri uyarısı verilir.
- Backend dayanıklılığı: Aynı kullanıcı için eşzamanlı TESTNET operasyon yenilemeleri single-flight ile birleştirildi. Salt-okunur Go snapshot çağrısı geçici hata halinde bir kez 250 ms sonra tekrarlanır.
- Test: PASS — frontend TypeScript lint ve production build; backend typecheck/build; tam backend regression 60 dosya/261 test. Runtime health: backend database connected, Go engine live ve ready (`mode=cutover`).
- Migration: Yok.
- Regression/safety: Emir oluşturma, manual trade, Grid Bot, Risk Engine veya production LIVE davranışı değişmedi. Yapılan engine çağrıları salt-okunur snapshot sorgularıdır; `productionLive=false` korunur.
- Açık TODO: Oturumlu tarayıcıda Arena yenileme smoke testi ve VPS deployment sonrası servis supervisor/health alert kurulumu.

### PHASE_CHECKPOINT 14 — Bot Allocation Pyramiding + TESTNET Soak

- Tamamlanan kapsam: 100 PAPER ve 15 Binance TESTNET botunun tamamında `pyramidingEnabled=true`. Aynı yönde yeni EMA/momentum sinyali geldiğinde bot aynı sembolde yeni MARKET girişleri ekleyebilir; ters yön sinyali mevcut pozisyona ekleme veya otomatik reversal üretmez.
- Sermaye sınırı: Bot başına `allocationUsdt=100` toplam açık notional üst sınırıdır. Hedef giriş dilimi %10 (yaklaşık 10 USDT); borsa min-notional/step-size kuralları uygulanır ve kalan kota 100 USDT'yi aşmayacak şekilde kırpılır. Bu değer 100 USDT margin değil, kaldıraç uygulanmış toplam açık pozisyon notional kotasıdır.
- PAPER muhasebesi: Aynı yön fill'leri kalıcı fill/trade kayıtlarına yazılır; ağırlıklı ortalama giriş, toplam quantity, fee, slippage, equity ve pozisyon ledger'ı güncellenir. Her botun açık pozisyon büyüklüğü autonomous Risk Engine içinde kendi 100 USDT allocation'ıyla sınırlandırılır.
- TESTNET güvenliği: Pyramiding girişi merkezi Go Risk Engine yolundan geçer. Açık isolated pozisyonun mevcut kaldıracı korunur; açık koruma emirleri varken gereksiz margin/leverage reconfiguration yapılmaz. Fill sonrasında eski STOP/TAKE iptal edilip ağırlıklı giriş ve tam yeni quantity için bir reduce-only STOP_MARKET + bir TAKE_PROFIT_MARKET oluşturulur. Koruma doğrulanamazsa ek miktar rollback edilir; stop kurulamazsa tam pozisyon emergency reduce-only MARKET ile kapatılır.
- Binance reconciliation hardening: Yeni emir yazımıyla periyodik reconciliation arasındaki yarış giderildi. In-flight emirler 30 saniyelik settlement penceresinden önce sorgulanmaz; Binance Demo'nun geçici `-2013` cevabı retryable eventual-consistency olarak sınıflandırılır. Settlement sonrasında hem regular hem Algo history'de bulunmayan idempotent client order local FAILED yapılır ve tek bir eski emir yüzünden tüm hesap `DEGRADED` edilmez.
- Yoğunluk hardening: Universe worker ile dört Go scheduler worker'ın eşzamanlı DB yazımlarında görülen MySQL `1213/1205` transaction çakışmaları yalnız bu transaction'larda üç denemeli kısa backoff ile tekrar edilir. Fill sırasında SL/TP seviyesi aşılmışsa Binance `-2021` trigger reddini beklemek yerine güncel tam pozisyon mevcut güvenli close/cleanup akışına alınır; sonraki koruma turu da eksik/mismatched korumayı fail-closed onarır.
- Arena görünümü: Bot detayına giriş fill sayısı, toplam fill, kapanış fill'i, komisyon ve aktif pozisyonda kullanılan kota/notional oranı eklendi. Açıklama aynı yön ekleme, 100 USDT üst sınırı ve korumaların yeniden boyutlandırılmasını belirtir.
- Runtime acceptance (2026-08-22): AIAUSDT, AIOTUSDT, AEVOUSDT ve CELOUSDT dahil birden fazla gerçek Binance TESTNET pyramiding MARKET fill'i ve `same-direction TESTNET pyramid fill plus resized full-position protection submitted` audit kanıtı oluştu. Nihai soak kontrolünde 12 açık pozisyonun tamamı 100 USDT altında (maksimum 99.8783); 12/12 pozisyon tam quantity ile eşleşen tam iki bot-owned koruma emrine (STOP + TAKE) sahip, ihlal/orphan yok. İki periyodik reconciliation/universe turunda yeni deadlock, account degradation veya autonomous execution error oluşmadı. Hesap `CONNECTED`, `0 ERROR`, `0 RISK_BLOCKED`, `productionLive=false`; 14 DEMO RUNNING ve bir boş DEMO güvenli rotasyon için PAUSED idi. Universe worker boş botları güvenli iki-aşamalı rotasyon sırasında geçici PAUSED/STARTING tutabilir.
- Veri/öğrenme gerçeği: Kararlar, PAPER fill/trade/pozisyonlar, metrics/scores, regime, Teacher/Researcher/Memory/Evolution kanıtları MySQL'de kalıcıdır. Aktif emir sinyali şu anda Binance 1m mum/mark verisi ve kalıcı performans seçiminden beslenir. Haber, YouTube/KOL, sosyal ve whale verileri sistemde ayrı kaynak/modüller olarak bulunabilir; henüz autonomous order kararına tam feature-fusion olarak bağlanmamıştır. “Kendini geliştirme” her tick'te online model ağırlığı eğitmek değil, kanıt eşiği sonrası score/survivor/mutation/crossover tabanlı nesil seçimidir.
- AITOS referansı: Portfolio Spot/Futures ayrımı, bot kartları, son değişiklikler/audit akışı ve AI pulse yaklaşımı sonraki UI/observability iterasyonu için referans alındı. Mevcut Arena/Champions/Evolution/Teacher/Researcher/Memory/Risk mimarisi korunacak; doküman dışı yeni execution mimarisi uydurulmadı.
- Test: PASS — Go tam `go test ./...` ve `go vet ./...`; backend 60 dosya/261 test, typecheck ve production build; frontend typecheck/lint ve production build. Runtime startup/periodic reconciliation, gerçek pyramiding fill, allocation ve tam koruma acceptance geçti.
- Migration: Yok.
- Regression/safety: Manual trade, Grid Bot ve production exchange davranışı değiştirilmedi. API key/permission veya withdrawal/transfer değişikliği yok. Production gerçek para LIVE yolu kapalı; yalnızca onaylı Binance TESTNET autonomous execution açık. Risk Engine bypass edilmedi.
- Açık TODO: Haber/KOL/sosyal/whale feature-fusion için mimarideki kanıt, kalite, gecikme ve fail-closed kurallarına uygun ayrı çalışma; AITOS benzeri birleşik Portfolio/AI Pulse UI; VPS systemd/Docker supervisor, secret injection, restart policy ve health alert kurulumu.

### PHASE_CHECKPOINT 15 — Bot Bazlı Manuel Sermaye + 200 USDT Otomatik Kota

- Tamamlanan kapsam: Arena bot detayına bot başına manuel sermaye/kota kontrolü eklendi. Yönetici kotayı doğrudan ayarlayabilir veya mevcut tutara bakiye ekleyebilir; bot başına izin verilen aralık 10–200 USDT ve çalışan autonomous botta sermaye azaltma kapalıdır.
- PAPER/TESTNET anlamı: PAPER tutarı simülasyon başlangıç sermayesi ve açık notional kotasıdır. DEMO/TESTNET tutarı Binance'taki ortak demo cüzdanından ayrı bir alt cüzdan oluşturmaz; botun ortak hesap üzerinde kullanabileceği uygulama kotasıdır. Binance Demo hesabına gerçek test bakiyesi ekleme işlemi bu API'nin dışında kalır.
- Çoklu giriş: Mevcut `pyramidingEnabled=true` akışı korunur. Aynı yönde yeni sinyal geldikçe MARKET ek giriş yapılabilir; toplam açık notional botun güncel 10–200 USDT kotasını aşamaz ve her fill sonrasında tam pozisyon için SL/TP yeniden boyutlandırılır.
- Otomatik yükseltme: En az 200 tamamlanmış trade metriği olan, güncel equity'si başlangıç sermayesinin üzerinde bulunan ve kotası 200 USDT'nin altında kalan bot, universe döngüsünde bir kez 200 USDT kotasına yükseltilir. İlk runtime turunda kanıt eşiğine uyan bot olmadığı için `autoScaledCapital=0`; manuel yükseltme hemen kullanılabilir.
- Risk Engine: TESTNET bot kotalarının toplamı büyüdüğünde ortak `maxAccountOpenNotional`, mevcut değerin altına düşürülmeden en az filo toplamına; sembol limiti de en az en büyük bot kotasına yükseltilir. Emirler yine merkezi Risk Engine, 15 açık pozisyon, isolated margin, 5x–20x kaldıraç ve zorunlu SL/TP kontrollerinden geçer; bypass eklenmedi.
- Kalıcılık/idempotency: `startingPaperBalance` ile JSON `allocationUsdt` birlikte audit kaydıyla güncellenir. Universe worker, PAPER bootstrap ve TESTNET deployment scriptleri manuel kotayı tekrar 100'e sıfırlamaz.
- Trade Memory düzeltmesi: Ekrandaki `200` değerinin işlem durdurma limiti olmadığı açıklandı. Yeni salt-okunur stats endpoint'i filtreye uyan tüm kapanmış PAPER işlemlerinin toplam sayı/PnL/cost/win bilgisini verir; tablo performans için yalnız en yeni 200 kaydı taşır.
- API/UI: `PATCH /api/admin/trading/autonomous/bots/:id/capital`, `GET /api/admin/trading/trade-memory/stats`; Arena'da “Kotayı ayarla” ve “Bakiye ekle” kontrolleri. Tüm sermaye değişiklikleri `AI_BOT_CAPITAL_SET` veya `AI_BOT_CAPITAL_ADDED` audit olayı üretir ve response güvenlik sözleşmesi `liveTradingEnabled=false` kalır.
- Test: PASS — hedeflenen 3 dosya/15 test; tam backend regression 60 dosya/263 test; backend typecheck ve production build; frontend typecheck/lint ve production build. Manual trading adapter, Binance Demo adapter, Grid Plan, execution safety ve autonomous Risk Engine regresyonları geçti.
- Runtime acceptance: Backend yeni build ile PID 19460 olarak `:4000` üzerinde çalışıyor; `/api/health` database connected döndü. Yeni iki korumalı rota çalışan süreçte kayıtlı ve yetkisiz smoke isteğine beklenen `401` döndü. Go Trading Engine PID 10496 kesintisiz kaldı; başlangıç universe turu 100 PAPER + 15 DEMO bot gördü. Bağlı tarayıcı olmadığı için oturumlu görsel click-through yapılamadı.
- Migration: Yok. Mevcut kolonlar kullanıldı; production veri kaybı veya schema değişikliği yok.
- Regression/safety: Manual trade, Grid Bot ve exchange credential/permission davranışı değiştirilmedi. API key/secret, withdrawal/transfer yetkisi ve production gerçek para LIVE yolu değiştirilmedi; `productionLive=false`.
- Açık TODO: Kullanıcının Arena'da seçtiği bot üzerinde ilk manuel 100→200 kota değişikliğinin oturumlu UI smoke testi; VPS supervisor/restart policy ve health alert kurulumu.

### PHASE_CHECKPOINT 16 — Arena/Evolution Veri Görünürlüğü ve Leaderboard Performansı

- Kök neden: `bot_metrics` tablosu 107.248 satıra ulaştığında correlated latest-score sorgusu her Arena/Evolution yenilemesinde yaklaşık 147–175 saniye sürüyordu. Frontend 15 saniyelik timeout nedeniyle bot ve generation ana verilerini de sıfır gösteriyordu; kayıtlar silinmemişti.
- Backend düzeltmesi: Latest metric sorgusu bot başına `MAX(id)` ile tek grouped scan + primary-key join kullanacak şekilde değiştirildi. Gerçek veritabanı kabulünde aynı 100 satırlık leaderboard 147+ saniyeden 354 ms'ye düştü.
- Frontend dayanıklılığı: Arena bot/summary/champion verileri, TESTNET snapshot ve leaderboard'dan bağımsız yüklenir. Evolution generation/run/mutation/crossover verileri de leaderboard'u beklemez. Opsiyonel skor veya TESTNET isteği gecikirse ana bot/generation listesi görünür kalır.
- Evolution açıklaması: “PAPER generation aç” işleminin alım-satım motorunu başlatmadığı açıklandı. Aktif G1 `RUNNING/EVALUATING` iken yeni generation düğmesi devre dışı ve mevcut generation numarasını gösterir.
- PAPER çalışma kabulü: G1 `RUNNING`, hedef 100, ilişkili bot 101 (arşivlenmiş replacement dahil). Ölçümde 100 PAPER bottan 99 RUNNING/1 STARTING; son 5 dakikada 239 PAPER karar ve 11 yeni PAPER fill; 22 açık PAPER trade. PAPER, Binance piyasa fiyatı/mumları üzerinde veritabanında simülasyon yapar ve exchange emri göndermez.
- Runtime: Optimize backend PID 14396 ile `:4000` üzerinde; Go Trading Engine PID 10496 kesintisiz. TESTNET botlar universe iki-aşamalı rotasyon nedeniyle anlık RUNNING/STARTING/PAUSED dağılımında olabilir.
- Test: PASS — ilgili 3 dosya/13 test, ek bot-score testi, backend typecheck/build, frontend typecheck/lint ve production build.
- Migration: Yok. API key/permission, manual trade, Grid Bot, withdrawal/transfer ve production LIVE davranışı değişmedi; `productionLive=false`, Risk Engine zorunlu.

### PHASE_CHECKPOINT 17 — Otomatik Teacher / Researcher Kanıt Döngüsü

- Kök neden: Teacher/Researcher servisleri, API'leri, tabloları ve read-only UI ekranları tamamlanmıştı fakat `server.ts` içinde bunları zamanlayan worker yoktu. Runtime kabulünden önce veritabanında 0 Teacher evaluation, 0 Research hypothesis ve 0 run audit bulundu.
- İlk analiz: Mevcut 377 kapanmış MOMENTUM PAPER trade üzerinde rule-based Teacher 117 hedef analiz edip 118 evaluation yazdı. Researcher 1 strategy-family dataset analiz edip 3 DRAFT candidate-only hipotez oluşturdu. `recommendationApplied=false`, `candidateCreated=false`, `liveChanged=false`.
- Worker: `AI_TRADING_LEARNING_ENABLED=true`; her 15 dakikada kanıt kontrolü. Yalnız son başarılı/baseline checkpoint'ten sonra en az 100 yeni kapanmış PAPER trade oluştuğunda Teacher, ardından Researcher çalışır. Başlangıç baseline'ı 378 trade'de oluşturuldu; restart aynı veriyi tekrar analiz etmez.
- Runtime: Backend PID 3000 üzerinde worker aktif; Go Trading Engine PID 10496 kesintisiz. UI yenilendiğinde Teacher'da 118 kayıt, Researcher'da 3 hipotez görünmelidir.
- Test: PASS — Teacher, Researcher, AI adapter, learning worker ve execution safety 5 dosya/17 test; tam backend regression 61 dosya/264 test; backend typecheck ve production build.
- Migration: Yok. Worker yalnız PAPER/kanıt tablolarını okur ve öneri/hipotez/audit yazar. Emir göndermez, strategy kodunu veya merkezi risk limitini değiştirmez; manual/Grid, API key/permission, withdrawal/transfer ve production LIVE davranışı değişmedi.
- Skill araştırması: skills.sh üzerindeki `backtesting-frameworks` ve `backtest-expert` geliştirme metodolojisi desteği olarak uygun bulundu. Bunlar runtime bot eklentisi değildir; backtest/walk-forward/overfitting kontrollerini geliştirirken Codex'e rehberlik eder. Harici skill otomatik kurulmadı.

### PHASE_CHECKPOINT 18 — Trading Playbook v1.0 Karar ve Risk Entegrasyonu

- Kaynak: `TRADING_PLAYBOOK.md` proje köküne eklendi; belge talimatları kullanıcı talebinden ayrı, hedef kural kaynağı olarak ele alındı.
- Bölüm 4: Altı maddeli giriş checklist'i fail-closed doğrulama katmanı olarak eklendi. Rejim, üst zaman dilimi, en az 2/3 teyit, risk/ödül, açık pozisyon limiti ve funding/OI uyumu tamamlanmadan autonomous giriş onaylanmaz.
- Bölüm 5: Miktar bot sermayesinin sabit `%0.5` risk bütçesi ve gerçek stop mesafesinden hesaplanır; yapılandırma yalnız `%0.5–1` aralığını kabul eder ve martingale girdisi kullanmaz. Bot bazlı günlük kayıp durdurma korunur. Üç ardışık kayıpta PAPER öğrenmeye devam eder; TESTNET 24 saat gözlem ve ardından insan/Teacher onayı olmadan yeniden giriş yapamaz.
- Bölüm 1–3: Binance Futures için 1m/5m/15m/1h/4h mumları, 1H–4H EMA(50/200), ADX, ATR genişlemesi, üç katmanlı yön oyu, funding ve OI teyidi sinyal katmanına eklendi. Eksik veri fail-closed; OI artışı yoksa giriş miktarı yarıya iner; düşük rejim güveninde kaldıraç düşürülür.
- Bölüm 6: Yalnız PAPER yaşam döngüsünde ilk hedefte varsayılan `%50` kısmi TP, stop'u maliyete taşıma, kalan miktarda trailing stop ve TREND → RANGE/UNCERTAIN rejim değişimi kapanışı eklendi. TESTNET/live executor değiştirilmedi.
- Commitler: `80a7aa2` (Bölüm 4), `e37ba91` (Bölüm 5), `e47ce5a` (Bölüm 1–3), `d676ba1` (Bölüm 6).
- Test: PASS — tam Go `go test ./...` ve `go build ./cmd/trading-engine`; manual execution, Grid, Binance, Bybit, reconciliation, risk, autonomous execution ve PAPER paketleri dahil tüm regression testleri geçti.
- Migration: Yok. Candidate/Challenger/Champion/Live Eligible yaşam döngüsü, API key/permission, withdrawal/transfer ve production LIVE yolu değiştirilmedi.
- Açık TODO/uygulanmayanlar: Bölüm 3 liquidation kümeleri için mevcut reader'da güvenilir veri kaynağı yok; giriş checklist'ine sahte veri eklenmedi. Bölüm 7 korelasyon ve ekonomik olay filtresi ile Bölüm 8 otomatik playbook dosyası değiştirme/A-B sürümleme bu talebin a–d kapsamı dışında bırakıldı.
