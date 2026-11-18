<#
.SYNOPSIS
    Security Engine Module for Nurvia-Prep Git Automation.
.DESCRIPTION
    Scans candidate files for leaked credentials, secrets, private keys, database connection
    strings, and oversized files. Never exposes secret values in logs or output.
#>

$script:SecurityPatterns = [ordered]@{
    'AWS-ACCESS-KEY'   = 'AKIA[0-9A-Z]{16}'
    'GITHUB-TOKEN'     = 'ghp_[A-Za-z0-9]{36}'
    'STRIPE-LIVE-KEY'  = 'sk_live_[A-Za-z0-9]{24}'
    'PRIVATE-KEY'      = '-----BEGIN [A-Z ]*PRIVATE KEY'
    'GOOGLE-API-KEY'   = 'AIza[0-9A-Za-z_-]{35}'
    'SLACK-TOKEN'      = 'xox[baprs]-[A-Za-z0-9-]+'
    'DB-CONNECTION'    = '(mongodb|postgres|mysql|redis)://[^\s"'']+'
}

function Invoke-SecurityAuditEngine {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$CandidateFiles,
        [string]$RepoRoot = (Get-Location).Path,
        [int64]$MaxSizeBytes = 5242880 # 5 MB
    )

    $findings = @()
    $excludedEnv = @()

    foreach ($relPath in $CandidateFiles) {
        $fullPath = Join-Path $RepoRoot $relPath
        if (-not (Test-Path -LiteralPath $fullPath)) { continue }

        # Check for disallowed environment or secret files
        if ($relPath -match '(\.env|\.pem|\.key|\.p12)$') {
            $excludedEnv += [pscustomobject]@{
                File = $relPath
                Rule = 'DISALLOWED-FILE-TYPE'
            }
            continue
        }

        $item = Get-Item -LiteralPath $fullPath
        if ($item.Length -gt $MaxSizeBytes) {
            $findings += [pscustomobject]@{
                File   = $relPath
                Line   = 0
                Rule   = 'OVERSIZED-FILE'
                Detail = "File size $($item.Length) bytes exceeds threshold"
            }
        }

        if ($relPath -match '\.(ts|tsx|js|jsx|json|css|html|md|mjs|txt|ya?ml)$') {
            try {
                $lines = [System.IO.File]::ReadAllLines($fullPath)
                for ($i = 0; $i -lt $lines.Length; $i++) {
                    $line = $lines[$i]
                    foreach ($rule in $script:SecurityPatterns.Keys) {
                        $pattern = $script:SecurityPatterns[$rule]
                        if ($line -match $pattern) {
                            $findings += [pscustomobject]@{
                                File   = $relPath
                                Line   = ($i + 1)
                                Rule   = $rule
                                Detail = 'Potential secret pattern detected (value redacted)'
                            }
                        }
                    }
                }
            } catch {
                Write-Warning "Could not read file for security audit: $relPath"
            }
        }
    }

    return [pscustomobject]@{
        Passed      = ($findings.Count -eq 0 -and $excludedEnv.Count -eq 0)
        Findings    = $findings
        BlockedEnv  = $excludedEnv
        ScannedFiles= $CandidateFiles.Count
    }
}

Export-ModuleMember -Function Invoke-SecurityAuditEngine
