<#
.SYNOPSIS
    Remote Synchronization Engine for Nurvia-Prep.
.DESCRIPTION
    Production-hardened, fail-safe Git lifecycle engine:
    Inspection -> Safety Gate -> Change Classification -> Implementation Validation ->
    Staged Secret Scanning -> Selective Staging -> Conventional Commit -> Push ->
    Cross-Remote Synchronization (origin <-> upstream) -> Fresh Verification -> Structured Report.
#>

# ==============================================================================
# Helper Functions
# ==============================================================================

function Get-GitRepositoryRoot {
    [CmdletBinding()]
    param(
        [string]$StartingPath = ""
    )

    if ([string]::IsNullOrEmpty($StartingPath)) {
        $StartingPath = (Get-Location).Path
    }

    # First attempt: ask git directly
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        if (Test-Path -LiteralPath $StartingPath) {
            $topLevel = & git -C $StartingPath rev-parse --show-toplevel 2>$null
            if ($LASTEXITCODE -eq 0 -and $topLevel) {
                return ($topLevel.Trim() -replace '/', '\')
            }
        }
    } catch {}
    finally {
        $ErrorActionPreference = $prevEap
    }

    # Second attempt: traverse upwards looking for .git
    $dir = $StartingPath
    if (Test-Path -LiteralPath $dir) {
        $item = Get-Item -LiteralPath $dir
        if (-not $item.PSIsContainer) {
            $dir = $item.DirectoryName
        }
    }

    while ($dir -and (Test-Path -LiteralPath $dir)) {
        if (Test-Path -LiteralPath (Join-Path $dir ".git")) {
            return $dir
        }
        $parent = [System.IO.Directory]::GetParent($dir)
        if ($null -eq $parent) { break }
        $dir = $parent.FullName
    }

    return $null
}

function Invoke-GitCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$RepoRoot,
        [Parameter(Mandatory=$true)]
        [string[]]$Arguments,
        [switch]$IgnoreExitCode
    )

    $fullArgs = @('-C', $RepoRoot) + $Arguments

    # In PowerShell 5.1, when $ErrorActionPreference = 'Stop', any stderr output from native binaries
    # triggers a terminating exception even with 2>&1. We suppress terminating on stderr stream here.
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $rawOutput = & git @fullArgs 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEap
    }

    $stdoutList = [System.Collections.Generic.List[string]]::new()
    $stderrList = [System.Collections.Generic.List[string]]::new()
    $allList = [System.Collections.Generic.List[string]]::new()

    if ($rawOutput) {
        foreach ($line in $rawOutput) {
            $str = if ($null -ne $line) { $line.ToString() } else { "" }
            $allList.Add($str)
            if ($line -is [System.Management.Automation.ErrorRecord]) {
                $stderrList.Add($str)
            } else {
                $stdoutList.Add($str)
            }
        }
    }

    return [PSCustomObject]@{
        ExitCode = $exitCode
        Success  = ($exitCode -eq 0)
        Output   = $allList.ToArray()
        Stdout   = $stdoutList.ToArray()
        Stderr   = $stderrList.ToArray()
        Text     = ($allList -join "`n")
    }
}

function Normalize-GitPath {
    param([string]$Path)
    if ([string]::IsNullOrEmpty($Path)) { return "" }
    $p = $Path.Trim().Replace('\', '/')
    while ($p.StartsWith('./')) {
        $p = $p.Substring(2)
    }
    return $p.TrimEnd('/')
}

function Get-GitWorkingTreeStatus {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$RepoRoot
    )

    $gitRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('status', '--porcelain=v1', '-uall', '-z')
    if (-not $gitRes.Success) {
        throw "Failed to query Git working tree status: $($gitRes.Text)"
    }

    $staged = [System.Collections.Generic.List[PSCustomObject]]::new()
    $unstaged = [System.Collections.Generic.List[PSCustomObject]]::new()
    $untracked = [System.Collections.Generic.List[string]]::new()

    $joined = ($gitRes.Output -join "`n")
    $tokens = $joined -split [char]0 | Where-Object { $_ -ne "" }

    $i = 0
    while ($i -lt $tokens.Count) {
        $token = $tokens[$i]
        if ($token.Length -lt 3) {
            $i++
            continue
        }
        $statusCode = $token.Substring(0, 2)
        $filePath = $token.Substring(3)
        $origPath = $null

        if ($statusCode[0] -in @('R', 'C') -and ($i + 1) -lt $tokens.Count) {
            $i++
            $origPath = $tokens[$i]
        }

        $x = $statusCode[0]
        $y = $statusCode[1]

        if ($statusCode -eq '??') {
            $untracked.Add($filePath)
        } else {
            if ($x -ne ' ' -and $x -ne '?') {
                $staged.Add([PSCustomObject]@{
                    Path = $filePath
                    Status = $x
                    OriginalPath = $origPath
                })
            }
            if ($y -ne ' ' -and $y -ne '?') {
                $unstaged.Add([PSCustomObject]@{
                    Path = $filePath
                    Status = $y
                    OriginalPath = $origPath
                })
            }
        }
        $i++
    }

    return [PSCustomObject]@{
        Staged           = $staged.ToArray()
        Unstaged         = $unstaged.ToArray()
        Untracked        = $untracked.ToArray()
        IsClean          = ($staged.Count -eq 0 -and $unstaged.Count -eq 0 -and $untracked.Count -eq 0)
        TotalUncommitted = ($staged.Count + $unstaged.Count + $untracked.Count)
    }
}

function Invoke-StagedSecretScan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$RepoRoot,
        [Parameter(Mandatory=$true)]
        [string[]]$StagedFiles
    )

    $findings = [System.Collections.Generic.List[PSCustomObject]]::new()
    if ($StagedFiles.Count -eq 0) {
        return $findings.ToArray()
    }

    $secretRules = @(
        @{ Id = "AWS_ACCESS_KEY_ID"; Pattern = '(?i)\b(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b' },
        @{ Id = "AWS_SECRET_ACCESS_KEY"; Pattern = '(?i)\b(?:aws_secret_access_key|aws_secret_key)\s*[:=]\s*[''"]?[A-Za-z0-9\/+=]{40}[''"]?\b' },
        @{ Id = "GITHUB_PAT"; Pattern = '\b(?:ghp_[A-Za-z0-9]{36}|gho_[A-Za-z0-9]{36}|ghu_[A-Za-z0-9]{36}|ghs_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82})\b' },
        @{ Id = "STRIPE_SECRET_KEY"; Pattern = '\b(?:sk_live_[0-9a-zA-Z]{24,}|rk_live_[0-9a-zA-Z]{24,}|sk_test_[0-9a-zA-Z]{24,}|rk_test_[0-9a-zA-Z]{24,})\b' },
        @{ Id = "PRIVATE_KEY_BLOCK"; Pattern = '-----BEGIN (?:RSA|OPENSSH|EC|DSA|PGP|ENCRYPTED|PRIVATE KEY)-----' },
        @{ Id = "DATABASE_URL_CREDENTIALS"; Pattern = '(?i)(?:postgres|postgresql|mysql|mongodb|redis|mssql):\/\/[^\s:]+:([^\s@]{3,})@' },
        @{ Id = "JWT_AUTH_SECRET"; Pattern = '(?i)\b(?:auth_secret|jwt_secret|app_secret|api_secret|session_secret|client_secret)\s*[:=]\s*[''"][^\s''"]{10,}[''"]' },
        @{ Id = "SLACK_TOKEN"; Pattern = '\bxox[baprs]-[0-9a-zA-Z-]{10,}\b' },
        @{ Id = "GOOGLE_API_KEY"; Pattern = '\bAIza[0-9A-Za-z\\-_]{35}\b' }
    )

    foreach ($file in $StagedFiles) {
        if ([string]::IsNullOrWhiteSpace($file)) { continue }

        # Scan staged diff additions with line numbers
        $diffRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('diff', '--cached', '-U0', '--', $file)
        if ($diffRes.Success -and $diffRes.Output.Count -gt 0) {
            $currentLine = 1
            foreach ($line in $diffRes.Output) {
                if ($line -match '^@@ -[0-9]+(?:,[0-9]+)? \+([0-9]+)(?:,[0-9]+)? @@') {
                    $currentLine = [int]$matches[1]
                    continue
                }
                if ($line.StartsWith('+') -and -not $line.StartsWith('+++')) {
                    $addedContent = $line.Substring(1)
                    foreach ($rule in $secretRules) {
                        if ($addedContent -match $rule.Pattern) {
                            $findings.Add([PSCustomObject]@{
                                File   = $file
                                Line   = $currentLine
                                RuleId = $rule.Id
                            })
                        }
                    }
                    $currentLine++
                }
            }
        } else {
            # Staged file without diff hunk (new file or special case): check full staged content
            $showRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('show', ":$file")
            if ($showRes.Success) {
                $lineNum = 1
                foreach ($line in $showRes.Output) {
                    foreach ($rule in $secretRules) {
                        if ($line -match $rule.Pattern) {
                            $findings.Add([PSCustomObject]@{
                                File   = $file
                                Line   = $lineNum
                                RuleId = $rule.Id
                            })
                        }
                    }
                    $lineNum++
                }
            }
        }
    }

    return $findings.ToArray()
}

