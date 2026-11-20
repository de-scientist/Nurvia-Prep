<#
.SYNOPSIS
    Automated Test Suite for NURVIA-PREP Feature Workflow Engine.
.DESCRIPTION
    Executes focused, isolated integration tests for all 22 scenarios required by Section 13.
    Uses temporary isolated Git repositories and bare remotes in $env:TEMP.
    Never modifies or accesses the actual Nurvia-Prep Git remotes or working tree.
#>

[CmdletBinding()]
param(
    [switch]$KeepTempDirs
)

$ErrorActionPreference = "Stop"

$TestDir = Join-Path $env:TEMP ("nurvia-test-suite-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $TestDir -Force | Out-Null

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrEmpty($ScriptDir)) {
    $ScriptDir = (Get-Location).Path
}

$EngineSourcePath = Join-Path $ScriptDir "Invoke-FeatureWorkflow.ps1"
$WrapperSourcePath = Join-Path $ScriptDir "Feature-WorkFlow.ps1"

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "NURVIA-PREP Workflow Engine Automated Test Suite" -ForegroundColor Cyan
Write-Host "Isolated Test Root: $TestDir" -ForegroundColor White
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

$testResults = [System.Collections.Generic.List[PSCustomObject]]::new()

function Invoke-TestGit {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Dir,
        [Parameter(Mandatory=$true)]
        [string[]]$Args
    )
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $fullArgs = @('-C', $Dir) + $Args
        $out = & git @fullArgs 2>&1
        $code = $LASTEXITCODE
        return [PSCustomObject]@{ Output = $out; ExitCode = $code; Success = ($code -eq 0); Text = ($out -join "`n") }
    } finally {
        $ErrorActionPreference = $prevEap
    }
}

function Run-Scenario {
    param(
        [int]$Id,
        [string]$Name,
        [scriptblock]$Action
    )

    Write-Host ("Test {0:D2}: {1} " -f $Id, $Name) -NoNewline
    try {
        $passed = & $Action
        if ($passed) {
            Write-Host "-> PASSED" -ForegroundColor Green
            $testResults.Add([PSCustomObject]@{
                Id      = $Id
                Name    = $Name
                Status  = "PASSED"
                Message = ""
            })
        } else {
            Write-Host "-> FAILED" -ForegroundColor Red
            $testResults.Add([PSCustomObject]@{
                Id      = $Id
                Name    = $Name
                Status  = "FAILED"
                Message = "Assertion returned false"
            })
        }
    } catch {
        Write-Host "-> ERROR: $_" -ForegroundColor Red
        $testResults.Add([PSCustomObject]@{
            Id      = $Id
            Name    = $Name
            Status  = "ERROR"
            Message = $_.ToString()
        })
    }
}

# Helper to create isolated test environment
function New-TestEnv {
    param([string]$ScenarioName)

    $envPath = Join-Path $TestDir $ScenarioName
    New-Item -ItemType Directory -Path $envPath -Force | Out-Null

    $originBare = Join-Path $envPath "origin.git"
    $upstreamBare = Join-Path $envPath "upstream.git"
    $clientDir = Join-Path $envPath "client"

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        # Init bare remotes on branch main
        & git init --bare -b main $originBare 2>$null | Out-Null
        & git init --bare -b main $upstreamBare 2>$null | Out-Null

        # Init client on branch main
        & git init -b main $clientDir 2>$null | Out-Null
        & git -C $clientDir config user.name "Workflow Tester"
        & git -C $clientDir config user.email "tester@nurvia.local"
        & git -C $clientDir config commit.gpgsign false

        # Add remotes
        & git -C $clientDir remote add origin $originBare
        & git -C $clientDir remote add upstream $upstreamBare

        # Create initial commit on main
        Set-Content -LiteralPath (Join-Path $clientDir "README.md") -Value "# Test Repository"
        & git -C $clientDir add README.md
        & git -C $clientDir commit -m "chore: initial commit" 2>$null | Out-Null

        # Push main to both bare remotes
        & git -C $clientDir push -u origin main 2>$null | Out-Null
        & git -C $clientDir push -u upstream main 2>$null | Out-Null
    } finally {
        $ErrorActionPreference = $prevEap
    }

    # Copy workflow tools into client
    $toolsDir = Join-Path $clientDir "tools\git"
    New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
    Copy-Item -LiteralPath $EngineSourcePath -Destination (Join-Path $toolsDir "Invoke-FeatureWorkflow.ps1") -Force
    Copy-Item -LiteralPath $WrapperSourcePath -Destination (Join-Path $toolsDir "Feature-WorkFlow.ps1") -Force

    return [PSCustomObject]@{
        EnvPath      = $envPath
        ClientDir    = $clientDir
        OriginBare   = $originBare
        UpstreamBare = $upstreamBare
        WrapperPath  = Join-Path $toolsDir "Feature-WorkFlow.ps1"
        EnginePath   = Join-Path $toolsDir "Invoke-FeatureWorkflow.ps1"
    }
}

