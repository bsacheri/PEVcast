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

function Get-CacheVersion([string]$HtmlVersion, [string]$CssVersion, [string]$JsVersion) {
  return "vhtml-$HtmlVersion-css-$CssVersion-js-$JsVersion"
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
    [string]$ServiceWorker,
    [string]$VersionJsonText
  )

  $versions = Get-VersionMap $IndexHtml
  $versionJson = $VersionJsonText | ConvertFrom-Json
  $cacheVersion = Get-CacheVersion -HtmlVersion $versions.html -CssVersion $versions.css -JsVersion $versions.js

  $checks = @(
    @{ Label = 'index.html footer html version'; Pattern = "id=""ver-html"">index\.html v$([regex]::Escape($versions.html))<" ; Text = $IndexHtml }
    @{ Label = 'index.html footer css version'; Pattern = "id=""ver-css"">styles\.css v$([regex]::Escape($versions.css))<" ; Text = $IndexHtml }
    @{ Label = 'index.html footer js version'; Pattern = "id=""ver-js"">app\.js v$([regex]::Escape($versions.js))<" ; Text = $IndexHtml }
    @{ Label = 'styles.css header version'; Pattern = "/\* styles\.css @version $([regex]::Escape($versions.css)) \*/" ; Text = $StylesCss }
    @{ Label = 'app.js header version'; Pattern = "(?m)^// app\.js @version $([regex]::Escape($versions.js))\r?$" ; Text = $AppJs }
    @{ Label = 'app.js runtime version'; Pattern = "window\.APP_VERSION='$([regex]::Escape($versions.js))'" ; Text = $AppJs }
    @{ Label = 'app.js footer version'; Pattern = "app\.js v$([regex]::Escape($versions.js))" ; Text = $AppJs }
    @{ Label = 'sw.js cache version'; Pattern = "const CACHE_VERSION = '$([regex]::Escape($cacheVersion))';" ; Text = $ServiceWorker }
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

function Add-Note {
  param(
    [hashtable]$Groups,
    [string]$Group,
    [string]$Text
  )

  if (-not $Groups.ContainsKey($Group)) {
    $Groups[$Group] = New-Object System.Collections.Generic.List[string]
  }
  if (-not $Groups[$Group].Contains($Text)) {
    $Groups[$Group].Add($Text)
  }
}

function Get-ChangedDiffText {
  param(
    [string[]]$Files,
    [bool]$UseWorkingTreeDiff
  )

  if (-not $Files -or $Files.Count -eq 0) {
    return ''
  }

  $args = if ($UseWorkingTreeDiff) { @('diff', '--') } else { @('diff', '--cached', '--') }
  $args += $Files
  return (& git @args) -join "`n"
}

function Get-RevisionLogGroups {
  param(
    [string[]]$Files,
    [string]$DiffText
  )

  $groups = @{}
  $joinedFiles = ($Files -join ' ')

  if ($joinedFiles -match 'app\.js') {
    Add-Note $groups 'Maintenance' 'Updated application behavior in app.js.'
  }
  if ($joinedFiles -match 'index\.html') {
    Add-Note $groups 'Maintenance' 'Updated the page shell or version metadata in index.html.'
  }
  if ($joinedFiles -match 'styles\.css') {
    Add-Note $groups 'Maintenance' 'Updated shared styling in styles.css.'
  }
  if ($joinedFiles -match 'sw\.js|manifest\.json|version\.json') {
    Add-Note $groups 'Versioning' 'Updated PWA, cache, or published version metadata.'
  }

  if ($DiffText -match 'weatherData|Weather Data|Hourly Weather Data|dataTable|formatWeatherDataHeader|Wind Dir|Chance \(%\)|Precip \(mm\)|REVISION_LOG') {
    Add-Note $groups 'Weather Data Popup' 'Updated the Hourly Weather Data popup display, selection, or copy behavior.'
  }
  if ($DiffText -match 'quickList|Locations|GPS|reverseGeocode|Nominatim|BigDataCloud|LOCATIONS_STORAGE|DEFAULT_LOCATION') {
    Add-Note $groups 'Locations' 'Updated saved locations, GPS defaults, or reverse-geocoding behavior.'
  }
  if ($DiffText -match 'buildChart|dayLabels|x-axis|Visible Hours|pastHoursHatching|now-line|Chart\.|annotation|gradient|Wind Speed') {
    Add-Note $groups 'Chart' 'Updated chart rendering, annotations, labels, or weather overlays.'
  }
  if ($DiffText -match 'ensureAppMenu|mWindLine|mApparent|Dark Theme|Clear Cache|About|Revision Log|showAboutDialog') {
    Add-Note $groups 'Menu and Dialogs' 'Updated menu options, About dialog controls, or app dialogs.'
  }
  if ($DiffText -match 'fetch\(|api\.open-meteo|nominatim|bigdatacloud|version\.json|cache_bust') {
    Add-Note $groups 'API' 'Updated browser-side API calls, fallback handling, or cache-busting behavior.'
  }
  if ($DiffText -match 'bump-version|pre-commit|pre-push|releaseNotes|FILE_VERSIONS|APP_VERSION|CACHE_VERSION') {
    Add-Note $groups 'Versioning' 'Updated version automation, release notes, or cache-version syncing.'
  }

  if ($groups.Count -eq 0) {
    Add-Note $groups 'Maintenance' 'Updated project files; review the diff for final release-note wording.'
  }

  return $groups
}

function New-RevisionLogEntry {
  param(
    [string]$Version,
    [datetime]$PublishedAt,
    [hashtable]$Groups
  )

  $lines = New-Object System.Collections.Generic.List[string]
  $lines.Add('---')
  $lines.Add('')
  $lines.Add("## $Version - $($PublishedAt.ToString('yyyy-MM-dd'))")
  $lines.Add('')
  $lines.Add('> REVIEW ME: Auto-generated during version sync. Edit these notes before publishing if more detail or different grouping would help.')
  $lines.Add('')

  foreach ($groupName in @('Chart', 'Menu and Dialogs', 'Weather Data Popup', 'Locations', 'API', 'Versioning', 'Maintenance')) {
    if (-not $Groups.ContainsKey($groupName)) { continue }
    $lines.Add("### $groupName")
    foreach ($note in $Groups[$groupName]) {
      $lines.Add("- $note")
    }
    $lines.Add('')
  }

  return (($lines -join "`n").TrimEnd() + "`n")
}

function Get-ReleaseNotesSummary {
  param([hashtable]$Groups)

  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($groupName in @('Chart', 'Menu and Dialogs', 'Weather Data Popup', 'Locations', 'API', 'Versioning', 'Maintenance')) {
    if (-not $Groups.ContainsKey($groupName)) { continue }
    $first = $Groups[$groupName][0]
    $parts.Add("${groupName}: $first")
    if ($parts.Count -ge 3) { break }
  }
  if ($parts.Count -eq 0) { return 'Updated app behavior and version metadata.' }
  return ($parts -join ' ')
}

function Prepend-RevisionLogEntry {
  param(
    [string]$Path,
    [string]$Entry
  )

  $heading = "# PEVcast Revision Log`n`n"
  $existing = if (Test-Path -LiteralPath $Path) { Get-Text $Path } else { '' }
  if ([string]::IsNullOrWhiteSpace($existing)) {
    Set-Text $Path ($heading + $Entry)
    return
  }
  if ($existing.StartsWith($heading)) {
    $body = $existing.Substring($heading.Length).TrimStart()
    Set-Text $Path ($heading + $Entry + "`n" + $body)
    return
  }
  Set-Text $Path ($heading + $Entry + "`n" + $existing.TrimStart())
}

$repoRoot = Get-RepoRoot
$indexPath = Join-Path $repoRoot 'index.html'
$appPath = Join-Path $repoRoot 'app.js'
$stylesPath = Join-Path $repoRoot 'styles.css'
$serviceWorkerPath = Join-Path $repoRoot 'sw.js'
$versionJsonPath = Join-Path $repoRoot 'version.json'
$revisionLogPath = Join-Path $repoRoot 'REVISION_LOG.md'

$indexHtml = Get-Text $indexPath
$appJs = Get-Text $appPath
$stylesCss = Get-Text $stylesPath
$serviceWorker = Get-Text $serviceWorkerPath
$versionJsonText = Get-Text $versionJsonPath

if ($CheckOnly) {
  $failures = @(Test-VersionConsistency -IndexHtml $indexHtml -AppJs $appJs -StylesCss $stylesCss -ServiceWorker $serviceWorker -VersionJsonText $versionJsonText)
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
$newCacheVersion = Get-CacheVersion -HtmlVersion $newHtmlVersion -CssVersion $newCssVersion -JsVersion $newJsVersion

$localNow = Get-Date
$codeUpdated = $localNow.ToString('MM/dd/yyyy h:mm tt')
$utcTimestamp = $localNow.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$diffText = Get-ChangedDiffText -Files $candidateFiles -UseWorkingTreeDiff ([bool]$UseWorkingTree)
$revisionGroups = Get-RevisionLogGroups -Files $candidateFiles -DiffText $diffText
$releaseNoteText = if ($ReleaseNotes) {
  $ReleaseNotes
} else {
  Get-ReleaseNotesSummary -Groups $revisionGroups
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

$serviceWorker = [regex]::Replace($serviceWorker, "const CACHE_VERSION = 'v[^']+';", "const CACHE_VERSION = '$newCacheVersion';")

$versionJson = $versionJsonText | ConvertFrom-Json
$versionJson.version = $newJsVersion
$versionJson.html = $newHtmlVersion
$versionJson.css = $newCssVersion
$versionJson.js = $newJsVersion
$versionJson.timestamp = $utcTimestamp
$versionJson.releaseNotes = $releaseNoteText
$newVersionJsonText = ($versionJson | ConvertTo-Json -Depth 5)

if ($trackedChanges.js) {
  $revisionEntry = New-RevisionLogEntry -Version $newJsVersion -PublishedAt $localNow -Groups $revisionGroups
  Prepend-RevisionLogEntry -Path $revisionLogPath -Entry $revisionEntry
}

Set-Text $indexPath $indexHtml
Set-Text $stylesPath $stylesCss
Set-Text $appPath $appJs
Set-Text $serviceWorkerPath $serviceWorker
Set-Text $versionJsonPath $newVersionJsonText

if ($StageUpdatedFiles) {
  git add -- index.html styles.css app.js sw.js version.json REVISION_LOG.md | Out-Null
}

Write-Host "Updated versions -> html: $newHtmlVersion, css: $newCssVersion, js: $newJsVersion"
