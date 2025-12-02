param(
  [Parameter(Mandatory = $true)]
  [string]$TargetRepoPath,
  [string]$Branch = 'main',
  [string]$OutputName = $(Get-Date -Format 'yyyyMMdd-HHmmss'),
  [string]$SourceRepoPath = $PSScriptRoot,
  [switch]$SkipInstall,
  [string]$CommitMessage
)

$ErrorActionPreference = 'Stop'

function Run-Git {
  param(
    [string]$Repo,
    [string[]]$Args
  )
  & git -C $Repo @Args
}

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'git is not available in PATH'
}

if (-not (Test-Path $TargetRepoPath)) {
  throw "TargetRepoPath not found: $TargetRepoPath"
}

if (-not (Test-Path (Join-Path $TargetRepoPath '.git'))) {
  throw "TargetRepoPath is not a git repository: $TargetRepoPath"
}

if (-not $CommitMessage) {
  $CommitMessage = "chore: publish frontend build ($OutputName)"
}

$distPath = Join-Path $SourceRepoPath 'dist'
$stagingRoot = Join-Path $SourceRepoPath 'release'
$stagingPath = Join-Path $stagingRoot $OutputName
$targetOutputPath = Join-Path $TargetRepoPath $OutputName

if (Test-Path $stagingPath) {
  throw "Staging path already exists: $stagingPath (choose another OutputName or remove it)"
}

if (Test-Path $targetOutputPath) {
  throw "Target output path already exists in target repo: $targetOutputPath"
}

if (-not $SkipInstall -and -not (Test-Path (Join-Path $SourceRepoPath 'node_modules'))) {
  Write-Host 'Installing dependencies...' -ForegroundColor Cyan
  pushd $SourceRepoPath
  npm install
  popd
}

Write-Host 'Building frontend...' -ForegroundColor Cyan
pushd $SourceRepoPath
npm run build
popd

if (-not (Test-Path $distPath)) {
  throw "Build output not found at $distPath"
}

Write-Host "Staging build to $stagingPath" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $stagingPath -Force | Out-Null
Copy-Item -Path (Join-Path $distPath '*') -Destination $stagingPath -Recurse

Write-Host "Copying build to target repo: $targetOutputPath" -ForegroundColor Cyan
Copy-Item -Path $stagingPath -Destination $targetOutputPath -Recurse

Write-Host "Ensuring branch $Branch exists..." -ForegroundColor Cyan
$branchExists = $true
try {
  Run-Git -Repo $TargetRepoPath -Args @('rev-parse', '--verify', $Branch) | Out-Null
} catch {
  $branchExists = $false
}
if ($branchExists) {
  Run-Git -Repo $TargetRepoPath -Args @('checkout', $Branch)
} else {
  Run-Git -Repo $TargetRepoPath -Args @('checkout', '-b', $Branch)
}

Write-Host "Adding build folder $OutputName to git..." -ForegroundColor Cyan
Run-Git -Repo $TargetRepoPath -Args @('add', $OutputName)

try {
  Run-Git -Repo $TargetRepoPath -Args @('commit', '-m', $CommitMessage)
} catch {
  Write-Warning 'Nothing to commit (git reported no changes).'
}

Write-Host "Pushing to origin/$Branch..." -ForegroundColor Cyan
Run-Git -Repo $TargetRepoPath -Args @('push', 'origin', $Branch)

Write-Host 'Done.' -ForegroundColor Green 
