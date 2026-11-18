<#
.SYNOPSIS
    Remote Synchronization Engine Module for Nurvia-Prep.
.DESCRIPTION
    Audits outgoing commits, verifies remote connectivity and ancestry, and pushes
    commits safely without force-pushing or rewriting history.
#>

function Test-RemoteReadiness {
    [CmdletBinding()]
    param(
        [string]$RemoteName = 'origin',
        [string]$Branch = 'main',
        [string]$RepoRoot = (Get-Location).Path
    )

    # Check remote existence
    $remotes = (& git -C $RepoRoot remote) -split "`n" | ForEach-Object { $_.Trim() }
    if ($RemoteName -notin $remotes) {
        return [pscustomobject]@{
            Ready   = $false
            Message = "Remote '$RemoteName' is not configured in repository."
        }
    }

    # Fetch refs non-destructively
    $fetchOut = & git -C $RepoRoot fetch $RemoteName 2>&1
    $fetchCode = $LASTEXITCODE
    if ($fetchCode -ne 0) {
        return [pscustomobject]@{
            Ready   = $false
            Message = "git fetch $RemoteName failed with exit code $fetchCode."
        }
    }

    # Check remote branch ref
    $lsRemote = & git -C $RepoRoot ls-remote $RemoteName "refs/heads/$Branch" 2>&1
    $remoteHead = if ($lsRemote -match '^([a-f0-9]{40})\s+') { $matches[1] } else { $null }

    # Check ancestry if remote head exists
    $isAncestor = $true
    if ($remoteHead) {
        & git -C $RepoRoot merge-base --is-ancestor $remoteHead HEAD 2>&1 | Out-Null
        $isAncestor = ($LASTEXITCODE -eq 0)
    }

    # Check outgoing commits
    $outgoing = @()
    if ($remoteHead) {
        $rawOutgoing = & git -C $RepoRoot log --oneline "$remoteHead..HEAD" 2>&1
        $outgoing = @($rawOutgoing | Where-Object { $_.Trim() })
    }

    return [pscustomobject]@{
        Ready        = $isAncestor
        RemoteName   = $RemoteName
        Branch       = $Branch
        RemoteHead   = $remoteHead
        IsAncestor   = $isAncestor
        OutgoingCount= $outgoing.Count
        Outgoing     = $outgoing
    }
}

function Invoke-VerifiedPush {
    [CmdletBinding()]
    param(
        [string]$RemoteName = 'origin',
        [string]$Branch = 'main',
        [string]$RepoRoot = (Get-Location).Path
    )

    $localHead = (& git -C $RepoRoot rev-parse HEAD).Trim()

    $pushOut = & git -C $RepoRoot push $RemoteName $Branch 2>&1
    $pushCode = $LASTEXITCODE

    if ($pushCode -ne 0) {
        return [pscustomobject]@{
            Success  = $false
            ExitCode = $pushCode
            Message  = (($pushOut | ForEach-Object { "$_" }) -join "`n")
        }
    }

    # Verify remote HEAD matches local HEAD
    $lsRemote = & git -C $RepoRoot ls-remote $RemoteName "refs/heads/$Branch" 2>&1
    $newRemoteHead = if ($lsRemote -match '^([a-f0-9]{40})\s+') { $matches[1] } else { $null }

    $verified = ($newRemoteHead -eq $localHead)

    return [pscustomobject]@{
        Success       = ($pushCode -eq 0 -and $verified)
        LocalHead     = $localHead
        RemoteHead    = $newRemoteHead
        VerifiedMatch = $verified
        Output        = (($pushOut | ForEach-Object { "$_" }) -join "`n")
    }
}

Export-ModuleMember -Function Test-RemoteReadiness, Invoke-VerifiedPush
