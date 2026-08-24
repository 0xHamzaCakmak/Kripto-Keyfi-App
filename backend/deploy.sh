#!/usr/bin/env bash
set -Eeuo pipefail

# KriptoKeyfi production deploy (PAPER + Binance TESTNET only).
# This script never bootstraps bots, resets the database, or enables real-money LIVE.

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${BRANCH:-main}"
SKIP_GIT_UPDATE="${SKIP_GIT_UPDATE:-false}"
RUN_BACKEND_TESTS="${RUN_BACKEND_TESTS:-true}"
APPLY_MIGRATIONS="${APPLY_MIGRATIONS:-true}"
RELOAD_NGINX="${RELOAD_NGINX:-true}"
WEB_ROOT="${WEB_ROOT:-}"

BACKEND_PM2_NAME="${BACKEND_PM2_NAME:-kriptokeyfi-api}"
ENGINE_PM2_NAME="${ENGINE_PM2_NAME:-kriptokeyfi-trading-engine}"
BACKEND_PORT="${BACKEND_PORT:-}"
BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-}"
ENGINE_HEALTH_URL="${ENGINE_HEALTH_URL:-http://127.0.0.1:8081/health/ready}"
ENGINE_STATUS_URL="${ENGINE_STATUS_URL:-http://127.0.0.1:8081/internal/v1/status}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/kriptokeyfi}"
MAINTENANCE_RESUME_MINUTES="${MAINTENANCE_RESUME_MINUTES:-180}"
ENABLE_PM2_STARTUP="${ENABLE_PM2_STARTUP:-true}"
PM2_RUNTIME_USER="${PM2_RUNTIME_USER:-$(id -un)}"
PM2_RUNTIME_HOME="${PM2_RUNTIME_HOME:-${HOME:-}}"
PM2_SYSTEMD_UNIT="${PM2_SYSTEMD_UNIT:-pm2-${PM2_RUNTIME_USER}}"

BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
ENGINE_DIR="$PROJECT_DIR/services/trading-engine"
ENV_FILE="$BACKEND_DIR/.env"
ENGINE_BINARY="$ENGINE_DIR/trading-engine"
ENGINE_CANDIDATE="$ENGINE_DIR/trading-engine.deploy"
ENGINE_ROLLBACK="$ENGINE_DIR/trading-engine.previous"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-}"
FRONTEND_ASSET_PATH=""

CURRENT_STEP="Baslangic"
FLEET_MAINTENANCE_STARTED=false

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

step() {
  CURRENT_STEP="$1"
  printf '\n============================================================\n'
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$CURRENT_STEP"
  printf '============================================================\n'
}

on_error() {
  local exit_code=$?
  printf '\n[HATA] Deploy durduruldu. Asama: %s (exit=%s)\n' "$CURRENT_STEP" "$exit_code" >&2
  if [ "$FLEET_MAINTENANCE_STARTED" = "true" ]; then
    printf '[GUVENLIK] TESTNET filosu otomatik devam ettirilmedi. Engine ve reconciliation kontrol edilmelidir.\n' >&2
  fi
  printf '[GUVENLIK] Veritabani resetlenmedi ve production LIVE acilmadi.\n' >&2
  exit "$exit_code"
}

trap on_error ERR

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Eksik komut: %s\n' "$1" >&2
    exit 1
  fi
}

acquire_lock() {
  if command -v flock >/dev/null 2>&1; then
    exec 9>"$PROJECT_DIR/.deploy.lock"
    if ! flock -n 9; then
      printf 'Baska bir deploy islemi halen calisiyor.\n' >&2
      exit 1
    fi
  fi
}

