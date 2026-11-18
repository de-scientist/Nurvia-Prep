<#
.SYNOPSIS
    Standalone CLI runner for Security Audit Engine.
#>
[CmdletBinding()]
param(
    [string]$RepoRoot
)

if (-not $PSScriptRoot) { $PSScriptRoot = (Split-Path -Parent $MyInvocation.MyCommand.Path) }
if (-not $RepoRoot)      { $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path }

Import-Module (Join-Path $PSScriptRoot 'modules\SecurityEngine.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'modules\FeatureClassifier.psm1') -Force

$manifestPath = Join-Path $PSScriptRoot 'integration-manifest.json'
$manifest = Import-IntegrationManifest -ManifestPath $manifestPath

$candidateFiles = @()
foreach ($u in $manifest.units) { $candidateFiles += $u.files }
$candidateFiles = @($candidateFiles | Sort-Object -Unique)

$audit = Invoke-SecurityAuditEngine -CandidateFiles $candidateFiles -RepoRoot $RepoRoot

if ($audit.Passed) {
    Write-Host "[SECURITY AUDIT PASSED] 0 secrets detected across $($audit.ScannedFiles) candidate files." -ForegroundColor Green
    exit 0
} else {
    Write-Host "[SECURITY AUDIT FAILED] Findings detected (values redacted):" -ForegroundColor Red
    $audit.Findings | Format-Table -AutoSize
    exit 1
}