function Invoke-ValidationCommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$RepoRoot,
        [Parameter(Mandatory=$true)]
        [string]$Command
    )

    $pinfo = New-Object System.Diagnostics.ProcessStartInfo
    $pinfo.FileName = "powershell.exe"
    $pinfo.Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command `"$Command`""
    $pinfo.WorkingDirectory = $RepoRoot
    $pinfo.RedirectStandardOutput = $true
    $pinfo.RedirectStandardError = $true
    $pinfo.UseShellExecute = $false
    $pinfo.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($pinfo)
    $stdout = $proc.StandardOutput.ReadToEnd()
    $stderr = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()
    $exitCode = $proc.ExitCode

    $combined = ($stdout + "`n" + $stderr).Trim()
    return [PSCustomObject]@{
        ExitCode = $exitCode
        Output   = $combined
        Success  = ($exitCode -eq 0)
    }
}

function Invoke-ProjectValidation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$RepoRoot,
        [bool]$RunTests = $true,
        [string[]]$ValidationCommands = @(),
        [bool]$RunBuild = $false
    )

    $results = [System.Collections.Generic.List[PSCustomObject]]::new()

    # 1. Mandatory Git whitespace checks
    $diffCheck = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('diff', '--check')
    $results.Add([PSCustomObject]@{
        Command       = "git diff --check"
        ExitCode      = $diffCheck.ExitCode
        Status        = $(if ($diffCheck.Success) { "Passed" } else { "Failed" })
        Output        = $diffCheck.Text
        FailureOutput = $(if (-not $diffCheck.Success) { $diffCheck.Text } else { "" })
        Skipped       = $false
    })

    $cachedDiffCheck = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('diff', '--cached', '--check')
    $results.Add([PSCustomObject]@{
        Command       = "git diff --cached --check"
        ExitCode      = $cachedDiffCheck.ExitCode
        Status        = $(if ($cachedDiffCheck.Success) { "Passed" } else { "Failed" })
        Output        = $cachedDiffCheck.Text
        FailureOutput = $(if (-not $cachedDiffCheck.Success) { $cachedDiffCheck.Text } else { "" })
        Skipped       = $false
    })

    # If test execution is disabled
    if (-not $RunTests) {
        $results.Add([PSCustomObject]@{
            Command       = "project-test-suite"
            ExitCode      = 0
            Status        = "Skipped"
            Output        = "Validation tests skipped by user configuration (-RunTests:`$false)"
            FailureOutput = ""
            Skipped       = $true
        })
        return $results.ToArray()
    }

    # 2. Custom validation commands if provided
    if ($ValidationCommands -and $ValidationCommands.Count -gt 0) {
        foreach ($cmd in $ValidationCommands) {
            if ([string]::IsNullOrWhiteSpace($cmd)) { continue }
            $exec = Invoke-ValidationCommand -RepoRoot $RepoRoot -Command $cmd
            $results.Add([PSCustomObject]@{
                Command       = $cmd
                ExitCode      = $exec.ExitCode
                Status        = $(if ($exec.Success) { "Passed" } else { "Failed" })
                Output        = $exec.Output
                FailureOutput = $(if (-not $exec.Success) { $exec.Output } else { "" })
                Skipped       = $false
            })
        }
        return $results.ToArray()
    }

    # 3. Auto-detected project validation checks from repository inspect
    $pkgPath = Join-Path $RepoRoot "package.json"
    $hasPkg = Test-Path -LiteralPath $pkgPath
    $hasLint = $false
    $hasTest = $false
    $hasBuild = $false

    if ($hasPkg) {
        try {
            $rawPkg = Get-Content -LiteralPath $pkgPath -Raw | ConvertFrom-Json
            if ($rawPkg.scripts) {
                if ($rawPkg.scripts.PSObject.Properties['lint']) { $hasLint = $true }
                if ($rawPkg.scripts.PSObject.Properties['test']) { $hasTest = $true }
                if ($rawPkg.scripts.PSObject.Properties['build']) { $hasBuild = $true }
            }
        } catch {}
    }

    # TypeScript check if tsconfig exists
    $tsconfigPath = Join-Path $RepoRoot "tsconfig.json"
    if (Test-Path -LiteralPath $tsconfigPath) {
        $tscCmd = "npx tsc --noEmit"
        $execTsc = Invoke-ValidationCommand -RepoRoot $RepoRoot -Command $tscCmd
        $results.Add([PSCustomObject]@{
            Command       = $tscCmd
            ExitCode      = $execTsc.ExitCode
            Status        = $(if ($execTsc.Success) { "Passed" } else { "Failed" })
            Output        = $execTsc.Output
            FailureOutput = $(if (-not $execTsc.Success) { $execTsc.Output } else { "" })
            Skipped       = $false
        })
    }

    # Lint check
    if ($hasLint) {
        $lintCmd = "npm run lint"
        $execLint = Invoke-ValidationCommand -RepoRoot $RepoRoot -Command $lintCmd
        $results.Add([PSCustomObject]@{
            Command       = $lintCmd
            ExitCode      = $execLint.ExitCode
            Status        = $(if ($execLint.Success) { "Passed" } else { "Failed" })
            Output        = $execLint.Output
            FailureOutput = $(if (-not $execLint.Success) { $execLint.Output } else { "" })
            Skipped       = $false
        })
    }

    # Test check (only if script exists in package.json)
    if ($hasTest) {
        $testCmd = "npm test"
        $execTest = Invoke-ValidationCommand -RepoRoot $RepoRoot -Command $testCmd
        $results.Add([PSCustomObject]@{
            Command       = $testCmd
            ExitCode      = $execTest.ExitCode
            Status        = $(if ($execTest.Success) { "Passed" } else { "Failed" })
            Output        = $execTest.Output
            FailureOutput = $(if (-not $execTest.Success) { $execTest.Output } else { "" })
            Skipped       = $false
        })
    } else {
        $results.Add([PSCustomObject]@{
            Command       = "npm test"
            ExitCode      = 0
            Status        = "Skipped"
            Output        = "No 'test' script declared in package.json"
            FailureOutput = ""
            Skipped       = $true
        })
    }

    # Production build check (if requested)
    if ($RunBuild) {
        if ($hasBuild) {
            $buildCmd = "npm run build"
            $execBuild = Invoke-ValidationCommand -RepoRoot $RepoRoot -Command $buildCmd
            $results.Add([PSCustomObject]@{
                Command       = $buildCmd
                ExitCode      = $execBuild.ExitCode
                Status        = $(if ($execBuild.Success) { "Passed" } else { "Failed" })
                Output        = $execBuild.Output
                FailureOutput = $(if (-not $execBuild.Success) { $execBuild.Output } else { "" })
                Skipped       = $false
            })
        }
    }

    return $results.ToArray()
}