# ------------------------------------------------------------------------------
# Test 1: Clean feature branch
# ------------------------------------------------------------------------------
Run-Scenario -Id 1 -Name "Clean feature branch" -Action {
    $env = New-TestEnv "test1"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/clean') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/clean') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'upstream', 'feature/clean') | Out-Null

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Test Clean" -RepoPath $env.ClientDir -RunTests:$false
    return ($res.ExitCode -eq 0 -and $res.FinalOutcome -eq "IMPLEMENTED_TESTED_COMMITTED_AND_FULLY_SYNCHRONIZED")
}

# ------------------------------------------------------------------------------
# Test 2: Dirty worktree with unrelated files
# ------------------------------------------------------------------------------
Run-Scenario -Id 2 -Name "Dirty worktree with unrelated files" -Action {
    $env = New-TestEnv "test2"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/unrelated') | Out-Null
    Set-Content -LiteralPath (Join-Path $env.ClientDir "unrelated.txt") -Value "unrelated changes"

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Test Dirty Tree" -RepoPath $env.ClientDir -RunTests:$false
    $fileStillExists = Test-Path -LiteralPath (Join-Path $env.ClientDir "unrelated.txt")
    return ($res.ExitCode -eq 3 -and $res.FinalOutcome -eq "WORKTREE_REVIEW_REQUIRED" -and $fileStillExists)
}

# ------------------------------------------------------------------------------
# Test 3: Pre-existing staged changes outside approved scope
# ------------------------------------------------------------------------------
Run-Scenario -Id 3 -Name "Pre-existing staged changes outside approved scope" -Action {
    $env = New-TestEnv "test3"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/staged') | Out-Null
    Set-Content -LiteralPath (Join-Path $env.ClientDir "staged-unrelated.txt") -Value "already staged"
    Invoke-TestGit -Dir $env.ClientDir -Args @('add', 'staged-unrelated.txt') | Out-Null

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Test Pre-existing Staged" -ApprovedPaths @("some-other.txt") -RepoPath $env.ClientDir -RunTests:$false
    return ($res.ExitCode -eq 3 -and $res.FinalOutcome -eq "WORKTREE_REVIEW_REQUIRED")
}

# ------------------------------------------------------------------------------
# Test 4: Untracked files
# ------------------------------------------------------------------------------
Run-Scenario -Id 4 -Name "Untracked files safety gate" -Action {
    $env = New-TestEnv "test4"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/untracked') | Out-Null
    Set-Content -LiteralPath (Join-Path $env.ClientDir "new-untracked.txt") -Value "untracked"

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Test Untracked" -RepoPath $env.ClientDir -RunTests:$false
    return ($res.ExitCode -eq 3 -and $res.FinalOutcome -eq "WORKTREE_REVIEW_REQUIRED")
}

# ------------------------------------------------------------------------------
# Test 5: Selective staging
# ------------------------------------------------------------------------------
Run-Scenario -Id 5 -Name "Selective staging of approved files only" -Action {
    $env = New-TestEnv "test5"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/selective') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/selective') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'upstream', 'feature/selective') | Out-Null

    Set-Content -LiteralPath (Join-Path $env.ClientDir "feat.txt") -Value "feature code"
    Set-Content -LiteralPath (Join-Path $env.ClientDir "other.txt") -Value "other unapproved code"

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Implement selective" -ApprovedPaths @("feat.txt") -ApproveCommit -RepoPath $env.ClientDir -RunTests:$false
    $statusRes = Invoke-TestGit -Dir $env.ClientDir -Args @('status', '--porcelain')
    $otherUntouched = ($statusRes.Text -match 'other\.txt')
    return ($res.ExitCode -eq 0 -and $res.FinalOutcome -eq "IMPLEMENTED_TESTED_COMMITTED_AND_FULLY_SYNCHRONIZED" -and $otherUntouched)
}

