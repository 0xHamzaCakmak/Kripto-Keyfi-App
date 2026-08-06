# Haber sistemi yayın ve gözlem rehberi

## Güvenli açılış sırası

1. Staging/admin ortamında `NEWS_AI_ENABLED=true`, `NEWS_AI_AUTO_PROCESS=false` ve `NEWS_AI_AUTO_PUBLISH_ENABLED=false` kullan.
2. `npm run security:secrets`, backend test/build ve frontend test/build/E2E kontrollerini çalıştır.
3. Haber Yönetimi'nde ilk örnekleri incele. Manuel düzenlenen kayıtlar worker tarafından tekrar yazılmaz.
4. Kontrollü backfill'i önce dry-run çalıştır:

   ```powershell
   $env:BACKFILL_LIMIT='20'
   npm run news:backfill-ai
   ```

5. Listelenen kayıtlar doğruysa yalnızca bekleyen haberlerde gerçek batch çalıştır:

   ```powershell
   $env:BACKFILL_LIMIT='20'
   $env:BACKFILL_DRY_RUN='false'
   $env:BACKFILL_CONFIRM='I_UNDERSTAND'
   npm run news:backfill-ai
   ```

6. Yayımlanmış eski kayıtları yeniden işlemek varsayılan olarak kapalıdır. Zorunlu ve editoryal olarak onaylı bir bakım penceresinde ayrıca `BACKFILL_INCLUDE_PUBLISHED=true` gerekir.
7. Kalite doğrulandıktan sonra otomatik worker için `NEWS_AI_AUTO_PROCESS=true` açılabilir. Otomatik yayın ayrı bir anahtardır ve varsayılan kapalı kalır.

## Production deploy kapısı

- Backend: `npm ci`, `npx prisma migrate deploy`, `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Frontend: `npm ci`, `npm run test:seo`, `npm run lint`, `npm run build`, `npm run test:e2e-news`.
- Runtime yalnızca build çıktısını çalıştırır; Vite geliştirme sunucusu production'da açılmaz.
- `GROQ_API_KEY`, JWT anahtarları ve veritabanı bağlantısı yalnızca Hostinger secret/env alanında tutulur.
- `COOKIE_SECURE=true`, gerçek `FRONTEND_URL`, `PUBLIC_SITE_URL` ve `SEO_API_BASE_URL` deployment ortamına göre ayarlanır.

## 24 saat gözlem

Snapshot:

```powershell
npm run news:monitor
```

24 saat boyunca beş dakikalık aralıklarla gözlem:

```powershell
$env:NEWS_MONITOR_DURATION_MINUTES='1440'
$env:NEWS_MONITOR_INTERVAL_SECONDS='300'
npm run news:monitor
```

İzlenen alarmlar: worker son başarı yaşı, kaynak hataları, AI `FAILED` kuyruğu ve Groq rate-limit/429 sayısı. Bu adım ancak production deploy başladıktan sonra tamamlanabilir.

## Geri dönüş

- AI üretimini durdur: `NEWS_AI_AUTO_PROCESS=false`.
- Haber çekimini geçici durdur: `NEWS_SYNC_ENABLED=false`.
- Otomatik yayını durdur: `NEWS_AI_AUTO_PUBLISH_ENABLED=false`.
- Mevcut veritabanı haberleri gösterilmeye devam eder; kaynak veya Groq kesintisi frontend'i boş bırakmaz.
