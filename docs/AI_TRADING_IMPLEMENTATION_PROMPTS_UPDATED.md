# KriptoKeyfi Autonomous AI Trading — Codex Implementation Prompts

## Otomatik Uygulama / Orchestrator Talimatı

Bu dosyadaki promptlar Codex tarafından **numara sırasıyla otomatik uygulanabilir**.

Codex'e başlangıçta yalnızca aşağıdaki ana talimatı ver:

```text
docs/AI_TRADING_ARCHITECTURE.md ve
docs/AI_TRADING_IMPLEMENTATION_PROMPTS.md dosyalarını oku.

AI_TRADING_IMPLEMENTATION_PROMPTS.md içindeki promptları PROMPT 0'dan başlayarak numara sırasıyla uygula.

Her promptu tamamlamadan bir sonrakine geçme.

Her prompt sonunda:
1. İlgili testleri çalıştır.
2. Testler başarısızsa sonraki prompta geçme; problemi düzelt ve testleri tekrar çalıştır.
3. Mevcut manual trade, grid bot, exchange entegrasyonu ve production davranışlarında regression olup olmadığını kontrol et.
4. docs/AI_TRADING_PROGRESS.md dosyasını oluştur/güncelle.
5. Progress dosyasına son tamamlanan prompt, mevcut prompt, durum, ana değişiklikler, test sonucu, migration özeti, TODO ve blocker bilgilerini yaz.
6. Prompt başarıyla tamamlandıysa otomatik olarak sıradaki prompta geç.
7. COMPLETED olarak işaretlenen promptları tekrar uygulama.
8. Oturum kesilirse AI_TRADING_PROGRESS.md dosyasını okuyarak kaldığın yerden devam et.
9. Prompt kapsamını kendiliğinden genişletme.
10. AI_TRADING_ARCHITECTURE.md hedef mimaridir.

Benden ara onay almadan normal geliştirme, güvenli refactor, test, yeni servis/component oluşturma, güvenli migration ve paper/shadow geliştirmelerinde ilerleyebilirsin.

Ancak aşağıdaki durumlarda DUR ve benden onay iste:
- destructive database migration gerekiyorsa
- production verisi silinecek/değiştirilecekse
- geri dönüşü zor schema değişikliği gerekiyorsa
- mevcut live trade execution davranışı değişecekse
- gerçek borsa emri gönderecek yeni özellik aktif hale getirilecekse
- live trading default olarak açılacaksa
- API key / secret / exchange permission değişikliği gerekiyorsa
- withdrawal veya para transferi yetkisiyle ilgili işlem gerekiyorsa
- mevcut manual/grid trade fonksiyonunda breaking change gerekiyorsa
- Risk Engine bypass edilebilecek bir mimari zorunluluğu oluşursa
- mimari dokümanda açık cevabı olmayan kritik bir tasarım kararı gerekiyorsa
- test veya regression sorunu makul şekilde çözülemiyorsa

Güvenlik kuralları:
- Live trading varsayılan olarak kapalı kalmalı.
- PAPER güvenli varsayılan mod olmalı.
- SHADOW gerçek emir göndermemeli.
- AI hiçbir zaman doğrudan exchange'e emir gönderememeli.
- Risk Engine fail-closed çalışmalı.
- Teacher, Researcher ve Evolution canlı risk limitlerini değiştirememeli.
- AI-generated strategy veya mutation doğrudan live'a geçmemeli.
- Gerçek exchange testi gerekiyorsa testnet/paper tercih edilmeli.
- Withdrawal yetkisi istenmemeli veya kullanılmamalı.

Checkpoint yaklaşımı:
- PROMPT 0 → 17 arasında otomatik devam et.
- PROMPT 18'e gelmeden önce AI_TRADING_PROGRESS.md içine PHASE_CHECKPOINT yaz ve test durumunu özetle. Ciddi blocker yoksa PROMPT 18'e otomatik geç.
- PROMPT 18 → 27 arasında aynı kurallarla devam et.
- PROMPT 28'e gelmeden önce ikinci PHASE_CHECKPOINT oluştur.
- PROMPT 28 → 38 arasında frontend ve final audit adımlarını sırayla uygula.

Ben herhangi bir anda müdahale edersem mevcut promptu tamamla ve verdiğim yeni talimata göre bekle veya devam et.

Şimdi PROMPT 0'dan başla.
```

### Progress Dosyası

Codex şu dosyayı sürekli güncel tutmalıdır:

`docs/AI_TRADING_PROGRESS.md`

Önerilen örnek:

```md
# AI Trading Implementation Progress

## Current State
Last completed prompt: PROMPT 7
Current prompt: PROMPT 8
Status: IN_PROGRESS

## Completed
- PROMPT 0 — COMPLETED
- PROMPT 1 — COMPLETED
- PROMPT 2 — COMPLETED
- PROMPT 3 — COMPLETED
- PROMPT 4 — COMPLETED
- PROMPT 5 — COMPLETED
- PROMPT 6 — COMPLETED
- PROMPT 7 — COMPLETED

## Current Prompt
PROMPT 8 — Market Regime Performance

## Last Test Result
- Unit tests: PASS
- Integration tests: PASS
- Trade regression smoke test: PASS

## Last Changes
- Added BotScore service
- Added leaderboard API
- Added sample-size penalty

## Migration
None

## Open TODO
None

## Blockers
None
```

Bu dosya Codex'in kaldığı yeri belirlemek için ana checkpoint kaynağıdır.

---

## Kullanım Şekli

Her prompt ayrı bir Codex oturumunda veya mantıklı bir geliştirme aşamasında verilmelidir.

Codex'e her aşamada önce şu talimatı ver:

> `docs/AI_TRADING_ARCHITECTURE.md` dosyasını oku. Bu dosya hedef mimaridir. Her şeyi tek seferde implement etme. Sadece bu promptta istenen fazı uygula.

Mevcut trade sistemini bozmadan ilerle.

---

# PROMPT 0 — Mevcut Sistemi Audit Et

```text
docs/AI_TRADING_ARCHITECTURE.md dosyasını oku.

KriptoKeyfi projesindeki mevcut Trade Operations backend yapısını detaylı fakat değişiklik yapmadan analiz et.

Özellikle şunları bul:

- mevcut trade backend modülleri
- Node.js servisleri
- Go trade engine
- exchange adapter / API entegrasyonu
- grid bot
- manual trading
- order lifecycle
- position management
- paper/test yapısı varsa
- market data akışı
- mevcut veritabanı modelleri
- admin API endpointleri
- scheduler/background worker yapısı

Bu aşamada kod değiştirme.

Sonuç olarak docs/AI_TRADING_CURRENT_STATE.md oluştur.

Dokümanda:
1. mevcut mimari
2. yeniden kullanılabilecek parçalar
3. eksikler
4. AI_TRADING_ARCHITECTURE ile farklar
5. önerilen entegrasyon noktaları
6. riskli değişiklik alanları

yer alsın.

Mevcut çalışan hiçbir özelliğe dokunma.
```

---

# PROMPT 1 — Core Domain Models

```text
docs/AI_TRADING_ARCHITECTURE.md ve docs/AI_TRADING_CURRENT_STATE.md dosyalarını oku.

Bu aşamada yalnızca Autonomous Trading sisteminin temel domain modellerini oluştur.

Minimum modeller:

- Strategy
- StrategyVersion
- BotInstance
- Generation
- PaperTrade
- BotMetric
- MarketRegimeSnapshot
- ChampionCandidate
- RiskProfile

Mevcut ORM / database yapısını kullan.

Kurallar:

- mevcut tabloları bozma
- gereksiz migration yapma
- mevcut trade modelleri tekrar kullanılabiliyorsa duplicate oluşturma
- enum/status değerlerini merkezi tanımla
- entity ilişkilerini açık ve sade tut
- strategy ve bot versiyonlanabilir olsun
- bot parent/generation ilişkilerine ileride izin ver
- live trading varsayılan olarak kapalı olsun

Gerekli migration ve type/model katmanlarını oluştur.

Henüz:
Teacher
Researcher
Evolution
AI
Live trade
frontend

geliştirme.

Test ekle.
```

---

# PROMPT 2 — Strategy Registry

```text
AI Trading mimarisine Strategy Registry ekle.

Amaç:
Tüm trading strategy family ve versiyonlarının merkezi olarak kayıtlı olması.

Desteklenebilecek family örnekleri:

- grid
- trend
- sma_crossover
- macd_trend
- rsi_mean_reversion
- bollinger_mean_reversion
- donchian_breakout
- atr_breakout
- momentum
- volume_spike
- funding_skew
- basis_arbitrage
- news_reactive
- dca
- ai_limit
- multi_agent

Mevcut çalışan grid/manual sistemini değiştirme.

Her strategy için:

- id
- family
- name
- version
- parameter schema
- allowed parameter ranges
- supported markets/timeframes
- status
- createdBy

gibi ihtiyaçları mevcut modele uygun şekilde çöz.

Parametreler kontrolsüz JSON olmamalı; validation katmanı olmalı.

Strategy Registry için backend servis ve internal API oluştur.

Henüz frontend geliştirme.
```