# ------------------------------------------------------------------------------
# Test 6: Secret detection in staged content
# ------------------------------------------------------------------------------
Run-Scenario -Id 6 -Name "Secret detection in staged content" -Action {
    $env = New-TestEnv "test6"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/secret') | Out-Null
    Set-Content -LiteralPath (Join-Path $env.ClientDir "config.js") -Value "const stripe = 'sk_live_1234567890abcdef1234567890';"

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Add config" -ApprovedPaths @("config.js") -ApproveCommit -RepoPath $env.ClientDir -RunTests:$false
    return ($res.ExitCode -eq 4 -and $res.FinalOutcome -eq "VALIDATION_FAILED")
}

# ------------------------------------------------------------------------------
# Test 7: Failed validation
# ------------------------------------------------------------------------------
Run-Scenario -Id 7 -Name "Failed mandatory validation" -Action {
    $env = New-TestEnv "test7"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/testfail') | Out-Null
    Set-Content -LiteralPath (Join-Path $env.ClientDir "code.js") -Value "console.log('hello');"

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Test Fail" -ApprovedPaths @("code.js") -ApproveCommit -ValidationCommands @("powershell -Command exit 1") -RepoPath $env.ClientDir
    return ($res.ExitCode -eq 4 -and $res.FinalOutcome -eq "VALIDATION_FAILED")
}

# ------------------------------------------------------------------------------
# Test 8: Commit succeeds but push fails
# ------------------------------------------------------------------------------
Run-Scenario -Id 8 -Name "Commit succeeds but push fails" -Action {
    $env = New-TestEnv "test8"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/pushfail') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/pushfail') | Out-Null

    # Break origin push URL
    Invoke-TestGit -Dir $env.ClientDir -Args @('remote', 'set-url', 'origin', 'file:///invalid/nonexistent/path.git') | Out-Null

    Set-Content -LiteralPath (Join-Path $env.ClientDir "file.txt") -Value "push fail test"

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Test Push Fail" -ApprovedPaths @("file.txt") -ApproveCommit -PushTo "origin" -RepoPath $env.ClientDir -RunTests:$false
    $head = (Invoke-TestGit -Dir $env.ClientDir -Args @('rev-parse', 'HEAD')).Text.Trim()
    return ($res.ExitCode -eq 1 -and $res.FinalOutcome -eq "IMPLEMENTED_TESTED_COMMITTED_PUSH_PENDING" -and $res.CommitHash -eq $head)
}

# ------------------------------------------------------------------------------
# Test 9: Rerun after push failure (Commit Recovery)
# ------------------------------------------------------------------------------
Run-Scenario -Id 9 -Name "Rerun after push failure resumes without duplicate commit" -Action {
    $env = New-TestEnv "test9"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/recovery') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/recovery') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'upstream', 'feature/recovery') | Out-Null

    # Create a local commit
    Set-Content -LiteralPath (Join-Path $env.ClientDir "file.txt") -Value "recovery test"
    Invoke-TestGit -Dir $env.ClientDir -Args @('add', 'file.txt') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('commit', '-m', 'feat(feature/recovery): recovery test') | Out-Null
    $firstCommit = (Invoke-TestGit -Dir $env.ClientDir -Args @('rev-parse', 'HEAD')).Text.Trim()

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "recovery test" -RepoPath $env.ClientDir -RunTests:$false
    $secondCommit = (Invoke-TestGit -Dir $env.ClientDir -Args @('rev-parse', 'HEAD')).Text.Trim()

    return ($res.ExitCode -eq 0 -and $res.FinalOutcome -eq "IMPLEMENTED_TESTED_COMMITTED_AND_FULLY_SYNCHRONIZED" -and $firstCommit -eq $secondCommit)
}

