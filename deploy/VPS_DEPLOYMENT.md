# Hostinger VPS — PAPER ve Binance TESTNET Dağıtımı

Bu profil production gerçek-para LIVE açmaz. `TRADING_ENGINE_MODE=cutover` yalnız kayıtlı TESTNET/DEMO hesap yazıcısını açar; `exchange_accounts.environment`, GO ownership ve Risk Engine kapıları ayrıca zorunludur.

## Yerleşim

- Uygulama: `/opt/kriptokeyfi`
- Secret environment dosyaları: `/etc/kriptokeyfi/backend.env` ve `/etc/kriptokeyfi/trading-engine.env`
- Loglar: `/var/log/kriptokeyfi`
- Servis kullanıcısı: `kriptokeyfi` (login shell olmadan)

Secret dosyalarını repoya kopyalamayın ve `chmod 600` uygulayın. Trading Engine environment dosyasında en az `DATABASE_URL`, `TRADING_ENGINE_TOKEN`, `TRADING_CREDENTIALS_MASTER_KEY`, `TRADING_ENGINE_MODE=cutover`, `TRADING_ENGINE_SHADOW_READ_ENABLED=true`, `TRADING_ENGINE_BOT_SCHEDULER_ENABLED=true`, `TRADING_ENGINE_AUTONOMOUS_TESTNET_ENABLED=true` ve `TRADING_ENGINE_LIQUIDATION_STREAM_ENABLED=true` bulunmalıdır.

## Build ve kurulum

```bash
cd /opt/kriptokeyfi/backend && npm ci && npx prisma generate && npm run build
cd /opt/kriptokeyfi/frontend && npm ci && npm run build
cd /opt/kriptokeyfi/services/trading-engine && go test ./... && go build -o trading-engine ./cmd/trading-engine
sudo install -m 0644 /opt/kriptokeyfi/deploy/systemd/*.service /etc/systemd/system/
sudo install -m 0644 /opt/kriptokeyfi/deploy/systemd/*.timer /etc/systemd/system/
sudo chmod +x /opt/kriptokeyfi/deploy/health-check.sh
sudo systemctl daemon-reload
sudo systemctl enable --now kriptokeyfi-trading-engine kriptokeyfi-backend
sudo systemctl enable --now kriptokeyfi-health.timer kriptokeyfi-walk-forward.timer
```

## Güvenli güncelleme

Önce TESTNET botlarını yönetim ekranından duraklatın. Yeni binary’yi build edin, `go test ./...` sonucunu doğrulayın, ardından yalnız engine servisini restart edin. `/health/ready` hazır olmadan botları devam ettirmeyin. Restart sonrasında reconciliation açık pozisyon ve koruyucu emirleri doğrular.

```bash
sudo systemctl restart kriptokeyfi-trading-engine
curl --fail http://127.0.0.1:8081/health/ready
sudo systemctl status kriptokeyfi-trading-engine --no-pager
journalctl -u kriptokeyfi-health.service -n 100 --no-pager
```

`alerts.env` içinde isteğe bağlı `ALERT_WEBHOOK_URL` tanımlanabilir. Withdrawal/transfer izni verilmemelidir; API anahtarı yalnız Futures testnet trade/read yetkileriyle sınırlandırılmalıdır.
