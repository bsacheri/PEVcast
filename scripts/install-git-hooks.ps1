[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (git rev-parse --show-toplevel).Trim()
$hooksSource = Join-Path $repoRoot '.githooks'
$hooksTarget = Join-Path $repoRoot '.git\hooks'

if (-not (Test-Path -LiteralPath $hooksSource)) {
  throw "Hook source directory not found: $hooksSource"
}

New-Item -ItemType Directory -Force -Path $hooksTarget | Out-Null

foreach ($hookName in @('pre-commit', 'pre-push')) {
  $sourcePath = Join-Path $hooksSource $hookName
  $targetPath = Join-Path $hooksTarget $hookName
  Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
  Write-Host "Installed $hookName hook."
}

Write-Host 'Git hook installation complete.'
