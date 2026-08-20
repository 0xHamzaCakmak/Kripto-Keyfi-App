# KriptoKeyfi Autonomous AI Trading Architecture

## 1. Amaç

Bu doküman KriptoKeyfi içindeki mevcut trade operasyon altyapısının, zaman içinde kendi performansını ölçebilen, yeni strateji varyasyonları üretebilen, paper ortamında botları yarıştırabilen, en başarılı adayları seçebilen ve kontrollü biçimde canlı trade'e taşıyabilen bir **Autonomous AI Trading Platform** haline getirilmesi için hedef mimariyi tanımlar.

Bu doküman bir "tek seferde uygulanacak görev listesi" değildir. Codex ve geliştirici ekip için **uzun vadeli hedef mimari referansıdır**.

Temel prensip:

> Sistem kendi kendini geliştirebilir; ancak Risk Engine, execution güvenliği ve canlı sermaye limitleri AI tarafından değiştirilemez.

---

## 2. Mevcut Sistemle İlişki

KriptoKeyfi içinde halihazırda:

- Admin panelinde Trade Operasyonları ekranı
- Manuel trade
- Grid bot mantığı
- Borsa API bağlantısı
- Backend trade servisleri
- Haber içerikleri
- YouTube içerikleri
- Whale / market veri altyapısı
- React frontend
- Node.js backend
- Go trade engine

bulunmaktadır.

Yeni yapı mevcut çalışan sistemin yerine geçmek için değil, onun üzerine kademeli şekilde inşa edilmek için tasarlanacaktır.

Aşağıdakiler korunmalıdır:

- mevcut manual trade
- mevcut grid bot
- mevcut exchange entegrasyonları
- mevcut açık pozisyon/emir yönetimi
- mevcut admin auth ve rol sistemi
- mevcut production davranışı

---

# 3. Hedef Sistem

```text
Market Data
    ↓
Market Intelligence
    ↓
Market Regime Detector
    ↓
Strategy Router
    ↓
Strategy Factory / Bot Factory
    ↓
Bot Arena
    ↓
Paper Trading
    ↓
Performance Engine
    ↓
Teacher
    ↓
Researcher
    ↓
Evolution Engine
    ↓
Champion / Challenger
    ↓
Portfolio Allocator
    ↓
Immutable Risk Engine
    ↓
Execution Engine
    ↓
Exchange
    ↓
Trade Memory
    ↓
Performance / Learning Loop
```

---

# 4. Ana Tasarım Prensipleri

## 4.1 AI doğrudan borsaya emir göndermez

Yanlış:

```text
AI → Exchange
```

Doğru:

```text
AI Decision
    ↓
Risk Validation
    ↓
Execution Validation
    ↓
Exchange Adapter
    ↓
Exchange
```

Her emir mutlaka merkezi Risk Engine tarafından onaylanmalıdır.

---

## 4.2 Öğrenme ile güvenlik birbirinden ayrılır

Teacher, Researcher veya Evolution Engine aşağıdaki parametreleri asla doğrudan değiştiremez:

- max leverage
- max risk per trade
- max daily loss
- max weekly loss
- max drawdown
- max open positions
- max total exposure
- max symbol exposure
- emergency stop
- exchange withdrawal permission
- liquidation protection
- live trading enable flag

Bu değerler kullanıcı tarafından yönetilen güvenlik ayarlarıdır.

---

## 4.3 Paper-first

Yeni hiçbir strateji doğrudan canlıya alınmaz.

Önerilen yaşam döngüsü:

```text
IDEA
↓
CANDIDATE
↓
BACKTESTED
↓
WALK_FORWARD_VALIDATED
↓
PAPER
↓
SHADOW
↓
CHALLENGER
↓
CHAMPION
↓
LIVE_ELIGIBLE
↓
LIVE
```

---

# 5. Market Data Layer

Tek market stream mümkün olduğunca tüm botlara ortak veri sağlamalıdır.

Örneğin aynı BTC 1m candle verisi 100 farklı bot için 100 kez borsadan çekilmemelidir.

Örnek market verileri:

- OHLCV
- bid / ask
- spread
- order book depth
- order book imbalance
- volume
- trades
- mark price
- index price
- funding rate
- next funding
- open interest
- long / short ratio
- liquidation data
- volatility
- BTC dominance
- cross-asset correlation

