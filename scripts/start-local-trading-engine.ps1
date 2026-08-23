param(
  [string]$Binary = "",
  [string]$StdoutLog = "",
  [string]$StderrLog = "",
  [switch]$EnableAutonomousTestnet
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($Binary)) { $Binary = Join-Path $projectRoot 'services\trading-engine\trading-engine.next.exe' }
if ([string]::IsNullOrWhiteSpace($StdoutLog)) { $StdoutLog = Join-Path $projectRoot '.runtime\trading-engine-adaptive.stdout.log' }
if ([string]::IsNullOrWhiteSpace($StderrLog)) { $StderrLog = Join-Path $projectRoot '.runtime\trading-engine-adaptive.stderr.log' }
$runtimeDirectory = Split-Path -Parent $StdoutLog
if (-not (Test-Path -LiteralPath $runtimeDirectory)) {
  New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
}
$binaryPath = (Resolve-Path -LiteralPath $Binary).Path
$engineDirectory = (Resolve-Path (Join-Path $projectRoot 'services\trading-engine')).Path
$environmentFile = Join-Path $projectRoot 'backend\.env'

foreach ($line in Get-Content -LiteralPath $environmentFile) {
  if ($line -match '^\s*#' -or $line -notmatch '^\s*([^=]+)=(.*)$') { continue }
  $key = $matches[1].Trim()
  $value = $matches[2].Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }
  [Environment]::SetEnvironmentVariable($key, $value, 'Process')
}

$required = @('DATABASE_URL', 'TRADING_ENGINE_TOKEN', 'TRADING_CREDENTIALS_MASTER_KEY')
foreach ($key in $required) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($key, 'Process'))) {
    throw "$key is required in backend/.env"
  }
}

$env:TRADING_ENGINE_MODE = 'cutover'
$env:TRADING_ENGINE_SHADOW_READ_ENABLED = 'true'
$env:TRADING_ENGINE_REALTIME_ENABLED = 'false'
# PAPER/SHADOW execution is local simulation and must keep running even when
# Binance TESTNET order execution is intentionally disabled.
$env:TRADING_ENGINE_BOT_SCHEDULER_ENABLED = 'true'
$env:TRADING_ENGINE_AUTONOMOUS_TESTNET_ENABLED = if ($EnableAutonomousTestnet) { 'true' } else { 'false' }
$env:TRADING_ENGINE_LIQUIDATION_STREAM_ENABLED = if ($EnableAutonomousTestnet) { 'true' } else { 'false' }
$env:TRADING_ENGINE_ADDR = ':8081'

$existingListener = netstat -ano | Select-String ':8081\s+.*LISTENING' | Select-Object -First 1
if ($existingListener) {
  throw 'Port 8081 is already in use. Stop the existing Trading Engine before starting another instance.'
}

$process = Start-Process -FilePath $binaryPath -WorkingDirectory $engineDirectory -RedirectStandardOutput $StdoutLog -RedirectStandardError $StderrLog -WindowStyle Hidden -PassThru
for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Milliseconds 500
  if ($process.HasExited) {
    throw "Trading Engine exited during startup. Check $StderrLog"
  }
  try {
    $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8081/health/ready' -TimeoutSec 2
    if ($health.status -eq 'ready') {
      [pscustomobject]@{
        pid = $process.Id
        status = $health.status
        mode = $health.mode
        paperScheduler = $true
        autonomousTestnet = $EnableAutonomousTestnet.IsPresent
        stdoutLog = $StdoutLog
        stderrLog = $StderrLog
      }
      exit 0
    }
  } catch {
    # The service can need a few seconds for startup reconciliation.
  }
}

throw "Trading Engine did not become ready within 10 seconds. Check $StderrLog"
