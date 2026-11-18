<#
.SYNOPSIS
    Nurvia-Prep Reusable Incremental Git Integration Engine.

.DESCRIPTION
    Consumes tools/git/integration-manifest.json and executes fine-grained, dependency-ordered
    conventional commits using explicit selective staging.
    Features:
    - Modular architecture (RepositoryScanner, FeatureClassifier, SecurityEngine, ValidationEngine,
      IncrementalCommitEngine, RemoteSyncEngine, EngineeringReporter)
    - Resume after interruption via persistent state
    - Duplicate-commit detection against existing history
    - In-memory O(1) dirty checking
    - Staged-diff verification (no git add ., no unrelated file leakage)
    - Automated security audit before staging
    - Milestone validation against baseline
    - Post-run coverage reconciliation
    - Remote synchronization & post-push hash verification
    - Comprehensive final report generation (GIT_INCREMENTAL_INTEGRATION_REPORT.md)
#>
[CmdletBinding()]
param(
    [string]$RepoRoot,
    [string]$ManifestPath,
    [string]$StatePath,
    [string]$LogPath,
    [string]$ResultsPath,
    [string]$BaselinePath,
    [string]$ReportPath,
    [string]$Remote = 'origin',
    [string]$TargetBranch = 'main',
    [switch]$Push,
    [switch]$DryRun,
    [switch]$SkipValidation
)

$ErrorActionPreference = 'Continue'
if (-not $PSScriptRoot) { $PSScriptRoot = (Split-Path -Parent $MyInvocation.MyCommand.Path) }
if (-not $RepoRoot)      { $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }
if (-not $ManifestPath)  { $ManifestPath = Join-Path $PSScriptRoot 'integration-manifest.json' }
if (-not $StatePath)     { $StatePath = Join-Path $PSScriptRoot 'integration-state.json' }
if (-not $LogPath)       { $LogPath = Join-Path $PSScriptRoot 'integration-log.txt' }
if (-not $ResultsPath)   { $ResultsPath = Join-Path $PSScriptRoot 'integration-results.json' }
if (-not $BaselinePath)  { $BaselinePath = Join-Path $PSScriptRoot 'baseline-validation.json' }
if (-not $ReportPath)    { $ReportPath = Join-Path $RepoRoot 'GIT_INCREMENTAL_INTEGRATION_REPORT.md' }

Set-Location $RepoRoot

# Import modules
Import-Module (Join-Path $PSScriptRoot 'modules\RepositoryScanner.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'modules\FeatureClassifier.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'modules\SecurityEngine.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'modules\ValidationEngine.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'modules\IncrementalCommitEngine.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'modules\RemoteSyncEngine.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'modules\EngineeringReporter.psm1') -Force

# Safe logging helper
function Write-EngineLog {
    param([string]$Level, [string]$Message)
    $line = '[{0}] [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    Write-Host $line
    try {
        [System.IO.File]::AppendAllText($LogPath, "$line`r`n", [System.Text.Encoding]::UTF8)
    } catch {
        # File lock fallback
    }
}

Write-EngineLog 'INFO' "======================================================="
Write-EngineLog 'INFO' "Nurvia-Prep Incremental Git Integration Engine started"
Write-EngineLog 'INFO' "Repository: $RepoRoot"
Write-EngineLog 'INFO' "Manifest:   $ManifestPath"
Write-EngineLog 'INFO' "DryRun:     $([bool]$DryRun) | SkipValidation: $([bool]$SkipValidation)"
Write-EngineLog 'INFO' "======================================================="

# ------------------------------------------------------------- Preflight Checks
$manifest = Import-IntegrationManifest -ManifestPath $ManifestPath
$initialHead = (& git -C $RepoRoot rev-parse HEAD).Trim()
$currentBranch = (& git -C $RepoRoot rev-parse --abbrev-ref HEAD).Trim()

if ($currentBranch -ne $TargetBranch) {
    Write-EngineLog 'ERROR' "Current branch '$currentBranch' does not match target branch '$TargetBranch'. Aborting."
    exit 2
}

# Ensure clean staging area
$stagedRaw = & git -C $RepoRoot diff --cached --name-only
$stagedNow = if ($stagedRaw) { ($stagedRaw | Out-String).Trim() } else { '' }
if ($stagedNow) {
    Write-EngineLog 'ERROR' "Index already contains staged changes: $stagedNow. Aborting to prevent data corruption."
    exit 3
}