Harici intelligence kaynakları:

- KriptoKeyfi haberleri
- YouTube içerikleri
- sosyal sentiment
- whale activity
- makro olaylar
- önemli takvim olayları

---

# 6. Market Intelligence

Market Intelligence ham veriyi karar verilebilir bir Market Context haline getirir.

Örnek:

```json
{
  "symbol": "BTCUSDT",
  "timestamp": "...",
  "timeframe": "15m",
  "trend": "bullish",
  "trendStrength": 0.74,
  "volatility": "medium",
  "atrPct": 1.21,
  "fundingRate": 0.0001,
  "openInterestDelta": 0.042,
  "volumeRelative": 1.38,
  "newsSentiment": 0.41,
  "socialSentiment": 0.28,
  "whaleBias": "neutral"
}
```

Bu yapı stratejilerin aynı standardize edilmiş context üzerinden karar vermesini sağlar.

---

# 7. Market Regime Detector

Global tek "en iyi bot" yaklaşımı kullanılmamalıdır.

Bot performansları piyasa rejimine göre değerlendirilmelidir.

Başlangıç rejimleri:

- TRENDING_UP
- TRENDING_DOWN
- RANGING
- BREAKOUT
- HIGH_VOLATILITY
- LOW_VOLATILITY
- CHAOTIC
- UNKNOWN

Her bot için ayrı rejim performansı tutulmalıdır.

Örnek:

```text
breakout_v17

TRENDING_UP: 88
TRENDING_DOWN: 61
RANGING: 32
BREAKOUT: 93
HIGH_VOL: 74
```

Market Regime Router güncel piyasa için en uygun bot/strateji havuzunu seçer.

---

# 8. Strategy Registry

Her strateji ailesi registry üzerinden tanımlanmalıdır.

Örnek aileler:

- Grid
- Trend Following
- SMA Crossover
- EMA Trend
- MACD Trend
- RSI Mean Reversion
- Bollinger Mean Reversion
- Donchian Breakout
- ATR Breakout
- Momentum
- Volume Spike
- Funding Skew
- Basis Arbitrage
- News Reactive
- Multi-Agent
- DCA
- AI Limit
- custom generated strategies

Her strateji versiyonlanmalıdır.

Örnek:

```text
strategy_family: ATR_BREAKOUT
strategy_version: 17
generation: 4
parent_versions: [12, 15]
```

---

# 9. Bot Factory

Bot Factory aynı stratejinin farklı parametre kombinasyonlarını üretebilir.

Örnek:

```text
ATR Breakout v12
ATR Breakout v13
ATR Breakout v14
```

Hepsi aynı strategy family'ye ait olabilir fakat parametreleri farklıdır.

Bot oluşturma yöntemleri:

- manual
- clone
- parameter mutation
- crossover
- regime specialization
- researcher hypothesis
- AI generated
- imported strategy

Her BotInstance için:

- bot_id
- strategy_id
- version
- generation
- parameters
- parent_bot_ids
- created_by
- created_at
- status
- paper_balance
- risk_profile_id

tutulmalıdır.

---

# 10. Bot Arena

Amaç:

> Aynı piyasa verisi üzerinde onlarca/yüzlerce botun paper olarak paralel test edilmesi.

Başlangıç hedefi:

```text
100 candidate bot
```

Arena şu görevlerden sorumludur:

- bot state yönetimi
- sinyal üretimi
- paper emirleri
- paper fills
- transaction fees
- funding
- slippage model
- equity
- position state
- realized / unrealized PnL
- drawdown
- bot lifecycle

100 bot = 100 ayrı OS process olmak zorunda değildir.

Tek market stream ile çoklu strategy state çalıştırılabilir.

---

# 11. Gerçekçi Paper Trading

Paper engine gerçek sonuçları şişirmemelidir.

Mutlaka dikkate alınması gerekenler:

- taker fee
- maker fee
- funding
- spread
- configurable slippage
- latency
- minimum order size
- tick size
- lot size
- leverage
- margin
- stop execution
- liquidation approximation
- partial fill modeli gerekiyorsa
- insufficient liquidity koruması

