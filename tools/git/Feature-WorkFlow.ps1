<#
.SYNOPSIS
    Nurvia-Prep Feature Workflow — One-command Git synchronization protocol entry point.
.DESCRIPTION
    Production-hardened wrapper for Invoke-FeatureWorkflow.
    Locates repository root reliably, imports the workflow engine, validates parameters,
    executes the workflow, and propagates exit codes and structured result objects.
.EXAMPLE
    .\tools\git\Feature-WorkFlow.ps1 -FeatureName "Restore Tutor Mode progression"
.EXAMPLE
    .\tools\git\Feature-WorkFlow.ps1 -FeatureName "Fix question renderer" -ApprovedPaths @("src/components/exam/Question.tsx") -ApproveCommit
#>

[CmdletBinding()]
param(
    [Parameter(Position=0, Mandatory=$true, HelpMessage="Feature description or summary")]
    [ValidateNotNullOrEmpty()]
    [string]$FeatureName,

    [Parameter(HelpMessage="Target branch name. Defaults to the active Git branch.")]
    [string]$BranchName = "",

    [Parameter(HelpMessage="Intended push remote ('origin' or 'upstream').")]
    [string]$PushTo = "",

    [Parameter(HelpMessage="Execute validation checks (tests, linter, typecheck).")]
    $RunTests = $true,

    [Parameter(HelpMessage="Explicitly approve creating a Git commit for staged changes.")]
    [switch]$ApproveCommit,

    [Parameter(HelpMessage="Simulate workflow execution without modifying Git state.")]
    [switch]$DryRun,

    [Parameter(HelpMessage="List of file paths explicitly approved for feature staging.")]
    [string[]]$ApprovedPaths = @(),

    [Parameter(HelpMessage="Explicit authorization to commit or push on the main integration branch.")]
    [switch]$AllowMainBranch,

    [Parameter(HelpMessage="Explicit authorization to create a new branch on a remote if absent.")]
    [switch]$AllowCreateRemoteBranch,

    [Parameter(HelpMessage="Custom validation commands to execute.")]
    [string[]]$ValidationCommands = @(),

    [Parameter(HelpMessage="Execute production build check as part of validation.")]
    [switch]$RunBuild,

    [Parameter(HelpMessage="Explicit repository path.")]
    [string]$RepoPath = ""
)

$ErrorActionPreference = "Stop"

# 1. Locate repository root reliably (works from inside or outside repo)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrEmpty($ScriptDir)) {
    $ScriptDir = (Get-Location).Path
}

$RepoRoot = $null
if (-not [string]::IsNullOrEmpty($RepoPath) -and (Test-Path -LiteralPath $RepoPath)) {
    $RepoRoot = $RepoPath
}

if (-not $RepoRoot) {
    # Check current working directory
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $topLevel = & git rev-parse --show-toplevel 2>$null
        if ($LASTEXITCODE -eq 0 -and $topLevel) {
            $RepoRoot = ($topLevel.Trim() -replace '/', '\')
        }
    } catch {}
    finally {
        $ErrorActionPreference = $prevEap
    }
}

if (-not $RepoRoot) {
    # Fallback to the repository hosting this script
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $topLevel = & git -C $ScriptDir rev-parse --show-toplevel 2>$null
        if ($LASTEXITCODE -eq 0 -and $topLevel) {
            $RepoRoot = ($topLevel.Trim() -replace '/', '\')
        }
    } catch {}
    finally {
        $ErrorActionPreference = $prevEap
    }
}

if (-not $RepoRoot) {
    # Fallback upwards directory traversal searching for .git
    $curr = $ScriptDir
    while ($curr -and (Test-Path -LiteralPath $curr)) {
        if (Test-Path -LiteralPath (Join-Path $curr ".git")) {
            $RepoRoot = $curr
            break
        }
        $parent = [System.IO.Directory]::GetParent($curr)
        if ($null -eq $parent) { break }
        $curr = $parent.FullName
    }
}

if (-not $RepoRoot) {
    Write-Error "CRITICAL: Could not locate Git repository root from '$ScriptDir'."
    exit 6
}

# 2. Import or dot-source the workflow engine
$EnginePath = Join-Path $ScriptDir "Invoke-FeatureWorkflow.ps1"
if (-not (Test-Path -LiteralPath $EnginePath)) {
    $EnginePath = Join-Path $RepoRoot "tools\git\Invoke-FeatureWorkflow.ps1"
}

if (-not (Test-Path -LiteralPath $EnginePath)) {
    Write-Error "CRITICAL: Workflow engine not found at '$EnginePath'."
    exit 6
}

. $EnginePath

# 3. Validate required inputs
if ([string]::IsNullOrWhiteSpace($FeatureName)) {
    Write-Error "ValidationError: FeatureName cannot be empty or whitespace."
    exit 6
}

# 4. Invoke Invoke-FeatureWorkflow
$runTestsBool = $true
if ($PSBoundParameters.ContainsKey('RunTests')) {
    if ($RunTests -is [bool]) {
        $runTestsBool = $RunTests
    } elseif ($RunTests -is [switch]) {
        $runTestsBool = $RunTests.IsPresent
    } elseif ($RunTests -is [string]) {
        if ($RunTests -in @('$false', 'false', '0', 'no', 'off')) {
            $runTestsBool = $false
        } else {
            $runTestsBool = $true
        }
    } elseif ($RunTests -eq 0) {
        $runTestsBool = $false
    }
}

$engineArgs = @{
    FeatureName              = $FeatureName
    RepoPath                 = $RepoRoot
    RunTests                 = $runTestsBool
    DryRun                   = $DryRun.IsPresent
    ApproveCommit            = $ApproveCommit.IsPresent
    AllowMainBranch          = $AllowMainBranch.IsPresent
    AllowCreateRemoteBranch  = $AllowCreateRemoteBranch.IsPresent
    RunBuild                 = $RunBuild.IsPresent
}

if (-not [string]::IsNullOrEmpty($BranchName)) {
    $engineArgs['BranchName'] = $BranchName
}
if (-not [string]::IsNullOrEmpty($PushTo)) {
    $engineArgs['PushTo'] = $PushTo
}
if ($ApprovedPaths -and $ApprovedPaths.Count -gt 0) {
    $engineArgs['ApprovedPaths'] = $ApprovedPaths
}
if ($ValidationCommands -and $ValidationCommands.Count -gt 0) {
    $engineArgs['ValidationCommands'] = $ValidationCommands
}

$workflowResult = Invoke-FeatureWorkflow @engineArgs

# 5. Propagate exit code and return result object
$exitCode = if ($workflowResult -and $null -ne $workflowResult.ExitCode) { [int]$workflowResult.ExitCode } else { 0 }
$global:LASTEXITCODE = $exitCode

# Emit structured result object to pipeline
$workflowResult

# Exit with engine code
exit $exitCode