---

# PROMPT 3 — Bot Factory

```text
Bot Factory backend modülünü geliştir.

Amaç:
Strategy Registry içindeki stratejilerden çok sayıda BotInstance üretilebilmesi.

Destekle:

- manual creation
- clone
- parameter variant
- parent bot reference
- generation reference

Bir bot oluşturulurken:

- strategy version
- parameter set
- starting paper balance
- symbols
- timeframe
- paper/live mode
- risk profile

tanımlanabilsin.

Default mode PAPER olmalı.

Bot Factory gerçek emir göndermemeli.

BotInstance lifecycle:

DRAFT
CANDIDATE
TESTING
PAPER
REJECTED
CHALLENGER
CHAMPION
LIVE_ELIGIBLE
LIVE
PAUSED
ARCHIVED

State transition validation ekle.

Henüz mutation/evolution otomasyonu ekleme.

Unit test ekle.
```

---

# PROMPT 4 — Paper Execution Engine

```text
Autonomous Trading sistemi için gerçekçi bir Paper Trading Engine geliştir.

Mevcut market/exchange data katmanını mümkün olduğunca yeniden kullan.

Paper Engine gerçek exchange emri göndermemeli.

Hesaplamalarda mümkün olduğunca destekle:

- entry
- exit
- maker/taker fee
- funding
- spread
- configurable slippage
- leverage
- isolated margin varsayımı
- stop loss
- take profit
- liquidation approximation
- tick size
- lot size
- min order size
- realized PnL
- unrealized PnL

Paper ve live kod yollarını net biçimde ayır.

Paper fill modeli config üzerinden ayarlanabilir olsun.

PaperTrade kayıtları DB'ye yazılsın.

Testlerde gerçek exchange API kullanma.

Deterministic simulation testleri ekle.
```

---

# PROMPT 5 — Bot Arena

```text
Bot Arena backend modülünü geliştir.

Amaç:
Aynı market data akışı üzerinde çok sayıda BotInstance'ın paralel paper çalışabilmesi.

İlk hedef:
100 bot.

100 bot için aynı candle/tick verisini 100 kez exchange'den çekme.
Ortak market stream / event dağıtımı kullan.

Arena:

- aktif paper botları yüklesin
- market eventlerini ilgili botlara dağıtsın
- strategy runtime state tutsun
- paper signal/order üretimini Paper Engine'e göndersin
- bot bazlı equity/state yönetsin
- pause/resume desteklesin
- bir botun hatasının diğer botları durdurmasını engellesin

Performans ve concurrency mevcut proje mimarisine göre çözülmeli.

Henüz Champion seçimi yapma.

100 botla çalışan bir benchmark/test senaryosu ekle.
```

---

# PROMPT 6 — Performance Engine

```text
Bot Arena sonuçlarını ölçmek için Performance Engine geliştir.

Bot bazında en az şu metrikleri hesapla:

- starting balance
- current equity
- net PnL
- ROI
- total trades
- wins
- losses
- win rate
- average win
- average loss
- expectancy
- average R:R
- profit factor
- max drawdown
- Sharpe
- Sortino
- Calmar
- average holding time
- turnover
- fee cost
- funding cost
- slippage cost
- consecutive wins/losses

BotMetric modeline snapshot mantığıyla kaydet.

Metrik hesaplarını ayrı servis halinde tut.

NaN, division by zero, düşük sample size gibi edge-case'leri doğru yönet.

Test ekle.
```

---

# PROMPT 7 — Risk-Adjusted Bot Score

```text
Performance Engine üstüne Bot Scoring modülü ekle.

Botları sadece PnL'ye göre sıralama.

Configurable scoring model oluştur.

Başlangıç bileşenleri:

positive:
- return
- profit factor
- Sharpe
- Sortino
- expectancy
- consistency

negative:
- max drawdown
- excessive turnover
- liquidation
- unstable performance
- excessive fee/funding cost

Score 0-100 arasında normalize edilebilir.

Score hesaplanırken düşük trade count için confidence/sample penalty uygula.

Admin/internal API üzerinden:

- bot leaderboard
- score breakdown
- rank

alınabilsin.

Henüz automatic Champion promote etme.
```

