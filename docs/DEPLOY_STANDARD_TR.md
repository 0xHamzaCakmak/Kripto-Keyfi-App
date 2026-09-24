# KriptoKeyfi standart TESTNET deploy akışı

Bu akış `Production LIVE` açmaz, veritabanını sıfırlamaz ve Binance ana hesap işlemlerine dokunmaz. Komutlar VPS üzerinde proje kökünde çalıştırılır.

**İlk SEO geçişi:** Deploy artık `kriptokeyfi-seo` PM2 servisini de başlatır.
Çalıştırmadan önce domainin Nginx `location /` yönlendirmesini hazırlayın:
[SEO sunumu ve VPS geçiş adımları](SEO_VPS_TR.md). Eski statik SPA sunumu
devam ederse yeni SEO doğrulaması deploy'u durdurur.

## 1. Yalnız ilk Hedge Mode geçişinde

Hedge Mode daha önce açıldıysa bu bölüm tekrar uygulanmaz. Açık pozisyon ve emirler, Hedge Mode zaten `true` olduğunda deployu engellemez.

```bash
cd ~/Projects/kriptokeyfi
npm --prefix backend ci --include=dev
npm --prefix backend run prisma:generate
npm --prefix backend run configure:testnet-hedge-mode
```

Çıktıda `"hedgeMode": true` görülüyorsa hazırlık tamamdır. `false` ise Binance, mod değişikliği için TESTNET hesabının tamamen boş olmasını ister:

1. TESTNET botlarını duraklat.
2. TESTNET açık pozisyonlarını reduce-only ile kapat.
3. TESTNET açık emirlerini iptal et.
4. Veritabanındaki `PENDING`, `SUBMITTING`, `OPEN`, `PARTIALLY_FILLED`, `CANCELING`, `CLOSING` ve `RECONCILIATION_REQUIRED` emirlerini reconciliation ile sonuçlandır.
5. Dry-run çıktısı `openPositions: 0`, `exchangeOpenOrders: 0`, `databaseInFlightOrders: 0` gösterince modu bir kez etkinleştir:

```bash
npm --prefix backend run configure:testnet-hedge-mode -- --confirm=ENABLE_BINANCE_TESTNET_HEDGE_MODE
npm --prefix backend run configure:testnet-hedge-mode
```

Son komut `"hedgeMode": true` göstermeden deploy başlatılmaz. Açık işlemler varken Hedge Mode değiştirmeye veya veritabanı kayıtlarını elle silmeye çalışma.

## 2. Her deploy öncesi

```bash
cd ~/Projects/kriptokeyfi
git status --short
```

Çıktı boş olmalıdır. Sunucuda commit edilmemiş değişiklik varsa deploy bunları silmez ve güvenli şekilde durur.

