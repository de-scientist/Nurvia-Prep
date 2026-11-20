<#
.SYNOPSIS
    Wave-2 manifest generator: classifies the live dirty set into dependency-ordered
    engineering units and writes tools/git/wave2-manifest.json.
.DESCRIPTION
    Reads `git status --porcelain` as the single source of truth (never a hand-typed list),
    expands untracked directory entries into their real files, assigns every file to exactly
    one unit via ordered prefix rules, and fails loudly if any file is unclassified or
    duplicated. Also asserts every commit subject is unique against existing git history.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repo = 'C:\Users\gitau\Documents\Nurvia-Prep'
Set-Location $repo

# ------------------------------------------------------- 1. Live dirty set
$raw = & git status --porcelain
$entries = @($raw | ForEach-Object { $_.Substring(3).Trim().Trim('"') } | Where-Object { $_ })

$files = New-Object System.Collections.Generic.List[string]]
$excluded = New-Object System.Collections.Generic.List[string]

foreach ($e in $entries) {
    if ($e -eq 'tools/git/.gitignore') { $files.Add($e); continue }   # tracked tooling file: commit it
    if ($e -like 'tools/git/*') { continue }          # engine runtime artifacts
    $isDir = $e.EndsWith('/')
    if ($isDir) {
        $lit = $e.Substring(0, $e.Length - 1)
        if (-not (Test-Path -LiteralPath $lit)) { throw "Directory entry missing on disk: $e" }
        $inner = Get-ChildItem -LiteralPath $lit -Recurse -File
        foreach ($f in $inner) {
            $rel = $f.FullName.Substring($repo.Length + 1).Replace('\', '/')
            if ($rel.StartsWith('.gemini/')) { $excluded.Add($rel) } else { $files.Add($rel) }
        }
    } else {
        if ($e.StartsWith('.gemini/')) { $excluded.Add($e) } else { $files.Add($e) }
    }
}

$files = @($files | Sort-Object -Unique)
$excluded = @($excluded | Sort-Object -Unique)

# ------------------------------------------------------- 2. Classification rules
# Ordered prefix rules; first match wins. Prefix checks only (no wildcard parsing),
# so paths containing [ ] ( ) are handled safely.
$unitRules = [ordered]@{
    'git-tooling' = @('exact:tools/git/.gitignore')
    'lib-api-core' = @('exact:src/lib/api-client.ts', 'exact:src/lib/api-types.ts', 'exact:src/lib/api-url.mjs')
    'lib-lexmacasto' = @('pre:src/lib/lexmacasto/')
    'lib-content-normalizer' = @('pre:src/lib/content/')
    'lib-attempts' = @('pre:src/lib/attempts/')
    'lib-qotd' = @('pre:src/lib/qotd/')
    'lib-analytics' = @('pre:src/lib/analytics/')
    'api-attempts' = @('pre:src/app/api/attempts/', 'pre:src/app/api/exams/')
    'api-auth' = @('pre:src/app/api/auth/')
    'api-content' = @('pre:src/app/api/qotd/', 'pre:src/app/api/study-library/', 'pre:src/app/api/strata/',
                      'pre:src/app/api/nexus/', 'pre:src/app/api/community/', 'pre:src/app/api/insights/')
    'comp-exam-renderers' = @('pre:src/components/exam/')
    'comp-shared' = @('pre:src/components/auth/', 'pre:src/components/layout/', 'pre:src/components/shared/')
    'comp-home-study' = @('pre:src/components/home/', 'pre:src/components/study/')
    'comp-analytics' = @('pre:src/components/analytics/')
    'page-livexams' = @('pre:src/app/web/')
    'page-dashboard-nav' = @('pre:src/app/dashboards/')
    'page-learner' = @('pre:src/app/learner/', 'exact:src/app/exam-session/page.tsx', 'exact:src/app/access-denied/page.tsx')
    'page-admin' = @('pre:src/app/admin/')
    'page-auth-web' = @('pre:src/app/(web)/')
    'page-home' = @('exact:src/app/page.tsx', 'exact:src/app/globals.css')
    'page-groups-qotd' = @('pre:src/app/groups/', 'pre:src/app/qotd/', 'pre:src/app/insights/')
    'page-marketing' = @('pre:src/app/')            # catch-all for remaining app pages
    'tests' = @('pre:tests/')
    'docs' = @('pre:docs/')
}

function Test-MatchesRule {
    param([string]$Path, [string[]]$Patterns)
    foreach ($pat in $Patterns) {
        if ($pat.StartsWith('exact:')) { if ($Path -eq $pat.Substring(6)) { return $true } }
        elseif ($pat.StartsWith('pre:')) { if ($Path.StartsWith($pat.Substring(4))) { return $true } }
    }
    return $false
}

$assignments = @{}   # unit -> List[string]
foreach ($id in $unitRules.Keys) { $assignments[$id] = New-Object System.Collections.Generic.List[string] }

$unclassified = @()
foreach ($f in $files) {
    $placed = $false
    foreach ($id in $unitRules.Keys) {
        if (Test-MatchesRule -Path $f -Patterns $unitRules[$id]) { $assignments[$id].Add($f); $placed = $true; break }
    }
    if (-not $placed) { $unclassified += $f }
}
if ($unclassified.Count -gt 0) {
    throw "UNCLASSIFIED FILES ($($unclassified.Count)):`n$($unclassified -join "`n")"
}

# Duplicate detection across units
$seen = @{}
$dups = @()
foreach ($id in $unitRules.Keys) {
    foreach ($f in $assignments[$id]) {
        if ($seen.ContainsKey($f)) { $dups += "$f in '$($seen[$f])' and '$id'" } else { $seen[$f] = $id }
    }
}
if ($dups.Count -gt 0) { throw "DUPLICATE ASSIGNMENTS:`n$($dups -join "`n")" }

# ------------------------------------------------------- 3. Unit metadata
$meta = [ordered]@{
    'git-tooling'            = @{ unit = 'Git Tooling';           msg = 'chore(tools): ignore engine runtime artifacts in git tooling directory'
                                  body = 'Ignore integration engine runtime artifacts (state, logs, results, baselines) so they never enter history.'
                                  deps = @() }
    'lib-api-core'           = @{ unit = 'Core API Layer';        msg = 'feat(api): normalize client request contracts and endpoint helpers'
                                  body = 'Normalize the shared API client, request contracts and endpoint URL helpers used by every feature surface.'
                                  deps = @() }
    'lib-lexmacasto'         = @{ unit = 'LexmaCasto Transport';  msg = 'feat(lexmacasto): harden transport client and sanitize support payloads'
                                  body = 'Harden the LexmaCasto transport client, refresh contracts and add support payload sanitization.'
                                  deps = @('lib-api-core') }
    'lib-content-normalizer' = @{ unit = 'Content Normalization'; msg = 'feat(content): extend clinical HTML normalization for question parity'
                                  body = 'Extend clinical HTML normalization so rendered question content matches source material.'
                                  deps = @('lib-api-core') }
    'lib-attempts'           = @{ unit = 'Attempt State';         msg = 'feat(attempts): add live exam loader and strata answer adapters'
                                  body = 'Add live exam loading, strata answer adaptation and attempt persistence helpers.'
                                  deps = @('lib-api-core', 'lib-lexmacasto') }
    'lib-qotd'               = @{ unit = 'Question of the Day';   msg = 'feat(qotd): extract daily question core service and store'
                                  body = 'Extract the daily question core service and store from the QOTD feature surface.'
                                  deps = @('lib-api-core') }
    'lib-analytics'          = @{ unit = 'Analytics Library';     msg = 'feat(analytics): add learner performance analytics library'
                                  body = 'Add the learner performance analytics library that feeds reporting components.'
                                  deps = @('lib-api-core') }
    'api-attempts'           = @{ unit = 'Attempt API Routes';    msg = 'feat(attempt-api): align attempt lifecycle endpoints with review and tutor flows'
                                  body = 'Align attempt lifecycle, response capture, review and tutor endpoints with the new attempt state layer.'
                                  deps = @('lib-attempts') }
    'api-auth'               = @{ unit = 'Auth API Routes';       msg = 'feat(auth-api): update social sign-in and account support endpoints'
                                  body = 'Update social sign-in providers and account support endpoints for verification, 2FA and messaging.'
                                  deps = @('lib-lexmacasto') }
    'api-content'            = @{ unit = 'Content API Routes';    msg = 'feat(content-api): update qotd, study library and strata endpoints'
                                  body = 'Update question-of-the-day, study library, strata and community endpoints.'
                                  deps = @('lib-qotd', 'lib-api-core') }
    'comp-exam-renderers'    = @{ unit = 'Exam Renderers';        msg = 'feat(exam-renderers): add integrity, hotspot and rationale renderers'
                                  body = 'Add content integrity, hotspot and rationale renderers alongside the existing question renderer set.'
                                  deps = @('lib-content-normalizer', 'lib-attempts') }
    'comp-shared'            = @{ unit = 'Shared Components';     msg = 'feat(shared): update avatar, feedback and application shells'
                                  body = 'Update the user avatar, feedback handlers and application shell layouts.'
                                  deps = @('lib-api-core') }
    'comp-home-study'        = @{ unit = 'Home & Study Components'; msg = 'feat(home-study): update home previews and study library cards'
                                  body = 'Update homepage preview components and study library card interactions.'
                                  deps = @('lib-api-core') }
    'comp-analytics'         = @{ unit = 'Analytics Components';  msg = 'feat(analytics): add learner performance chart components'
                                  body = 'Add score, category, track and progression chart components backed by the analytics library.'
                                  deps = @('lib-analytics') }
    'page-livexams'          = @{ unit = 'Live Exam Layouts';     msg = 'feat(live-exams): harmonize exam layout navigation and standalone question types'
                                  body = 'Harmonize the upper sticky navigation across all live exam layouts and standalone question types.'
                                  deps = @('comp-exam-renderers') }
    'page-dashboard-nav'     = @{ unit = 'Dashboard Navigation';  msg = 'feat(dashboards): update track navbar shells'
                                  body = 'Update the navbar shell shared by all six exam track dashboards.'
                                  deps = @('comp-shared') }
    'page-learner'           = @{ unit = 'Learner Pages';         msg = 'feat(learner): update learner hub, attempts and performance pages'
                                  body = 'Update learner hub, attempt history, performance and profile pages.'
                                  deps = @('comp-shared', 'comp-analytics') }
    'page-admin'             = @{ unit = 'Admin Pages';           msg = 'feat(admin): update exam, question and review management pages'
                                  body = 'Update admin exam, question and review management pages.'
                                  deps = @('comp-shared') }
    'page-auth-web'          = @{ unit = 'Web Auth Pages';        msg = 'feat(auth-pages): update web logout page'
                                  body = 'Update the public web logout page flow.'
                                  deps = @('comp-shared') }
    'page-home'              = @{ unit = 'Homepage';              msg = 'feat(home): refresh homepage layout and global styles'
                                  body = 'Refresh the homepage entry layout and the global stylesheet it depends on.'
                                  deps = @('comp-home-study') }
    'page-groups-qotd'       = @{ unit = 'Engagement Pages';      msg = 'feat(engagement): update groups, insights and question-of-the-day pages'
                                  body = 'Update study groups, community insights and question-of-the-day pages.'
                                  deps = @('comp-shared') }
    'page-marketing'         = @{ unit = 'Marketing & Directory Pages'; msg = 'feat(pages): refresh marketing, study and directory pages'
                                  body = 'Refresh marketing, study, directory and utility pages across the public site.'
                                  deps = @('comp-home-study') }
    'tests'                  = @{ unit = 'Verification Suites';   msg = 'test(exams): add lifecycle, delivery, scoring and navbar verification suites'
                                  body = 'Add automated verification suites covering exam lifecycle, question delivery, scoring and navbar auth flows.'
                                  deps = @('api-attempts', 'api-auth', 'api-content', 'comp-exam-renderers',
                                           'page-livexams', 'page-dashboard-nav', 'page-learner') }
    'docs'                   = @{ unit = 'Documentation';         msg = 'docs(reports): add code cleanup remediation report'
                                  body = 'Publish the code cleanup remediation report describing the applied cleanup.'
                                  deps = @() }
}

# ------------------------------------------------------- 4. Uniqueness vs history
$history = @(& git log --format=%s)
$historySet = New-Object 'System.Collections.Generic.HashSet[string]'
foreach ($h in $history) { [void]$historySet.Add($h) }

$units = @()
foreach ($id in $unitRules.Keys) {
    $m = $meta[$id]
    if (-not $m) { throw "Missing metadata for unit '$id'" }
    if ($historySet.Contains($m.msg)) { throw "Subject already exists in history for '$id': $($m.msg)" }
    $units += [pscustomobject]@{
        id       = $id
        unit     = $m.unit
        message  = $m.msg
        body     = $m.body
        dependsOn = @($m.deps)
        files    = @($assignments[$id] | Sort-Object)
    }
}

# ------------------------------------------------------- 5. Milestones
$validateAfter = @(
    [pscustomobject]@{ afterUnit = 'api-auth';      label = 'post-auth-api'; commands = @('npx tsc --noEmit', 'npm run lint') }
    [pscustomobject]@{ afterUnit = 'page-marketing'; label = 'post-pages';    commands = @('npx tsc --noEmit', 'npm run lint') }
    [pscustomobject]@{ afterUnit = 'tests';          label = 'pre-push';      commands = @('npx tsc --noEmit', 'npm run lint', 'npm run build') }
)

# ------------------------------------------------------- 6. Write manifest
$manifest = [pscustomobject]@{
    manifestVersion = 2
    repository      = 'Nurvia-Prep'
    targetBranch    = 'main'
    units           = $units
    excluded        = @($excluded)
    validateAfter   = $validateAfter
}

$outPath = Join-Path $repo 'tools\git\wave2-manifest.json'
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $outPath -Encoding UTF8

# ------------------------------------------------------- 7. Report
$assignedTotal = ($units | ForEach-Object { $_.files.Count } | Measure-Object -Sum).Sum
Write-Host "Dirty entries read:   $($entries.Count)"
Write-Host "Candidate files:      $($files.Count)"
Write-Host "Assigned to units:    $assignedTotal"
Write-Host "Excluded:             $($excluded.Count)  [$($excluded -join ', ')]"
Write-Host "Units:                $($units.Count)"
Write-Host ""
foreach ($u in $units) {
    Write-Host ("  {0,-24} {1,3} file(s)  deps=[{2}]" -f $u.id, $u.files.Count, ($u.dependsOn -join ', '))
}
if ($assignedTotal -ne $files.Count) { throw "COVERAGE MISMATCH: assigned $assignedTotal != candidates $($files.Count)" }
Write-Host ""
Write-Host "Manifest written: $outPath"