# ------------------------------------------------------------------------------
# Test 10: Both remotes already synchronized
# ------------------------------------------------------------------------------
Run-Scenario -Id 10 -Name "Both remotes already synchronized" -Action {
    $env = New-TestEnv "test10"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/synced') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/synced') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'upstream', 'feature/synced') | Out-Null

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Already Synced" -RepoPath $env.ClientDir -RunTests:$false
    return ($res.ExitCode -eq 0 -and $res.FinalOutcome -eq "IMPLEMENTED_TESTED_COMMITTED_AND_FULLY_SYNCHRONIZED")
}

# ------------------------------------------------------------------------------
# Test 11: Fast-forward synchronization across remotes
# ------------------------------------------------------------------------------
Run-Scenario -Id 11 -Name "Fast-forward synchronization across remotes" -Action {
    $env = New-TestEnv "test11"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/ffsync') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/ffsync') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'upstream', 'feature/ffsync') | Out-Null

    Set-Content -LiteralPath (Join-Path $env.ClientDir "ff.txt") -Value "fast forward sync"

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Test FF Sync" -ApprovedPaths @("ff.txt") -ApproveCommit -RepoPath $env.ClientDir -RunTests:$false

    $originHash = (Invoke-TestGit -Dir $env.ClientDir -Args @('rev-parse', 'refs/remotes/origin/feature/ffsync')).Text.Trim()
    $upstreamHash = (Invoke-TestGit -Dir $env.ClientDir -Args @('rev-parse', 'refs/remotes/upstream/feature/ffsync')).Text.Trim()
    $head = (Invoke-TestGit -Dir $env.ClientDir -Args @('rev-parse', 'HEAD')).Text.Trim()

    return ($res.ExitCode -eq 0 -and $res.FinalOutcome -eq "IMPLEMENTED_TESTED_COMMITTED_AND_FULLY_SYNCHRONIZED" -and $originHash -eq $head -and $upstreamHash -eq $head)
}

# ------------------------------------------------------------------------------
# Test 12: Origin-only commit blocks divergence
# ------------------------------------------------------------------------------
Run-Scenario -Id 12 -Name "Origin-only commit divergence protection" -Action {
    $env = New-TestEnv "test12"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/origdiv') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/origdiv') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'upstream', 'feature/origdiv') | Out-Null

    # Push a rogue commit to origin using another client
    $otherClient = Join-Path $env.EnvPath "otherClient"
    & git clone $env.OriginBare $otherClient 2>$null | Out-Null
    Invoke-TestGit -Dir $otherClient -Args @('config', 'user.name', 'Other') | Out-Null
    Invoke-TestGit -Dir $otherClient -Args @('config', 'user.email', 'other@test.local') | Out-Null
    Invoke-TestGit -Dir $otherClient -Args @('config', 'commit.gpgsign', 'false') | Out-Null
    Invoke-TestGit -Dir $otherClient -Args @('checkout', 'feature/origdiv') | Out-Null
    Set-Content -LiteralPath (Join-Path $otherClient "rogue.txt") -Value "rogue on origin"
    Invoke-TestGit -Dir $otherClient -Args @('add', 'rogue.txt') | Out-Null
    Invoke-TestGit -Dir $otherClient -Args @('commit', '-m', 'feat: rogue commit on origin') | Out-Null
    Invoke-TestGit -Dir $otherClient -Args @('push', 'origin', 'feature/origdiv') | Out-Null

    # Now in original client, create independent commit
    Set-Content -LiteralPath (Join-Path $env.ClientDir "local.txt") -Value "local independent"

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Independent Local" -ApprovedPaths @("local.txt") -ApproveCommit -RepoPath $env.ClientDir -RunTests:$false
    return ($res.ExitCode -eq 5 -and $res.FinalOutcome -eq "SYNCHRONIZATION_BLOCKED_CONFLICT_REQUIRES_RESOLUTION")
}