update_code() {
  step "1/13 GitHub kodu guncelleniyor"
  cd "$PROJECT_DIR"
  if [ "$SKIP_GIT_UPDATE" = "true" ]; then
    log "SKIP_GIT_UPDATE=true: mevcut sunucu kodu kullanilacak"
    return
  fi
  if ! git diff --quiet || ! git diff --cached --quiet; then
    printf 'Sunucuda commit edilmemis takip edilen dosya degisiklikleri var. Deploy iptal edildi.\n' >&2
    printf 'Degisiklikleri commit edin; deploy scripti git reset --hard calistirmaz.\n' >&2
    exit 1
  fi
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git merge --ff-only "origin/$BRANCH"
  log "Deploy commit: $(git rev-parse --short HEAD)"
}

install_dependencies() {
  step "2/13 Backend ve frontend bagimliliklari kuruluyor"
  if [ -f "$BACKEND_DIR/package-lock.json" ]; then
    NODE_ENV=development npm --prefix "$BACKEND_DIR" ci --include=dev
  else
    NODE_ENV=development npm --prefix "$BACKEND_DIR" install --include=dev
  fi
  if [ -f "$FRONTEND_DIR/package-lock.json" ]; then
    NODE_ENV=development npm --prefix "$FRONTEND_DIR" ci --include=dev
  else
    NODE_ENV=development npm --prefix "$FRONTEND_DIR" install --include=dev
  fi
}

load_environment() {
  step "3/13 Production environment kontrol ediliyor"
  if [ ! -f "$ENV_FILE" ]; then
    printf 'Env dosyasi bulunamadi: %s\n' "$ENV_FILE" >&2
    exit 1
  fi

  # dotenv semantics are used instead of sourcing the file in Bash. Values are
  # single-quote escaped before eval and are never printed.
  local exports
  exports="$(cd "$PROJECT_DIR" && node - "$ENV_FILE" <<'NODE'
const fs = require('fs');
const dotenv = require('./backend/node_modules/dotenv');
const parsed = dotenv.parse(fs.readFileSync(process.argv[2]));
const quote = (value) => `'${String(value).replaceAll("'", `'"'"'`)}'`;
for (const [key, value] of Object.entries(parsed)) {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) process.stdout.write(`export ${key}=${quote(value)}\n`);
}
NODE
)"
  eval "$exports"
  unset exports

  export NODE_ENV=production
  BACKEND_PORT="${BACKEND_PORT:-${PORT:-}}"
  if [ -z "$BACKEND_PORT" ]; then
    printf 'Backend portu belirtilmemis. backend/.env icine PORT=<nginx proxy portu> ekleyin.\n' >&2
    exit 1
  fi
  export PORT="$BACKEND_PORT"
  BACKEND_HEALTH_URL="${BACKEND_HEALTH_URL:-http://127.0.0.1:${BACKEND_PORT}/api/health}"
  FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-${FRONTEND_URL:-}}"

  local required=(DATABASE_URL JWT_ACCESS_SECRET JWT_REFRESH_SECRET TRADING_ENGINE_URL TRADING_ENGINE_TOKEN TRADING_CREDENTIALS_MASTER_KEY)
  local variable
  for variable in "${required[@]}"; do
    if [ -z "${!variable:-}" ]; then
      printf 'backend/.env icinde zorunlu alan eksik: %s\n' "$variable" >&2
      exit 1
    fi
  done
  if ! [[ "$TRADING_CREDENTIALS_MASTER_KEY" =~ ^[a-fA-F0-9]{64}$ ]]; then
    printf 'TRADING_CREDENTIALS_MASTER_KEY tam 64 hexadecimal karakter olmalidir.\n' >&2
    exit 1
  fi
  if [ "${#TRADING_ENGINE_TOKEN}" -lt 32 ]; then
    printf 'TRADING_ENGINE_TOKEN en az 32 karakter olmalidir.\n' >&2
    exit 1
  fi

  local expected_flags=(
    "TRADING_ENGINE_URL=http://127.0.0.1:8081"
    "TRADING_ENGINE_MODE=cutover"
    "TRADING_ENGINE_ADDR=127.0.0.1:8081"
    "TRADING_ENGINE_SHADOW_READ_ENABLED=true"
    "TRADING_ENGINE_BOT_SCHEDULER_ENABLED=true"
    "TRADING_ENGINE_AUTONOMOUS_TESTNET_ENABLED=true"
    "TRADING_ENGINE_LIQUIDATION_STREAM_ENABLED=true"
    "TRADING_ENGINE_EXECUTION_ENABLED=true"
    "AUTONOMOUS_TESTNET_EXECUTION_ENABLED=true"
  )
  local pair name expected actual
  for pair in "${expected_flags[@]}"; do
    name="${pair%%=*}"
    expected="${pair#*=}"
    actual="${!name:-}"
    if [ "$actual" != "$expected" ]; then
      printf '%s degeri %s olmalidir (mevcut: %s).\n' "$name" "$expected" "${actual:-<missing>}" >&2
      exit 1
    fi
  done
}

