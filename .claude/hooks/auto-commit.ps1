# Stop-hook: commit en push alles wat Claude aan het eind van een beurt heeft laten staan.
# - Typecheck faalt  -> niet committen; fout gaat terug naar Claude (exit 2) om te herstellen.
# - Tweede poging faalt ook -> niet blokkeren (voorkomt een lus), wel een melding tonen.
# - Alleen op een branch met upstream; nooit force-pushen.

$ErrorActionPreference = 'Continue'
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $repo
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')

$hookInput = $null
try { $hookInput = [Console]::In.ReadToEnd() | ConvertFrom-Json } catch {}
$retry = $hookInput -and $hookInput.stop_hook_active

function Say($msg) { @{ systemMessage = $msg } | ConvertTo-Json -Compress; exit 0 }

$branch = git rev-parse --abbrev-ref HEAD
if ($branch -eq 'HEAD') { Say 'Auto-commit overgeslagen: geen branch actief (detached HEAD).' }

$changes = git status --porcelain
if ($changes) {
    $tsc = npx --no-install tsc --noEmit 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) {
        if ($retry) { Say 'Auto-commit overgeslagen: typecheck faalt nog steeds. Wijzigingen staan lokaal, niet gecommit.' }
        [Console]::Error.WriteLine("Auto-commit tegengehouden: typecheck faalt. Los deze fouten op:`n" + ($tsc.Trim() -split "`n" | Select-Object -First 40 | Out-String))
        exit 2
    }

    git add -A
    $files = @(git diff --cached --name-only)
    $names = ($files | Select-Object -First 3 | ForEach-Object { Split-Path $_ -Leaf }) -join ', '
    if ($files.Count -gt 3) { $names += " en $($files.Count - 3) andere" }
    git commit -q -m "Bijgewerkt: $names" | Out-Null
    if ($LASTEXITCODE -ne 0) { Say 'Auto-commit mislukt: git commit gaf een fout.' }
}

git rev-parse --abbrev-ref '@{u}' 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    git push -q -u origin $branch 2>&1 | Out-Null
} else {
    $ahead = [int](git rev-list --count '@{u}..HEAD')
    if ($ahead -eq 0) { exit 0 }
    git pull -q --rebase --autostash 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { git rebase --abort 2>$null; Say 'Auto-push mislukt: conflict met GitHub. Commits staan lokaal.' }
    git push -q 2>&1 | Out-Null
}
if ($LASTEXITCODE -ne 0) { Say 'Auto-push mislukt. Commits staan lokaal.' }
Say "Gecommit en gepusht naar $branch."