# ------------------------------------------------------------------------------
# Test 13: Upstream-only commit divergence protection
# ------------------------------------------------------------------------------
Run-Scenario -Id 13 -Name "Upstream-only commit divergence protection" -Action {
    $env = New-TestEnv "test13"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/updiv') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/updiv') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'upstream', 'feature/updiv') | Out-Null

    # Push a rogue commit to upstream
    $otherClient = Join-Path $env.EnvPath "otherClient"
    & git clone $env.UpstreamBare $otherClient 2>$null | Out-Null
    Invoke-TestGit -Dir $otherClient -Args @('config', 'user.name', 'Other') | Out-Null
    Invoke-TestGit -Dir $otherClient -Args @('config', 'user.email', 'other@test.local') | Out-Null
    Invoke-TestGit -Dir $otherClient -Args @('config', 'commit.gpgsign', 'false') | Out-Null
    Invoke-TestGit -Dir $otherClient -Args @('checkout', 'feature/updiv') | Out-Null
    Set-Content -LiteralPath (Join-Path $otherClient "upstream_rogue.txt") -Value "rogue on upstream"
    Invoke-TestGit -Dir $otherClient -Args @('add', 'upstream_rogue.txt') | Out-Null
    Invoke-TestGit -Dir $otherClient -Args @('commit', '-m', 'feat: rogue commit on upstream') | Out-Null
    Invoke-TestGit -Dir $otherClient -Args @('push', 'origin', 'feature/updiv') | Out-Null

    # Create local commit
    Set-Content -LiteralPath (Join-Path $env.ClientDir "local.txt") -Value "local independent"

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Independent Local" -ApprovedPaths @("local.txt") -ApproveCommit -RepoPath $env.ClientDir -RunTests:$false
    return ($res.ExitCode -eq 5 -and $res.FinalOutcome -eq "SYNCHRONIZATION_BLOCKED_CONFLICT_REQUIRES_RESOLUTION")
}

# ------------------------------------------------------------------------------
# Test 14: Divergent remote histories
# ------------------------------------------------------------------------------
Run-Scenario -Id 14 -Name "Divergent remote histories resolution requirement" -Action {
    $env = New-TestEnv "test14"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/diverged') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/diverged') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'upstream', 'feature/diverged') | Out-Null

    # Push commit 1 to origin
    $clientA = Join-Path $env.EnvPath "clientA"
    & git clone $env.OriginBare $clientA 2>$null | Out-Null
    Invoke-TestGit -Dir $clientA -Args @('config', 'user.name', 'ClientA') | Out-Null
    Invoke-TestGit -Dir $clientA -Args @('config', 'user.email', 'a@test.local') | Out-Null
    Invoke-TestGit -Dir $clientA -Args @('config', 'commit.gpgsign', 'false') | Out-Null
    Invoke-TestGit -Dir $clientA -Args @('checkout', 'feature/diverged') | Out-Null
    Set-Content -LiteralPath (Join-Path $clientA "fileA.txt") -Value "file A"
    Invoke-TestGit -Dir $clientA -Args @('add', 'fileA.txt') | Out-Null
    Invoke-TestGit -Dir $clientA -Args @('commit', '-m', 'feat: commit A on origin') | Out-Null
    Invoke-TestGit -Dir $clientA -Args @('push', 'origin', 'feature/diverged') | Out-Null

    # Push commit 2 to upstream
    $clientB = Join-Path $env.EnvPath "clientB"
    & git clone $env.UpstreamBare $clientB 2>$null | Out-Null
    Invoke-TestGit -Dir $clientB -Args @('config', 'user.name', 'ClientB') | Out-Null
    Invoke-TestGit -Dir $clientB -Args @('config', 'user.email', 'b@test.local') | Out-Null
    Invoke-TestGit -Dir $clientB -Args @('config', 'commit.gpgsign', 'false') | Out-Null
    Invoke-TestGit -Dir $clientB -Args @('checkout', 'feature/diverged') | Out-Null
    Set-Content -LiteralPath (Join-Path $clientB "fileB.txt") -Value "file B"
    Invoke-TestGit -Dir $clientB -Args @('add', 'fileB.txt') | Out-Null
    Invoke-TestGit -Dir $clientB -Args @('commit', '-m', 'feat: commit B on upstream') | Out-Null
    Invoke-TestGit -Dir $clientB -Args @('push', 'origin', 'feature/diverged') | Out-Null

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Test Divergence" -RepoPath $env.ClientDir -RunTests:$false
    return ($res.ExitCode -eq 5 -and $res.FinalOutcome -eq "SYNCHRONIZATION_BLOCKED_CONFLICT_REQUIRES_RESOLUTION")
}