validate_and_build() {
  step "4/13 Test, typecheck ve production build calisiyor"
  (cd "$BACKEND_DIR" && npx prisma generate)
  npm --prefix "$BACKEND_DIR" run typecheck
  if [ "$RUN_BACKEND_TESTS" = "true" ]; then
    NODE_ENV=test npm --prefix "$BACKEND_DIR" test
  else
    log "RUN_BACKEND_TESTS=false: backend testleri atlandi"
  fi
  npm --prefix "$BACKEND_DIR" run build
  npm --prefix "$FRONTEND_DIR" run lint
  npm --prefix "$FRONTEND_DIR" run build

  cd "$ENGINE_DIR"
  # Config package tests verify fail-safe defaults. Run tests without the live
  # process environment; the compiled binary receives production env via PM2.
  (
    unset DATABASE_URL TRADING_CREDENTIALS_MASTER_KEY
    while IFS= read -r variable; do unset "$variable"; done < <(compgen -A variable TRADING_ENGINE_)
    go test ./...
  )
  go build -trimpath -o "$ENGINE_CANDIDATE" ./cmd/trading-engine
  chmod 0755 "$ENGINE_CANDIDATE"

  test -f "$BACKEND_DIR/dist/server.js"
  test -f "$FRONTEND_DIR/dist/index.html"
  FRONTEND_ASSET_PATH="$(grep -oE '/assets/index-[^"]+\.js' "$FRONTEND_DIR/dist/index.html" | head -n 1)"
  if [ -z "$FRONTEND_ASSET_PATH" ]; then
    printf 'Frontend build asset hash bulunamadi: %s\n' "$FRONTEND_DIR/dist/index.html" >&2
    exit 1
  fi
  log "Frontend build asset: $FRONTEND_ASSET_PATH"
  test -x "$ENGINE_CANDIDATE"
}

backup_database() {
  step "5/13 Veritabani yedegi aliniyor"
  require_command mysqldump
  mkdir -p "$BACKUP_DIR"
  chmod 0700 "$BACKUP_DIR"

  local db_host db_port db_user db_password db_name defaults_file backup_file
  db_host="$(node -e 'const u=new URL(process.env.DATABASE_URL); process.stdout.write(u.hostname)' )"
  db_port="$(node -e 'const u=new URL(process.env.DATABASE_URL); process.stdout.write(u.port || "3306")' )"
  db_user="$(node -e 'const u=new URL(process.env.DATABASE_URL); process.stdout.write(decodeURIComponent(u.username))' )"
  db_password="$(node -e 'const u=new URL(process.env.DATABASE_URL); process.stdout.write(decodeURIComponent(u.password))' )"
  db_name="$(node -e 'const u=new URL(process.env.DATABASE_URL); process.stdout.write(decodeURIComponent(u.pathname.replace(/^\//, "")))' )"
  if [ -z "$db_host" ] || [ -z "$db_user" ] || [ -z "$db_name" ]; then
    printf 'DATABASE_URL mysqldump icin ayrisamadi.\n' >&2
    exit 1
  fi

  defaults_file="$(mktemp)"
  chmod 0600 "$defaults_file"
  printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword=%s\n' \
    "$db_host" "$db_port" "$db_user" "$db_password" > "$defaults_file"
  backup_file="$BACKUP_DIR/${db_name}_$(date '+%Y%m%d_%H%M%S').sql"
  if ! mysqldump --defaults-extra-file="$defaults_file" --single-transaction --routines --triggers --no-tablespaces "$db_name" > "$backup_file"; then
    rm -f "$defaults_file" "$backup_file"
    return 1
  fi
  rm -f "$defaults_file"
  chmod 0600 "$backup_file"
  test -s "$backup_file"
  log "Veritabani yedegi olusturuldu: $backup_file"
}

