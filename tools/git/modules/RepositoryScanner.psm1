<#
.SYNOPSIS
    Repository Scanner Module for Nurvia-Prep Git Automation Engine.
.DESCRIPTION
    Discovers modified, deleted, and untracked files, builds in-memory dirty sets
    for O(1) change verification, and queries repository commit history.
#>

function Get-GitRepositoryStatus {
    [CmdletBinding()]
    param(
        [string]$RepoRoot = (Get-Location).Path
    )

    $raw = & git -C $RepoRoot status --porcelain -uall 2>&1
    $entries = @()
    foreach ($line in $raw) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.Length -lt 4) { continue }
        $statusCode = $line.Substring(0, 2)
        $path = $line.Substring(3).Trim().Trim('"').Replace('\', '/')
        $entries += [pscustomobject]@{
            StatusCode   = $statusCode
            Path         = $path
            IsUntracked  = ($statusCode -eq '??')
            IsModified   = ($statusCode -match 'M')
            IsDeleted    = ($statusCode -match 'D')
            IsRenamed    = ($statusCode -match 'R')
        }
    }
    return $entries
}

function Get-GitDirtySet {
    [CmdletBinding()]
    param(
        [string]$RepoRoot = (Get-Location).Path
    )

    $dirtySet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $raw = & git -C $RepoRoot status --porcelain -uall 2>&1
    foreach ($line in $raw) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.Length -lt 4) { continue }
        $path = $line.Substring(3).Trim().Trim('"').Replace('\', '/')
        [void]$dirtySet.Add($path)
    }
    return $dirtySet
}

function Get-GitHistorySubjects {
    [CmdletBinding()]
    param(
        [string]$RepoRoot = (Get-Location).Path
    )

    $subjects = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    $raw = & git -C $RepoRoot log --format=%s 2>&1
    foreach ($line in $raw) {
        if (-not [string]::IsNullOrWhiteSpace($line)) {
            [void]$subjects.Add($line.Trim())
        }
    }
    return $subjects
}

function Get-GitRemotesInfo {
    [CmdletBinding()]
    param(
        [string]$RepoRoot = (Get-Location).Path
    )

    $raw = & git -C $RepoRoot remote -v 2>&1
    $remotes = @{}
    foreach ($line in $raw) {
        if ($line -match '^(\S+)\s+(\S+)\s+\((\w+)\)$') {
            $name = $matches[1]
            $url  = $matches[2]
            $type = $matches[3]
            if (-not $remotes.ContainsKey($name)) {
                $remotes[$name] = @{ Name = $name; FetchUrl = $null; PushUrl = $null }
            }
            if ($type -eq 'fetch') { $remotes[$name].FetchUrl = $url }
            if ($type -eq 'push')  { $remotes[$name].PushUrl = $url }
        }
    }
    return $remotes
}

Export-ModuleMember -Function Get-GitRepositoryStatus, Get-GitDirtySet, Get-GitHistorySubjects, Get-GitRemotesInfo
