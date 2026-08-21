# AI Trading Simulation Results

PROMPT 27 deterministic suite: `npm run test:ai-trading-simulation`

Suite production exchange, credential, network veya live execution kullanmaz. PAPER/SHADOW-only in-memory harness ile mevcut mutation, Champion selection, Shadow summary ve leaderboard fonksiyonlarını birlikte doğrular.

| # | Scenario | Expected invariant |
|---:|---|---|
| 1 | 100 bot parallel paper | 100 bot tamamlanır; yalnız paper order oluşur |
| 2 | Profitable trend | Net PnL pozitif |
| 3 | Ranging market | Fee sonrası performans zayıflar |
| 4 | Volatility spike | Yüksek drawdown ölçülür |
| 5 | Exchange disconnect | Emirden önce fail-closed |
| 6 | Stale market data | Emirden önce fail-closed |
| 7 | High funding | Risk rejection |
| 8 | Fee-heavy overtrading | Cost penalty ve negatif net PnL |
| 9 | High profit / bad drawdown | Risk-adjusted skor düşer |
| 10 | Low profit / stable | Riskli yüksek-kâr bottan üstte sıralanır |
| 11 | Daily loss limit | Limit sonrası yeni paper order yok |
| 12 | Emergency stop | Tüm sinyaller reddedilir |
| 13 | Generation mutation | Parent immutable, child bounded |
| 14 | Champion promotion | PAPER → CHALLENGER → CHAMPION; LIVE yok |
| 15 | Shadow mode | PAPER ledger’dan izole |
| 16 | Risk rejection | Rejected sinyal paper order oluşturmaz |

Bu sonuçların ana kabul kriteri: seçim yalnız mutlak kâra göre yapılmaz. Daha yüksek net kârlı fakat yüksek drawdown'lı bot, düşük kârlı ve istikrarlı botun altında risk-adjusted skor alır.
