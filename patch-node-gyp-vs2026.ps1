# Patch node-gyp to support Visual Studio 2026
# Run as Administrator if needed

$nodeGypPath = "$env:APPDATA\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js"

if (-not (Test-Path $nodeGypPath)) {
    Write-Host "ERROR: Could not find node-gyp at: $nodeGypPath" -ForegroundColor Red
    Write-Host "Trying to locate node-gyp..." -ForegroundColor Yellow
    
    $nodeGypCmd = Get-Command node-gyp -ErrorAction SilentlyContinue
    if ($nodeGypCmd) {
        $nodeGypPath = Join-Path (Split-Path (Split-Path $nodeGypCmd.Source)) "lib\find-visualstudio.js"
    }
    
    if (-not (Test-Path $nodeGypPath)) {
        Write-Host "ERROR: node-gyp not found. Please install it first." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Found node-gyp at: $nodeGypPath" -ForegroundColor Green
Write-Host ""

# Create backup
$backupPath = "$nodeGypPath.backup"
Copy-Item $nodeGypPath $backupPath -Force
Write-Host "Backup created: $backupPath" -ForegroundColor Green
Write-Host ""

# Read the file
$content = Get-Content $nodeGypPath -Raw

# Track changes
$changes = @()

# 1. Update findVisualStudio2019OrNewerFromSpecifiedLocation to include 2026
if ($content -match "findVisualStudio2019OrNewerFromSpecifiedLocation.*?\[2019,\s*2022\]") {
    $content = $content -replace "\[2019,\s*2022\]", "[2019, 2022, 2026]"
    $changes += "Added 2026 to findVisualStudio2019OrNewerFromSpecifiedLocation"
}

# 2. Update any [2019, 2022] arrays
if ($content -match "\[2019,\s*2022\]") {
    $content = $content -replace "\[2019,\s*2022\]", "[2019, 2022, 2026]"
    $changes += "Added 2026 to version arrays"
}

# 3. Update version checks (version === 17 || version === 19 || version === 22)
$versionCheckPattern = "(version\s*===\s*17\s*\|\|\s*version\s*===\s*19\s*\|\|\s*version\s*===\s*22)"
if ($content -match $versionCheckPattern) {
    $oldLine = $matches[0]
    $newLine = $oldLine -replace "version\s*===\s*22", "version === 22 || version === 26"
    $content = $content -replace [regex]::Escape($oldLine), $newLine
    $changes += "Added 26 to version checks"
}

# 4. Update versionYear checks
if ($content -match "versionYear\s*===\s*2022") {
    $content = $content -replace "(versionYear\s*===\s*2022)", "`$1 || versionYear === 2026"
    $changes += "Added 2026 to versionYear checks"
}

# 5. Update any hardcoded version lists [17, 19, 22]
if ($content -match "\[17,\s*19,\s*22\]") {
    $content = $content -replace "\[17,\s*19,\s*22\]", "[17, 19, 22, 26]"
    $changes += "Updated hardcoded version lists"
}

# 6. Update checkConfigVersion to accept 2026
if ($content -match "checkConfigVersion.*?2022") {
    $content = $content -replace "(checkConfigVersion.*?2022)", "`$1 || versionYear === 2026"
    $changes += "Updated checkConfigVersion for 2026"
}

# Write the patched file
Set-Content $nodeGypPath $content -NoNewline

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Patch Applied Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Changes made:" -ForegroundColor Yellow
foreach ($change in $changes) {
    Write-Host "  - $change" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Backup saved to: $backupPath" -ForegroundColor Green
Write-Host ""
Write-Host "Now try rebuilding node-pty:" -ForegroundColor Yellow
Write-Host "  npm rebuild node-pty" -ForegroundColor White
Write-Host ""