pause_testnet_fleet() {
  step "7/13 TESTNET filosu bakim moduna aliniyor"
  npm --prefix "$BACKEND_DIR" run control:ai-testnet-fleet -- \
    --action=pause \
    --confirm=PAUSE_BINANCE_TESTNET_FLEET
  FLEET_MAINTENANCE_STARTED=true
}

apply_migrations() {
  step "6/13 Prisma migrationlari uygulaniyor"
  if [ "$APPLY_MIGRATIONS" = "true" ]; then
    # Production veri kaybi veya breaking schema degisikligi otomatik deploy
    # yetkisinin disindadir. Yalniz henuz uygulanmamis migration dosyalari
    # taranir; riskli SQL bulunursa yonetici onayi icin deploy durur.
    (cd "$BACKEND_DIR" && node - <<'NODE'
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const destructive = /\b(DROP\s+(?:TABLE|COLUMN|DATABASE|INDEX|FOREIGN\s+KEY|PRIMARY\s+KEY)|TRUNCATE\s+TABLE|DELETE\s+FROM|RENAME\s+TABLE|ALTER\s+TABLE[\s\S]{0,500}?\b(?:MODIFY|CHANGE|RENAME)\b)\b/i;

(async () => {
  const appliedRows = await prisma.$queryRawUnsafe(
    'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
  );
  const applied = new Set(appliedRows.map((row) => row.migration_name));
  const root = path.join(process.cwd(), 'prisma', 'migrations');
  const pending = fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !applied.has(entry.name))
    .map((entry) => ({ name: entry.name, file: path.join(root, entry.name, 'migration.sql') }))
    .filter((entry) => fs.existsSync(entry.file));
  const blocked = pending.filter((entry) => destructive.test(fs.readFileSync(entry.file, 'utf8')));
  if (blocked.length) {
    console.error(`[GUVENLIK] Destructive migration onay gerektiriyor: ${blocked.map((entry) => entry.name).join(', ')}`);
    process.exitCode = 42;
  } else {
    console.log(`[GUVENLIK] ${pending.length} pending migration destructive SQL icermiyor.`);
  }
})().finally(() => prisma.$disconnect());
NODE
    )
    (cd "$BACKEND_DIR" && npx prisma migrate deploy)
  else
    log "APPLY_MIGRATIONS=false: migration uygulanmadi"
    (cd "$BACKEND_DIR" && npx prisma migrate status)
  fi
}

install_frontend() {
  step "8/13 Frontend yayina hazirlaniyor"
  if [ -n "$WEB_ROOT" ]; then
    mkdir -p "$WEB_ROOT"
    cp -a "$FRONTEND_DIR/dist/." "$WEB_ROOT/"
    test -f "$WEB_ROOT$FRONTEND_ASSET_PATH"
    log "Frontend kopyalandi: $WEB_ROOT"
  else
    log "WEB_ROOT bos: Nginx'in frontend/dist dizinini servis ettigi varsayildi"
  fi
  if [ "$RELOAD_NGINX" = "true" ]; then
    nginx -t
    systemctl reload nginx
  fi
}

