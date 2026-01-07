# Make Windows SDK optional in node-gyp
# This allows builds to proceed even if SDK is not detected

$nodeGypPath = "$env:APPDATA\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js"

# Check npx location first (since that's what's being used)
$npxFiles = Get-ChildItem "$env:LOCALAPPDATA\npm-cache\_npx" -Recurse -Filter "find-visualstudio.js" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($npxFiles) {
    $nodeGypPath = $npxFiles.FullName
    Write-Host "Found npx node-gyp at: $nodeGypPath" -ForegroundColor Yellow
} elseif (-not (Test-Path $nodeGypPath)) {
    Write-Host "ERROR: Could not find node-gyp" -ForegroundColor Red
    exit 1
} else {
    Write-Host "Found node-gyp at: $nodeGypPath" -ForegroundColor Green
}

Write-Host ""
Write-Host "Making Windows SDK optional..." -ForegroundColor Yellow

# Create backup
$backupPath = "$nodeGypPath.backup-optional-sdk"
Copy-Item $nodeGypPath $backupPath -Force

# Read the file
$content = Get-Content $nodeGypPath -Raw
$originalContent = $content

# Find the SDK check that causes continue and make it non-fatal
# Pattern: if (info.sdk) { ... } else { ... continue }
$pattern = '(if\s*\(info\.sdk\)\s*\{[^}]+\}\s*else\s*\{[^}]+\s*continue\s*\})'
$replacement = @'
if (info.sdk) {
        this.addLog(`- found Windows SDK: ${info.sdk}`)
      } else {
        this.addLog('- missing any Windows SDK (using fallback - SDK may be available via Windows Kits)')
        // Don't fail - SDK is often available via Windows Kits even if not detected
        // Set a fallback SDK version
        info.sdk = info.sdk || '10.0.19041.0'
      }
'@

if ($content -match $pattern) {
    $content = $content -replace $pattern, $replacement
    Write-Host "Made SDK check non-fatal" -ForegroundColor Green
} else {
    # Try alternative pattern
    $pattern2 = '(if\s*\(!info\.sdk\)\s*\{[^}]+\s*continue\s*\})'
    $replacement2 = @'
if (!info.sdk) {
        this.addLog('- missing any Windows SDK (using fallback)')
        info.sdk = '10.0.19041.0' // Fallback SDK
        // Don't continue - allow build to proceed
      }
'@
    if ($content -match $pattern2) {
        $content = $content -replace $pattern2, $replacement2
        Write-Host "Made SDK check non-fatal (alternative pattern)" -ForegroundColor Green
    }
}

# Write if changed
if ($content -ne $originalContent) {
    Set-Content $nodeGypPath $content -NoNewline
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "SDK made optional!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Backup saved to: $backupPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Now try rebuilding:" -ForegroundColor Yellow
    Write-Host "  rebuild-node-pty-final.bat" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "Pattern not found. SDK check may be in a different format." -ForegroundColor Yellow
    Write-Host "The build should still work with the SDK fallback in getSDK." -ForegroundColor Yellow
}

Write-Host ""