Paper sonuçları gerçek canlı performans garantisi olarak değerlendirilmemelidir.

---

# 12. Performance Engine

Her bot için en az aşağıdakiler hesaplanmalıdır:

- starting balance
- current equity
- realized PnL
- unrealized PnL
- net PnL
- ROI
- total trades
- wins
- losses
- win rate
- expectancy
- average win
- average loss
- average R:R
- profit factor
- max drawdown
- Sharpe
- Sortino
- Calmar
- volatility
- average holding time
- turnover
- fee cost
- funding cost
- slippage cost
- liquidation count
- consecutive wins
- consecutive losses
- regime-specific performance

---

# 13. Bot Score

Sıralama sadece maksimum kâra göre yapılmamalıdır.

Yanlış:

```text
score = net_profit
```

Önerilen yaklaşım:

```text
score =
  return_component
+ profit_factor_component
+ sharpe_component
+ sortino_component
+ consistency_component
+ expectancy_component
- drawdown_penalty
- churn_penalty
- liquidation_penalty
- instability_penalty
```

Ağırlıklar konfigüre edilebilir olmalıdır.

Amaç:

> Maximum sustainable risk-adjusted return.

---

# 14. Minimum Kanıt Koşulları

Bir bot sadece birkaç başarılı işlem nedeniyle Champion olamaz.

Örnek doğrulama kriterleri:

- min trades
- min observation duration
- min market regimes
- minimum profit factor
- maximum drawdown
- minimum score
- minimum out-of-sample performance
- minimum walk-forward performance

Örnek:

```text
minTrades = 200
minPaperDays = 7
minMarketRegimes = 3
```

Bu değerler sabit değil; ayarlanabilir olmalıdır.

---

# 15. Generations

Evolution Engine botları nesiller halinde geliştirebilir.

Örnek:

```text
Generation 1
100 bots

↓ evaluate

Top 20 survive

Generation 2

20 survivors
50 mutations
20 crossover children
10 researcher candidates

= 100 bots
```

Her generation kaydedilmelidir.

---

# 16. Mutation

Mutation örneği:

```text
parent bot

ATR multiplier: 1.8
volume threshold: 1.30
confidence: 0.68
```

Yeni adaylar:

```text
candidate A
ATR: 1.9

candidate B
volume threshold: 1.42

candidate C
confidence: 0.72
```

Mutation limitleri Strategy Schema ile kontrol edilmelidir.

AI keyfi parametre üretememelidir.

---

# 17. Crossover

Başarılı iki botun bazı özellikleri birleştirilebilir.

Örnek:

```text
Parent A
strong entry logic

Parent B
strong exit logic

Child C
A.entry + B.exit
```

Crossover sadece teknik olarak uyumlu strategy schema'larında yapılmalıdır.

---

# 18. Champion / Challenger

Bot yaşam döngüsü:

```text
Candidate
↓
Validated
↓
Challenger
↓
Champion
↓
Live Eligible
```

Başlangıç hedefi örneği:

```text
100 candidate
↓
20 challenger
↓
10 champion
↓
1-3 live active
```

Champion olmak canlıya otomatik geçmek anlamına gelmemelidir.

---

# 19. Teacher

Teacher gerçekleşen işlemleri ve bot performansını analiz eder.

Örnek çıktı:

```text
Bot:
funding_skew_v12

Observation:
- excess churn
- weak neutral-funding performance
- drawdown increasing

Recommendation:
- increase funding threshold
- increase cooldown
- reduce position factor
```

Teacher:

- öneri üretir
- botların zayıf yönlerini belirler
- güçlü botları işaretler
- aşırı işlem sorununu tespit eder
- threshold önerir

Teacher canlı kodu doğrudan değiştirmez.

---

# 20. Researcher

Researcher yeni hipotezler üretir.

Kaynaklar:

- paper sonuçları
- market regime performansı
- trade memory
- news sentiment
- market intelligence
- bot correlation
- failure analysis

Örnek:

```text
Hypothesis:

Breakout strategies underperform
when funding is strongly positive
and OI acceleration is high.
```

Sonuç:

```text
breakout_funding_filter_v1
```

Candidate olarak Bot Arena'ya gönderilir.

---

# 21. Trade Memory

