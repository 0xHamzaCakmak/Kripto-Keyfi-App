# Autonomous Trading Admin API v1

Base path: `/api/admin/trading`. Bütün endpointler mevcut `authenticate + ADMIN` authorization zincirinin arkasındadır. Response envelope `{ success, data }`; yeni autonomous DTO'ları ayrıca `{ apiVersion: "v1", kind, data, liveTradingEnabled: false }` taşır.

## Read contracts

| Alan | Endpoint |
|---|---|
| Overview | `GET /autonomous/overview` |
| Bots | `GET /bot-factory/bots` |
| Leaderboard | `GET /leaderboard` |
| Arena status | `GET /autonomous/arena-status` |
| Champions | `GET /champions` |
| Strategies | `GET /strategies` |
| Generations | `GET /autonomous/generations` |
| Evolution runs | `GET /evolution/runs` |
| Teacher evaluations | `GET /teacher/evaluations` |
| Researcher hypotheses | `GET /research/hypotheses` |
| Memory/trades | `GET /trade-memory`, `GET /trade-memory/summary` |
| Performance | `GET /bot-factory/bots/:id/score`, `GET /bots/:id/paper-performance` |
| Market regime | `GET /regimes/:regime/leaderboard`, `GET /market-intelligence/context` |
| Risk | `GET /exchange-accounts/:id/risk-profile`, `GET /exchange-accounts/:id/risk-events` |
| Shadow | `GET /shadow-trades`, `GET /shadow-trades/performance` |
| Live eligibility | `GET /autonomous/live-eligibility` |
| System health/audit | `GET /system-health`, `GET /system-health/audit` |

## Safe write contracts

- `POST /autonomous/bots`: yalnız PAPER autonomous bot oluşturur.
- `POST /autonomous/bots/:id/pause|resume`: yalnız PAPER/SHADOW runtime state; resume sırasında account ve Risk Engine gate fail-closed kontrol edilir.
- `POST /autonomous/generations`: yalnız PAPER, exchange execution kapalı generation açar; aynı kullanıcı için ikinci aktif generation reddedilir.
- `POST /autonomous/bots/:id/archive`: yalnız henüz promote edilmemiş candidate lifecycle'ı arşivler.
- `POST /autonomous/bots/:id/promotion-review`: reject güvenli PAUSED durumuna taşır; approve yalnız audit'e `APPROVED_PENDING_ACTIVATION` yazar. `LIVE` aktivasyonu yapmaz.
- `PATCH /autonomous/bots/:id/settings`: yalnız `intervalSeconds` (10–3600) gibi non-critical scheduler ayarı; `LIVE_ELIGIBLE` ayarları freeze edilir.

Hiçbir v1 autonomous admin endpointi production live açmaz, exchange order submit etmez, API permission/credential değiştirmez veya Risk Engine policy'sini bypass etmez.