---

# PROMPT 8 — Market Regime Performance

```text
Market Regime ölçüm altyapısını ekle.

Başlangıç rejimleri:

TRENDING_UP
TRENDING_DOWN
RANGING
BREAKOUT
HIGH_VOLATILITY
LOW_VOLATILITY
CHAOTIC
UNKNOWN

İlk aşamada basit ve deterministic bir regime classifier kullan.
AI/LLM kullanma.

Her PaperTrade ve BotMetric mümkün olduğunda regime ile ilişkilendirilsin.

Bot bazında:

- regime trade count
- regime PnL
- regime win rate
- regime profit factor
- regime drawdown
- regime score

hesaplanabilsin.

Amaç global "en iyi bot" yerine "bu piyasa rejiminde en iyi bot" sorgusunu mümkün kılmak.

Test ekle.
```

---

# PROMPT 9 — Champion / Challenger

```text
Champion / Challenger seçim sistemini geliştir.

Lifecycle:

CANDIDATE
→ PAPER
→ CHALLENGER
→ CHAMPION
→ LIVE_ELIGIBLE

Automatic promotion için minimum evidence şartları tanımla:

- min trades
- min paper duration
- min profit factor
- max drawdown
- min bot score
- min regime coverage

Default değerleri config ile yönet.

Promotion hiçbir zaman doğrudan LIVE yapmasın.

CHAMPION yalnızca en başarılı ve yeterli kanıtı olan botları işaretlesin.

Top N Champion ayarlanabilir olsun.

Örnek hedef:
100 candidate → 20 challenger → 10 champion.

Promotion/demotion işlemleri audit log'a yazılsın.

Test ekle.
```

---

# PROMPT 10 — Trade Memory

```text
Trade Memory modülü geliştir.

Her işlem için mümkün olduğunca şu context'i sakla:

- bot
- strategy
- symbol
- side
- entry/exit
- stop
- take profit
- leverage
- position size
- fee
- funding
- slippage
- PnL
- MFE
- MAE
- holding time
- market regime
- market context snapshot
- close reason
- AI confidence varsa
- decision summary varsa

Mevcut PaperTrade modelini gereksiz duplicate etme.

Trade Memory sorguları:

- benzer bot işlemleri
- strategy performance
- regime performance
- symbol performance
- failure examples
- best examples

için uygun indexleri ekle.

Henüz embedding/vector DB ekleme.
```

---

# PROMPT 11 — Teacher

```text
Teacher backend modülünü geliştir.

Teacher kod veya canlı strategy parametresini doğrudan değiştirmemeli.

Görevi:
Bot ve strategy performansını periyodik analiz edip yapılandırılmış öneri üretmek.

Örnek öneriler:

- increase confidence threshold
- increase cooldown
- reduce position factor
- strategy strong in breakout regime
- strategy weak in ranging regime
- excessive churn
- drawdown deterioration
- insufficient sample size

TeacherEvaluation kaydı oluştur.

Evaluation içinde:

- target bot/strategy
- observation
- severity
- confidence
- metric evidence
- recommended action
- createdAt

olsun.

İlk sürüm deterministic/rule-based olabilir.

LLM entegrasyonunu interface arkasına hazırla fakat zorunlu yapma.

Teacher canlıya değişiklik uygulamasın.
```

---

# PROMPT 12 — Researcher

```text
Researcher backend modülünü geliştir.

Researcher'ın görevi Trade Memory, TeacherEvaluation ve Performance verilerinden yeni strategy hypothesis üretmek.

ResearchHypothesis modeli ekle.

Örnek:

"ATR breakout performs poorly when funding is strongly positive and OI acceleration is high."

Her hypothesis:

- evidence
- target strategy family
- suggested parameter/filter change
- confidence
- status

içersin.

Researcher doğrudan canlı bot değiştirmemeli.

Research hypothesis → Candidate Strategy/Bot oluşturabilecek servis interface'i hazırla.

İlk sürüm rule/template based olabilir.

İleride LLM provider bağlanabilecek adapter/interface yapısı oluştur.
```

---

# PROMPT 13 — Mutation Engine

