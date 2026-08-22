param(
  [string]$Binary = "",
  [string]$StdoutLog = "",
  [string]$StderrLog = ""
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if ([string]::IsNullOrWhiteSpace($Binary)) { $Binary = Join-Path $projectRoot 'services\trading-engine\trading-engine.next.exe' }
if ([string]::IsNullOrWhiteSpace($StdoutLog)) { $StdoutLog = Join-Path $projectRoot '.runtime\trading-engine-adaptive.stdout.log' }
if ([string]::IsNullOrWhiteSpace($StderrLog)) { $StderrLog = Join-Path $projectRoot '.runtime\trading-engine-adaptive.stderr.log' }
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
$env:TRADING_ENGINE_BOT_SCHEDULER_ENABLED = 'true'
$env:TRADING_ENGINE_AUTONOMOUS_TESTNET_ENABLED = 'true'
$env:TRADING_ENGINE_LIQUIDATION_STREAM_ENABLED = 'true'
$env:TRADING_ENGINE_ADDR = ':8081'

$process = Start-Process -FilePath $binaryPath -WorkingDirectory $engineDirectory -RedirectStandardOutput $StdoutLog -RedirectStandardError $StderrLog -WindowStyle Hidden -PassThru
Write-Output $process.Id
