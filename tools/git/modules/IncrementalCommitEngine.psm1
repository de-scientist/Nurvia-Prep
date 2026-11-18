<#
.SYNOPSIS
    Incremental Commit Engine Module for Nurvia-Prep.
.DESCRIPTION
    Executes selective staging without git add ., verifies staged diffs, generates conventional commits,
    records commit hashes, and audits committed file contents.
#>

function Invoke-SelectiveStage {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$FilesToStage,
        [string]$RepoRoot = (Get-Location).Path
    )

    if ($FilesToStage.Count -eq 0) {
        return [pscustomobject]@{ Success = $false; Message = 'No files specified for staging' }
    }

    $stageArgs = @('-C', $RepoRoot, 'add', '--') + $FilesToStage
    $out = & git @stageArgs 2>&1
    $exitCode = $LASTEXITCODE

    return [pscustomobject]@{
        Success  = ($exitCode -eq 0)
        ExitCode = $exitCode
        Output   = (($out | ForEach-Object { "$_" }) -join "`n")
    }
}

function Assert-StagedSet {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$ExpectedFiles,
        [string]$RepoRoot = (Get-Location).Path
    )

    $raw = & git -C $RepoRoot diff --cached --name-only 2>&1
    $stagedNow = @($raw | ForEach-Object { $_.Trim().Trim('"').Replace('\', '/') } | Where-Object { $_ } | Sort-Object -Unique)
    $expected  = @($ExpectedFiles | ForEach-Object { $_.Trim().Trim('"').Replace('\', '/') } | Where-Object { $_ } | Sort-Object -Unique)

    $unexpected = @($stagedNow | Where-Object { $_ -notin $expected })
    $missing    = @($expected | Where-Object { $_ -notin $stagedNow })

    $isExactMatch = ($unexpected.Count -eq 0 -and $missing.Count -eq 0)

    return [pscustomobject]@{
        IsMatch    = $isExactMatch
        StagedNow  = $stagedNow
        Unexpected = $unexpected
        Missing    = $missing
    }
}

function Invoke-UnitCommit {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Subject,
        [Parameter(Mandatory = $true)]
        [string]$Body,
        [Parameter(Mandatory = $true)]
        [string[]]$ExpectedFiles,
        [string]$RepoRoot = (Get-Location).Path
    )

    # Empty staged diff check
    & git -C $RepoRoot diff --cached --quiet 2>&1
    if ($LASTEXITCODE -eq 0) {
        return [pscustomobject]@{
            Success = $false
            Status  = 'skipped-empty'
            Message = 'Staged diff is empty; nothing to commit'
        }
    }

    $commitArgs = @('-C', $RepoRoot, 'commit', '-m', $Subject, '-m', $Body)
    $out = & git @commitArgs 2>&1
    $commitCode = $LASTEXITCODE

    if ($commitCode -ne 0) {
        return [pscustomobject]@{
            Success  = $false
            Status   = 'failed-commit'
            ExitCode = $commitCode
            Message  = (($out | ForEach-Object { "$_" }) -join "`n")
        }
    }

    $hash = (& git -C $RepoRoot rev-parse HEAD).Trim()
    $headSubject = (& git -C $RepoRoot log -1 --format=%s).Trim()
    $rawFiles = & git -C $RepoRoot show --name-only --format= $hash 2>&1
    $committedFiles = @($rawFiles | ForEach-Object { $_.Trim().Trim('"').Replace('\', '/') } | Where-Object { $_ } | Sort-Object -Unique)

    $expected = @($ExpectedFiles | ForEach-Object { $_.Trim().Trim('"').Replace('\', '/') } | Sort-Object -Unique)
    $badFiles = @($committedFiles | Where-Object { $_ -notin $expected })

    if ($headSubject -ne $Subject) {
        return [pscustomobject]@{
            Success = $false
            Status  = 'failed-verify-subject'
            Hash    = $hash
            Message = "Subject mismatch: '$headSubject' vs expected '$Subject'"
        }
    }

    if ($badFiles.Count -gt 0) {
        return [pscustomobject]@{
            Success  = $false
            Status   = 'failed-verify-files'
            Hash     = $hash
            BadFiles = $badFiles
            Message  = "Commit contains unexpected files: $($badFiles -join ', ')"
        }
    }

    return [pscustomobject]@{
        Success        = $true
        Status         = 'committed'
        Hash           = $hash
        Subject        = $headSubject
        CommittedFiles = $committedFiles
    }
}

function Reset-StagedChanges {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$FilesToUnstage,
        [string]$RepoRoot = (Get-Location).Path
    )

    $args = @('-C', $RepoRoot, 'reset', '-q', 'HEAD', '--') + $FilesToUnstage
    & git @args 2>&1 | Out-Null
}

Export-ModuleMember -Function Invoke-SelectiveStage, Assert-StagedSet, Invoke-UnitCommit, Reset-StagedChanges