# Remote information
$remotes = Get-GitRemotesInfo -RepoRoot $RepoRoot
$originUrl = if ($remotes.ContainsKey('origin')) { $remotes['origin'].PushUrl } else { 'none' }
$upstreamUrl = if ($remotes.ContainsKey('upstream')) { $remotes['upstream'].PushUrl } else { 'none' }

# Candidate files
$candidateFiles = @()
foreach ($u in $manifest.units) { $candidateFiles += $u.files }
$candidateFiles = @($candidateFiles | Sort-Object -Unique)

# Security Audit
Write-EngineLog 'INFO' "Running pre-flight security audit on $($candidateFiles.Count) candidate files..."
$secAudit = Invoke-SecurityAuditEngine -CandidateFiles $candidateFiles -RepoRoot $RepoRoot
if (-not $secAudit.Passed) {
    Write-EngineLog 'ERROR' "Security audit failed! Detected potential secrets or disallowed files."
    $secAudit.Findings | ForEach-Object { Write-EngineLog 'ERROR' "Finding: $($_.File) line $($_.Line) rule $($_.Rule)" }
    exit 4
}
Write-EngineLog 'OK' "Security audit passed cleanly (0 secrets detected)."

# Baseline validation
$baseline = @{}
if (Test-Path $BaselinePath) {
    $b = Get-Content $BaselinePath -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($p in $b.PSObject.Properties) { $baseline[$p.Name] = [int]$p.Value }
    Write-EngineLog 'INFO' "Baseline validation loaded: $(($baseline.Keys | ForEach-Object { "$_=$($baseline[$_])" }) -join '; ')"
} else {
    Write-EngineLog 'WARN' "No baseline validation file found."
}

# Resume state
$state = @{ units = @{} }
if (Test-Path $StatePath) {
    $s = Get-Content $StatePath -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($p in $s.units.PSObject.Properties) {
        $state.units[$p.Name] = @{ hash = $p.Value.hash; subject = $p.Value.subject }
    }
    Write-EngineLog 'INFO' "Loaded resume state with $($state.units.Count) completed unit(s)."
}

# Existing subjects in history (duplicate guard)
$existingSubjects = Get-GitHistorySubjects -RepoRoot $RepoRoot

$results = New-Object System.Collections.ArrayList

