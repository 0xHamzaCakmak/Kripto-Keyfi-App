# Hostinger VPS çalışma rehberi

Bu dağıtım uygulamayı 7/24 internette çalıştırır. Trading modu PAPER + Binance TESTNET'tir; production gerçek-para LIVE açılmaz.

## 1. Ağ ve alan adı

- Alan adının `A` kaydını VPS IPv4 adresine yönlendirin.
- Hostinger ve sunucu firewall'ında yalnız SSH, `80/tcp` ve `443/tcp` dışarıya açık olsun.
- MySQL `3306`, backend `4000` ve Go Engine `8081` internete açılmasın.
- MySQL yalnız `127.0.0.1` üzerinde dinlesin.

## 2. Sunucu paketleri ve dizinler

Önerilen taban Ubuntu 22.04/24.04'tür. Node.js, npm, Go, MySQL ve Nginx kurulu olmalıdır.

```bash
sudo adduser --system --group --home /opt/kriptokeyfi kriptokeyfi
sudo mkdir -p /opt/kriptokeyfi /etc/kriptokeyfi /var/log/kriptokeyfi
sudo chown -R kriptokeyfi:kriptokeyfi /opt/kriptokeyfi /var/log/kriptokeyfi
sudo chmod 750 /etc/kriptokeyfi
```

Projeyi `/opt/kriptokeyfi` içine Git veya güvenli bir deployment yöntemiyle yerleştirin. `.env`, API key ve secret dosyalarını Git'e eklemeyin.

## 3. Environment dosyaları

Backend secret dosyası `/etc/kriptokeyfi/backend.env` içinde mevcut production değişkenlerine ek olarak:

```dotenv
NODE_ENV=production
PORT=4000
FRONTEND_URL=https://bot.example.com
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
TRADING_ENGINE_URL=http://127.0.0.1:8081
TRADING_ENGINE_EXECUTION_ENABLED=true
AUTONOMOUS_TESTNET_EXECUTION_ENABLED=true
TRADING_ENGINE_SHADOW_COMPARE_ENABLED=false
AI_TRADING_EVOLUTION_ENABLED=true
AI_TRADING_UNIVERSE_ENABLED=true
AI_TRADING_LEARNING_ENABLED=true
AI_TRADING_EVOLUTION_MIN_TRADES=200
```

Engine secret dosyası `/etc/kriptokeyfi/trading-engine.env`:

```dotenv
TRADING_ENGINE_MODE=cutover
TRADING_ENGINE_ADDR=127.0.0.1:8081
TRADING_ENGINE_SHADOW_READ_ENABLED=true
TRADING_ENGINE_BOT_SCHEDULER_ENABLED=true
TRADING_ENGINE_AUTONOMOUS_TESTNET_ENABLED=true
TRADING_ENGINE_LIQUIDATION_STREAM_ENABLED=true
TRADING_ENGINE_REALTIME_ENABLED=false
TRADING_ENGINE_AI_OBSERVER_ENABLED=false
```

İki dosyada `DATABASE_URL`, `TRADING_ENGINE_TOKEN` ve `TRADING_CREDENTIALS_MASTER_KEY` aynı gerçek değerleri kullanmalıdır. Master key değiştirilirse veritabanındaki şifreli Binance Demo anahtarları çözülemez. Backend production doğrulaması için JWT, R2 ve projede kullanılan diğer zorunlu production değişkenlerini de mevcut değerleriyle taşıyın.

```bash
sudo chown root:kriptokeyfi /etc/kriptokeyfi/backend.env /etc/kriptokeyfi/trading-engine.env
sudo chmod 640 /etc/kriptokeyfi/backend.env /etc/kriptokeyfi/trading-engine.env
```

## 4. Build, migration ve servis kurulumu

Migration öncesinde MySQL yedeği alın. Ardından yalnız repodaki incelenmiş migration'ları uygulayın.

```bash
cd /opt/kriptokeyfi/backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run bootstrap:ai-trading
npm run bootstrap:ai-strategy-arsenal

cd /opt/kriptokeyfi/frontend
npm ci
npm run build

cd /opt/kriptokeyfi/services/trading-engine
go test ./...
go build -o trading-engine ./cmd/trading-engine

sudo install -m 0644 /opt/kriptokeyfi/deploy/systemd/*.service /etc/systemd/system/
sudo install -m 0644 /opt/kriptokeyfi/deploy/systemd/*.timer /etc/systemd/system/
sudo chmod +x /opt/kriptokeyfi/deploy/health-check.sh
sudo systemctl daemon-reload
sudo systemctl enable --now kriptokeyfi-trading-engine kriptokeyfi-backend
sudo systemctl enable --now kriptokeyfi-health.timer kriptokeyfi-walk-forward.timer
```

