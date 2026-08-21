# AI Trading Frontend Plan

## Amaç ve sınırlar

Bu plan, mevcut `/admin/trading` çalışma alanını bozmadan Autonomous AI Trading operasyon ekranlarını aynı React, React Router, Tailwind ve tasarım tokenlarıyla eklemek için hazırlanmıştır. Manual trade, Grid Bot, borsa hesapları, pozisyonlar, emirler ve mevcut risk ekranları korunacaktır.

Frontend yalnızca mevcut admin API sözleşmelerini tüketir. Mock veri üretmez; bir endpoint veri döndürmüyorsa açık bir boş durum gösterir. PAPER, SHADOW ve LIVE verileri hiçbir yerde aynı anlamı taşıyan renk veya etikette sunulmaz. Backend `liveActivationAvailable: false` döndürdüğü sürece live aktivasyon kontrolü render edilmez.

## Mevcut mimari bulguları

- Uygulama React 19 + React Router 7 kullanıyor. Admin rotaları `frontend/src/App.tsx`, trading alt navigasyonu `frontend/src/components/AdminModuleLayout.tsx` içinde.
- Tüm trading ekranları `AdminRoute` arkasında ve `/admin/trading` altında lazy-loaded route olarak açılıyor.
- Tasarım sistemi Tailwind v4 tokenlarını kullanıyor: koyu `background/surface`, altın `primary`, güvenli durum için yeşil `secondary`, uyarı için `tertiary`, tehlike için `error`.
- Tekrar kullanılan desenler: yuvarlatılmış surface kartları, yatay taşan tablolar, responsive grid, skeleton, error ve empty state, `lucide-react` ikonları.
- Projede grafik için zaten `recharts` var. Yeni veya ağır bir görselleştirme bağımlılığı gerekmiyor.
- HTTP erişimi `frontend/src/services/apiClient.ts` üzerinden, `/api` base URL ve mevcut auth interceptor'larıyla yapılmalı.
- Mevcut manual/grid bileşenleri `ManualTrading.tsx`, `TradingBots.tsx` ve `TradingAdminPhases.tsx` içinde kalmalı; autonomous sayfalar bu bileşenlerin işleyişini veya servis çağrılarını değiştirmemeli.
- Mevcut trading sekme çubuğu yeni ekran sayısıyla aşırı uzayacak. Autonomous ekranlar `/admin/trading/ai/*` altında, ayrı bir `AITradingLayout` ve ikinci seviye yatay navigasyonla gruplanmalı. Ana trading navigasyonuna yalnızca `AI Trading` giriş sekmesi eklenmeli.

## Route ve ekran yapısı

| Ekran | Önerilen route | Ana backend contract |
|---|---|---|
| Overview | `/admin/trading/ai` | `/autonomous/overview`, `/autonomous/arena-status`, `/system-health`, `/market-intelligence/context`, leaderboard, Teacher, Researcher, audit |
| Arena | `/admin/trading/ai/arena` | `/autonomous/arena-status`, `/leaderboard`, `/bot-factory/bots` |
| Bots | Arena ekranındaki bot tablosu/detay drawer | `/bot-factory/bots`, bot score ve güvenli autonomous write endpointleri |
| Champions | `/admin/trading/ai/champions` | `/champions`, `/autonomous/live-eligibility`, audit |
| Strategies | Arena ve Researcher filtrelerinde ortak özet | `/strategies` |
| Evolution | `/admin/trading/ai/evolution` | `/autonomous/generations`, `/evolution/runs`, mutations, crossovers |
| Researcher | `/admin/trading/ai/researcher` | `/research/hypotheses` |
| Teacher | `/admin/trading/ai/teacher` | `/teacher/evaluations` |
| Memory | `/admin/trading/ai/memory` | `/trade-memory`, `/trade-memory/summary` |
| Performance | `/admin/trading/ai/performance` | leaderboard, bot score, memory summary ve paper performance |
| Risk | `/admin/trading/ai/risk` | mevcut account risk profile/events, `/system-health` |
| Shadow | `/admin/trading/ai/shadow-live` | `/shadow-trades`, `/shadow-trades/performance` |
| Live Trading | Shadow ile aynı ekranda ayrı, kırmızı çerçeveli bölüm | `/autonomous/live-eligibility`, mevcut positions ve exchange health read endpointleri |
| Settings | Risk ekranındaki non-critical bot settings alanı | `/autonomous/bots/:id/settings` |