function Compare-GitAncestry {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$RepoRoot,
        [string]$BaseCommit,
        [string]$TargetCommit
    )

    if ([string]::IsNullOrEmpty($BaseCommit) -or [string]::IsNullOrEmpty($TargetCommit)) {
        return "UNKNOWN"
    }
    if ($BaseCommit -eq $TargetCommit) {
        return "EQUAL"
    }

    $isAncestor1 = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('merge-base', '--is-ancestor', $BaseCommit, $TargetCommit)
    if ($isAncestor1.Success) {
        return "BEHIND_TARGET" # Base is ancestor of Target: fast-forward Base -> Target is safe
    }

    $isAncestor2 = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('merge-base', '--is-ancestor', $TargetCommit, $BaseCommit)
    if ($isAncestor2.Success) {
        return "AHEAD_OF_TARGET" # Target is ancestor of Base: Target is behind Base
    }

    return "DIVERGED"
}

function Get-RemoteBranchHash {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$RepoRoot,
        [Parameter(Mandatory=$true)]
        [string]$Remote,
        [Parameter(Mandatory=$true)]
        [string]$Branch
    )

    # First try ls-remote for fresh remote state
    $ls = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('ls-remote', '--heads', $Remote, "refs/heads/$Branch")
    if ($ls.Success -and $ls.Stdout.Count -gt 0) {
        foreach ($line in $ls.Stdout) {
            if ($line -match '^([a-f0-9]{40})\s+') {
                return $matches[1]
            }
        }
    }

    # Fallback to local tracking ref if ls-remote is unavailable
    $rev = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', '--verify', '--quiet', "refs/remotes/$Remote/$Branch")
    if ($rev.Success -and $rev.Stdout.Count -gt 0) {
        return $rev.Stdout[0].Trim()
    }

    return $null
}

# ==============================================================================
# Main Engine Function
# ==============================================================================