## 5. Nginx ve HTTPS

```bash
sudo apt update
sudo apt install -y nginx
sudo sed 's/YOUR_DOMAIN/bot.example.com/g' /opt/kriptokeyfi/deploy/nginx/kriptokeyfi.conf.example \
  | sudo tee /etc/nginx/sites-available/kriptokeyfi >/dev/null
sudo ln -s /etc/nginx/sites-available/kriptokeyfi /etc/nginx/sites-enabled/kriptokeyfi
sudo nginx -t
sudo systemctl reload nginx
```

`bot.example.com` yerine gerçek domain/subdomain yazın. DNS yayılımından sonra Hostinger'ın güncel Certbot/Let's Encrypt yönergesiyle HTTPS kurun.

## 6. Başarılı botu Binance Demo'da kullanma

Champion varsayılan kanıt kapıları:

- en az 200 kapanmış PAPER trade;
- en az 7 PAPER günü;
- profit factor en az `1,20`;
- drawdown en fazla `%20`;
- Bot Score en az `60`;
- en az 3 piyasa rejimi.

ATR walk-forward kapısı daha sıkıdır: varyant başına en az 200 out-of-sample kapanış, pozitif expectancy, profit factor `>1` ve drawdown `<=%15`.

1. Arena ve Performance ekranlarında expectancy, profit factor, drawdown, maliyet ve trade sayısını kontrol edin.
2. Champions ekranında Candidate → Challenger → Champion kanıtlarını inceleyin. Champion etiketi tek başına emir göndermez.
3. TESTNET'e alınacak PAPER botun açık pozisyonu olmadığından emin olun.
4. Arena bot detayında `Binance TESTNET canary etkinleştir` düğmesini kullanın ve `ENABLE BINANCE TESTNET` onayını girin.
5. En fazla 15 DEMO bot çalışır. Bot detayında yalnız Binance tarafından fill edilmiş işlemler, gerçekleşmiş PnL, komisyon, açık pozisyon ve SL/TP izlenir.

Mevcut 15 botluk TESTNET filosu çalışır durumdadır. `deploy:ai-testnet-fleet` başlangıç filosunu yeniden kurar ve açık pozisyon varken çalıştırılmamalıdır. Yeni Champion'ları mevcut filoya flat-position kontrollü otomatik değiştiren rebalance akışı henüz yoktur; şimdilik değişim yönetici onaylı canary olmalıdır.

## 7. Günlük kontrol ve güvenli güncelleme

```bash
systemctl is-active kriptokeyfi-backend kriptokeyfi-trading-engine
systemctl list-timers 'kriptokeyfi-*'
curl --fail http://127.0.0.1:4000/api/health
curl --fail http://127.0.0.1:8081/health/ready
journalctl -u kriptokeyfi-trading-engine -n 100 --no-pager
journalctl -u kriptokeyfi-backend -n 100 --no-pager
```

Kod güncellemesinde önce TESTNET botlarını duraklatın, test/build çalıştırın, engine'i restart edin, `/health/ready` ve reconciliation başarılarını gördükten sonra botları sürdürün. `Restart=always` servisleri çökme ve VPS reboot sonrasında tekrar başlatır. Health timer her dakika kontrol yapar; walk-forward timer her gün 03:15'te rapor üretir.

## 8. Tek komut güvenli deployment

Proje kökündeki `deploy.sh` backend/frontend bağımlılıklarını, typecheck/test/build işlemlerini, Go test ve atomik binary değişimini, DB yedeğini, Prisma migration'larını, PM2 restartını ve health kontrollerini birlikte yürütür. TESTNET botu varsa yalnız deploy sırasında duraklatır; backend ve engine hazır olmadan devam ettirmez.

```bash
cd /root/Projects/kriptokeyfi
chmod +x deploy.sh
./deploy.sh
```

Sunucudaki kod Git üzerinden değil manuel güncellendiyse yalnız o çalıştırmada:

```bash
SKIP_GIT_UPDATE=true ./deploy.sh
```

Nginx başka bir dizini servis ediyorsa `WEB_ROOT=/var/www/kriptokeyfi` verilebilir. Varsayılan durumda Nginx'in doğrudan `frontend/dist` dizinini servis ettiği kabul edilir. `deploy.sh` bootstrap/seed/reset çalıştırmaz ve master key üretmez.
