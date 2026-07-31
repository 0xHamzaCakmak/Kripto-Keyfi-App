# KriptoKeyfi Backend

KriptoKeyfi'nin ilk backend fazı; Express, TypeScript strict mode, Prisma/MySQL ve cookie tabanlı refresh-session authentication altyapısını içerir. Trading bot, borsa bağlantısı ve para tabloları bu fazda bilinçli olarak yoktur.

## Gereksinimler

- Node.js 20 LTS veya 22 LTS
- npm
- MySQL 8+

## Yerel kurulum

MySQL üzerinde yalnızca bu proje için ayrı bir veritabanı oluşturun:

```sql
CREATE DATABASE kriptokeyfi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Ardından backend dizininde `.env.example` dosyasını `.env` olarak kopyalayın. `DATABASE_URL`, frontend origin'i ve ilk admin bilgilerini kendi ortamınıza göre ayarlayın. `.env` Git tarafından yok sayılır.

Access ve refresh için birbirinden farklı güçlü secret'lar üretin:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Kurulum ve ilk çalıştırma:

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init_auth
npm run prisma:seed
npm run dev
```

Migration dosyası repoda hazırdır. Mevcut migration'ları development veritabanına uygulamak için `npm run prisma:migrate`, production/deployment ortamında ise `npx prisma migrate deploy` kullanın.

Seed, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_PASSWORD` ve `INITIAL_ADMIN_NAME` değerlerini `.env` üzerinden okur. Email'i küçük harfe çevirir ve aynı kullanıcı mevcutsa yeniden oluşturmaz. Şifre hiçbir loga yazılmaz.

## Frontend bağlantısı

`frontend/.env` içinde:

```dotenv
VITE_API_URL=http://localhost:4000/api
```

Backend `.env` içinde `FRONTEND_URL=http://localhost:3000` olmalıdır. Frontend'in kesin development portu mevcut npm scriptine göre 3000, backend portu örnekte 4000'dir. CORS sadece `FRONTEND_URL` origin'ine ve credential'lı isteklere izin verir.

## Komutlar

```bash
npm run dev
npm run build
npm run start
npm run typecheck
npm run lint
npm test
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio
npm run prisma:seed
```

## API

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me` — Bearer access token gerekir
- `GET /api/admin/dashboard` — `ADMIN` rolü gerekir

Access token response body'de gelir ve frontend belleğinde tutulur. Refresh token yalnızca HttpOnly cookie'dedir; veritabanında ham token değil SHA-256 hash bulunur. Refresh işleminde session rotation uygulanır.

## Testler

Testler gerçek veya canlı MySQL kullanmaz; Prisma sınırı in-memory test doubles ile izole edilir:

```bash
npm test
```

Test kapsamı seed idempotency, başarılı/başarısız login, pasif kullanıcı, `/me` authentication, admin authorization, refresh rotation, logout revocation ve response veri sızıntısı kontrolleridir.

## Production kontrol listesi

- Benzersiz ve birbirinden farklı JWT secret'ları secret manager üzerinden verin.
- `NODE_ENV=production`, `COOKIE_SECURE=true` kullanın; HTTPS zorunlu olsun.
- Frontend ve API farklı site bağlamındaysa `COOKIE_SAME_SITE=none` yalnızca HTTPS ile kullanılmalıdır; aynı site için `lax` tercih edilir.
- `FRONTEND_URL` kesin production origin'i olmalı; wildcard kullanmayın.
- Veritabanı kullanıcısına en az ayrıcalık verin, TLS ve düzenli yedekleme kullanın.
- İlk admin şifresini dağıtım sonrasında değiştirin; `.env` ve secret'ları loglamayın.
- Reverse proxy üzerinde ek request-size, timeout ve rate-limit politikaları değerlendirin.
- Migration'ı `npx prisma migrate deploy` ile çalıştırın; seed'i yalnızca kontrollü ilk kurulumda çalıştırın.