```text
Strategy/Bot Mutation Engine geliştir.

Amaç:
Başarılı botlardan kontrollü parametre varyasyonları üretmek.

Mutation sadece Strategy Registry'deki allowed parameter schema/range içinde çalışmalı.

Destekle:

- numeric parameter mutation
- threshold mutation
- cooldown mutation
- position factor mutation
- timeframe variant yalnızca destekleniyorsa

Her child bot:

- parent bot
- mutation reason
- mutation diff
- generation

ile ilişkilendirilsin.

Mutation yeni botu CANDIDATE olarak oluştursun.

Asla mevcut Champion parametrelerini yerinde değiştirme.

Test ekle.
```

---

# PROMPT 14 — Evolution / Generations

```text
Evolution Engine geliştir.

Generation akışı:

1. mevcut population al
2. minimum evidence oluşmuş botları değerlendir
3. top performers seç
4. zayıf botları reject/archive et
5. survivor'lardan mutation candidates üret
6. yeni generation oluştur

Örnek population target:
100 bot.

Generation config:

- population size
- survivor count
- mutation count
- researcher candidate count
- max generations

Her EvolutionRun audit edilebilir olsun.

Fitness = raw profit olmasın.
Bot Score/Performance Engine kullan.

Yeni generation varsayılan PAPER modunda doğsun.

Live stratejilere otomatik dokunma.
```

---

# PROMPT 15 — Crossover

```text
Evolution Engine'e kontrollü crossover ekle.

Crossover sadece compatible strategy schema'ları arasında yapılabilsin.

Örnek:

Parent A güçlü entry parametreleri
Parent B güçlü exit parametreleri

Child:
A entry + B exit

Her crossover:

- parent A
- parent B
- inherited fields
- generated fields
- generation

ile kaydedilsin.

Geçersiz parametre kombinasyonlarını validation reddetsin.

Child her zaman CANDIDATE/PAPER olarak başlasın.

Test ekle.
```

---

# PROMPT 16 — Market Intelligence

```text
Market Intelligence backend katmanını geliştir.

Amaç:
Ham market data + KriptoKeyfi internal intelligence kaynaklarını tek standardize MarketContext modeline dönüştürmek.

Mümkün olan kaynakları mevcut projeden kullan:

- OHLCV
- volume
- trend indicators
- ATR/volatility
- funding
- open interest
- order book
- BTC dominance
- KriptoKeyfi news sentiment
- whale data
- YouTube/social sentiment mevcutsa

Eksik kaynaklar için gerçek olmayan data üretme.
Kaynak yoksa field nullable/unknown olsun.

MarketContext versioned schema oluştur.

Market Intelligence hiçbir trade emri göndermemeli.

Caching ve timestamp freshness kontrolü ekle.
```

---

# PROMPT 17 — Strategy Router

```text
Market Regime + Bot regime performance verisini kullanarak Strategy Router geliştir.

Router'ın görevi:

Current market regime
+
bot regime scores
+
risk state
+
recent bot health

üzerinden aktif paper bot havuzunu ağırlıklandırmak/seçmek.

Router output:

- selected bots
- weights
- regime
- reason summary

olabilir.

Router gerçek order göndermez.

Başlangıçta deterministic scoring kullan.

AI/LLM zorunlu değil.

Kararlar audit log'a yazılsın.
```

---

# PROMPT 18 — Immutable Risk Engine

```text
Autonomous Trading sistemi için merkezi ve bypass edilemeyen Risk Engine geliştir veya mevcut risk motorunu bu gereksinimlere göre güçlendir.

Kontroller:

- max risk per trade
- max daily loss
- max weekly loss
- max drawdown
- max leverage
- max total exposure
- max symbol exposure
- max concurrent positions
- min R:R
- stop loss required
- margin mode policy
- max position size
- cooldown
- consecutive loss lock
- emergency stop

Teacher, Researcher, Evolution veya AI bu ayarları değiştirememeli.

Execution path:
AI/Strategy → Risk Engine → Execution

Risk approval olmadan emir gitmemeli.

Fail-closed tasarla:
Risk Engine hata verirse yeni trade açılmasın.

Mevcut live trading'i bozma.

Unit/integration testleri ekle.
```

---

# PROMPT 19 — Portfolio Allocator

```text
Champion botları arasında sermaye dağıtımı yapan Portfolio Allocator geliştir.

Değerlendirsin:

- bot score
- regime fit
- recent drawdown
- volatility
- correlation
- current exposure
- risk limits
- cash reserve

Output:

- bot allocation %
- symbol allocation %
- reserve %

Allocator Risk Engine limitlerini aşamaz.

İlk sürüm deterministic olsun.

Live execution'a otomatik bağlama.
Paper/shadow üzerinde test et.
```

