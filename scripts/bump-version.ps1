[CmdletBinding()]
param(
  [switch]$CheckOnly,
  [switch]$StageUpdatedFiles,
  [switch]$UseWorkingTree,
  [string]$ReleaseNotes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RepoRoot {
  return (git rev-parse --show-toplevel).Trim()
}

function Get-Text([string]$Path) {
  return Get-Content -LiteralPath $Path -Raw
}

function Set-Text([string]$Path, [string]$Value) {
  Set-Content -LiteralPath $Path -Value $Value
}

function Get-VersionMap([string]$IndexHtml) {
  $match = [regex]::Match($IndexHtml, "window\.FILE_VERSIONS\s*=\s*\{\s*html:\s*'(?<html>[^']+)'\s*,\s*css:\s*'(?<css>[^']+)'\s*,\s*js:\s*'(?<js>[^']+)'\s*\s*\};")
  if (-not $match.Success) {
    throw "Unable to parse window.FILE_VERSIONS from index.html."
  }

  return @{
    html = $match.Groups['html'].Value
    css = $match.Groups['css'].Value
    js = $match.Groups['js'].Value
  }
}

function Increment-Version([string]$Version) {
  $parts = $Version.Split('.')
  if ($parts.Count -ne 3) {
    throw "Unsupported version format: $Version"
  }

  $patch = [int]$parts[2] + 1
  return '{0}.{1}.{2}' -f $parts[0], $parts[1], $patch
}

function Get-StagedFiles {
  $files = @(git diff --cached --name-only --diff-filter=ACMR)
  return $files | Where-Object { $_ } | ForEach-Object { $_.Trim() }
}

function Get-WorkingTreeFiles {
  $files = @(git diff --name-only --diff-filter=ACMR)
  return $files | Where-Object { $_ } | ForEach-Object { $_.Trim() }
}

function Test-VersionConsistency {
  param(
    [string]$IndexHtml,
    [string]$AppJs,
    [string]$StylesCss,
    [string]$VersionJsonText
  )

  $versions = Get-VersionMap $IndexHtml
  $versionJson = $VersionJsonText | ConvertFrom-Json

  $checks = @(
    @{ Label = 'index.html footer html version'; Pattern = "id=""ver-html"">index\.html v$([regex]::Escape($versions.html))<" ; Text = $IndexHtml }
    @{ Label = 'index.html footer css version'; Pattern = "id=""ver-css"">styles\.css v$([regex]::Escape($versions.css))<" ; Text = $IndexHtml }
    @{ Label = 'index.html footer js version'; Pattern = "id=""ver-js"">app\.js v$([regex]::Escape($versions.js))<" ; Text = $IndexHtml }
    @{ Label = 'styles.css header version'; Pattern = "/\* styles\.css @version $([regex]::Escape($versions.css)) \*/" ; Text = $StylesCss }
    @{ Label = 'app.js header version'; Pattern = "(?m)^// app\.js @version $([regex]::Escape($versions.js))$" ; Text = $AppJs }
    @{ Label = 'app.js runtime version'; Pattern = "window\.APP_VERSION='$([regex]::Escape($versions.js))'" ; Text = $AppJs }
    @{ Label = 'app.js footer version'; Pattern = "app\.js v$([regex]::Escape($versions.js))" ; Text = $AppJs }
    @{ Label = 'version.json app version'; Pattern = '"version"\s*:\s*"' + [regex]::Escape($versions.js) + '"' ; Text = $VersionJsonText }
    @{ Label = 'version.json js version'; Pattern = '"js"\s*:\s*"' + [regex]::Escape($versions.js) + '"' ; Text = $VersionJsonText }
    @{ Label = 'version.json html version'; Pattern = '"html"\s*:\s*"' + [regex]::Escape($versions.html) + '"' ; Text = $VersionJsonText }
    @{ Label = 'version.json css version'; Pattern = '"css"\s*:\s*"' + [regex]::Escape($versions.css) + '"' ; Text = $VersionJsonText }
  )

  $failures = @()
  foreach ($check in $checks) {
    if (-not [regex]::IsMatch($check.Text, $check.Pattern)) {
      $failures += $check.Label
    }
  }

  if ($versionJson.version -ne $versions.js) {
    $failures += 'version.json version field does not match js version'
  }

  return $failures
}

$repoRoot = Get-RepoRoot
$indexPath = Join-Path $repoRoot 'index.html'
$appPath = Join-Path $repoRoot 'app.js'
$stylesPath = Join-Path $repoRoot 'styles.css'
$versionJsonPath = Join-Path $repoRoot 'version.json'

$indexHtml = Get-Text $indexPath
$appJs = Get-Text $appPath
$stylesCss = Get-Text $stylesPath
$versionJsonText = Get-Text $versionJsonPath

if ($CheckOnly) {
  $failures = @(Test-VersionConsistency -IndexHtml $indexHtml -AppJs $appJs -StylesCss $stylesCss -VersionJsonText $versionJsonText)
  if ($failures.Count -gt 0) {
    Write-Error ("Version metadata is out of sync:`n - " + ($failures -join "`n - "))
  }
  Write-Host 'Version metadata is in sync.'
  exit 0
}

$candidateFiles = if ($UseWorkingTree) { Get-WorkingTreeFiles } else { Get-StagedFiles }
$jsBucketFiles = @($candidateFiles | Where-Object { $_ -in @('app.js', 'sw.js', 'manifest.json', 'version.json') })
$trackedChanges = @{
  html = $candidateFiles -contains 'index.html'
  css = $candidateFiles -contains 'styles.css'
  js = ($jsBucketFiles.Count -gt 0)
}

if (-not ($trackedChanges.html -or $trackedChanges.css -or $trackedChanges.js)) {
  Write-Host 'No staged versioned files changed. Skipping version bump.'
  exit 0
}

$versions = Get-VersionMap $indexHtml
$newHtmlVersion = if ($trackedChanges.html) { Increment-Version $versions.html } else { $versions.html }
$newCssVersion = if ($trackedChanges.css) { Increment-Version $versions.css } else { $versions.css }
$newJsVersion = if ($trackedChanges.js) { Increment-Version $versions.js } else { $versions.js }

$localNow = Get-Date
$codeUpdated = $localNow.ToString('MM/dd/yyyy h:mm tt')
$utcTimestamp = $localNow.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$releaseNoteText = if ($ReleaseNotes) {
  $ReleaseNotes
} else {
  $changedBuckets = @()
  if ($trackedChanges.html) { $changedBuckets += 'html' }
  if ($trackedChanges.css) { $changedBuckets += 'css' }
  if ($trackedChanges.js) { $changedBuckets += 'js' }
  'Auto-synced version metadata for changed files: ' + ($changedBuckets -join ', ')
}

$indexHtml = [regex]::Replace($indexHtml, "window\.FILE_VERSIONS\s*=\s*\{\s*html:\s*'[^']+'\s*,\s*css:\s*'[^']+'\s*,\s*js:\s*'[^']+'\s*\s*\};", "window.FILE_VERSIONS = { html: '$newHtmlVersion', css: '$newCssVersion', js: '$newJsVersion' };")
$indexHtml = [regex]::Replace($indexHtml, 'id="ver-html">index\.html v[^<]+<', "id=`"ver-html`">index.html v$newHtmlVersion<")
$indexHtml = [regex]::Replace($indexHtml, 'id="ver-css">styles\.css v[^<]+<', "id=`"ver-css`">styles.css v$newCssVersion<")
$indexHtml = [regex]::Replace($indexHtml, 'id="ver-js">app\.js v[^<]+<', "id=`"ver-js`">app.js v$newJsVersion<")
$indexHtml = [regex]::Replace($indexHtml, 'id="lastUpdated"[^>]*>[^<]+<', "id=`"lastUpdated`" style=`"font-size:0.75rem; opacity:0.7;`">- Code updated: $codeUpdated<")

$stylesCss = [regex]::Replace($stylesCss, '/\* styles\.css @version [^*]+\*/', "/* styles.css @version $newCssVersion */")

$appJs = [regex]::Replace($appJs, '(?m)^// app\.js @version .+$', "// app.js @version $newJsVersion")
$appJs = [regex]::Replace($appJs, "window\.APP_VERSION='[^']+'", "window.APP_VERSION='$newJsVersion'")
$appJs = [regex]::Replace($appJs, "const CODE_UPDATED = '[^']+';", "const CODE_UPDATED = '$codeUpdated';")
$appJs = [regex]::Replace($appJs, 'app\.js v\d+\.\d+\.\d+', "app.js v$newJsVersion")

$versionJson = $versionJsonText | ConvertFrom-Json
$versionJson.version = $newJsVersion
$versionJson.html = $newHtmlVersion
$versionJson.css = $newCssVersion
$versionJson.js = $newJsVersion
$versionJson.timestamp = $utcTimestamp
$versionJson.releaseNotes = $releaseNoteText
$newVersionJsonText = ($versionJson | ConvertTo-Json -Depth 5)

Set-Text $indexPath $indexHtml
Set-Text $stylesPath $stylesCss
Set-Text $appPath $appJs
Set-Text $versionJsonPath $newVersionJsonText

if ($StageUpdatedFiles) {
  git add -- index.html styles.css app.js version.json | Out-Null
}

Write-Host "Updated versions -> html: $newHtmlVersion, css: $newCssVersion, js: $newJsVersion"
