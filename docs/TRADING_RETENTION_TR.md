# Trading verisi saklama ve VPS kurulumu

## 9 Eylül 2026 ölçümü

Yerel ortamda yapılandırılmış veritabanına salt okunur bağlantıyla ölçüldü; VPS dosya sistemi ölçümü değildir. Tablo + indeks toplamı 3573,36 MiB (3,49 GiB).

| Tablo | MiB | Kayıt |
| --- | ---: | ---: |
| trading_outbox_events | 2091,95 | 1.786.476 |
| trading_bot_decisions | 561,19 | 253.973 |
| trading_bot_signals | 551,70 | 253.973 |
| trading_audit_logs | 332,03 | 256.535 |
| trading_orders | 10,80 | 7.912 |

Outbox dağılımı: 1.141.867 BOT_STATE_CHANGED, 339.107 BOT_PAPER_DECISION, 286.547 BOT_SHADOW_DECISION, 9.654 SNAPSHOT_RECONCILED. Bu dört türün toplamı 1.777.175 kayıttır; ölçüm anında hepsi 24 saatten eskidir. Bot durumu trading_bots tablosunda, emir/pozisyon bilgisi ilgili kayıtlar ve borsa snapshot API'lerinde bulunur. Bu bildirimler motorun emir kuyruğu değildir.

Audit tablosunda 225.497 AUTONOMOUS_RISK_APPROVED, 27.150 AUTONOMOUS_RISK_REJECTED ve 3.528 AUTONOMOUS_RISK_BLOCKED vardır. Risk/denetim kayıtları bu değişiklikte silinmez; özellikle BLOCKED kayıtları canlıya geçiş değerlendirmesinde kullanılır. Bu tablo ve muhasebe geçmişi büyümeye devam edebilir; raporla izlenmelidir.

## Otomatik politika

Backend başladığında ve ardından her 24 saatte bir:

- Hem occurredAt hem createdAt değeri 24 saatten eski AUTONOMOUS kararları temizlenir. Geç yazılmış kararlar en az 24 saat korunur.
- AUTONOMOUS botların 24 saatten eski sinyalleri, karar bağlantısı olmasa da temizlenir. Yeni sinyaller eski karara bağlıysa sinyal korunur, bağlantısı NULL olur.
- Yalnız yukarıdaki dört outbox bildirim türünün 24 saatten eski kayıtları temizlenir. publishedAt tüketici onayı olarak kullanılmaz; mevcut SSE akışı bu alanı güncellemez.
- Gerçek emirler, testnet fill, paper fill, paper trade, açık pozisyonlar, shadow performans kanıtları, audit ve risk olayları korunur. Silinen kararın paper fill/shadow bağlantısı NULL olur.

Temizlik 1000 kayıtlık batch'ler ve aralarda 100 ms bekleme ile çalışır. Hata loglanır; sonraki çalıştırma kalan kayıtları temizler. Aynı süreçte üst üste çalışması engellenir; farklı süreçlerin aynı satırları temizlemesi idempotenttir. Günlük çalışma, temizlik anında son 24 saati bırakır; bir sonraki temizlikten önce yaklaşık 48 saatlik geçmiş bulunabilir. Backend kapalıysa temizlik yeniden açılışta devam eder. Ayrı cron gerekmez.

Eski karar ayrıntıları/sinyaller geriye dönük incelenemez. SSE ready mesajı yeniden bağlanan istemcilerde resyncRequired=true ve transientReplayRetentionHours=24 bildirir. Cursor ile bağlanan tüketiciler güncel durumu REST snapshot uçlarından yenilemelidir; geçmiş bildirimlerden tam hesap durumu oluşturulmamalıdır. ID boşlukları geçerlidir; cursor sorgusu id > cursor şeklindedir.

## Kurulum

Kod commit edilip VPS'in kullandığı dala gönderildikten sonra mevcut standart deploy uygulanır. SSH bağlantısı olmadan bu dosyanın hazırlanması VPS'e kurulum yapıldığı anlamına gelmez.

Önce, yeni kod sunucudayken silmeden kapsamı ölç:

```bash
cd ~/Projects/kriptokeyfi
npm --prefix backend run report:db-storage
npm --prefix backend run retention:trading
```

İkinci komut varsayılan olarak dry-run'dır. Veritabanı .env üzerinden seçilir; doğru ortama baktığını doğrula. İlk rapor büyük tablolarda tam sayım yaptığı için zaman alabilir. Gerekli eski geçmişi saklayacaksan deploydan önce VPS dışına yedekle.

```bash
./deploy.sh
```