---

# PROMPT 20 — Shadow Trading

```text
Shadow Trading modunu geliştir.

Shadow mode:

- gerçek live market data kullanır
- gerçek emir göndermez
- "would open / would close / would move stop" kararlarını kaydeder
- live execution fiyatına yakın simulation yapar
- Paper modundan ayrı raporlanır

ShadowTrade modelini gerekirse ekle.

Champion botların live eligibility değerlendirmesinde Shadow performansı kullanılabilsin.

Admin API üzerinden shadow sonuçları alınabilsin.
```

---

# PROMPT 21 — Live Eligibility Gate

```text
Live Eligible gate geliştir.

Bir bot LIVE_ELIGIBLE olabilmek için configurable kriterlerden geçsin:

- minimum paper trades
- minimum paper duration
- acceptable max drawdown
- minimum profit factor
- minimum risk-adjusted score
- minimum regime coverage
- successful shadow period
- no recent critical risk violation

Gate sadece LIVE_ELIGIBLE status verir.

Gerçek LIVE aktivasyonu kullanıcı/admin onayı olmadan yapılmasın.

Promotion audit log'a yazılsın.
```

---

# PROMPT 22 — Live Execution Hardening

```text
Mevcut canlı exchange execution yolunu AI Trading mimarisi için harden et.

Özellikle:

- idempotent order submit
- duplicate order prevention
- position reconciliation
- retry policy
- API timeout
- stale market data guard
- stop-loss verification
- exchange disconnect
- partial failure
- emergency stop
- startup reconciliation

kontrollerini incele ve eksikleri minimal değişikliklerle tamamla.

Risk Engine approval zorunlu olsun.

Withdrawal yetkisiyle ilgili kod/yetki isteme.

Gerçek trade'i test ederken varsayılan olarak testnet/paper kullan.

Production live davranışı kullanıcı onayı olmadan açılmasın.
```

---

# PROMPT 23 — AI Decision Interface

```text
AI Decision Layer için provider-independent backend interface geliştir.

AI output serbest metin değil, validated structured schema olmalı.

Örnek fields:

- symbol
- decision: LONG | SHORT | WAIT | HOLD | CLOSE | PARTIAL_CLOSE | MOVE_STOP | NO_TRADE
- confidence
- strategy
- marketRegime
- entryZone
- invalidation
- targets
- reasonSummary

Reason summary kısa ve açıklanabilir olsun.
Hidden chain-of-thought saklama/gösterme.

AI kararları hiçbir zaman doğrudan exchange'e gitmemeli.

Flow:

AI Decision
→ validation
→ Risk Engine
→ execution

İlk aşamada mock/provider adapter eklenebilir.
Gerçek provider'a sıkı coupling yapma.
```

---

# PROMPT 24 — Teacher + Researcher AI Adapter

```text
Teacher ve Researcher için opsiyonel LLM provider adapter ekle.

Kurallar:

- provider interface kullan
- provider başarısızsa deterministic fallback çalışabilsin
- LLM çıktısı JSON schema ile validate edilsin
- AI hiçbir kodu direkt değiştirmesin
- AI hiçbir live risk ayarını değiştirmesin
- AI önerileri audit edilsin

Teacher AI:
performans değerlendirmesi üretir.

Researcher AI:
yeni hypothesis üretir.

Generated hypothesis doğrudan live'a uygulanmaz.
Candidate pipeline'a gider.
```

---

# PROMPT 25 — Backend Observability

```text
Autonomous Trading sistemi için observability ekle.

Takip edilmesi gerekenler:

- active bots
- arena throughput
- market data lag
- strategy execution latency
- paper order count
- risk rejects
- exchange errors
- AI provider errors
- generation status
- teacher runs
- researcher runs
- memory growth
- PnL calculation errors

Mevcut logging/metrics altyapısını kullan.

Sensitive API key veya secret loglama.

Admin için health endpointleri ekle.

Error correlation id kullanılıyorsa mevcut standarda uy.
```

---

# PROMPT 26 — Autonomous Trading Admin API

```text
Frontend entegrasyonu için Autonomous Trading Admin API katmanını tamamla.

Read endpoints/data contracts:

- overview
- bots
- leaderboard
- arena status
- champions
- strategies
- generations
- evolution runs
- teacher evaluations
- researcher hypotheses
- memory/trades
- performance
- market regime
- risk
- shadow
- live eligibility
- system health

Write operations:

- create/pause/resume paper bot
- trigger allowed paper generation
- archive candidate
- approve/reject promotion where manual approval required
- configure allowed non-critical settings

Critical live/risk operations mevcut admin security modeline uygun olsun.

API response'ları frontend için stabil DTO'larla dönsün.
```

