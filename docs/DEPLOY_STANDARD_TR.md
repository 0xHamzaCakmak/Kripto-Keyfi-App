# KriptoKeyfi standart TESTNET deploy akışı

Bu akış `Production LIVE` açmaz, veritabanını sıfırlamaz ve Binance ana hesap işlemlerine dokunmaz. Komutlar VPS üzerinde proje kökünde çalıştırılır.

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

## 3. Standart deploy

```bash
cd ~/Projects/kriptokeyfi
chmod +x deploy.sh
./deploy.sh
```

`deploy.sh` kodu fast-forward günceller; bağımlılıkları ve Prisma Client'ı hazırlar; environment, test ve build kontrollerini çalıştırır; TESTNET filosunu bakım moduna alır; migration uygular; backend, frontend ve Go engine'i günceller; health/reconciliation başarılıysa yalnız kendi durdurduğu botları devam ettirir.

## 4. Her deploy sonrası

```bash
cd ~/Projects/kriptokeyfi
pm2 status
curl -fsS http://127.0.0.1:8081/health/ready
npm --prefix backend run status:ai-fleet
npm --prefix backend run status:testnet-runtime
npm --prefix backend run configure:testnet-hedge-mode
```

Beklenen sonuçlar:

- `kriptokeyfi-api` ve `kriptokeyfi-trading-engine`: `online`
- Engine readiness: başarılı
- Filo durumu: beklenen botlar çalışıyor veya açıklanabilir bir risk durumunda
- Hedge Mode: `true`
- Stage 3 Prisma hatası yok

Sorun varsa önce son logları al:

```bash
pm2 logs kriptokeyfi-api --lines 100 --nostream
pm2 logs kriptokeyfi-trading-engine --lines 100 --nostream
```

Deploy Stage 6'dan sonra durduysa `.deploy-maintenance-bots.json` dosyasını silme. Engine ve reconciliation doğrulanmadan botları topluca devam ettirme; bu dosya yalnız deployun durdurduğu botların güvenli biçimde geri alınması için kullanılır.