verify_frontend_release() {
  if [ -z "$FRONTEND_HEALTH_URL" ]; then
    log "FRONTEND_URL/FRONTEND_HEALTH_URL bos: yayinlanan frontend hash kontrolu atlandi"
    return
  fi
  local url body
  url="${FRONTEND_HEALTH_URL%/}/"
  body="$(curl -fsS --max-time 15 -H 'Cache-Control: no-cache' "${url}?deploy=$(date +%s)")"
  if [[ "$body" != *"$FRONTEND_ASSET_PATH"* ]]; then
    printf 'Canli frontend yeni build hashini sunmuyor: %s\n' "$FRONTEND_ASSET_PATH" >&2
    printf 'Nginx baska dizini servis ediyor olabilir. WEB_ROOT degerini gercek Nginx root dizinine ayarlayin.\n' >&2
    return 1
  fi
  curl -fsS --max-time 15 -o /dev/null "${url%/}${FRONTEND_ASSET_PATH}"
  log "Canli frontend build dogrulandi: $FRONTEND_ASSET_PATH"
}

restart_backend() {
  step "9/13 Backend PM2 ile yeniden baslatiliyor"
  if pm2 describe "$BACKEND_PM2_NAME" >/dev/null 2>&1; then
    pm2 restart "$BACKEND_PM2_NAME" --update-env
  else
    pm2 start "$BACKEND_DIR/dist/server.js" \
      --name "$BACKEND_PM2_NAME" \
      --cwd "$BACKEND_DIR" \
      --restart-delay 5000 \
      --kill-timeout 20000 \
      --time
  fi
}

install_and_restart_engine() {
  step "10/13 Go Trading Engine atomik guncelleniyor"
  if [ -x "$ENGINE_BINARY" ]; then
    cp -p "$ENGINE_BINARY" "$ENGINE_ROLLBACK"
  else
    rm -f "$ENGINE_ROLLBACK"
  fi
  mv -f "$ENGINE_CANDIDATE" "$ENGINE_BINARY"
  chmod 0755 "$ENGINE_BINARY"

  if pm2 describe "$ENGINE_PM2_NAME" >/dev/null 2>&1; then
    pm2 restart "$ENGINE_PM2_NAME" --update-env
  else
    pm2 start "$ENGINE_BINARY" \
      --name "$ENGINE_PM2_NAME" \
      --interpreter none \
      --cwd "$ENGINE_DIR" \
      --restart-delay 5000 \
      --kill-timeout 20000 \
      --time
  fi
}

wait_for_url() {
  local name="$1" url="$2" process_name="$3" attempt
  for attempt in $(seq 1 30); do
    if curl -fsS --max-time 5 "$url" >/dev/null; then
      log "$name hazir: $url"
      return 0
    fi
    sleep 2
  done
  printf '%s health-check basarisiz: %s\n' "$name" "$url" >&2
  pm2 logs "$process_name" --lines 100 --nostream || true
  return 1
}

wait_for_backend() {
  local attempt body
  for attempt in $(seq 1 30); do
    if body="$(curl -fsS --max-time 5 "$BACKEND_HEALTH_URL" 2>/dev/null)" && \
      node -e '
        try {
          const value = JSON.parse(process.argv[1]);
          if (value.status !== "ok" || value.database !== "connected") process.exit(1);
        } catch { process.exit(1); }
      ' "$body"; then
      log "Backend hazir ve kimligi dogrulandi: $BACKEND_HEALTH_URL"
      return 0
    fi
    sleep 2
  done
  printf 'Backend health-check/kimlik dogrulamasi basarisiz: %s\n' "$BACKEND_HEALTH_URL" >&2
  pm2 logs "$BACKEND_PM2_NAME" --lines 100 --nostream || true
  return 1
}

wait_for_engine_contract() {
  local attempt body
  for attempt in $(seq 1 30); do
    if body="$(curl -fsS --max-time 5 -H "Authorization: Bearer ${TRADING_ENGINE_TOKEN}" "$ENGINE_STATUS_URL" 2>/dev/null)" && \
      node -e '
        try {
          const value = JSON.parse(process.argv[1]);
          if (value.status !== "ready" || value.mode !== "cutover" || value.executor !== "enabled" || value.shadow_read !== "enabled") process.exit(1);
        } catch { process.exit(1); }
      ' "$body"; then
      log "Node -> Go tokenli runtime sozlesmesi hazir: $ENGINE_STATUS_URL"
      return 0
    fi
    sleep 2
  done
  printf 'Trading Engine tokenli status/execution sozlesmesi dogrulanamadi: %s\n' "$ENGINE_STATUS_URL" >&2
  pm2 logs "$ENGINE_PM2_NAME" --lines 100 --nostream || true
  return 1
}