function Invoke-FeatureWorkflow {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [ValidateNotNullOrEmpty()]
        [string]$FeatureName,

        [string]$BranchName = "",

        [string]$PushTo = "",

        [bool]$RunTests = $true,

        [string[]]$ApprovedPaths = @(),

        [switch]$ApproveCommit,

        [switch]$DryRun,

        [switch]$AllowMainBranch,

        [switch]$AllowCreateRemoteBranch,

        [string[]]$ValidationCommands = @(),

        [bool]$RunBuild = $false,

        [string]$RepoPath = ""
    )

    $ErrorActionPreference = "Stop"

    # Outcome states
    $STATE_SYNCHRONIZED       = "IMPLEMENTED_TESTED_COMMITTED_AND_FULLY_SYNCHRONIZED"
    $STATE_PUSH_PENDING       = "IMPLEMENTED_TESTED_COMMITTED_PUSH_PENDING"
    $STATE_COMMIT_PENDING     = "IMPLEMENTED_AND_TESTED_COMMIT_PENDING"
    $STATE_WORKTREE_REVIEW    = "WORKTREE_REVIEW_REQUIRED"
    $STATE_VALIDATION_FAILED  = "VALIDATION_FAILED"
    $STATE_SYNC_BLOCKED       = "SYNCHRONIZATION_BLOCKED_CONFLICT_REQUIRES_RESOLUTION"
    $STATE_INCOMPLETE         = "IMPLEMENTATION_INCOMPLETE"

    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host "NURVIA-PREP Feature Workflow Engine (Production)" -ForegroundColor Cyan
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host ""

    # 1. LOCATE REPOSITORY ROOT
    $RepoRoot = if (-not [string]::IsNullOrEmpty($RepoPath)) { $RepoPath } else { Get-GitRepositoryRoot }
    if (-not $RepoRoot -or -not (Test-Path -LiteralPath $RepoRoot)) {
        Write-Host "CRITICAL ERROR: Failed to locate Git repository root." -ForegroundColor Red
        return [PSCustomObject]@{
            FeatureName                 = $FeatureName
            Branch                      = ""
            CommitHash                  = ""
            CommitMessage               = ""
            ApprovedFiles               = $ApprovedPaths
            ValidationResults           = @()
            PushRemote                  = ""
            PushBranch                  = ""
            OriginHash                  = ""
            UpstreamHash                = ""
            LocalHead                   = ""
            WorkingTreeStatus           = "RepositoryNotFound"
            RemainingUncommittedChanges = @()
            FinalOutcome                = $STATE_INCOMPLETE
            ExitCode                    = 6
            Success                     = $false
        }
    }

    # 2. INSPECT CURRENT GIT STATE & BRANCH SELECTION
    Write-Host "1. INSPECTING CURRENT GIT STATE & ACTIVE BRANCH" -ForegroundColor Cyan

    $activeBranchRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('branch', '--show-current')
    $activeBranch = if ($activeBranchRes.Success -and $activeBranchRes.Stdout.Count -gt 0) { $activeBranchRes.Stdout[0].Trim() } else { "" }

    if ([string]::IsNullOrEmpty($activeBranch)) {
        # Check if in detached HEAD
        $headRev = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', '--short', 'HEAD')
        Write-Host "CRITICAL ERROR: Repository is in detached HEAD state ($($headRev.Text)). Workflow requires an active branch." -ForegroundColor Red
        return [PSCustomObject]@{
            FeatureName                 = $FeatureName
            Branch                      = "DETACHED_HEAD"
            CommitHash                  = ""
            CommitMessage               = ""
            ApprovedFiles               = $ApprovedPaths
            ValidationResults           = @()
            PushRemote                  = ""
            PushBranch                  = ""
            OriginHash                  = ""
            UpstreamHash                = ""
            LocalHead                   = ""
            WorkingTreeStatus           = "DetachedHead"
            RemainingUncommittedChanges = @()
            FinalOutcome                = $STATE_INCOMPLETE
            ExitCode                    = 6
            Success                     = $false
        }
    }

    # Verify requested branch matches active branch
    if (-not [string]::IsNullOrEmpty($BranchName) -and $BranchName -ne $activeBranch) {
        # Check if requested branch exists locally
        $branchCheck = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', '--verify', "refs/heads/$BranchName")
        if (-not $branchCheck.Success) {
            Write-Host "ERROR: Requested branch '$BranchName' does not exist locally." -ForegroundColor Red
        } else {
            Write-Host "ERROR: Active branch is '$activeBranch', but requested branch is '$BranchName'." -ForegroundColor Red
            Write-Host "Automatic branch switching is strictly prohibited to protect uncommitted work." -ForegroundColor Red
        }
        return [PSCustomObject]@{
            FeatureName                 = $FeatureName
            Branch                      = $activeBranch
            CommitHash                  = ""
            CommitMessage               = ""
            ApprovedFiles               = $ApprovedPaths
            ValidationResults           = @()
            PushRemote                  = ""
            PushBranch                  = ""
            OriginHash                  = ""
            UpstreamHash                = ""
            LocalHead                   = ""
            WorkingTreeStatus           = "BranchMismatch"
            RemainingUncommittedChanges = @()
            FinalOutcome                = $STATE_WORKTREE_REVIEW
            ExitCode                    = 3
            Success                     = $false
        }
    }

    # Main branch governance policy
    if ($activeBranch -in @('main', 'master')) {
        if (-not $AllowMainBranch) {
            Write-Host "ERROR: Active branch is '$activeBranch' (primary integration branch)." -ForegroundColor Red
            Write-Host "Automatic feature commits or pushes to '$activeBranch' are strictly prohibited by default." -ForegroundColor Red
            Write-Host "To authorize an explicit integration workflow on '$activeBranch', rerun with -AllowMainBranch." -ForegroundColor Red
            return [PSCustomObject]@{
                FeatureName                 = $FeatureName
                Branch                      = $activeBranch
                CommitHash                  = ""
                CommitMessage               = ""
                ApprovedFiles               = $ApprovedPaths
                ValidationResults           = @()
                PushRemote                  = ""
                PushBranch                  = ""
                OriginHash                  = ""
                UpstreamHash                = ""
                LocalHead                   = ""
                WorkingTreeStatus           = "MainBranchProtectionBlocked"
                RemainingUncommittedChanges = @()
                FinalOutcome                = $STATE_WORKTREE_REVIEW
                ExitCode                    = 3
                Success                     = $false
            }
        } else {
            Write-Host "   NOTICE: Explicit integration workflow on '$activeBranch' authorized (-AllowMainBranch)." -ForegroundColor Yellow
        }
    }

    $lastLogRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('log', '-1', '--oneline', '--decorate')
    $lastLog = if ($lastLogRes.Success -and $lastLogRes.Stdout.Count -gt 0) { $lastLogRes.Stdout[0].Trim() } else { "No commits" }

    $remotesRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('remote', '-v')
    $remotesList = $remotesRes.Stdout

    Write-Host "   Repository Root: $RepoRoot" -ForegroundColor White
    Write-Host "   Active Branch:   $activeBranch" -ForegroundColor White
    Write-Host "   Last Commit:     $lastLog" -ForegroundColor White
    Write-Host "   Remotes:`n$($remotesRes.Text)" -ForegroundColor White

    # 3. SAFETY GATE: DIRTY WORKING TREE INVENTORY & SELECTIVE STAGING
    Write-Host ""
    Write-Host "2. SAFETY GATE: WORKING TREE INVENTORY & CLASSIFICATION" -ForegroundColor Cyan

    $initialStatus = Get-GitWorkingTreeStatus -RepoRoot $RepoRoot
    Write-Host "   Working Tree Status: Staged=$($initialStatus.Staged.Count), Unstaged=$($initialStatus.Unstaged.Count), Untracked=$($initialStatus.Untracked.Count)" -ForegroundColor White

    # Normalize approved paths
    $normalizedApproved = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($ap in $ApprovedPaths) {
        $norm = Normalize-GitPath $ap
        if (-not [string]::IsNullOrEmpty($norm)) {
            $normalizedApproved.Add($norm) | Out-Null
        }
    }

    $filesToCommit = [System.Collections.Generic.List[string]]::new()
    $commitHash = ""
    $commitMessage = ""

    # If the working tree is dirty
    if (-not $initialStatus.IsClean) {
        Write-Host "   Pre-existing uncommitted changes detected in working tree." -ForegroundColor Yellow

        # If no approved paths were explicitly provided: STOP immediately
        if ($normalizedApproved.Count -eq 0) {
            Write-Host "   [BLOCKED] No approved feature paths provided (-ApprovedPaths)." -ForegroundColor Red
            Write-Host "   The workflow engine refuses to infer feature ownership from dirty worktree state." -ForegroundColor Red
            Write-Host ""
            Write-Host "   Uncommitted Inventory:" -ForegroundColor Yellow
            if ($initialStatus.Staged.Count -gt 0) {
                Write-Host "     Staged changes ($($initialStatus.Staged.Count)):" -ForegroundColor Yellow
                $initialStatus.Staged | ForEach-Object { Write-Host "       [$($_.Status)] $($_.Path)" -ForegroundColor Yellow }
            }
            if ($initialStatus.Unstaged.Count -gt 0) {
                Write-Host "     Unstaged modifications ($($initialStatus.Unstaged.Count)):" -ForegroundColor Yellow
                $initialStatus.Unstaged | ForEach-Object { Write-Host "       [$($_.Status)] $($_.Path)" -ForegroundColor Yellow }
            }
            if ($initialStatus.Untracked.Count -gt 0) {
                Write-Host "     Untracked files ($($initialStatus.Untracked.Count)):" -ForegroundColor Yellow
                $initialStatus.Untracked | ForEach-Object { Write-Host "       [?] $_" -ForegroundColor Yellow }
            }
            Write-Host ""
            Write-Host "   Resolution: Supply -ApprovedPaths @('path1', 'path2') to selectively stage approved files." -ForegroundColor Cyan

            return [PSCustomObject]@{
                FeatureName                 = $FeatureName
                Branch                      = $activeBranch
                CommitHash                  = ""
                CommitMessage               = ""
                ApprovedFiles               = $ApprovedPaths
                ValidationResults           = @()
                PushRemote                  = ""
                PushBranch                  = ""
                OriginHash                  = ""
                UpstreamHash                = ""
                LocalHead                   = (Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', 'HEAD')).Text.Trim()
                WorkingTreeStatus           = "WorktreeReviewRequired"
                RemainingUncommittedChanges = @($initialStatus.Staged.Path + $initialStatus.Unstaged.Path + $initialStatus.Untracked)
                FinalOutcome                = $STATE_WORKTREE_REVIEW
                ExitCode                    = 3
                Success                     = $false
            }
        }

        # Check for pre-existing staged files outside approved scope
        $unauthorizedStaged = [System.Collections.Generic.List[string]]::new()
        foreach ($stg in $initialStatus.Staged) {
            $normStg = Normalize-GitPath $stg.Path
            if (-not $normalizedApproved.Contains($normStg)) {
                $unauthorizedStaged.Add($stg.Path)
            }
        }

        if ($unauthorizedStaged.Count -gt 0) {
            Write-Host "   [BLOCKED] Pre-existing staged changes outside approved feature scope detected:" -ForegroundColor Red
            $unauthorizedStaged | ForEach-Object { Write-Host "     $_" -ForegroundColor Red }
            Write-Host "   Staging will not proceed to prevent committing unrelated staged work." -ForegroundColor Red
            return [PSCustomObject]@{
                FeatureName                 = $FeatureName
                Branch                      = $activeBranch
                CommitHash                  = ""
                CommitMessage               = ""
                ApprovedFiles               = $ApprovedPaths
                ValidationResults           = @()
                PushRemote                  = ""
                PushBranch                  = ""
                OriginHash                  = ""
                UpstreamHash                = ""
                LocalHead                   = (Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', 'HEAD')).Text.Trim()
                WorkingTreeStatus           = "UnauthorizedStagedChangesPresent"
                RemainingUncommittedChanges = @($initialStatus.Staged.Path + $initialStatus.Unstaged.Path + $initialStatus.Untracked)
                FinalOutcome                = $STATE_WORKTREE_REVIEW
                ExitCode                    = 3
                Success                     = $false
            }
        }

        # Selectively stage approved paths
        Write-Host "   Selectively staging approved feature paths..." -ForegroundColor White
        foreach ($approvedPath in $ApprovedPaths) {
            $norm = Normalize-GitPath $approvedPath
            if ([string]::IsNullOrEmpty($norm)) { continue }

            # Check if ignored by Git
            $ignoreCheck = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('check-ignore', '--', $approvedPath)
            if ($ignoreCheck.Success) {
                Write-Host "   [WARNING] File '$approvedPath' is ignored by Git. Skipping." -ForegroundColor Yellow
                continue
            }

            if (-not $DryRun) {
                $addRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('add', '--', $approvedPath)
                if (-not $addRes.Success) {
                    Write-Host "   [ERROR] Failed to stage '$approvedPath': $($addRes.Text)" -ForegroundColor Red
                    return [PSCustomObject]@{
                        FeatureName                 = $FeatureName
                        Branch                      = $activeBranch
                        CommitHash                  = ""
                        CommitMessage               = ""
                        ApprovedFiles               = $ApprovedPaths
                        ValidationResults           = @()
                        PushRemote                  = ""
                        PushBranch                  = ""
                        OriginHash                  = ""
                        UpstreamHash                = ""
                        LocalHead                   = (Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', 'HEAD')).Text.Trim()
                        WorkingTreeStatus           = "StagingFailed"
                        RemainingUncommittedChanges = @($initialStatus.Staged.Path + $initialStatus.Unstaged.Path + $initialStatus.Untracked)
                        FinalOutcome                = $STATE_WORKTREE_REVIEW
                        ExitCode                    = 3
                        Success                     = $false
                    }
                }
            } else {
                Write-Host "   [DRY-RUN] Would stage: $approvedPath" -ForegroundColor Gray
            }
        }

        # Inspect staged changes after selective staging
        if (-not $DryRun) {
            $stagedRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('diff', '--cached', '--name-only', '-z')
            $stagedFiles = if ($stagedRes.Success) {
                ($stagedRes.Output -join "`n") -split [char]0 | Where-Object { $_ -ne "" }
            } else { @() }

            if ($stagedFiles.Count -eq 0) {
                Write-Host "   No changes were staged from the approved file list." -ForegroundColor Yellow
                return [PSCustomObject]@{
                    FeatureName                 = $FeatureName
                    Branch                      = $activeBranch
                    CommitHash                  = ""
                    CommitMessage               = ""
                    ApprovedFiles               = $ApprovedPaths
                    ValidationResults           = @()
                    PushRemote                  = ""
                    PushBranch                  = ""
                    OriginHash                  = ""
                    UpstreamHash                = ""
                    LocalHead                   = (Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', 'HEAD')).Text.Trim()
                    WorkingTreeStatus           = "NoChangesStaged"
                    RemainingUncommittedChanges = @($initialStatus.Unstaged.Path + $initialStatus.Untracked)
                    FinalOutcome                = $STATE_WORKTREE_REVIEW
                    ExitCode                    = 3
                    Success                     = $false
                }
            }

            # Enforce that NO staged file is outside approved scope
            foreach ($sf in $stagedFiles) {
                $normSf = Normalize-GitPath $sf
                if (-not $normalizedApproved.Contains($normSf)) {
                    Write-Host "   [SECURITY BREACH] File '$sf' is staged but not in approved paths. Aborting." -ForegroundColor Red
                    return [PSCustomObject]@{
                        FeatureName                 = $FeatureName
                        Branch                      = $activeBranch
                        CommitHash                  = ""
                        CommitMessage               = ""
                        ApprovedFiles               = $ApprovedPaths
                        ValidationResults           = @()
                        PushRemote                  = ""
                        PushBranch                  = ""
                        OriginHash                  = ""
                        UpstreamHash                = ""
                        LocalHead                   = (Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', 'HEAD')).Text.Trim()
                        WorkingTreeStatus           = "UnapprovedFileStaged"
                        RemainingUncommittedChanges = @($stagedFiles)
                        FinalOutcome                = $STATE_WORKTREE_REVIEW
                        ExitCode                    = 3
                        Success                     = $false
                    }
                }
                $filesToCommit.Add($sf)
            }
        } else {
            # In dry-run mode, treat approved paths as filesToCommit
            foreach ($ap in $ApprovedPaths) {
                $filesToCommit.Add((Normalize-GitPath $ap))
            }
        }
    } else {
        # Working tree is clean: Check for Commit Recovery state
        Write-Host "   Working tree is clean. Checking for existing unpushed feature commit..." -ForegroundColor White
        $headCommitRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', 'HEAD')
        $headCommit = if ($headCommitRes.Success -and $headCommitRes.Stdout.Count -gt 0) { $headCommitRes.Stdout[0].Trim() } else { "" }
        $headSubjRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('log', '-1', '--format=%s')
        $headSubj = if ($headSubjRes.Success -and $headSubjRes.Stdout.Count -gt 0) { $headSubjRes.Stdout[0].Trim() } else { "" }

        $commitHash = $headCommit
        $commitMessage = $headSubj
    }

    # 4. IMPLEMENTATION VALIDATION & STAGED DIFF REVIEW
    Write-Host ""
    Write-Host "3. IMPLEMENTATION VALIDATION & QUALITY GATES" -ForegroundColor Cyan

    $validationResults = Invoke-ProjectValidation -RepoRoot $RepoRoot -RunTests $RunTests -ValidationCommands $ValidationCommands -RunBuild $RunBuild

    $hasValidationFailure = $false
    foreach ($vr in $validationResults) {
        $color = if ($vr.Status -eq "Passed") { "Green" } elseif ($vr.Status -eq "Skipped") { "Yellow" } else { "Red" }
        Write-Host "   [$($vr.Status)] $($vr.Command)" -ForegroundColor $color
        if ($vr.Status -eq "Failed") {
            $hasValidationFailure = $true
            Write-Host "     Output: $($vr.FailureOutput)" -ForegroundColor Red
        }
    }

    if ($hasValidationFailure) {
        Write-Host "   [BLOCKED] Mandatory implementation validation failed. Halting workflow." -ForegroundColor Red
        return [PSCustomObject]@{
            FeatureName                 = $FeatureName
            Branch                      = $activeBranch
            CommitHash                  = $commitHash
            CommitMessage               = $commitMessage
            ApprovedFiles               = $ApprovedPaths
            ValidationResults           = $validationResults
            PushRemote                  = ""
            PushBranch                  = ""
            OriginHash                  = ""
            UpstreamHash                = ""
            LocalHead                   = (Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', 'HEAD')).Text.Trim()
            WorkingTreeStatus           = "ValidationFailed"
            RemainingUncommittedChanges = @($filesToCommit)
            FinalOutcome                = $STATE_VALIDATION_FAILED
            ExitCode                    = 4
            Success                     = $false
        }
    }

    # 5. CONTENT-BASED SECRET SCANNER
    Write-Host ""
    Write-Host "4. CONTENT-BASED SECRET SCANNING" -ForegroundColor Cyan

    if ($filesToCommit.Count -gt 0 -and -not $DryRun) {
        $secretFindings = Invoke-StagedSecretScan -RepoRoot $RepoRoot -StagedFiles $filesToCommit.ToArray()
        if ($secretFindings.Count -gt 0) {
            Write-Host "   [SECURITY ALERT] Credential or secret patterns detected in staged changes:" -ForegroundColor Red
            foreach ($finding in $secretFindings) {
                Write-Host "     Violation: Rule '$($finding.RuleId)' matched in file '$($finding.File)' at line $($finding.Line)" -ForegroundColor Red
            }
            Write-Host "   Commit blocked. Suspected secrets must be revoked and removed before committing." -ForegroundColor Red
            return [PSCustomObject]@{
                FeatureName                 = $FeatureName
                Branch                      = $activeBranch
                CommitHash                  = ""
                CommitMessage               = ""
                ApprovedFiles               = $ApprovedPaths
                ValidationResults           = $validationResults
                PushRemote                  = ""
                PushBranch                  = ""
                OriginHash                  = ""
                UpstreamHash                = ""
                LocalHead                   = (Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', 'HEAD')).Text.Trim()
                WorkingTreeStatus           = "SecretsDetected"
                RemainingUncommittedChanges = @($filesToCommit)
                FinalOutcome                = $STATE_VALIDATION_FAILED
                ExitCode                    = 4
                Success                     = $false
            }
        } else {
            Write-Host "   Content scan clean: 0 detected secrets in staged files." -ForegroundColor Green
        }
    } else {
        Write-Host "   No newly staged files to scan." -ForegroundColor Gray
    }

    # 6. STAGED DIFF REVIEW & EXPLICIT COMMIT APPROVAL GATE
    if ($filesToCommit.Count -gt 0) {
        Write-Host ""
        Write-Host "5. STAGED CHANGES REVIEW" -ForegroundColor Cyan
        Write-Host "   Staged files to commit:" -ForegroundColor White
        $filesToCommit | ForEach-Object { Write-Host "     $_" -ForegroundColor White }

        if (-not $DryRun) {
            $diffStatRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('diff', '--cached', '--stat')
            Write-Host "   Staged diff summary:`n$($diffStatRes.Text)" -ForegroundColor Gray
        }

        if (-not $ApproveCommit) {
            Write-Host "   [COMMIT APPROVAL REQUIRED] Changes staged and validated." -ForegroundColor Yellow
            Write-Host "   Explicit approval is required before committing. Rerun with -ApproveCommit." -ForegroundColor Yellow
            return [PSCustomObject]@{
                FeatureName                 = $FeatureName
                Branch                      = $activeBranch
                CommitHash                  = ""
                CommitMessage               = ""
                ApprovedFiles               = $ApprovedPaths
                ValidationResults           = $validationResults
                PushRemote                  = ""
                PushBranch                  = ""
                OriginHash                  = ""
                UpstreamHash                = ""
                LocalHead                   = (Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', 'HEAD')).Text.Trim()
                WorkingTreeStatus           = "CommitApprovalPending"
                RemainingUncommittedChanges = @($filesToCommit)
                FinalOutcome                = $STATE_COMMIT_PENDING
                ExitCode                    = 2
                Success                     = $false
            }
        }

        # 7. CREATE CONVENTIONAL COMMIT
        Write-Host ""
        Write-Host "6. CREATING CONVENTIONAL COMMIT" -ForegroundColor Cyan

        $commitType = "feat"
        $fl = $FeatureName.ToLower()
        if ($fl -match 'fix|bug|defect|issue|resolve') {
            $commitType = "fix"
        } elseif ($fl -match 'refactor|cleanup|consolidate') {
            $commitType = "refactor"
        } elseif ($fl -match 'docs|documentation|readme|report') {
            $commitType = "docs"
        } elseif ($fl -match 'test|spec') {
            $commitType = "test"
        }

        $commitSubject = "${commitType}(${activeBranch}): ${FeatureName}"
        Write-Host "   Commit Subject: $commitSubject" -ForegroundColor White

        if (-not $DryRun) {
            $commitRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('commit', '-m', $commitSubject)
            if (-not $commitRes.Success) {
                Write-Host "   [ERROR] Git commit failed: $($commitRes.Text)" -ForegroundColor Red
                return [PSCustomObject]@{
                    FeatureName                 = $FeatureName
                    Branch                      = $activeBranch
                    CommitHash                  = ""
                    CommitMessage               = ""
                    ApprovedFiles               = $ApprovedPaths
                    ValidationResults           = $validationResults
                    PushRemote                  = ""
                    PushBranch                  = ""
                    OriginHash                  = ""
                    UpstreamHash                = ""
                    LocalHead                   = (Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', 'HEAD')).Text.Trim()
                    WorkingTreeStatus           = "CommitFailed"
                    RemainingUncommittedChanges = @($filesToCommit)
                    FinalOutcome                = $STATE_VALIDATION_FAILED
                    ExitCode                    = 4
                    Success                     = $false
                }
            }

            $newHashRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', 'HEAD')
            $commitHash = $newHashRes.Stdout[0].Trim()
            $commitMessage = $commitSubject
            Write-Host "   Commit created successfully: $commitHash" -ForegroundColor Green
        } else {
            Write-Host "   [DRY-RUN] Would create commit: $commitSubject" -ForegroundColor Gray
            $commitHash = "DRY_RUN_COMMIT_HASH"
            $commitMessage = $commitSubject
        }
    }

    # 8. PUSH ACTIVE BRANCH & CROSS-REMOTE SYNCHRONIZATION
    Write-Host ""
    Write-Host "7. PUSH ACTIVE FEATURE BRANCH & REMOTE SYNCHRONIZATION" -ForegroundColor Cyan

    # Determine remotes
    $availableRemotesRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('remote')
    $availableRemotes = $availableRemotesRes.Stdout | Where-Object { $_ }

    if ($availableRemotes.Count -eq 0) {
        Write-Host "   No remotes configured. Local commit preserved." -ForegroundColor Yellow
        return [PSCustomObject]@{
            FeatureName                 = $FeatureName
            Branch                      = $activeBranch
            CommitHash                  = $commitHash
            CommitMessage               = $commitMessage
            ApprovedFiles               = $ApprovedPaths
            ValidationResults           = $validationResults
            PushRemote                  = ""
            PushBranch                  = $activeBranch
            OriginHash                  = ""
            UpstreamHash                = ""
            LocalHead                   = $commitHash
            WorkingTreeStatus           = "NoRemotesConfigured"
            RemainingUncommittedChanges = @()
            FinalOutcome                = $STATE_PUSH_PENDING
            ExitCode                    = 1
            Success                     = $false
        }
    }

    $pushRemote = if (-not [string]::IsNullOrEmpty($PushTo)) {
        $PushTo
    } elseif ($availableRemotes -contains "origin") {
        "origin"
    } else {
        $availableRemotes[0]
    }

    if ($availableRemotes -notcontains $pushRemote) {
        Write-Host "   [ERROR] Specified push remote '$pushRemote' does not exist." -ForegroundColor Red
        return [PSCustomObject]@{
            FeatureName                 = $FeatureName
            Branch                      = $activeBranch
            CommitHash                  = $commitHash
            CommitMessage               = $commitMessage
            ApprovedFiles               = $ApprovedPaths
            ValidationResults           = $validationResults
            PushRemote                  = $pushRemote
            PushBranch                  = $activeBranch
            OriginHash                  = ""
            UpstreamHash                = ""
            LocalHead                   = $commitHash
            WorkingTreeStatus           = "PushRemoteNotFound"
            RemainingUncommittedChanges = @()
            FinalOutcome                = $STATE_PUSH_PENDING
            ExitCode                    = 1
            Success                     = $false
        }
    }

    # Fetch remotes
    Write-Host "   Fetching fresh remote data..." -ForegroundColor White
    foreach ($r in $availableRemotes) {
        $fetchRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('fetch', $r, '--prune')
        if (-not $fetchRes.Success) {
            Write-Host "   [WARNING] Fetch failed for remote '$r': $($fetchRes.Text)" -ForegroundColor Yellow
        }
    }

    $localHead = if ($commitHash -and $commitHash -ne "DRY_RUN_COMMIT_HASH") {
        $commitHash
    } else {
        (Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', 'HEAD')).Stdout[0].Trim()
    }

    # Primary push
    $primaryHash = Get-RemoteBranchHash -RepoRoot $RepoRoot -Remote $pushRemote -Branch $activeBranch
    Write-Host "   Primary target: $pushRemote/$activeBranch (Current Remote Hash: $(if ($primaryHash) { $primaryHash } else { 'ABSENT' }))" -ForegroundColor White

    $pushNeeded = $true
    if ([string]::IsNullOrEmpty($primaryHash)) {
        if (-not $AllowCreateRemoteBranch) {
            Write-Host "   [BLOCKED] Branch '$activeBranch' does not exist on remote '$pushRemote'." -ForegroundColor Red
            Write-Host "   Creating new remote branch requires explicit authorization (-AllowCreateRemoteBranch)." -ForegroundColor Red
            return [PSCustomObject]@{
                FeatureName                 = $FeatureName
                Branch                      = $activeBranch
                CommitHash                  = $commitHash
                CommitMessage               = $commitMessage
                ApprovedFiles               = $ApprovedPaths
                ValidationResults           = $validationResults
                PushRemote                  = $pushRemote
                PushBranch                  = $activeBranch
                OriginHash                  = (Get-RemoteBranchHash -RepoRoot $RepoRoot -Remote "origin" -Branch $activeBranch)
                UpstreamHash                = (Get-RemoteBranchHash -RepoRoot $RepoRoot -Remote "upstream" -Branch $activeBranch)
                LocalHead                   = $localHead
                WorkingTreeStatus           = "RemoteBranchCreationRequired"
                RemainingUncommittedChanges = @()
                FinalOutcome                = $STATE_PUSH_PENDING
                ExitCode                    = 1
                Success                     = $false
            }
        }
    } else {
        $ancestry = Compare-GitAncestry -RepoRoot $RepoRoot -BaseCommit $primaryHash -TargetCommit $localHead
        if ($ancestry -eq "EQUAL") {
            Write-Host "   Remote '$pushRemote' is already synchronized with local HEAD ($localHead)." -ForegroundColor Green
            $pushNeeded = $false
        } elseif ($ancestry -eq "BEHIND_TARGET") {
            Write-Host "   Ancestry verified: remote is ancestor of local branch. Fast-forward push is safe." -ForegroundColor Green
        } else {
            Write-Host "   [DIVERGENCE DETECTED] Remote '$pushRemote/$activeBranch' has diverged from local branch." -ForegroundColor Red
            $divRes = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('log', '--oneline', "$pushRemote/$activeBranch..HEAD")
            $divRemote = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('log', '--oneline', "HEAD..$pushRemote/$activeBranch")
            Write-Host "   Local commits absent on remote:`n$($divRes.Text)" -ForegroundColor Yellow
            Write-Host "   Remote commits absent locally:`n$($divRemote.Text)" -ForegroundColor Red
            Write-Host "   Automatic push blocked. Force-push is strictly prohibited." -ForegroundColor Red
            return [PSCustomObject]@{
                FeatureName                 = $FeatureName
                Branch                      = $activeBranch
                CommitHash                  = $commitHash
                CommitMessage               = $commitMessage
                ApprovedFiles               = $ApprovedPaths
                ValidationResults           = $validationResults
                PushRemote                  = $pushRemote
                PushBranch                  = $activeBranch
                OriginHash                  = (Get-RemoteBranchHash -RepoRoot $RepoRoot -Remote "origin" -Branch $activeBranch)
                UpstreamHash                = (Get-RemoteBranchHash -RepoRoot $RepoRoot -Remote "upstream" -Branch $activeBranch)
                LocalHead                   = $localHead
                WorkingTreeStatus           = "RemoteDiverged"
                RemainingUncommittedChanges = @()
                FinalOutcome                = $STATE_SYNC_BLOCKED
                ExitCode                    = 5
                Success                     = $false
            }
        }
    }

    if ($pushNeeded -and -not $DryRun) {
        $pushArgs = if ([string]::IsNullOrEmpty($primaryHash)) {
            @('push', '-u', $pushRemote, $activeBranch)
        } else {
            @('push', $pushRemote, $activeBranch)
        }
        $pushExec = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments $pushArgs
        if (-not $pushExec.Success) {
            Write-Host "   [ERROR] Push to '$pushRemote/$activeBranch' failed: $($pushExec.Text)" -ForegroundColor Red
            return [PSCustomObject]@{
                FeatureName                 = $FeatureName
                Branch                      = $activeBranch
                CommitHash                  = $commitHash
                CommitMessage               = $commitMessage
                ApprovedFiles               = $ApprovedPaths
                ValidationResults           = $validationResults
                PushRemote                  = $pushRemote
                PushBranch                  = $activeBranch
                OriginHash                  = (Get-RemoteBranchHash -RepoRoot $RepoRoot -Remote "origin" -Branch $activeBranch)
                UpstreamHash                = (Get-RemoteBranchHash -RepoRoot $RepoRoot -Remote "upstream" -Branch $activeBranch)
                LocalHead                   = $localHead
                WorkingTreeStatus           = "PushFailed"
                RemainingUncommittedChanges = @()
                FinalOutcome                = $STATE_PUSH_PENDING
                ExitCode                    = 1
                Success                     = $false
            }
        }
        Write-Host "   Push to '$pushRemote/$activeBranch' succeeded." -ForegroundColor Green
    } elseif ($DryRun) {
        Write-Host "   [DRY-RUN] Would push local branch to '$pushRemote/$activeBranch'" -ForegroundColor Gray
    }

    # Cross-remote synchronization (e.g. origin <-> upstream)
    $secondaryRemote = if ($pushRemote -eq 'origin' -and ($availableRemotes -contains 'upstream')) {
        'upstream'
    } elseif ($pushRemote -eq 'upstream' -and ($availableRemotes -contains 'origin')) {
        'origin'
    } else {
        $null
    }

    if ($secondaryRemote) {
        Write-Host ""
        Write-Host "   Synchronizing with secondary remote '$secondaryRemote'..." -ForegroundColor Cyan
        $secHash = Get-RemoteBranchHash -RepoRoot $RepoRoot -Remote $secondaryRemote -Branch $activeBranch

        if ([string]::IsNullOrEmpty($secHash)) {
            if (-not $AllowCreateRemoteBranch) {
                Write-Host "   Branch does not exist on '$secondaryRemote'. Skipping creation (-AllowCreateRemoteBranch not set)." -ForegroundColor Yellow
            } else {
                if (-not $DryRun) {
                    $secCreate = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('push', $secondaryRemote, $activeBranch)
                    if ($secCreate.Success) {
                        Write-Host "   Branch created on '$secondaryRemote'." -ForegroundColor Green
                    } else {
                        Write-Host "   [WARNING] Failed to push branch to '$secondaryRemote': $($secCreate.Text)" -ForegroundColor Yellow
                    }
                }
            }
        } else {
            $secAncestry = Compare-GitAncestry -RepoRoot $RepoRoot -BaseCommit $secHash -TargetCommit $localHead
            if ($secAncestry -eq "EQUAL") {
                Write-Host "   Secondary remote '$secondaryRemote' already at parity with local HEAD." -ForegroundColor Green
            } elseif ($secAncestry -eq "BEHIND_TARGET") {
                if (-not $DryRun) {
                    $secPush = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('push', $secondaryRemote, $activeBranch)
                    if ($secPush.Success) {
                        Write-Host "   Fast-forward sync successful to '$secondaryRemote'." -ForegroundColor Green
                    } else {
                        Write-Host "   [WARNING] Fast-forward push to '$secondaryRemote' failed: $($secPush.Text)" -ForegroundColor Yellow
                    }
                } else {
                    Write-Host "   [DRY-RUN] Would fast-forward sync '$secondaryRemote/$activeBranch'" -ForegroundColor Gray
                }
            } else {
                Write-Host "   [DIVERGENCE DETECTED] Secondary remote '$secondaryRemote' has diverged from local HEAD." -ForegroundColor Red
                $secDiv = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('log', '--oneline', "$secondaryRemote/$activeBranch..HEAD")
                $secDivRemote = Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('log', '--oneline', "HEAD..$secondaryRemote/$activeBranch")
                Write-Host "   Local commits absent on $secondaryRemote:`n$($secDiv.Text)" -ForegroundColor Yellow
                Write-Host "   $secondaryRemote commits absent locally:`n$($secDivRemote.Text)" -ForegroundColor Red
                return [PSCustomObject]@{
                    FeatureName                 = $FeatureName
                    Branch                      = $activeBranch
                    CommitHash                  = $commitHash
                    CommitMessage               = $commitMessage
                    ApprovedFiles               = $ApprovedPaths
                    ValidationResults           = $validationResults
                    PushRemote                  = $pushRemote
                    PushBranch                  = $activeBranch
                    OriginHash                  = (Get-RemoteBranchHash -RepoRoot $RepoRoot -Remote "origin" -Branch $activeBranch)
                    UpstreamHash                = (Get-RemoteBranchHash -RepoRoot $RepoRoot -Remote "upstream" -Branch $activeBranch)
                    LocalHead                   = $localHead
                    WorkingTreeStatus           = "SecondaryRemoteDiverged"
                    RemainingUncommittedChanges = @()
                    FinalOutcome                = $STATE_SYNC_BLOCKED
                    ExitCode                    = 5
                    Success                     = $false
                }
            }
        }
    }

    # 9. FRESH VERIFICATION & PARITY CHECK
    Write-Host ""
    Write-Host "8. FRESH REMOTE VERIFICATION & PARITY" -ForegroundColor Cyan

    if (-not $DryRun) {
        foreach ($r in $availableRemotes) {
            Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('fetch', $r, '--prune') | Out-Null
        }
    }

    $finalOriginHash = if ($availableRemotes -contains "origin") {
        Get-RemoteBranchHash -RepoRoot $RepoRoot -Remote "origin" -Branch $activeBranch
    } else { $null }

    $finalUpstreamHash = if ($availableRemotes -contains "upstream") {
        Get-RemoteBranchHash -RepoRoot $RepoRoot -Remote "upstream" -Branch $activeBranch
    } else { $null }

    $finalLocalHead = (Invoke-GitCommand -RepoRoot $RepoRoot -Arguments @('rev-parse', 'HEAD')).Stdout[0].Trim()

    Write-Host "   Local HEAD:            $finalLocalHead" -ForegroundColor White
    Write-Host "   origin/$activeBranch:   $(if ($finalOriginHash) { $finalOriginHash } else { 'N/A' })" -ForegroundColor White
    Write-Host "   upstream/$activeBranch: $(if ($finalUpstreamHash) { $finalUpstreamHash } else { 'N/A' })" -ForegroundColor White

    # Determine final outcome
    $outcome = ""
    $exitCode = 0

    if ($DryRun) {
        $outcome = "IMPLEMENTED_AND_TESTED_DRY_RUN_COMPLETE"
        $exitCode = 0
    } elseif ($availableRemotes -contains "origin" -and $availableRemotes -contains "upstream") {
        if ($finalOriginHash -and $finalUpstreamHash) {
            if ($finalOriginHash -eq $finalUpstreamHash -and $finalOriginHash -eq $finalLocalHead) {
                $outcome = $STATE_SYNCHRONIZED
                $exitCode = 0
                Write-Host "   Parity verified: local HEAD = origin/$activeBranch = upstream/$activeBranch ($finalLocalHead)" -ForegroundColor Green
            } else {
                $outcome = $STATE_SYNC_BLOCKED
                $exitCode = 5
                Write-Host "   Parity mismatch between remotes!" -ForegroundColor Red
            }
        } elseif ($finalOriginHash -eq $finalLocalHead -and [string]::IsNullOrEmpty($finalUpstreamHash)) {
            $outcome = $STATE_PUSH_PENDING
            $exitCode = 1
            Write-Host "   Pushed to origin, but branch absent on upstream." -ForegroundColor Yellow
        } else {
            $outcome = $STATE_SYNC_BLOCKED
            $exitCode = 5
        }
    } elseif ($availableRemotes -contains "origin") {
        if ($finalOriginHash -eq $finalLocalHead) {
            $outcome = $STATE_SYNCHRONIZED
            $exitCode = 0
            Write-Host "   Parity verified: local HEAD = origin/$activeBranch ($finalLocalHead)" -ForegroundColor Green
        } else {
            $outcome = $STATE_PUSH_PENDING
            $exitCode = 1
        }
    } else {
        $outcome = $STATE_PUSH_PENDING
        $exitCode = 1
    }

    # 10. FINAL REPORT SUMMARY
    $finalWorktree = Get-GitWorkingTreeStatus -RepoRoot $RepoRoot
    $remainingList = @($finalWorktree.Staged.Path + $finalWorktree.Unstaged.Path + $finalWorktree.Untracked)

    Write-Host ""
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host "WORKFLOW RESULTS SUMMARY" -ForegroundColor Cyan
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host "   Feature Name:        $FeatureName" -ForegroundColor White
    Write-Host "   Branch:              $activeBranch" -ForegroundColor White
    Write-Host "   Commit Hash:         $commitHash" -ForegroundColor White
    Write-Host "   Commit Message:      $commitMessage" -ForegroundColor White
    Write-Host "   Approved Files:      $($ApprovedPaths -join ', ')" -ForegroundColor White
    Write-Host "   Push Target:         $pushRemote/$activeBranch" -ForegroundColor White
    Write-Host "   Origin Hash:         $(if ($finalOriginHash) { $finalOriginHash } else { 'N/A' })" -ForegroundColor White
    Write-Host "   Upstream Hash:       $(if ($finalUpstreamHash) { $finalUpstreamHash } else { 'N/A' })" -ForegroundColor White
    Write-Host "   Local HEAD:          $finalLocalHead" -ForegroundColor White
    Write-Host "   Working Tree:        $(if ($finalWorktree.IsClean) { 'Clean' } else { 'Dirty' }) ($($remainingList.Count) uncommitted items)" -ForegroundColor White
    Write-Host "   Final Outcome:       $outcome" -ForegroundColor $(if ($exitCode -eq 0) { "Green" } else { "Red" })
    Write-Host "   Exit Code:           $exitCode" -ForegroundColor $(if ($exitCode -eq 0) { "Green" } else { "Red" })
    Write-Host "======================================================" -ForegroundColor Cyan

    return [PSCustomObject]@{
        FeatureName                 = $FeatureName
        Branch                      = $activeBranch
        CommitHash                  = $commitHash
        CommitMessage               = $commitMessage
        ApprovedFiles               = $ApprovedPaths
        ValidationResults           = $validationResults
        PushRemote                  = $pushRemote
        PushBranch                  = $activeBranch
        OriginHash                  = $finalOriginHash
        UpstreamHash                = $finalUpstreamHash
        LocalHead                   = $finalLocalHead
        WorkingTreeStatus           = $(if ($finalWorktree.IsClean) { 'Clean' } else { 'Dirty' })
        RemainingUncommittedChanges = $remainingList
        FinalOutcome                = $outcome
        ExitCode                    = $exitCode
        Success                     = ($exitCode -eq 0)
    }
}
