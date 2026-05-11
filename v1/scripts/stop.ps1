# Stop the Basira dev stack started by scripts/dev.ps1.
#
# Usage: npm run stop  (from the repo root)

$ErrorActionPreference = "SilentlyContinue"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Write-Step { param($msg) Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "    $msg" -ForegroundColor Green }

Write-Step "Killing processes on 3000 and 8080"
foreach ($port in 3000, 8080) {
  $pids = (netstat -ano | Select-String ":$port\s+.*LISTENING") -replace '.*\s+(\d+)$', '$1' | Sort-Object -Unique
  foreach ($p in $pids) {
    if ($p -match '^\d+$') {
      $prevPref = $ErrorActionPreference; $ErrorActionPreference = "Continue"
      & taskkill /F /PID $p 2>&1 | Out-Null
      $ErrorActionPreference = $prevPref
    }
  }
}
Write-Ok "ports cleared"

Write-Step "Stopping Postgres"
$prevPref = $ErrorActionPreference; $ErrorActionPreference = "Continue"
& docker compose down 2>&1 | Out-Null
$ErrorActionPreference = $prevPref
Write-Ok "Postgres stopped"

Write-Host ""
Write-Host "Basira stopped." -ForegroundColor Green
Write-Host "Spawned 'basira daemon' / 'basira web' windows can be closed manually."