health_checks() {
  step "11/13 Backend ve Engine health/reconciliation kontrol ediliyor"
  wait_for_backend
  verify_frontend_release
  if ! wait_for_url "Trading Engine" "$ENGINE_HEALTH_URL" "$ENGINE_PM2_NAME"; then
    if [ -x "$ENGINE_ROLLBACK" ]; then
      log "Engine hazir olmadi; onceki binary geri yukleniyor"
      cp -p "$ENGINE_ROLLBACK" "$ENGINE_BINARY"
      pm2 restart "$ENGINE_PM2_NAME" --update-env || true
    fi
    return 1
  fi
  wait_for_engine_contract
}

resume_testnet_fleet() {
  step "12/13 Yalniz bakimda durdurulan TESTNET botlari devam ettiriliyor"
  npm --prefix "$BACKEND_DIR" run control:ai-testnet-fleet -- \
    --action=resume \
    --recent-minutes="$MAINTENANCE_RESUME_MINUTES" \
    --confirm=RESUME_BINANCE_TESTNET_FLEET
  FLEET_MAINTENANCE_STARTED=false
}

finalize() {
  step "13/13 Deploy sonucu dogrulaniyor"
  pm2 save
  if [ "$ENABLE_PM2_STARTUP" = "true" ]; then
    if [ "$(id -u)" -ne 0 ]; then
      printf 'PM2 reboot entegrasyonunu kurmak icin deploy root olarak calistirilmalidir.\n' >&2
      return 1
    fi
    if [ -z "$PM2_RUNTIME_HOME" ] || [ ! -d "$PM2_RUNTIME_HOME" ]; then
      printf 'PM2 runtime home gecersiz: %s\n' "${PM2_RUNTIME_HOME:-<missing>}" >&2
      return 1
    fi
    if ! systemctl cat "$PM2_SYSTEMD_UNIT" >/dev/null 2>&1; then
      pm2 startup systemd -u "$PM2_RUNTIME_USER" --hp "$PM2_RUNTIME_HOME"
    fi
    systemctl enable "$PM2_SYSTEMD_UNIT"
    systemctl is-enabled --quiet "$PM2_SYSTEMD_UNIT"
    log "PM2 reboot entegrasyonu etkin: $PM2_SYSTEMD_UNIT"
  fi
  node -e '
    const names = new Set(process.argv.slice(1));
    const apps = JSON.parse(require("child_process").execFileSync("pm2", ["jlist"], { encoding: "utf8" }));
    for (const name of names) {
      const app = apps.find((candidate) => candidate.name === name);
      if (!app || app.pm2_env?.status !== "online" || app.pm2_env?.autorestart === false) {
        console.error(`PM2 process production-safe degil: ${name}`);
        process.exit(1);
      }
    }
  ' "$BACKEND_PM2_NAME" "$ENGINE_PM2_NAME"
  npm --prefix "$BACKEND_DIR" run status:ai-fleet
  pm2 status
  log "Deploy tamamlandi. PAPER/TESTNET DB durumundan devam eder; production LIVE kapali kalir."
}

main() {
  require_command git
  require_command node
  require_command npm
  require_command go
  require_command pm2
  require_command curl
  if [ "$ENABLE_PM2_STARTUP" = "true" ]; then require_command systemctl; fi
  acquire_lock
  update_code
  install_dependencies
  load_environment
  validate_and_build
  backup_database
  apply_migrations
  pause_testnet_fleet
  install_frontend
  restart_backend
  install_and_restart_engine
  health_checks
  resume_testnet_fleet
  finalize
}

main "$@"
