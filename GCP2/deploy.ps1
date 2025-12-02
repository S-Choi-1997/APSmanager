$ErrorActionPreference = 'Stop'

# Changeable defaults
$FunctionName = 'inquiryApi'
$Region = 'asia-northeast3'
$Runtime = 'nodejs20'
$EntryPoint = 'api'

# Load .env if present
$envFile = Join-Path $PSScriptRoot '.env'
if (Test-Path $envFile) {
  Get-Content $envFile |
    Where-Object { $_ -and $_ -notmatch '^\s*#' } |
    ForEach-Object {
      $parts = $_ -split '=', 2
      if ($parts.Count -eq 2) {
        $key = $parts[0].Trim()
        $val = $parts[1].Trim()
        if ($key) { Set-Item -Path "Env:$key" -Value $val }
      }
    }
}

# Required envs
$required = @('ALLOWED_ORIGINS', 'ALLOWED_EMAILS')
$missing = $required | Where-Object { -not (Get-Item -Path "Env:$_" -ErrorAction SilentlyContinue) }
if ($missing.Count -gt 0) {
  Write-Error "Missing required env vars: $($missing -join ', '). Set them in .env or your shell."
  exit 1
}

# Build env var string for gcloud
$envVars = @()
foreach ($item in Get-ChildItem Env: | Where-Object { $_.Name -in 'ALLOWED_ORIGINS','ALLOWED_EMAILS','STORAGE_BUCKET','GCLOUD_PROJECT' }) {
  if ($item.Value) { $envVars += "$($item.Name)=$($item.Value)" }
}
$envVarArg = $envVars -join ','

Write-Host "Deploying $FunctionName to $Region (runtime: $Runtime)..." -ForegroundColor Cyan

$gcloudArgs = @(
  'functions', 'deploy', $FunctionName,
  '--runtime', $Runtime,
  '--region', $Region,
  '--entry-point', $EntryPoint,
  '--trigger-http',
  '--allow-unauthenticated',
  '--set-env-vars', $envVarArg
)

Write-Host "Running: gcloud $($gcloudArgs -join ' ')" -ForegroundColor Yellow
& gcloud @gcloudArgs
