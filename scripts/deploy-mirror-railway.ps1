# Deploy BrandHive companion server (MongoDB mirrors) to Railway
# and wire VITE_MIRROR_API_URL on Vercel.
#
# Prerequisites:
#   1. npx @railway/cli login
#   2. MongoDB Atlas URI or Railway MongoDB plugin in the same project
#
# Usage (from repo root):
#   .\scripts\deploy-mirror-railway.ps1
#   .\scripts\deploy-mirror-railway.ps1 -MongoUri "mongodb+srv://..."

param(
  [string]$MongoUri = $env:MONGO_URI,
  [string]$VercelProject = "brandhive-main"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ServerDir = Join-Path $Root "server"

Write-Host "`n=== BrandHive Mirror Server — Railway Deploy ===`n" -ForegroundColor Cyan

Push-Location $ServerDir
try {
  $whoami = npx @railway/cli whoami 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in to Railway. Run:" -ForegroundColor Yellow
    Write-Host "  npx @railway/cli login`n"
    exit 1
  }
  Write-Host "Railway account: $whoami"

  if (-not (Test-Path ".railway")) {
    Write-Host "Initializing Railway project in server/ ..."
    npx @railway/cli init --name brandhive-mirror
  }

  if ($MongoUri) {
    Write-Host "Setting MONGO_URI ..."
    npx @railway/cli variables set "MONGO_URI=$MongoUri"
  } else {
    Write-Host "Tip: set MONGO_URI in Railway dashboard or pass -MongoUri" -ForegroundColor Yellow
  }

  npx @railway/cli variables set "NODE_ENV=production"

  Write-Host "`nDeploying to Railway ..."
  npx @railway/cli up --detach

  Write-Host "`nGenerating public domain ..."
  npx @railway/cli domain 2>$null
  if ($LASTEXITCODE -ne 0) {
    npx @railway/cli domain generate
  }

  Start-Sleep -Seconds 3
  $statusJson = npx @railway/cli status --json 2>$null | ConvertFrom-Json
  $mirrorUrl = $null

  if ($statusJson.service?.url) {
    $mirrorUrl = $statusJson.service.url
  }

  if (-not $mirrorUrl) {
    $domainOut = npx @railway/cli domain 2>&1 | Out-String
    if ($domainOut -match 'https://[^\s]+') {
      $mirrorUrl = $Matches[0].Trim()
    }
  }

  if (-not $mirrorUrl) {
    Write-Host "`nDeploy started. Copy the public URL from Railway dashboard, then run:" -ForegroundColor Yellow
    Write-Host "  cd $Root"
    Write-Host "  npx vercel env add VITE_MIRROR_API_URL production"
    Write-Host "  npx vercel --prod --yes"
    exit 0
  }

  $mirrorUrl = $mirrorUrl.TrimEnd('/')
  Write-Host "`nMirror server URL: $mirrorUrl" -ForegroundColor Green

  Pop-Location
  Push-Location $Root

  Write-Host "Setting VITE_MIRROR_API_URL on Vercel ($VercelProject) ..."
  $mirrorUrl | npx vercel env add VITE_MIRROR_API_URL production --force 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Run manually: npx vercel env add VITE_MIRROR_API_URL production" -ForegroundColor Yellow
    Write-Host "Value: $mirrorUrl"
  }

  Write-Host "Redeploying Vercel frontend ..."
  npx vercel --prod --yes

  Write-Host "`nDone!" -ForegroundColor Green
  Write-Host "  Mirror API: $mirrorUrl"
  Write-Host "  Frontend:   https://brandhive-main.vercel.app"
}
finally {
  Pop-Location
}