---

# PROMPT 27 — Backend Test / Simulation Suite

```text
AI Trading backend için kapsamlı simulation ve test suite oluştur.

Senaryolar:

1. 100 bot parallel paper
2. profitable trend market
3. ranging market
4. sudden volatility spike
5. exchange disconnect
6. stale market data
7. high funding
8. fee-heavy overtrading bot
9. high profit + unacceptable drawdown bot
10. low profit + stable bot
11. daily loss limit
12. emergency stop
13. generation mutation
14. Champion promotion
15. Shadow mode
16. risk rejection

Test sonuçlarında özellikle bot score'un yalnızca kâra göre seçim yapmadığını doğrula.

Production exchange'e emir gönderme.
```

---

# PROMPT 28 — Frontend Architecture Audit

```text
Backend fazları tamamlandıktan sonra frontend için başla.

Önce mevcut Trade Operasyonları admin ekranını analiz et.

Bu aşamada kod değiştirme.

Aşağıdaki ekranların mevcut component/design system ile nasıl entegre edileceğini docs/AI_TRADING_FRONTEND_PLAN.md içinde yaz:

- Overview
- Arena
- Bots
- Champions
- Strategies
- Evolution
- Researcher
- Teacher
- Memory
- Performance
- Risk
- Shadow
- Live Trading
- Settings

Mevcut manual/grid trade UI'ını koru.

Backend API contract'larını incele.
```

---

# PROMPT 29 — AI Trading Overview Frontend

```text
docs/AI_TRADING_FRONTEND_PLAN.md dosyasını oku.

Trade Operations admin alanına AI Trading Overview ekranı ekle.

Göster:

- autonomous system status
- paper/live/shadow mode
- active bots
- candidate/challenger/champion counts
- current market regime
- aggregate paper equity
- net PnL
- max drawdown
- risk status
- arena status
- top bots
- latest Teacher insight
- latest Researcher hypothesis
- recent activity

Mevcut design system kullan.
Backend API'lere bağlan.
Mock data kullanma, API yoksa boş state göster.

Desktop-first responsive tasarla.
```

---

# PROMPT 30 — Arena & Bot Leaderboard Frontend

```text
Admin frontend'e Arena ekranı ekle.

Göster:

- 100 bot population
- bot cards/table
- score
- PnL
- ROI
- profit factor
- max drawdown
- trades
- win rate
- strategy family
- generation
- regime fit
- status
- mini equity sparkline varsa

Filtreler:

- status
- strategy
- generation
- regime
- score
- PnL

Sıralama:

- score
- PnL
- PF
- drawdown
- trades

Bot detay drawer/modal ekle.
Mevcut backend contracts kullan.
```

---

# PROMPT 31 — Champions Frontend

```text
Admin frontend'e Champions / Challengers ekranı ekle.

Göster:

- Candidate
- Challenger
- Champion
- Live Eligible

ayrımlarını net yap.

Her bot için:

- score
- paper duration
- trade count
- regime coverage
- PF
- drawdown
- shadow status
- eligibility blockers

Promotion history göster.

Live'a alma butonu backend izin vermiyorsa gösterme.
Manual approval gerekiyorsa confirm flow kullan.
```

---

# PROMPT 32 — Evolution Frontend

```text
Evolution ekranı oluştur.

Göster:

- current generation
- population size
- survivors
- mutations
- crossover children
- rejected
- top fitness/score
- generation history
- parent → child ilişkileri

Bot lineage göstermek için sade bir visual/tree kullan.
Gereksiz ağır kütüphane ekleme.

Mutation diff detayını göster:

old value → new value

Evolution trigger backend izinlerine uygun olsun.
```

---

# PROMPT 33 — Teacher / Researcher Frontend

```text
Teacher ve Researcher ekranlarını oluştur.

Teacher:

- bot/strategy
- observation
- severity
- confidence
- metric evidence
- recommendation
- date

Researcher:

- hypothesis
- evidence
- target strategy
- suggested change
- confidence
- candidate status

AI tarafından üretilen içerik ile sistem tarafından uygulanan değişiklikleri net ayır.

"Suggestion" hiçbir zaman "Applied" gibi görünmemeli.
```

---

