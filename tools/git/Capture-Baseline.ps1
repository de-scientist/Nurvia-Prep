# Captures wave-2 baseline validation exit codes for the current (pre-commit) worktree.
$repo = 'C:\Users\gitau\Documents\Nurvia-Prep'
Set-Location $repo
$log = Join-Path $repo 'tools\git\baseline-run-log.txt'
"=== baseline capture started $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Set-Content $log -Encoding UTF8

$commands = @('npx tsc --noEmit', 'npm run lint', 'npm run build')
$result = [ordered]@{}

foreach ($cmd in $commands) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $null = & powershell -NoProfile -Command $cmd 2>&1 | Out-Null
    $code = $LASTEXITCODE
    $sw.Stop()
    $result[$cmd] = $code
    "[$cmd] exit=$code elapsed=$([math]::Round($sw.Elapsed.TotalSeconds,1))s" | Add-Content $log -Encoding UTF8
}

$result | ConvertTo-Json | Set-Content (Join-Path $repo 'tools\git\baseline-validation.json') -Encoding UTF8
"=== baseline capture finished $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Add-Content $log -Encoding UTF8