# ---------------------------------------------------------------- Unit Loop
foreach ($unit in $manifest.units) {
    $id = $unit.id
    $subject = $unit.message
    $body = $unit.body
    $unitFiles = Get-NormalizedUnitFiles -Files @($unit.files)
    $label = "[$id] $subject"

    # Resume / duplicate guard
    if ($state.units.ContainsKey($id) -and $existingSubjects.Contains($subject)) {
        Write-EngineLog 'SKIP' "$label -> already committed ($($state.units[$id].hash))"
        [void]$results.Add([pscustomobject]@{ id = $id; status = 'skipped-existing'; hash = $state.units[$id].hash; message = $subject; files = $unitFiles.Count })
        continue
    }
    if ($existingSubjects.Contains($subject)) {
        Write-EngineLog 'SKIP' "$label -> subject already in history; recording existing hash."
        $h = (& git -C $RepoRoot log -1 --format=%H --grep="^$([regex]::Escape($subject))$").Trim()
        $state.units[$id] = @{ hash = $h; subject = $subject }
        [void]$results.Add([pscustomobject]@{ id = $id; status = 'skipped-duplicate-subject'; hash = $h; message = $subject; files = $unitFiles.Count })
        continue
    }

    # Dependency check
    $missingDeps = Test-DependencyPrerequisites -Unit $unit -CompletedUnits $state.units
    if ($missingDeps.Count -gt 0) {
        Write-EngineLog 'FAIL' "$label -> unmet dependencies: $($missingDeps -join ', ')"
        [void]$results.Add([pscustomobject]@{ id = $id; status = 'failed-dependency'; hash = $null; message = $subject; files = 0 })
        continue
    }

    # O(1) dirty checking
    $dirtySet = Get-GitDirtySet -RepoRoot $RepoRoot
    $missingFiles = @()
    $cleanFiles = @()
    $dirtyFiles = @()

    foreach ($f in $unitFiles) {
        $fullPath = Join-Path $RepoRoot $f
        if (-not (Test-Path -LiteralPath $fullPath)) {
            $missingFiles += $f
            continue
        }
        if ($dirtySet.Contains($f)) {
            $dirtyFiles += $f
        } else {
            $cleanFiles += $f
        }
    }

    if ($missingFiles.Count -gt 0) {
        Write-EngineLog 'FAIL' "$label -> file(s) missing on disk: $($missingFiles -join ', ')"
        [void]$results.Add([pscustomobject]@{ id = $id; status = 'failed-missing-files'; hash = $null; message = $subject; files = 0 })
        continue
    }

    if ($cleanFiles.Count -eq $unitFiles.Count) {
        Write-EngineLog 'SKIP' "$label -> all files clean, nothing to commit."
        [void]$results.Add([pscustomobject]@{ id = $id; status = 'skipped-clean'; hash = $null; message = $subject; files = 0 })
        continue
    }

    if ($cleanFiles.Count -gt 0) {
        Write-EngineLog 'WARN' "$label -> partial changes dirty ($($dirtyFiles.Count)/$($unitFiles.Count)); committing dirty files."
    }

    if ($DryRun) {
        Write-EngineLog 'DRYRUN' "$label -> would stage $($dirtyFiles.Count) file(s)"
        $state.units[$id] = @{ hash = 'DRYRUN'; subject = $subject }
        [void]$results.Add([pscustomobject]@{ id = $id; status = 'dry-run'; hash = 'DRYRUN'; message = $subject; files = $dirtyFiles.Count })
        continue
    }

    # Selective staging (explicit paths only)
    $stageResult = Invoke-SelectiveStage -FilesToStage $dirtyFiles -RepoRoot $RepoRoot
    if (-not $stageResult.Success) {
        Write-EngineLog 'FAIL' "$label -> staging failed: $($stageResult.Output)"
        [void]$results.Add([pscustomobject]@{ id = $id; status = 'failed-stage'; hash = $null; message = $subject; files = 0 })
        continue
    }

    # Staged set assertion
    $stagedAssert = Assert-StagedSet -ExpectedFiles $dirtyFiles -RepoRoot $RepoRoot
    if (-not $stagedAssert.IsMatch) {
        Write-EngineLog 'FAIL' "$label -> staged set mismatch! Unexpected: [$($stagedAssert.Unexpected -join ', ')], Missing: [$($stagedAssert.Missing -join ', ')]. Resetting."
        Reset-StagedChanges -FilesToUnstage $dirtyFiles -RepoRoot $RepoRoot
        [void]$results.Add([pscustomobject]@{ id = $id; status = 'failed-staged-mismatch'; hash = $null; message = $subject; files = 0 })
        continue
    }

    # Execute commit
    $commitResult = Invoke-UnitCommit -Subject $subject -Body $body -ExpectedFiles $dirtyFiles -RepoRoot $RepoRoot
    if (-not $commitResult.Success) {
        Write-EngineLog 'FAIL' "$label -> commit failed: $($commitResult.Message)"
        Reset-StagedChanges -FilesToUnstage $dirtyFiles -RepoRoot $RepoRoot
        [void]$results.Add([pscustomobject]@{ id = $id; status = $commitResult.Status; hash = $null; message = $subject; files = 0 })
        continue
    }

    $commitHash = $commitResult.Hash
    $state.units[$id] = @{ hash = $commitHash; subject = $subject }
    [void]$existingSubjects.Add($subject)

    # Persist state
    ConvertTo-Json @{ units = $state.units } -Depth 5 | Set-Content -LiteralPath $StatePath -Encoding UTF8

    Write-EngineLog 'OK' "$label -> committed $commitHash ($($dirtyFiles.Count) file(s))"
    [void]$results.Add([pscustomobject]@{ id = $id; status = 'committed'; hash = $commitHash; message = $subject; files = $dirtyFiles.Count })

    # Milestone validation
    if (-not $SkipValidation) {
        $milestones = @($manifest.validateAfter | Where-Object { $_.afterUnit -eq $id })
        foreach ($m in $milestones) {
            Write-EngineLog 'VALIDATE' "[$($m.label)] Running validation commands..."
            $valResults = Invoke-MilestoneValidation -Commands @($m.commands) -RepoRoot $RepoRoot -Baseline $baseline -LogDir $PSScriptRoot
            foreach ($vr in $valResults) {
                if ($vr.IsNewFailure) {
                    Write-EngineLog 'FAIL' "[$($m.label)] $($vr.Command) -> exit $($vr.ExitCode) (NEW FAILURE vs baseline $($vr.BaselineCode))"
                } elseif ($vr.ExitCode -ne 0) {
                    Write-EngineLog 'WARN' "[$($m.label)] $($vr.Command) -> exit $($vr.ExitCode) (matches baseline failure)"
                } else {
                    Write-EngineLog 'OK' "[$($m.label)] $($vr.Command) -> exit 0"
                }
            }
        }
    }
}

