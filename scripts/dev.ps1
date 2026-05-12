# Basira dev orchestrator. Brings up Postgres, runs migrations,
# and launches the daemon + web dev servers in their own windows.
#
# Usage: npm run dev   (from the repo root)
#
# Stops with: npm run stop  (or close the spawned PowerShell windows)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

function Write-Step { param($msg) Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok   { param($msg) Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "    $msg" -ForegroundColor Yellow }
function Write-Bad  { param($msg) Write-Host "    $msg" -ForegroundColor Red }

# Native command stderr wrapping under PS 5.1 makes `2>&1` look like errors.
# Use Invoke-Quiet for native calls whose noise we don't need.
function Invoke-Quiet {
  param([string]$Exe, [string[]]$Args)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & $Exe @Args 2>&1 | Out-Null
    return $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $prev
  }
}

# ─── 1. Docker check ─────────────────────────────────────────────────
Write-Step "Checking Docker"
$dockerCode = Invoke-Quiet "docker" @("info")
if ($dockerCode -ne 0) {
  Write-Bad "Docker isn't running. Start Docker Desktop and try again."
  exit 1
}
Write-Ok "Docker is running"

# ─── 2. .env check ───────────────────────────────────────────────────
Write-Step "Checking .env"
if (-not (Test-Path "$RepoRoot\.env")) {
  Write-Bad ".env not found at $RepoRoot\.env"
  Write-Warn "Copy .env.example to .env and fill in DATABASE_URL, SOLANA_RPC_URL, LLM_API_KEY."
  exit 1
}
Write-Ok ".env present"

# Sync web/.env.local from root .env so Next.js workers see DATABASE_URL.
Copy-Item "$RepoRoot\.env" "$RepoRoot\web\.env.local" -Force
Write-Ok "synced web/.env.local"

# ─── 3. Postgres ─────────────────────────────────────────────────────
Write-Step "Starting Postgres (docker compose up -d)"
$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$composeOut = & docker compose up -d 2>&1 | Out-String
$composeCode = $LASTEXITCODE
$ErrorActionPreference = $prevPref
if ($composeCode -ne 0) {
  Write-Bad "docker compose up failed:"
  Write-Host $composeOut
  exit 1
}
# Surface useful lines so users see progress. Skip PowerShell error-decoration
# lines ("docker.exe :", "+ CategoryInfo", "+ FullyQualified") that come from
# native stderr wrapping under PS 5.1.
foreach ($line in ($composeOut -split "`r?`n")) {
  $trim = $line.Trim()
  if ($trim -eq "") { continue }
  if ($trim -match "^(docker\.exe |\+ CategoryInfo|\+ FullyQualified)") { continue }
  if ($trim -match "(Container|Network|Volume) .+(Creating|Created|Starting|Started|Healthy)$") {
    Write-Host "    $trim"
  }
}

Write-Step "Waiting for Postgres to accept connections"
$ready = $false
$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"
for ($i = 0; $i -lt 120; $i++) {
  $check = (& docker exec basira-postgres pg_isready -U basira -d basira 2>&1 | Out-String)
  if ($check -match "accepting connections") { $ready = $true; break }
  Start-Sleep -Milliseconds 500
}
$ErrorActionPreference = $prevPref
if (-not $ready) {
  Write-Bad "Postgres didn't become ready in 60s"
  exit 1
}
Write-Ok "Postgres ready on localhost:5433"

# ─── 4. Migrations (idempotent) ──────────────────────────────────────
Write-Step "Applying migrations"
$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$migrateOut = & npm run db:migrate -w '@basira/shared' 2>&1 | Out-String
$migrateCode = $LASTEXITCODE
$ErrorActionPreference = $prevPref
if ($migrateCode -ne 0) {
  Write-Bad "Migrations failed:"
  Write-Host $migrateOut
  exit 1
}
$summary = ($migrateOut -split "`n") | Where-Object { $_ -match "No migrations|Migrations applied|MIGRATION " } | Select-Object -First 3
foreach ($line in $summary) { Write-Host "    $($line.Trim())" }
Write-Ok "schema up to date"

# ─── 5. Kill stale dev processes on 3000 and 8080 ────────────────────
Write-Step "Clearing ports 3000 and 8080"
foreach ($port in 3000, 8080) {
  $pids = (netstat -ano | Select-String ":$port\s+.*LISTENING") -replace '.*\s+(\d+)$', '$1' | Sort-Object -Unique
  foreach ($p in $pids) {
    if ($p -match '^\d+$') {
      Invoke-Quiet "taskkill" @("/F", "/PID", $p) | Out-Null
    }
  }
}
Write-Ok "ports cleared"

# ─── 6. Launch daemon and web in new PowerShell windows ──────────────
$shell = if (Get-Command pwsh -ErrorAction SilentlyContinue) { "pwsh" } else { "powershell" }

Write-Step "Launching daemon (new window)"
Start-Process $shell -ArgumentList @(
  "-NoExit", "-NoProfile", "-Command",
  "Set-Location '$RepoRoot'; `$Host.UI.RawUI.WindowTitle = 'basira daemon'; Write-Host 'BASIRA DAEMON' -ForegroundColor Magenta; npm run dev -w '@basira/daemon'"
)

Write-Step "Launching web (new window)"
Start-Process $shell -ArgumentList @(
  "-NoExit", "-NoProfile", "-Command",
  "Set-Location '$RepoRoot'; `$Host.UI.RawUI.WindowTitle = 'basira web'; Write-Host 'BASIRA WEB' -ForegroundColor Magenta; npm run dev -w '@basira/web'"
)

# ─── 7. Wait for web ready, then print URLs ──────────────────────────
Write-Step "Waiting for web to respond"
$webReady = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    $r = Invoke-WebRequest "http://localhost:3000/api/v1/health" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { $webReady = $true; break }
  } catch {}
  Start-Sleep -Milliseconds 500
}

Write-Host ""
if ($webReady) {
  Write-Host "Basira is up." -ForegroundColor Green
} else {
  Write-Warn "Web didn't respond in 30s. Check the 'basira web' window for errors."
}
Write-Host ""
Write-Host "  Web:      http://localhost:3000"
Write-Host "  Daemon:   http://localhost:8080/health"
Write-Host "  Postgres: localhost:5433  (basira/basira)"
Write-Host ""
Write-Host "Stop with: npm run stop  (or just close the two new PowerShell windows)"