# ------------------------------------------------------------------------------
# Test 15: Missing remote branch blocks automatic creation without permission
# ------------------------------------------------------------------------------
Run-Scenario -Id 15 -Name "Missing remote branch blocks creation without explicit permission" -Action {
    $env = New-TestEnv "test15"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/missing') | Out-Null
    Set-Content -LiteralPath (Join-Path $env.ClientDir "feature.txt") -Value "new feature"

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Test Missing Branch" -ApprovedPaths @("feature.txt") -ApproveCommit -RepoPath $env.ClientDir -RunTests:$false
    return ($res.ExitCode -eq 1 -and $res.FinalOutcome -eq "IMPLEMENTED_TESTED_COMMITTED_PUSH_PENDING")
}

# ------------------------------------------------------------------------------
# Test 16: Incorrect branch tracking
# ------------------------------------------------------------------------------
Run-Scenario -Id 16 -Name "Branch parameter mismatch rejected" -Action {
    $env = New-TestEnv "test16"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/alpha') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('branch', 'feature/beta') | Out-Null

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Test Branch Mismatch" -BranchName "feature/beta" -RepoPath $env.ClientDir -RunTests:$false
    return ($res.ExitCode -eq 3 -and $res.FinalOutcome -eq "WORKTREE_REVIEW_REQUIRED")
}

# ------------------------------------------------------------------------------
# Test 17: Execution on main integration branch requires authorization
# ------------------------------------------------------------------------------
Run-Scenario -Id 17 -Name "Execution on main branch requires authorization" -Action {
    $env = New-TestEnv "test17"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', 'main') | Out-Null

    . $env.EnginePath
    # Without -AllowMainBranch: should block
    $resBlocked = Invoke-FeatureWorkflow -FeatureName "Test Main Without Auth" -RepoPath $env.ClientDir -RunTests:$false
    $blockedOk = ($resBlocked.ExitCode -eq 3 -and $resBlocked.FinalOutcome -eq "WORKTREE_REVIEW_REQUIRED")

    # With -AllowMainBranch: allowed
    $resAllowed = Invoke-FeatureWorkflow -FeatureName "Test Main With Auth" -AllowMainBranch -RepoPath $env.ClientDir -RunTests:$false
    $allowedOk = ($resAllowed.ExitCode -eq 0 -and $resAllowed.FinalOutcome -eq "IMPLEMENTED_TESTED_COMMITTED_AND_FULLY_SYNCHRONIZED")

    return ($blockedOk -and $allowedOk)
}

# ------------------------------------------------------------------------------
# Test 18: Failed fetch handled gracefully
# ------------------------------------------------------------------------------
Run-Scenario -Id 18 -Name "Failed fetch handled gracefully" -Action {
    $env = New-TestEnv "test18"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/fetchfail') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/fetchfail') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('remote', 'set-url', 'upstream', 'file:///nonexistent/invalid/repo.git') | Out-Null

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Test Fetch Failure" -RepoPath $env.ClientDir -RunTests:$false
    return ($null -ne $res)
}

# ------------------------------------------------------------------------------
# Test 19: Failed push preserves commit
# ------------------------------------------------------------------------------
Run-Scenario -Id 19 -Name "Failed push preserves local commit" -Action {
    $env = New-TestEnv "test19"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/pushpreserve') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/pushpreserve') | Out-Null

    # Break remote push URL
    Invoke-TestGit -Dir $env.ClientDir -Args @('remote', 'set-url', 'origin', 'file:///invalid/remote/path.git') | Out-Null

    Set-Content -LiteralPath (Join-Path $env.ClientDir "preserved.txt") -Value "must be preserved"

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Preserve Commit" -ApprovedPaths @("preserved.txt") -ApproveCommit -PushTo "origin" -RepoPath $env.ClientDir -RunTests:$false
    $head = (Invoke-TestGit -Dir $env.ClientDir -Args @('rev-parse', 'HEAD')).Text.Trim()
    return ($res.ExitCode -eq 1 -and $res.CommitHash -eq $head)
}

