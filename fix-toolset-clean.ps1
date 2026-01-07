# Fix toolset for 2026 - clean version
$nodeGypPath = "$env:APPDATA\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js"

# Find npx node-gyp
$npxFiles = Get-ChildItem "$env:LOCALAPPDATA\npm-cache\_npx" -Recurse -Filter "find-visualstudio.js" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($npxFiles) {
    $nodeGypPath = $npxFiles.FullName
    Write-Host "Found npx node-gyp at: $nodeGypPath" -ForegroundColor Yellow
} elseif (-not (Test-Path $nodeGypPath)) {
    Write-Host "ERROR: Could not find node-gyp" -ForegroundColor Red
    exit 1
}

Write-Host "Applying clean fixes..." -ForegroundColor Yellow
Write-Host ""

# Create backup
$backupPath = "$nodeGypPath.backup-final-clean"
Copy-Item $nodeGypPath $backupPath -Force

# Read the file
$content = Get-Content $nodeGypPath -Raw
$originalContent = $content

# Fix 1: Add 2026 to arrays (if missing)
if ($content -notmatch "\[2019,\s*2022,\s*2026\]") {
    $content = $content -replace "\[2019,\s*2022\]", "[2019, 2022, 2026]"
    Write-Host "Added 2026 to arrays" -ForegroundColor Green
}

# Fix 2: Add version 18 -> 2026 mapping
if ($content -notmatch "versionMajor === 18") {
    $content = $content -replace "(if\s*\(ret\.versionMajor\s*===\s*17\)\s*\{[^}]+\})", "`$1`n    if (ret.versionMajor === 18) {`n      ret.versionYear = 2026`n      return ret`n    }"
    Write-Host "Added version 18 -> 2026 mapping" -ForegroundColor Green
}

# Fix 3: Add toolset for 2026 (carefully)
# Find the exact pattern for 2022 toolset
$toolsetPattern = "(} else if \(versionYear === 2022\) \{[\s\S]*?return 'v143'[\s\S]*?\})"
if ($content -match $toolsetPattern -and $content -notmatch "versionYear === 2026.*v145") {
    $match = $matches[0]
    $replacement = $match + "`n    } else if (versionYear === 2026) {`n      return 'v145'"
    $content = $content -replace [regex]::Escape($match), $replacement
    Write-Host "Added toolset v145 for 2026" -ForegroundColor Green
}

# Fix 4: Add SDK fallback (only modify the return null part)
if ($content -match "getSDK.*?return null" -and $content -notmatch "return '10\.0\.19041\.0'") {
    $content = $content -replace "(getSDK[^}]+return null\s*\})", "`$1`n    // Fallback SDK`n    this.log.silly('- no SDK found, using fallback')`n    return '10.0.19041.0'"
    Write-Host "Added SDK fallback" -ForegroundColor Green
}

# Fix 5: Make SDK check non-fatal
if ($content -match "missing any Windows SDK[^\n]+\n\s+continue") {
    $content = $content -replace "(- missing any Windows SDK[^\n]+)\n(\s+continue)", "`$1 (using fallback)`n`$2`n        info.sdk = info.sdk || '10.0.19041.0'"
    Write-Host "Made SDK check non-fatal" -ForegroundColor Green
}

# Verify syntax
$tempFile = [System.IO.Path]::GetTempFileName()
Set-Content $tempFile $content -NoNewline
$syntaxCheck = node -c $tempFile 2>&1
Remove-Item $tempFile

if ($LASTEXITCODE -eq 0) {
    Set-Content $nodeGypPath $content -NoNewline
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "All fixes applied successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Backup saved to: $backupPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Syntax verified - file is valid JavaScript" -ForegroundColor Green
    Write-Host ""
    Write-Host "Now rebuild node-pty:" -ForegroundColor Yellow
    Write-Host "  rebuild-node-pty-final.bat" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Syntax error detected!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host $syntaxCheck
    Write-Host ""
    Write-Host "Restoring from backup..." -ForegroundColor Yellow
    Copy-Item $backupPath $nodeGypPath -Force
    Write-Host "File restored. Please check the replacement patterns." -ForegroundColor Yellow
}

Write-Host ""