Her trade için tam context saklanmalıdır.

Örnek:

```text
symbol
side
strategy
bot_id
entry_time
exit_time
entry
exit
SL
TP
position_size
leverage
fees
funding
slippage
PnL
MFE
MAE
market_regime
market_context
news_context
AI confidence
close_reason
```

---

# 22. Market Memory

Sistem benzer piyasa durumlarını bulabilmelidir.

Market fingerprint örneği:

```text
RSI
ATR
trend
volume ratio
funding
OI delta
orderbook imbalance
news sentiment
market regime
```

Benzer context'lerde hangi strategy family'nin daha iyi performans gösterdiği bulunabilir.

---

# 23. AI Decision Layer

AI çıktıları yapılandırılmış olmalıdır.

Örnek:

```json
{
  "symbol": "BTCUSDT",
  "decision": "LONG",
  "confidence": 0.78,
  "entryZone": [118200, 118400],
  "invalidation": 117650,
  "targets": [119100, 120000],
  "strategy": "breakout",
  "marketRegime": "TRENDING_UP",
  "reasonSummary": [
    "1h trend bullish",
    "volume confirmation",
    "funding neutral"
  ]
}
```

AI'ın gizli reasoning çıktısı UI veya DB için gerekli değildir.

Sadece açıklanabilir özet saklanmalıdır.

---

# 24. Immutable Risk Engine

Risk Engine tüm trade sisteminin üzerinde olmalıdır.

Kontroller:

- max risk/trade
- max daily loss
- max weekly loss
- max max drawdown
- max leverage
- max total exposure
- max symbol exposure
- max concurrent positions
- min risk/reward
- stop-loss required
- isolated/cross policy
- max position size
- cooldown
- consecutive-loss lock
- emergency stop

Execution Engine sadece:

```text
RiskEngine.approve()
```

başarılı olduğunda emir gönderebilir.

---

# 25. Position Sizing

AI position size belirlememelidir.

Risk Engine hesaplamalıdır.

Örnek:

```text
accountEquity = 100 USDT
riskPerTrade = 1%
maxLoss = 1 USDT

entry = 100
stop = 98

position size risk bazlı hesaplanır.
```

Leverage gerçek risk limitini bypass edemez.

---

# 26. Portfolio Allocator

Birden fazla Champion aynı anda kullanılabilir.

Örnek:

```text
BTC breakout champion     30%
ETH trend champion        25%
BTC mean reversion        20%
cash reserve              25%
```

Allocation şu faktörleri değerlendirebilir:

- bot score
- regime fit
- recent drawdown
- correlation
- volatility
- portfolio exposure
- capital reserve

---

# 27. Canlı Başlangıç

İlk canlı testte tüm Champion botları aynı anda çalıştırmak önerilmez.

Başlangıç:

```text
capital: 100 USDT
active strategies: 1-3
low leverage
isolated margin
hard daily loss
hard max drawdown
```

Performans hedefi sadece bakiye büyümesi değil:

- drawdown
- profit factor
- expectancy
- risk-adjusted return
- stability
- execution accuracy

---

# 28. Shadow Mode

Live market data üzerinde gerçek emir gönderilmeden sistem:

```text
Would Open
Would Close
Would Move Stop
```

kararlarını üretir.

Shadow performansı gerçek fiyat akışı üzerinde ölçülür.

Bu Live Eligible geçişinin önemli parçasıdır.

---

# 29. Node.js ve Go Sorumluluk Ayrımı

## Node.js

Önerilen sorumluluklar:

- Admin API
- AI Orchestrator
- Teacher
- Researcher
- Market Intelligence orchestration
- Evolution coordination
- Strategy Registry
- Generation management
- Performance API
- Memory API
- Admin settings
- scheduler / background orchestration
- persistence

## Go

Önerilen sorumluluklar:

- high frequency market event processing
- strategy runtime
- Bot Arena execution
- paper simulation
- order execution
- exchange adapter
- position manager
- real-time risk checks
- position synchronization

Mevcut mimari farklı ise Codex mevcut yapıyı analiz edip uygun sınırlar içinde adapte etmelidir.

---

# 30. İlk Veri Modelleri

İlk fazda minimum:

```text
Strategy
StrategyVersion
BotInstance
Generation
PaperTrade
BotMetric
MarketRegimeSnapshot
TeacherEvaluation
ChampionCandidate
RiskProfile
```

İleri faz:

```text
ResearchHypothesis
Mutation
Crossover
EvolutionRun
MarketMemory
TradeMemory
PortfolioAllocation
ShadowTrade
LiveTrade
AIActivity
```

---

# 31. Strategy Status

Önerilen state:

```text
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
```

Geçişler audit log'a yazılmalıdır.

---

# 32. Auditability

Sistem her önemli kararı kayıt altına almalıdır:

- kim oluşturdu
- hangi bot değişti
- hangi parametre değişti
- neden değişti
- hangi parent'tan geldi
- hangi test sonucu ile promote edildi
- kim live'a aldı
- hangi risk profili aktifti

AI tarafından yapılan aksiyonlar da audit log'a yazılmalıdır.

---

# 33. Emergency Safety

Aşağıdaki durumlarda yeni emir engellenmelidir:

- exchange disconnected
- account sync uncertain
- market data delayed
- Risk Engine unavailable
- stop order failure
- daily loss exceeded
- max DD exceeded
- unexpected balance mismatch
- API authentication failure
- emergency stop active

---

# 34. Admin Frontend Hedef Yapısı

Backend tamamlandıkça aşağıdaki ekranlar oluşturulabilir:

```text
Overview
Arena
Bots
Champions
Strategies
Evolution
Researcher
Teacher
Memory
Performance
Risk
Live Trading
Settings
```

Öncelik backend doğruluğudur. UI backend contract'larına göre inşa edilmelidir.

---

# 35. Geliştirme Sırası

Önerilen sıra:

1. Architecture audit
2. Core domain models
3. Strategy Registry
4. Bot Factory
5. Paper Engine
6. Bot Arena
7. Performance Engine
8. Bot Score
9. Champion / Challenger
10. Trade Memory
11. Teacher
12. Researcher
13. Evolution / Mutation
14. Crossover
15. Market Intelligence
16. Market Regime Detector
17. Strategy Router
18. Immutable Risk Engine
19. Portfolio Allocator
20. Shadow Mode
21. Live integration hardening
22. Admin frontend

---

# 36. İlk Büyük Hedef

İlk somut hedef:

> KriptoKeyfi aynı anda en az 100 paper botu aynı market data üzerinde çalıştırabilsin, gerçekçi fee/funding/slippage ile sonuçlarını ölçebilsin, risk-adjusted score hesaplayabilsin ve en başarılı adayları otomatik sıralayabilsin.

Sonraki hedef:

> En iyi botlar Champion/Challenger sistemiyle seçilsin ve sistem kontrollü şekilde yeni nesiller üretebilsin.

---

# 37. Kodlama Kuralları

Codex her fazda:

- önce mevcut sistemi incelemeli
- mevcut çalışan trade özelliklerini bozmamalı
- tek seferde tüm mimariyi uygulamaya çalışmamalı
- migration gerekiyorsa minimal ve geri alınabilir yapmalı
- test yazmalı
- type safety korumalı
- yeni config'leri env/example veya merkezi config üzerinden tanımlamalı
- gerçek live trade'i varsayılan olarak açmamalı
- paper mode default güvenli mod olmalı
- mock ve production data ayrımını açık tutmalı

---

# 38. Nihai Vizyon

KriptoKeyfi AI Trader sadece "AL / SAT sinyali üreten bir bot" olmayacaktır.

Nihai sistem:

- piyasa koşullarını tanır
- uygun stratejileri seçer
- yeni botlar üretir
- paper ortamında yarıştırır
- performanslarını ölçer
- zayıfları eler
- güçlüleri geliştirir
- Champion havuzu oluşturur
- geçmiş işlemlerden hafıza üretir
- Teacher ile performans analizi yapar
- Researcher ile yeni hipotezler üretir
- Evolution Engine ile yeni nesiller oluşturur
- değiştirilemez Risk Engine ile sermayeyi korur
- yalnızca yeterli kanıtı olan stratejileri canlıya aday yapar

Ana hedef:

> Maksimum kısa vadeli kâr değil, uzun vadeli sürdürülebilir risk-ayarlı getiri.
