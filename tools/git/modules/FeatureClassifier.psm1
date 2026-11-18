<#
.SYNOPSIS
    Feature Classifier & Dependency Graph Module.
.DESCRIPTION
    Validates unit definitions, manages dependencies, ensures strict acyclic execution order,
    and maps project files to logical engineering units.
#>

function Import-IntegrationManifest {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ManifestPath
    )

    if (-not (Test-Path -LiteralPath $ManifestPath)) {
        throw "Integration manifest not found at: $ManifestPath"
    }

    $raw = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8
    $manifest = $raw | ConvertFrom-Json
    return $manifest
}

function Test-DependencyPrerequisites {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        $Unit,
        [Parameter(Mandatory = $true)]
        [System.Collections.IDictionary]$CompletedUnits
    )

    $missing = @()
    foreach ($dep in @($Unit.dependsOn)) {
        if (-not $CompletedUnits.ContainsKey($dep)) {
            $missing += $dep
        }
    }
    return $missing
}

function Get-NormalizedUnitFiles {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Files
    )

    return @($Files | ForEach-Object { $_.Replace('\', '/') } | Sort-Object -Unique)
}

Export-ModuleMember -Function Import-IntegrationManifest, Test-DependencyPrerequisites, Get-NormalizedUnitFiles