Strategies, Bots ve Settings bağımsız ağır ekranlar yerine ilgili operasyon ekranlarında erişilebilir alt bölümler olarak ele alınacaktır; bu yaklaşım hedefteki tüm bilgiyi kapsarken ana navigasyonu yönetilebilir tutar.

## Paylaşılan frontend katmanı

`frontend/src/services/aiTradingService.ts` içinde backend DTO'ları ve çağrıları merkezileştirilecek. Autonomous envelope `{ apiVersion, kind, data, liveTradingEnabled }` doğrulanacak; beklenmeyen API sürümü güvenli hata durumuna düşecek.

`frontend/src/components/ai-trading/AITradingUI.tsx` içinde şu hafif ortak parçalar kullanılacak:

- `AITradingPage`, `MetricCard`, `StatusBadge`, `ModeBadge`
- `LoadingState`, `ErrorState`, `EmptyState`
- `DataTable`, `FilterBar`, `JsonEvidence`
- tarih, para, yüzde ve nullable metric formatter'ları

Mode sunumu zorunlu olarak:

- PAPER: altın etiket + “Simülasyon / gerçek emir yok” açıklaması
- SHADOW: mor/tertiary etiket + “Canlı piyasa takibi / gerçek emir yok” açıklaması
- LIVE: kırmızı etiket + “Gerçek sermaye” açıklaması
- UNKNOWN: nötr gri ve güvenli belirsizlik mesajı

## Ekran uygulama planı

### Overview

Autonomous durum, güvenli modlar, aktif bot ve lifecycle sayıları, arena throughput, risk/health, market regime ve aggregate PAPER metriklerini kartlarda gösterir. Top botlar ile en son Teacher/Researcher kayıtları ve audit aktivitesi aşağıdaki bölümlerde sunulur. API'nin sağlamadığı metrikler `—` ve açıklayıcı empty state olarak görünür; istemci tarafında tahmin edilmez.

### Arena ve Bots

Leaderboard ile factory bot listesini `tradingBotId` üzerinden birleştirir. Filtre ve sıralama istemci tarafında yalnızca yüklenen veri üzerinde uygulanır. Score breakdown içinden bulunan PnL, ROI, PF, drawdown, trade count ve win rate alanları gösterilir; bulunmayan alanlar `—` kalır. Drawer bot kimliği, strateji, lifecycle, mode, score snapshot ve güvenli pause/resume/settings eylemlerini içerir. Mini equity serisi backend tarafından sağlanmıyorsa chart gösterilmez.

### Champions

Candidate/Challenger/Champion/Live Eligible durumları ayrı kolon veya filtrelerle sunulur. Champion evaluation evidence içinden duration, trades, regime coverage, PF, drawdown ve failed gates okunur. Promotion geçmişi champion kayıtları ve audit ledger ile gösterilir. Live aktivasyon endpointi olmadığı için “Live'a al” butonu bulunmaz; yalnızca backend destekli promotion review varsa açık confirm akışı kullanılabilir ve sonuç `APPROVED_PENDING_ACTIVATION` olarak etiketlenir.

### Evolution

Generation özetleri, run geçmişi ve counts alanları kullanılır. Mutation ve crossover kayıtlarından parent → child bağlantıları CSS tabanlı kompakt ağaç/listede çizilir. Mutation diff JSON'u eski → yeni satırları olarak gösterilir. Yeni nesil tetikleme yalnızca PAPER contract'ını kullanır ve confirm metni gerçek emir oluşturmadığını açıkça belirtir.

### Teacher ve Researcher

