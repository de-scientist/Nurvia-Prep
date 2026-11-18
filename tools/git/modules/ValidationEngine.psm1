<#
.SYNOPSIS
    Validation Engine Module for Nurvia-Prep.
.DESCRIPTION
    Runs project verification checks at designated milestones, records exit codes,
    and compares against recorded baselines to distinguish pre-existing failures.
#>

function Invoke-MilestoneValidation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Commands,
        [string]$RepoRoot = (Get-Location).Path,
        [hashtable]$Baseline = @{},
        [string]$LogDir = $RepoRoot
    )

    $results = @()
    foreach ($cmd in $Commands) {
        $outFile = Join-Path $LogDir 'last-validate-out.txt'
        $errFile = Join-Path $LogDir 'last-validate-err.txt'

        $p = Start-Process -FilePath 'powershell' -ArgumentList '-NoProfile', '-Command', $cmd `
                -WorkingDirectory $RepoRoot -Wait -PassThru -NoNewWindow `
                -RedirectStandardOutput $outFile `
                -RedirectStandardError $errFile

        $exitCode = $p.ExitCode
        $baseCode = if ($Baseline.ContainsKey($cmd)) { $Baseline[$cmd] } else { $null }

        $status = 'OK'
        $isNewFailure = $false
        if ($null -ne $baseCode -and $exitCode -ne $baseCode -and $exitCode -ne 0) {
            $status = 'NEW-FAILURE'
            $isNewFailure = $true
        } elseif ($exitCode -ne 0) {
            $status = 'BASELINE-FAILURE'
        }

        $results += [pscustomobject]@{
            Command      = $cmd
            ExitCode     = $exitCode
            BaselineCode = $baseCode
            Status       = $status
            IsNewFailure = $isNewFailure
        }
    }
    return $results
}

Export-ModuleMember -Function Invoke-MilestoneValidation