Deploy, yeni indeks migration'ını ve preserve_execution_evidence_retention migration'ını backend başlamadan önce uygulamalıdır. Bu ikinci migration eski ON DELETE CASCADE ilişkilerini ON DELETE SET NULL yapar. Worker bu ilişkileri information_schema üzerinden doğrular; migration eksikse hiçbir kayıt silmeden hata verir. Eski backend sürümü nullable decisionId alanlarıyla uyumlu değildir; migration sonrasında eski backend'e doğrudan dönülmemelidir.

Deploy sonrası:

```bash
pm2 logs kriptokeyfi-api --lines 100 --nostream
npm --prefix backend run retention:trading
npm --prefix backend run report:db-storage
```

Logda daily trading retention completed ve silinen kayıt sayıları beklenir. retention:trading çıktısında yeniden birikenler dışında eski kayıt kalmamalıdır. Gerekirse, migration uygulanmış ortamda tek seferlik manuel çalıştırma:

```bash
npm --prefix backend run retention:trading -- --apply
```

## Gerçek disk alanı

DELETE satırları kaldırır; InnoDB'nin ayırdığı alanı işletim sistemine hemen geri vermeyebilir. Boş sayfalar yeni kayıtlar için tekrar kullanılabilir. Bu yüzden raporun MiB değeri veya df çıktısı anında küçülmeyebilir.

VPS'te MySQL, log ve diğer dosyaları ayrı ölç:

```bash
df -h
sudo du -sh /var/lib/mysql
sudo du -sh /var/log
 du -sh ~/.pm2/logs ~/Projects/kriptokeyfi
```

OPTIMIZE TABLE otomatik çalıştırılmaz. Tabloyu yeniden oluşturabilir; ek boş alan ve bakım planı gerekir. Disk dolmaya yakınken körlemesine çalıştırma. Önce MySQL sürümü, tablespace düzeni, kullanılabilir alan ve yedek incelenmelidir. İlgili tablolar için uygun bakım penceresinde tek tek değerlendir.

Kaynak: [MySQL OPTIMIZE TABLE](https://dev.mysql.com/doc/refman/8.4/en/optimize-table.html).

Deploy kontrolu: koruyucu migration yalniz incelenmis SQL iceriginin SHA-256 degeri eslesirse genel destructive SQL kontrolunden gecer. Diger riskli migrationlar engellenmeye devam eder. deploy.sh otomatik DB yedegi almaz.

## P3018 / MySQL 1826 retention migration kurtarma

Ilk surum ayni ALTER TABLE icinde eski foreign key adini yeniden kullaniyordu. Duzeltilen migration yeni `*_decisionId_retention_fkey` adlarini kullanir; Prisma schema, worker kontrolu ve deploy SHA-256 kaydi birlikte guncellenmistir.

Asagidaki akis yalniz `20260909100000_preserve_execution_evidence_retention` migration'inin ilk sorguda 1826 ile durdugu, onceki semanin korundugu durum icindir. Yeni duzeltmeleri commit/push ettikten sonra VPS'te:

```bash
cd ~/Projects/kriptokeyfi
git pull --ff-only
cd backend
npx tsx scripts/verify-retention-recovery.ts && npx prisma migrate resolve --rolled-back 20260909100000_preserve_execution_evidence_retention
```

Precheck sadece okur: basarisiz migration kaydi, iki eski CASCADE foreign key, NOT NULL kolonlar ve yeni outbox indeksinin henuz bulunmadigi dogrulanir. Basarisizsa burada dur; sonraki komutu calistirma. `resolve --rolled-back` veri veya semayi geri almaz, basarisiz denemenin tekrar denenebilmesini saglar.

Onceki komut basarili olduktan sonra:

```bash
cd ~/Projects/kriptokeyfi
RESUME_DEPLOY_MAINTENANCE=true MAINTENANCE_RESUME_MINUTES=0 bash deploy.sh
```

Kurtarma secenegi `.deploy-maintenance-bots.json` dosyasini korur. Listedeki botlarin PAUSED oldugunu ve calisan autonomous TESTNET botu bulunmadigini dogrular. Yeni migration ve servis health/reconciliation kontrollerinden sonra sadece orijinal listedeki botlar devam ettirilir. `MAINTENANCE_RESUME_MINUTES=0` uzun suren kurtarmalarda 180 dakikalik filtreyi kaldirir; orijinal bot listesi kisitlamasi kalir. Varsayilan deploy davranisi degismez: kurtarma secenegi olmadan eski bakim kaydi varsa durur.

Bakim dosyasini silme; `migrate reset`, `db push` veya gercekte uygulanmamis migration icin `resolve --applied` kullanma. Bu kurtarma SQL'i VPS uzerinde henuz uygulanmadi; yerelde Bash sozdizimi, Prisma validate/typecheck ve ilgili testler kontrol edildi.

Kaynak: https://www.prisma.io/docs/orm/prisma-migrate/workflows/patching-and-hotfixing