Teacher kartları gözlem, severity, confidence, metric evidence ve recommendation alanlarını taşır ve her zaman `ÖNERİ — UYGULANMADI` rozeti gösterir. Researcher kartları hypothesis, evidence, strategy family, suggested change, confidence ve candidate status alanlarını gösterir. `candidateCreated: false` veya DRAFT durumları hiçbir zaman Applied olarak sunulmaz.

### Memory

Server-side desteklenen symbol/bot/strategy/regime/result/date filtreleri query parametrelerine dönüştürülür. Trade drawer entry/exit, PnL, MFE/MAE, fees, funding, slippage, market context, regime, close reason ve decision summary alanlarını gösterir. Benzer piyasa endpointi yoksa ilgili bölüm render edilmez.

### Performance

Mevcut `recharts` ile yalnızca API'den gelen zaman serisi varsa equity curve çizilir. PnL, ROI, Sharpe, Sortino, Calmar, drawdown, PF, expectancy, costs, trades ve win rate nullable olarak sunulur. Strategy/bot/generation/regime/symbol karşılaştırmaları mevcut leaderboard ve memory summary verileriyle sınırlıdır; eksik kırılımlar uydurulmaz.

### Risk

Mevcut hesap risk ekranının API contract'ları yeniden kullanılır; autonomous sert limitler ve recent rejects eklenir. Hard safety alanları kırmızı/çizgili ayrı panelde salt-okunur sunulur ve “AI bu limitleri değiştiremez” metni gösterilir. Mevcut admin confirm standardı olmadan kritik write eklenmez. Kill switch davranışı değiştirilmez.

### Shadow ve Live

Shadow action ledger ve virtual PnL ayrı mor/tertiary alanda gösterilir. Live alanı yalnızca read-only eligibility, positions ve exchange health gösterir. `liveActivationAvailable: false` iken aktivasyon CTA'sı yoktur. Boş live sonuçları “Live trading kapalı” güvenli durumu gösterir; PAPER veya SHADOW PnL hiçbir koşulda Live başlığı altında toplanmaz.

## API boşlukları ve güvenli davranış

- Overview contract doğrudan aggregate equity, PnL ve drawdown vermiyor. Var olan paper performance/memory verisi güvenilir biçimde aggregate edilebiliyorsa gösterilecek; aksi halde boş kalacak.
- Arena bot listesi ile score breakdown alanlarının şekli tamamen sabit DTO değil. Frontend bilinmeyen JSON'u daraltan type guard kullanacak.
- Current market context `UNKNOWN` veya stale dönebilir. UI bunu aktif regime gibi renklendirmeyecek.
- Evolution mutation/crossover list endpointleri vardır, fakat graph için tüm lineage tek response değildir; kayıtlar client tarafında sınırlı listede birleştirilecek.
- Live position/allocation verisi autonomous contract'ta tek endpoint değildir. Var olan read-only position ve allocation endpointleri kullanılacak; eksik veri live olarak varsayılmayacak.
- Backend write endpointi bulunmayan hiçbir UI aksiyonu gösterilmeyecek.

## Test ve regresyon yaklaşımı

Her frontend promptunda en az `npm run lint` ve `npm run build` çalıştırılacak. Saf formatter/filter/DTO yardımcıları Node test runner ile test edilebilir hale getirilecek. Route smoke kontrolleri yeni lazy importların build çıktısına dahil olduğunu doğrulayacak.

Manual trade, Grid Bot, exchange accounts, orders, positions ve mevcut risk ekranı rotaları her promptta korunacak. Final frontend fazında bu rotaların kaynak eşlemeleri ve production build yeniden doğrulanacak.

## Uygulama sırası

1. Ortak service/types/UI ve nested AI layout ile Overview.
2. Arena/Bots ve Champion ekranları.
3. Evolution, Teacher ve Researcher ekranları.
4. Memory ve Performance ekranları.
5. Autonomous Risk ile Shadow/Live ekranları.
6. Frontend faz regresyon testi ve PROMPT 38 öncesi checkpoint.