İsteğe bağlı Stage 3 ön kontrolü:

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run configure:testnet-hedge-mode
```

Beklenen değer `"hedgeMode": true` değeridir. Prisma Client üretimi ayrıca `deploy.sh` içinde bağımlılık kurulumundan hemen sonra otomatik çalışır.

Trading saklama politikasi: [olcum, migration ve gunluk temizlik](TRADING_RETENTION_TR.md). Bu surum backend acilisinda eski karar/sinyal ve gecici outbox bildirimlerini temizler. Once rapor ve dry-run alinmalidir. Koruyucu migration backend baslamadan once uygulanmalidir; deploy.sh otomatik DB yedegi almaz.

## 3. Standart deploy

```bash
cd ~/Projects/kriptokeyfi
chmod +x deploy.sh
./deploy.sh
```

`deploy.sh` kodu fast-forward günceller; bağımlılıkları ve Prisma Client'ı hazırlar; environment, test ve build kontrollerini çalıştırır; TESTNET filosunu bakım moduna alır; migration uygular; backend, frontend ve Go engine'i günceller; health/reconciliation başarılıysa yalnız kendi durdurduğu botları devam ettirir.

## 4. Her deploy sonrası

Deploy **13/13 tamamlandıysa** ek başlatma komutu gerekmez. Aşağıdaki komutlar
durum kontrolüdür; bot başlatmaz. Backend ve Go Engine sunucuda çalışır;
tarayıcıyı veya SSH oturumunu kapatmak botları durdurmaz. Varsayılan deploy
PM2 otomatik yeniden başlatmayı doğrular, `pm2 save` çalıştırır ve sunucu açılışı
için systemd entegrasyonunu etkinleştirir (`ENABLE_PM2_STARTUP=true`).

Deploy yalnız bakım için kendisinin durdurduğu botları devam ettirir; önceden
duraklatılmış botları açmaz. DEMO emirleri için botun çalışır durumda olması,
hesabın otomatik işlem izninin açık olması ve risk kontrollerinin geçmesi gerekir.
Sinyal görülmesi tek başına borsaya emir gönderildiği anlamına gelmez.

Günlük veri temizliği: karar/sinyal ve outbox bildirimlerinde son **7 gün** tutulur. Haberler ve görseller kalıcı korunur; ana haber akışı ve sohbet yalnız son 7 günü gösterir. Eski yayımlanmış haberler detay, kategori, arama ve sitemap üzerinden erişilebilir kalır. Haber retention komutu --apply ile de silme yapmaz. `20260909120000_daily_retention_schedule` migration'ı trading görev zamanlarını kalıcı tutar. Politika: [Veri saklama ve günlük temizlik](TRADING_RETENTION_TR.md#otomatik-politika--son-7-gün).

```bash
cd ~/Projects/kriptokeyfi
pm2 status
curl -fsS --max-time 10 http://127.0.0.1:8081/health/ready
npm --prefix backend run status:testnet-runtime
systemctl is-enabled pm2-root
systemctl is-active pm2-root
```

Beklenen sonuçlar:

- `kriptokeyfi-api`, `kriptokeyfi-trading-engine` ve `kriptokeyfi-seo`: `online`
- Engine readiness: başarılı
- Filo durumu: beklenen botlar çalışıyor veya açıklanabilir bir risk durumunda
- PM2 systemd servisi: `enabled` ve `active` (root dışı kurulumda yapılandırılmış servis adını kullanın)
- Stage 3 Prisma hatası yok

`configure:testnet-hedge-mode` salt durum sorgusu değildir; borsa pozisyon modunu
yapılandırır. Standart deploy zaten Hedge Mode kontrolünü yaptığı için her deploy
sonrası tekrar çalıştırmak gerekmez. `status:ai-fleet` ek filo raporudur; DEMO
çalışmasını doğrulamak için `status:testnet-runtime` çıktısını esas alın.

Sorun varsa önce son logları al:

```bash
pm2 logs kriptokeyfi-api --lines 100 --nostream
pm2 logs kriptokeyfi-trading-engine --lines 100 --nostream
```

Deploy Stage 6'dan sonra durduysa `.deploy-maintenance-bots.json` dosyasını silme. Engine ve reconciliation doğrulanmadan botları topluca devam ettirme; bu dosya yalnız deployun durdurduğu botların güvenli biçimde geri alınması için kullanılır.
--------------------------------------------------------
deploy için
cd ~/Projects/kriptokeyfi
git status --short

npm --prefix backend run prisma:generate
npm --prefix backend run configure:testnet-hedge-mode

chmod +x deploy.sh
./deploy.sh
-------------------------------------------------------
deploy sonrası
pm2 status
curl -fsS --max-time 10 http://127.0.0.1:8081/health/ready
npm --prefix backend run status:testnet-runtime
systemctl is-enabled pm2-root
systemctl is-active pm2-root

------------------------------------------------------------------------------

100.000 USDT hesap için aynı %80 kullanım / %20 rezerv modeli:
Bot başına teminat kotası:            4.000
Asgari işlem teminatı:                  500
Emir başına azami başlangıç teminatı: 4.000
Emir başına azami notional:          80.000
Hesap açık notional limiti:       1.600.000
Parite açık notional limiti:         160.000
Korunacak minimum bakiye:             20.000
Azami açık pozisyon:                      20
Parite başına pozisyon:                    2
Dakikalık/Günlük emir limiti:              0
---------------------------------------------------------------------------------
10.000 USDT testnet bakiye için örnek:
Bot başına teminat kotası:             400
Asgari işlem teminatı:                 100
Emir başına azami başlangıç teminatı:  400
Emir başına azami notional:          8.000
Hesap açık notional limiti:        160.000
Parite açık notional limiti:        16.000
Korunacak minimum bakiye:            2.000
Azami kaldıraç:                         20
Azami açık pozisyon:                    20
Parite başına pozisyon:                  2
Dakikalık emir limiti:                    0
Günlük emir limiti:                       0
Retention deploy P3018 / MySQL 1826 ile durursa: [kontrollu migration kurtarma adimlari](TRADING_RETENTION_TR.md#p3018--mysql-1826-retention-migration-kurtarma). `.deploy-maintenance-bots.json` dosyasini silmeyin.

24.09.2026 geliştirme geçişi: `202609120001_grid_spot_accounts` ve
`202609130003_bot_pnl_closed_only` migration'larının mevcut SQL içerikleri
`deploy.sh` içinde SHA-256 ile onaylanmıştır. Proje sahibinin onayıyla yedek
alınmadan geliştirme dönemi fill kâr/zarar özetleri yeniden oluşturulabilir.
Ham borsa gerçekleşme kayıtları silinmez ve veritabanı resetlenmez. Bu izin
yalnızca belirtilen içeriklere aittir; dosyalar değişirse kontrol tekrar durur.
Güncel `deploy.sh` sunucuya geldikten sonra `./deploy.sh` yeniden çalıştırılır.
Bu geçiş canlı başlangıç tarihi belirlemez ve tüm geçmişi sıfırlamaz; sonraki
işlemlerin kaydı mevcut kayıt mekanizmasıyla devam eder.