# ------------------------------------------------- Coverage Reconciliation
$finalStatus = Get-GitRepositoryStatus -RepoRoot $RepoRoot
$remainingPaths = @($finalStatus | ForEach-Object { $_.Path })
$excludedNormalized = @($manifest.excluded | ForEach-Object { $_.Replace('\', '/') })
$unexpectedRemaining = @($remainingPaths | Where-Object { $_ -notin $excludedNormalized -and $_ -notlike 'tools/git/*' })

$committedCount = @($results | Where-Object { $_.status -eq 'committed' }).Count
$failedCount    = @($results | Where-Object { $_.status -like 'failed-*' }).Count

Write-EngineLog 'INFO' "======================================================="
Write-EngineLog 'INFO' "Integration loop complete. Committed: $committedCount | Failed: $failedCount"

if ($unexpectedRemaining.Count -gt 0) {
    Write-EngineLog 'WARN' "Unreconciled files remaining: $($unexpectedRemaining -join ', ')"
} else {
    Write-EngineLog 'OK' "Coverage reconciliation clean: 100% of candidate files integrated. Remaining files are on excluded list."
}

$finalHead = (& git -C $RepoRoot rev-parse HEAD).Trim()
Write-EngineLog 'INFO' "Final HEAD: $finalHead"

# ---------------------------------------------------- Remote Synchronization
$syncSummary = @{
    Status = 'Pending / Not Pushed'
    Detail = 'Push was not requested.'
}

if ($Push -and -not $DryRun -and $failedCount -eq 0) {
    Write-EngineLog 'INFO' "Auditing remote synchronization for remote '$Remote'..."
    $readiness = Test-RemoteReadiness -RemoteName $Remote -Branch $TargetBranch -RepoRoot $RepoRoot
    if ($readiness.Ready) {
        Write-EngineLog 'INFO' "Remote '$Remote' is ready. Outgoing commits: $($readiness.OutgoingCount). Pushing safely..."
        $pushResult = Invoke-VerifiedPush -RemoteName $Remote -Branch $TargetBranch -RepoRoot $RepoRoot
        if ($pushResult.Success) {
            Write-EngineLog 'OK' "Push successful and verified! Remote HEAD matches local HEAD: $($pushResult.RemoteHead)"
            $syncSummary.Status = "Synchronized to $Remote/$TargetBranch"
            $syncSummary.Detail = "Successfully pushed $($readiness.OutgoingCount) commits to $Remote/$TargetBranch without force-push. Remote HEAD verified at $($pushResult.RemoteHead)."
        } else {
            Write-EngineLog 'ERROR' "Push failed or verification mismatch: $($pushResult.Message)"
            $syncSummary.Status = 'Push Failed'
            $syncSummary.Detail = "Push failed: $($pushResult.Message)"
        }
    } else {
        Write-EngineLog 'ERROR' "Remote '$Remote' not ready for safe push: $($readiness.Message)"
        $syncSummary.Status = 'Push Aborted (Safety Check)'
        $syncSummary.Detail = "Safety check aborted push: $($readiness.Message)"
    }
}

# ------------------------------------------------- Final Report Generation
$baselineData = @{
    RepoRoot       = $RepoRoot
    InitialHead    = $initialHead
    CandidateCount = $candidateFiles.Count
    OriginUrl      = $originUrl
    UpstreamUrl    = $upstreamUrl
}

$finalData = @{
    FinalHead   = $finalHead
    Branch      = $TargetBranch
}

$securitySummary = @{
    Passed       = $secAudit.Passed
    ScannedCount = $candidateFiles.Count
}

$validationSummary = @{
    Baseline = $baseline
}

Write-EngineLog 'INFO' "Generating final engineering report at $ReportPath..."
New-EngineeringReport -ReportPath $ReportPath `
                     -Manifest $manifest `
                     -Results $results `
                     -BaselineData $baselineData `
                     -FinalData $finalData `
                     -SecuritySummary $securitySummary `
                     -ValidationSummary $validationSummary `
                     -SyncSummary $syncSummary

# Save JSON results
$results | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ResultsPath -Encoding UTF8
Write-EngineLog 'OK' "Engine execution complete. Results saved to $ResultsPath."

if ($failedCount -gt 0) { exit 1 }
exit 0