# PROMPT 34 — Memory Frontend

```text
Trade Memory ekranı oluştur.

Filtreler:

- symbol
- bot
- strategy
- regime
- result
- date

Trade detail:

- entry/exit
- PnL
- MFE/MAE
- fees
- funding
- slippage
- market context
- regime
- close reason
- decision summary

Benzer piyasa örnekleri backend destekliyorsa ayrı bölüm göster.

Data dense fakat okunabilir tasarım yap.
```

---

# PROMPT 35 — Performance Frontend

```text
Performance ekranı oluştur.

Göster:

- aggregate equity curve
- PnL
- ROI
- Sharpe
- Sortino
- Calmar
- max drawdown
- profit factor
- expectancy
- fees
- funding
- slippage
- trade count
- win rate

Karşılaştırmalar:

- strategy family
- bot
- generation
- regime
- symbol

Projede mevcut chart library varsa onu kullan.
Yeni ağır bağımlılık ekleme.
```

---

# PROMPT 36 — Risk Frontend

```text
Risk ekranını geliştir.

Göster:

- Risk Engine status
- max risk/trade
- daily loss
- weekly loss
- max drawdown
- leverage
- max open positions
- exposure
- symbol exposure
- cooldown
- emergency stop
- recent risk rejects

Immutable/hard safety alanlarını görsel olarak diğer ayarlardan ayır.

AI'ın bu alanları değiştiremeyeceğini UI'da açıkça belirt.

Critical değişikliklerde mevcut admin confirmation standardını kullan.
```

---

# PROMPT 37 — Shadow & Live Frontend

```text
Shadow / Live Trading ekranlarını oluştur.

Shadow:

- would open
- would close
- would move stop
- virtual PnL
- live-market tracking

Live:

- active live Champion bots
- capital allocation
- current positions
- risk state
- realized/unrealized PnL
- exchange health

Paper / Shadow / Live sonuçlarını görsel olarak kesin biçimde ayır.

Kullanıcı yanlışlıkla paper sonucu live sanmamalı.
```

---

# PROMPT 38 — Final Integration Audit

```text
AI_TRADING_ARCHITECTURE.md dosyasındaki hedef mimariye göre tamamlanan sistemi audit et.

Kontrol et:

- mevcut manual/grid trade bozulmuş mu
- paper/live ayrımı güvenli mi
- 100 bot arena çalışıyor mu
- score risk-adjusted mı
- Champion gate doğru mu
- Teacher sadece öneri mi üretiyor
- Researcher candidate mı üretiyor
- Evolution live'a dokunuyor mu
- Risk Engine bypass edilebiliyor mu
- emergency stop doğru mu
- market data freshness guard var mı
- audit logs yeterli mi
- frontend paper/shadow/live ayrımını doğru gösteriyor mu

Eksikleri docs/AI_TRADING_FINAL_AUDIT.md içine yaz.

Kritik güvenlik hataları dışında bu aşamada büyük refactor yapma.
```

---

# Önerilen Faz Grupları

Daha kontrollü ilerlemek için promptları şu gruplarda uygula:

## Faz A — Temel Sistem

PROMPT 0-7

Hedef:
100 botu paper çalıştır ve puanla.

## Faz B — Seçim ve Hafıza

PROMPT 8-10

Hedef:
Rejim bazlı ölç, Champion seç, geçmişi kaydet.

## Faz C — Kendi Kendini Geliştirme

PROMPT 11-15

Hedef:
Teacher + Researcher + Mutation + Evolution + Crossover.

## Faz D — Intelligence

PROMPT 16-17

Hedef:
Piyasa context'i ve uygun bot yönlendirmesi.

## Faz E — Risk ve Canlıya Hazırlık

PROMPT 18-27

Hedef:
Risk, portfolio, shadow, live eligibility, execution hardening ve testler.

## Faz F — Frontend

PROMPT 28-37

Hedef:
Autonomous Trading Operations Center.

## Faz G — Audit

PROMPT 38

Hedef:
Canlı öncesi mimari ve güvenlik denetimi.

---

# Önemli Not

Her prompt tamamlandıktan sonra:

1. testleri çalıştır
2. oluşan migrationları kontrol et
3. mevcut manual/grid trade'i smoke test et
4. git diff incele
5. commit oluştur
6. sonraki prompta geç

Tek bir Codex oturumunda 5-10 fazı birden yaptırma.

Bu proje küçük ve doğrulanabilir iterasyonlarla geliştirilmelidir.
