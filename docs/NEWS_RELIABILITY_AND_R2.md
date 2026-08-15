# Haber Otomasyonu ve Cloudflare R2 Güvenilirlik Notu

Son güncelleme: 15 Ağustos 2026

## Düzeltilen davranışlar

- Kısa RSS açıklaması ve kısa özet kalite bayrağı olarak saklanır fakat tek başına yayını engellemez.
- Gerçekten bozuk çıktılar (encoding, URL/markdown sızıntısı, aşırı kaynak kopyası, aşırı uzun özet) incelemeye alınır ve zamanlanmış olarak tekrar denenir.
- `WAITING`, `REVIEW_REQUIRED` ve `FAILED` durumları worker tarafından tekrar işlenir; beş denemeden sonra kalıcı olarak terk edilmez.
- 10 dakikadan uzun `PROCESSING` kilitleri otomatik kurtarılır.
- Groq zinciri `openai/gpt-oss-20b` → `openai/gpt-oss-120b`; Groq kullanılamazsa DeepSeek şeklindedir.
- İki sağlayıcı da geçici olarak kullanılamazsa izinli kaynak başlığı/özeti geçici olarak yayınlanır ve AI iyileştirmesi arka planda sürer.
- Güvenilir, izinleri doğrulanmış ve `autoPublish=true` olan yabancı kaynaklar artık 20 manuel onay beklemez.
- Dış haberler için eski 300 kayıt fiziksel silme sınırı kaldırıldı. `NEWS_EXTERNAL_RETENTION_LIMIT=0` sınırsız saklama anlamına gelir. Pozitif limit seçilirse fazla kayıtlar silinmez, arşivlenir.
- Yeni haberlerde kaynak görsel URL'si R2 yüklemesi başarısız olsa bile DB'de tutulur ve yükleme tekrar denenir.

## Görsel veri modeli

- `sourceImageUrl`: RSS/API veya izinli kaynak sayfasından gelen özgün görsel adresi.
- `coverImageUrl`: Kullanıcıya sunulan R2 adresi.
- `imageSyncAttempts`: R2 deneme sayısı.
- `imageSyncError`: Son hata.
- `imageSyncNextAttemptAt`: Sonraki otomatik deneme zamanı.

Haber metni, özgün bağlantı, kaynak, başlık, excerpt, Türkçe başlık/özet, AI editoryal alanları, etiketler, coin ilişkileri ve görsel URL'leri MySQL veritabanında saklanır. Görsel dosyasının binary içeriği DB'de değil R2'de tutulur.

## Ölçülen başlangıç durumu

15 Ağustos 2026 tarihinde yapılandırılmış DB/R2 üzerinde:

- DB haber kaydı: 300
- Yayında: 231
- Beklemede: 67
- R2 URL'li haber: 50
- Uzak URL'li haber: 25
- Görselsiz haber: 225
- R2 `haberler/` nesnesi: 60
- R2 haber görseli toplamı: 8,02 MiB
- AI durumu: 1 waiting, 62 ready, 177 review required, 60 failed
- Tamamlanmış R2 nesnelerini silen lifecycle expiration kuralı: yok

DB'nin tam 300 kayıtta olması eski fiziksel retention davranışıyla uyumludur. Daha önce silinmiş DB haberleri yalnız veritabanı yedeği veya kaynaklardan yeniden içe aktarma ile geri getirilebilir. R2'de DB'ye bağlı olmayan nesneler otomatik silinmez.

## Canlı deploy sonrası komutlar

```bash
npx prisma migrate deploy
npm run build
npm run news:verify-groq-model
npm run news:localize
npm run news:recover-image-sources -- --limit=500 --execute
npm run news:retry-images
npm run news:report-storage
pm2 restart kriptoke --update-env
```

Canlı `.env`:

```env
NEWS_AI_ENABLED=true
NEWS_AI_AUTO_PROCESS=true
NEWS_AI_AUTO_PUBLISH_ENABLED=true
NEWS_SYNC_ENABLED=true
NEWS_AI_PROVIDER=multi
NEWS_AI_PROVIDER_ORDER=groq,deepseek
NEWS_AI_MAX_CONCURRENCY=2
NEWS_AI_BATCH_SIZE=24
NEWS_IMAGE_RETRY_BATCH_SIZE=12
NEWS_EXTERNAL_RETENTION_LIMIT=0
GROQ_PRIMARY_MODEL=openai/gpt-oss-20b
GROQ_FALLBACK_MODEL=openai/gpt-oss-120b
```

Görsel keşfi yalnız `imageUseAllowed=true` kaynaklarda çalışır. İzin kapalı kaynakların görselleri, teknik olarak bulunabilse bile otomatik kopyalanmaz.
