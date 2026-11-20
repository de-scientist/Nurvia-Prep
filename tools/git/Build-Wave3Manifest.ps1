<#
.SYNOPSIS
    Wave-3 manifest generator: classifies the residual dirty set after the concurrent
    agent completed waves 1-2, and writes tools/git/wave3-manifest.json.
.DESCRIPTION
    Reads `git status --porcelain` as the single source of truth, expands untracked
    directory entries, assigns every file to exactly one unit via ordered prefix rules,
    and fails loudly if any file is unclassified or duplicated. Also asserts every commit
    subject is unique against existing git history.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\gitau\Documents\Nurvia-Prep'
Set-Location $repo

# ------------------------------------------------------- 1. Live dirty set
$raw = & git status --porcelain
$entries = @($raw | ForEach-Object { $_.Substring(3).Trim().Trim('"') } | Where-Object { $_ })

$files = New-Object System.Collections.Generic.List[string]
$excluded = New-Object System.Collections.Generic.List[string]

foreach ($e in $entries) {
    $isDir = $e.EndsWith('/')
    if ($isDir) {
        $lit = $e.Substring(0, $e.Length - 1)
        if (-not (Test-Path -LiteralPath $lit)) { throw "Directory entry missing on disk: $e" }
        foreach ($f in (Get-ChildItem -LiteralPath $lit -Recurse -File)) {
            $rel = $f.FullName.Substring($repo.Length + 1).Replace('\', '/')
            if ($rel.StartsWith('.gemini/')) { $excluded.Add($rel) } else { $files.Add($rel) }
        }
    } else {
        if ($e.StartsWith('.gemini/')) { $excluded.Add($e) } else { $files.Add($e) }
    }
}
$files    = @($files    | Sort-Object -Unique)
$excluded = @($excluded | Sort-Object -Unique)

# ------------------------------------------------------- 2. Classification rules
# Prefix/exact checks only - no wildcard parsing, so [ ] ( ) in paths are safe.
$unitRules = [ordered]@{
    'git-tooling'   = @('exact:.gitignore', 'pre:tools/git/')
    'lib-api-core'  = @('exact:src/lib/api-client.ts', 'exact:src/lib/api-types.ts')
    'lib-attempts'  = @('pre:src/lib/attempts/')
    'api-tutor'     = @('pre:src/app/api/attempts/')
    'comp-tutor'    = @('exact:src/components/exam/TutorModePanel.tsx', 'pre:tests/')
    'comp-study'    = @('pre:src/components/study/')
    'pages-session' = @('exact:src/app/exam-session/page.tsx', 'exact:src/app/page.tsx',
                        'exact:src/components/layout/learner-shell.tsx')
    'docs'          = @('pre:docs/', 'rootmd:')                       # root-level *.md catch-all
}

function Test-MatchesRule {
    param([string]$Path, [string[]]$Patterns)
    foreach ($pat in $Patterns) {
        if     ($pat -eq 'rootmd:')   { if ($Path -notlike '*/*' -and $Path.ToLower().EndsWith('.md')) { return $true } }
        elseif ($pat.StartsWith('exact:')) { if ($Path -eq $pat.Substring(6)) { return $true } }
        elseif ($pat.StartsWith('pre:'))   { if ($Path.StartsWith($pat.Substring(4))) { return $true } }
    }
    return $false
}

$assignments = @{}
foreach ($id in $unitRules.Keys) { $assignments[$id] = New-Object System.Collections.Generic.List[string] }

$unclassified = @()
foreach ($f in $files) {
    $placed = $false
    foreach ($id in $unitRules.Keys) {
        if (Test-MatchesRule -Path $f -Patterns $unitRules[$id]) { $assignments[$id].Add($f); $placed = $true; break }
    }
    if (-not $placed) { $unclassified += $f }
}
if ($unclassified.Count -gt 0) { throw "UNCLASSIFIED FILES ($($unclassified.Count)):`n$($unclassified -join "`n")" }

$seen = @{}; $dups = @()
foreach ($id in $unitRules.Keys) { foreach ($f in $assignments[$id]) {
    if ($seen.ContainsKey($f)) { $dups += "$f in '$($seen[$f])' and '$id'" } else { $seen[$f] = $id } } }
if ($dups.Count -gt 0) { throw "DUPLICATE ASSIGNMENTS:`n$($dups -join "`n")" }

# ------------------------------------------------------- 3. Unit metadata
$meta = [ordered]@{
    'git-tooling'   = @{ unit = 'Git Tooling'
                         msg = 'chore(tooling): extend git ignore rules and add manifest generator scripts'
                         body = 'Ignore engine scratch artifacts, ignore agent/ide directories, and commit the manifest generator and baseline capture scripts.'
                         deps = @() }
    'lib-api-core'  = @{ unit = 'Core API Layer'
                         msg = 'feat(api): refine client request mapping and shared DTO contracts'
                         body = 'Refine the shared API client request mapping and align shared DTO contracts.'
                         deps = @() }
    'lib-attempts'  = @{ unit = 'Attempt State'
                         msg = 'feat(attempts): harden attempt store and live exam loader'
                         body = 'Harden attempt persistence and the live exam loader used by active sessions.'
                         deps = @('lib-api-core') }
    'api-tutor'     = @{ unit = 'Attempt API Routes'
                         msg = 'fix(tutor): correct tutor answer evaluation endpoint semantics'
                         body = 'Correct tutor answer evaluation endpoint semantics against the attempt store.'
                         deps = @('lib-attempts') }
    'comp-tutor'    = @{ unit = 'Tutor Mode'
                         msg = 'test(tutor): cover tutor mode panel integrity with automated suite'
                         body = 'Add automated coverage for tutor mode panel integrity and evaluation flow.'
                         deps = @('api-tutor') }
    'comp-study'    = @{ unit = 'Study Components'
                         msg = 'feat(study): refine study library filters and card actions'
                         body = 'Refine study library filtering, card actions and the library view.'
                         deps = @('lib-api-core') }
    'pages-session' = @{ unit = 'Session Pages'
                         msg = 'feat(pages): update exam session, homepage and learner shell'
                         body = 'Update the exam session page, homepage entry and learner shell layout.'
                         deps = @('comp-study', 'lib-attempts') }
    'docs'          = @{ unit = 'Documentation'
                         msg = 'docs(reports): publish implementation completion and wave reports'
                         body = 'Publish the implementation completion, wave and cleanup reports.'
                         deps = @() }
}

# ------------------------------------------------------- 4. Uniqueness vs history
$historySet = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($h in (& git log --format=%s)) { [void]$historySet.Add($h) }

$units = @()
foreach ($id in $unitRules.Keys) {
    $m = $meta[$id]
    if (-not $m) { throw "Missing metadata for unit '$id'" }
    if ($historySet.Contains($m.msg)) { throw "Subject already exists in history for '$id': $($m.msg)" }
    $units += [pscustomobject]@{
        id        = $id
        unit      = $m.unit
        message   = $m.msg
        body      = $m.body
        dependsOn = @($m.deps)
        files     = @($assignments[$id] | Sort-Object)
    }
}

# ------------------------------------------------------- 5. Milestones
$validateAfter = @(
    [pscustomobject]@{ afterUnit = 'api-tutor';     label = 'post-core';   commands = @('npx tsc --noEmit', 'npm run lint') }
    [pscustomobject]@{ afterUnit = 'pages-session'; label = 'post-pages';  commands = @('npx tsc --noEmit', 'npm run lint') }
    [pscustomobject]@{ afterUnit = 'docs';          label = 'pre-push';    commands = @('npx tsc --noEmit', 'npm run lint', 'npm run build') }
)

# ------------------------------------------------------- 6. Write manifest
$manifest = [pscustomobject]@{
    manifestVersion = 3
    repository      = 'Nurvia-Prep'
    targetBranch    = 'main'
    units           = $units
    excluded        = @($excluded)
    validateAfter   = $validateAfter
}
$outPath = Join-Path $repo 'tools\git\wave3-manifest.json'
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $outPath -Encoding UTF8

# ------------------------------------------------------- 7. Report
$assignedTotal = ($units | ForEach-Object { $_.files.Count } | Measure-Object -Sum).Sum
Write-Host "Dirty entries read: $($entries.Count)"
Write-Host "Candidate files:    $($files.Count)"
Write-Host "Assigned to units:  $assignedTotal"
Write-Host "Excluded:           $($excluded.Count)  [$($excluded -join ', ')]"
Write-Host "Units:              $($units.Count)"
Write-Host ""
foreach ($u in $units) { Write-Host ("  {0,-15} {1,3} file(s)  deps=[{2}]" -f $u.id, $u.files.Count, ($u.dependsOn -join ', ')) }
if ($assignedTotal -ne $files.Count) { throw "COVERAGE MISMATCH: assigned $assignedTotal != candidates $($files.Count)" }
Write-Host ""
Write-Host "Manifest written: $outPath"
