# Reset local dev environment: sync main, clean Next.js cache, reinstall if needed.
#
# Usage:
#   .\scripts\dev-reset.ps1              # pull + clean + npm run dev
#   .\scripts\dev-reset.ps1 -SkipDev     # pull + clean only (prints "run npm run dev")
#   .\scripts\dev-reset.ps1 -SkipPull    # clean cache only (no git pull)
#   .\scripts\dev-reset.ps1 -SkipPull -SkipDev   # cache clean, no dev server
#
# Env:
#   GIT_PATH  -  full path to git.exe (optional; auto-detected GitHub Desktop on Windows)

param(
  [switch]$SkipDev,
  [switch]$SkipPull
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
function Get-GitHubDesktopGit {
  $base = Join-Path $env:LOCALAPPDATA "GitHubDesktop"
  if (-not (Test-Path -LiteralPath $base)) { return $null }

  $apps = Get-ChildItem -LiteralPath $base -Directory -Filter "app-*" |
    Sort-Object Name -Descending

  foreach ($app in $apps) {
    $gitExe = Join-Path $app.FullName "resources\app\git\cmd\git.exe"
    if (Test-Path -LiteralPath $gitExe) { return $gitExe }
  }

  return $null
}

function Resolve-GitExecutable {
  if ($env:GIT_PATH -and (Test-Path -LiteralPath $env:GIT_PATH)) {
    return $env:GIT_PATH
  }
  if ($env:GIT_PATH) {
    Write-Warning "[dev-reset] GIT_PATH set but not found: $env:GIT_PATH"
  }

  $cmd = Get-Command git -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $desktopGit = Get-GitHubDesktopGit
  if ($desktopGit) { return $desktopGit }

  $programFilesGit = "C:\Program Files\Git\cmd\git.exe"
  if (Test-Path -LiteralPath $programFilesGit) { return $programFilesGit }

  return "git"
}

$Git = Resolve-GitExecutable
$LockHashFile = Join-Path $Root "node_modules\.package-lock.hash"

Set-Location $Root

function Invoke-Git {
  param([string[]]$Args)
  & $Git @Args
  if ($LASTEXITCODE -ne 0) { throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE" }
}

if (-not $SkipPull) {
  Write-Host "[dev-reset] Fetching origin..."
  Invoke-Git @("fetch", "origin")

  $dirty = Invoke-Git @("status", "--porcelain")
  if ($dirty) {
    Write-Warning "[dev-reset] Uncommitted changes detected  -  skipping git pull. Commit or stash first."
  } else {
    Write-Host "[dev-reset] Pulling origin/main..."
    Invoke-Git @("pull", "origin", "main")
  }
}

Write-Host "[dev-reset] Removing .next and node_modules/.cache..."
Remove-Item -Recurse -Force (Join-Path $Root ".next") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $Root "node_modules\.cache") -ErrorAction SilentlyContinue

$lockFile = Join-Path $Root "package-lock.json"
$currentHash = $null
if (Test-Path $lockFile) {
  $currentHash = (Get-FileHash $lockFile -Algorithm SHA256).Hash
}

$storedHash = $null
if (Test-Path $LockHashFile) {
  $storedHash = (Get-Content $LockHashFile -Raw).Trim()
}

$needsInstall = -not (Test-Path (Join-Path $Root "node_modules")) -or ($currentHash -and $currentHash -ne $storedHash)

if ($needsInstall) {
  Write-Host "[dev-reset] package-lock.json changed or node_modules missing  -  running npm install..."
  npm install
  if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
  if ($currentHash) {
    New-Item -ItemType Directory -Force -Path (Join-Path $Root "node_modules") | Out-Null
    Set-Content -Path $LockHashFile -Value $currentHash -NoNewline
  }
} else {
  Write-Host "[dev-reset] package-lock.json unchanged  -  skipping npm install"
}

$sha = Invoke-Git @("rev-parse", "--short", "HEAD")
Write-Host "[dev-reset] Latest commit: $sha"

if ($SkipDev) {
  Write-Host "[dev-reset] Run: npm run dev"
} else {
  npm run dev
}