# ------------------------------------------------------------------------------
# Test 20: Final parity verification
# ------------------------------------------------------------------------------
Run-Scenario -Id 20 -Name "Final parity verification across both remotes" -Action {
    $env = New-TestEnv "test20"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/parity') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/parity') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'upstream', 'feature/parity') | Out-Null

    Set-Content -LiteralPath (Join-Path $env.ClientDir "parity.txt") -Value "parity check"

    . $env.EnginePath
    $res = Invoke-FeatureWorkflow -FeatureName "Test Parity" -ApprovedPaths @("parity.txt") -ApproveCommit -RepoPath $env.ClientDir -RunTests:$false

    return ($res.ExitCode -eq 0 -and $res.FinalOutcome -eq "IMPLEMENTED_TESTED_COMMITTED_AND_FULLY_SYNCHRONIZED" -and $res.OriginHash -eq $res.UpstreamHash -and $res.OriginHash -eq $res.LocalHead)
}

# ------------------------------------------------------------------------------
# Test 21: Wrapper invocation from outside the repository directory
# ------------------------------------------------------------------------------
Run-Scenario -Id 21 -Name "Wrapper invocation from outside repo directory" -Action {
    $env = New-TestEnv "test21"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/outside') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/outside') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'upstream', 'feature/outside') | Out-Null

    # Execute wrapper from outside the repo ($TestDir)
    $origPwd = (Get-Location).Path
    try {
        Set-Location $TestDir
        $wrapper = $env.WrapperPath
        $output = & powershell.exe -ExecutionPolicy Bypass -File $wrapper -FeatureName "Outside Execution" -RunTests:$false
        $code = $LASTEXITCODE
        $matched = ($output -join "`n") -match 'IMPLEMENTED_TESTED_COMMITTED_AND_FULLY_SYNCHRONIZED'
        return ($code -eq 0 -and $matched)
    } finally {
        Set-Location $origPwd
    }
}

# ------------------------------------------------------------------------------
# Test 22: Paths containing spaces and brackets
# ------------------------------------------------------------------------------
Run-Scenario -Id 22 -Name "Paths containing spaces and brackets" -Action {
    $env = New-TestEnv "test22"
    Invoke-TestGit -Dir $env.ClientDir -Args @('checkout', '-b', 'feature/complex-paths') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'origin', 'feature/complex-paths') | Out-Null
    Invoke-TestGit -Dir $env.ClientDir -Args @('push', '-u', 'upstream', 'feature/complex-paths') | Out-Null

    $complexDir = Join-Path $env.ClientDir "src\app\admin\questions\[id]\edit"
    New-Item -ItemType Directory -Path $complexDir -Force | Out-Null
    $complexFile = Join-Path $complexDir "page with spaces.tsx"
    Set-Content -LiteralPath $complexFile -Value "export default function ComplexPage() { return <div>OK</div>; }"

    . $env.EnginePath
    $relPath = "src/app/admin/questions/[id]/edit/page with spaces.tsx"
    $res = Invoke-FeatureWorkflow -FeatureName "Fix complex bracket path" -ApprovedPaths @($relPath) -ApproveCommit -RepoPath $env.ClientDir -RunTests:$false

    return ($res.ExitCode -eq 0 -and $res.FinalOutcome -eq "IMPLEMENTED_TESTED_COMMITTED_AND_FULLY_SYNCHRONIZED")
}

# ------------------------------------------------------------------------------
# Cleanup and Summary
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "AUTOMATED TEST SUITE SUMMARY" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

$passedCount = ($testResults | Where-Object { $_.Status -eq "PASSED" }).Count
$failedCount = ($testResults | Where-Object { $_.Status -ne "PASSED" }).Count

foreach ($t in $testResults) {
    $color = if ($t.Status -eq "PASSED") { "Green" } else { "Red" }
    Write-Host ("[{0}] Test {1:D2}: {2} {3}" -f $t.Status, $t.Id, $t.Name, $t.Message) -ForegroundColor $color
}

Write-Host "------------------------------------------------------" -ForegroundColor Cyan
Write-Host "Total Tests: $($testResults.Count) | Passed: $passedCount | Failed: $failedCount" -ForegroundColor $(if ($failedCount -eq 0) { "Green" } else { "Red" })
Write-Host "======================================================" -ForegroundColor Cyan

if (-not $KeepTempDirs) {
    Remove-Item -LiteralPath $TestDir -Recurse -Force -ErrorAction SilentlyContinue
}

if ($failedCount -gt 0) {
    exit 1
} else {
    exit 0
}
