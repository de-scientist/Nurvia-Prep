<#
.SYNOPSIS
    Wave-3 manifest generator: classifies the residual dirty set into dependency-ordered
    engineering units and writes tools/git/wave3-manifest.json.
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

$files    = New-Object System.Collections.Generic.List[string]
$excluded = New-Object System.Collections.Generic.List[string]

# Files deliberately held out of the commit units (never modified, never deleted - they stay
# on disk uncommitted and are reported in the final report's excluded/remaining inventory).
# docs/development/git-workflow.md line 99 trips the DB-CONNECTION rule with a literal
# documentation placeholder of the form `scheme://user:pass@host/db` (real db scheme in the
# file); it documents the audit's own rule #6 and contains no real credential.
# Verified: user segment "user", secret segment "pass".
$forceExclude = @('docs/development/git-workflow.md')

foreach ($e in $entries) {
    # Engine runtime artifacts are never committed (git-ignored ones never appear here;
    # these are the known scratch names that may not be ignored yet).
    if ($e -like 'tools/git/wave3-*' -or $e -like 'tools/git/baseline-*' -or
        $e -like 'tools/git/last-validate-*' -or $e -like 'tools/git/integration-log.txt' -or
        $e -like 'tools/git/dryrun-output.txt' -or $e -like 'tools/git/candidate_files.json') {
        continue
    }
    $isDir = $e.EndsWith('/')
    if ($isDir) {
        $lit = $e.Substring(0, $e.Length - 1)
        if (-not (Test-Path -LiteralPath $lit)) { throw "Directory entry missing on disk: $e" }
        foreach ($f in (Get-ChildItem -LiteralPath $lit -Recurse -File)) {
            $rel = $f.FullName.Substring($repo.Length + 1).Replace('\', '/')
            if ($rel.StartsWith('.gemini/') -or $forceExclude -contains $rel) { $excluded.Add($rel) } else { $files.Add($rel) }
        }
    } else {
        if ($e.StartsWith('.gemini/') -or $forceExclude -contains $e) { $excluded.Add($e) } else { $files.Add($e) }
    }
}
$files    = @($files    | Sort-Object -Unique)
$excluded = @($excluded | Sort-Object -Unique)

# ------------------------------------------------------- 2. Classification rules
# Ordered prefix/exact rules; first match wins. Prefix checks only (no wildcard parsing),
# so paths containing [ ] ( ) are handled safely.
$unitRules = [ordered]@{
    'git-tooling'      = @('pre:tools/git/')
    'config-root'      = @('exact:next.config.ts', 'exact:src/app/layout.tsx')
    'lib-api-core'     = @('exact:src/lib/api-client.ts', 'exact:src/lib/api-types.ts',
                           'exact:src/lib/lexmacasto/client.ts')
    'lib-attempts'     = @('pre:src/lib/attempts/', 'pre:src/lib/hooks/')
    'api-tutor'        = @('pre:src/app/api/attempts/')
    'api-auth'         = @('pre:src/app/api/auth/')
    'ui-theme'         = @('pre:src/lib/contexts/', 'pre:src/components/ui/')
    'feedback-loading' = @('exact:src/app/loading.tsx', 'pre:src/components/shared/feedback/',
                           'exact:src/components/common/dashboards/elements/DashboardPreloader.tsx',
                           'exact:src/components/exam/ExamLoadingScreen.tsx')
    'layout-shells'    = @('pre:src/components/layout/')
    'comp-study'       = @('pre:src/components/study/')
    'comp-tutor'       = @('exact:src/components/exam/TutorModePanel.tsx')
    'page-admin'       = @('pre:src/app/admin/')
    'page-learner'     = @('pre:src/app/learner/')
    'page-session'     = @('pre:src/app/exam-session/')
    'page-public'      = @('pre:src/app/sign-up/', 'pre:src/app/nclex/')
    'tests'            = @('pre:tests/')
    'docs'             = @('pre:docs/')
}

function Test-MatchesRule {
    param([string]$Path, [string[]]$Patterns)
    foreach ($pat in $Patterns) {
        if     ($pat.StartsWith('exact:')) { if ($Path -eq $pat.Substring(6)) { return $true } }
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
    'git-tooling'      = @{ unit = 'Git Tooling'
                            msg = 'chore(tooling): add feature workflow scripts to git tooling'
                            body = 'Add the feature workflow automation scripts alongside the integration engine.'
                            deps = @() }
    'config-root'      = @{ unit = 'Root Configuration'
                            msg = 'feat(config): update next configuration and root layout'
                            body = 'Update the Next.js configuration and the root application layout.'
                            deps = @() }
    'lib-api-core'     = @{ unit = 'Core API Layer'
                            msg = 'feat(api): refine client request mapping and transport contracts'
                            body = 'Refine the shared API client request mapping, DTO contracts and transport client.'
                            deps = @() }
    'lib-attempts'     = @{ unit = 'Attempt State'
                            msg = 'feat(attempts): harden live exam loader and async operation hooks'
                            body = 'Harden the live exam loader and add the shared async operation hook.'
                            deps = @('lib-api-core') }
    'api-tutor'        = @{ unit = 'Attempt API Routes'
                            msg = 'fix(tutor): correct tutor hint, evaluate and session endpoint semantics'
                            body = 'Correct tutor hint, evaluation and session endpoint semantics against the attempt store.'
                            deps = @('lib-attempts') }
    'api-auth'         = @{ unit = 'Auth API Routes'
                            msg = 'fix(auth-api): harden session identity endpoint response semantics'
                            body = 'Harden the session identity endpoint response semantics used by the application shell.'
                            deps = @('lib-api-core') }
    'ui-theme'         = @{ unit = 'UI Primitives & Theme'
                            msg = 'feat(ui): update button, theme toggle and panel theme context'
                            body = 'Update the button primitive, theme toggle and panel theme context.'
                            deps = @() }
    'feedback-loading' = @{ unit = 'Feedback & Loading'
                            msg = 'feat(feedback): standardize branded loading screens, skeletons and route transitions'
                            body = 'Standardize branded loading screens, skeleton loaders and route transition feedback.'
                            deps = @('ui-theme') }
    'layout-shells'    = @{ unit = 'Layout Shells'
                            msg = 'feat(layout): update admin and learner application shells'
                            body = 'Update the admin and learner application shells.'
                            deps = @('feedback-loading') }
    'comp-study'       = @{ unit = 'Study Components'
                            msg = 'feat(study): refine study library cards, filters and search states'
                            body = 'Refine study library cards, category filters, search and state views.'
                            deps = @('lib-api-core') }
    'comp-tutor'       = @{ unit = 'Tutor Mode'
                            msg = 'feat(tutor): refine tutor mode panel evaluation experience'
                            body = 'Refine the tutor mode panel evaluation and hint experience.'
                            deps = @('api-tutor') }
    'page-admin'       = @{ unit = 'Admin Pages'
                            msg = 'feat(admin): update admin management pages and loading states'
                            body = 'Update admin management pages with their route loading states.'
                            deps = @('layout-shells') }
    'page-learner'     = @{ unit = 'Learner Pages'
                            msg = 'feat(learner): update learner hub, profile, exams and security pages'
                            body = 'Update learner hub, profile, exams and security pages with loading states.'
                            deps = @('layout-shells') }
    'page-session'     = @{ unit = 'Exam Session'
                            msg = 'feat(session): refine exam session navigation and loading state'
                            body = 'Refine the exam session navigator and add its route loading state.'
                            deps = @('comp-tutor') }
    'page-public'      = @{ unit = 'Public Pages'
                            msg = 'feat(public): update sign-up and nclex study pages'
                            body = 'Update the sign-up and NCLEX study pages.'
                            deps = @('layout-shells') }
    'tests'            = @{ unit = 'Verification Suites'
                            msg = 'test(system): cover loading transitions, exam modes and learner catalogue'
                            body = 'Add automated coverage for branded loading transitions, exam identity modes and the learner catalogue.'
                            deps = @('api-tutor', 'api-auth', 'comp-study', 'page-admin', 'page-learner', 'page-session') }
    'docs'             = @{ unit = 'Documentation'
                            msg = 'docs(reports): publish exam modes and learner catalogue upgrade reports'
                            body = 'Publish the exam modes reports and learner catalogue upgrade report.'
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
    [pscustomobject]@{ afterUnit = 'api-tutor';     label = 'post-core';  commands = @('npx tsc --noEmit', 'npm run lint') }
    [pscustomobject]@{ afterUnit = 'page-session';  label = 'post-pages'; commands = @('npx tsc --noEmit', 'npm run lint') }
    [pscustomobject]@{ afterUnit = 'docs';          label = 'pre-push';   commands = @('npx tsc --noEmit', 'npm run lint', 'npm run build') }
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
foreach ($u in $units) { Write-Host ("  {0,-17} {1,3} file(s)  deps=[{2}]" -f $u.id, $u.files.Count, ($u.dependsOn -join ', ')) }
if ($assignedTotal -ne $files.Count) { throw "COVERAGE MISMATCH: assigned $assignedTotal != candidates $($files.Count)" }
Write-Host ""
Write-Host "Manifest written: $outPath"
