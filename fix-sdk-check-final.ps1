# Fix the SDK check in processData to not skip when SDK fallback is used
$nodeGypPath = "$env:APPDATA\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js"

# Check npx location
$npxFiles = Get-ChildItem "$env:LOCALAPPDATA\npm-cache\_npx" -Recurse -Filter "find-visualstudio.js" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($npxFiles) {
    $nodeGypPath = $npxFiles.FullName
    Write-Host "Found npx node-gyp at: $nodeGypPath" -ForegroundColor Yellow
} elseif (-not (Test-Path $nodeGypPath)) {
    Write-Host "ERROR: Could not find node-gyp" -ForegroundColor Red
    exit 1
}

Write-Host "Fixing SDK check in processData..." -ForegroundColor Yellow
Write-Host ""

# Create backup
$backupPath = "$nodeGypPath.backup-final"
Copy-Item $nodeGypPath $backupPath -Force

# Read the file
$content = Get-Content $nodeGypPath -Raw
$originalContent = $content

# Find and fix the SDK check that causes continue
# Pattern: if (info.sdk) { ... } else { ... continue }
$pattern = '(if\s*\(info\.sdk\)\s*\{[^}]+\}\s*else\s*\{[^}]+\s*continue\s*\})'
$replacement = @'
if (info.sdk) {
        this.addLog(`- found Windows SDK: ${info.sdk}`)
      } else {
        // SDK fallback should have been set by getSDK, but if not, use default
        info.sdk = info.sdk || '10.0.19041.0'
        this.addLog(`- using fallback Windows SDK: ${info.sdk}`)
        // Don't continue - allow build to proceed with fallback SDK
      }
'@

if ($content -match $pattern) {
    $content = $content -replace $pattern, $replacement
    Write-Host "Fixed SDK check - made it non-fatal" -ForegroundColor Green
} else {
    # Try finding the exact line
    $lines = $content -split "`n"
    $found = $false
    for ($i = 0; $i -lt $lines.Length; $i++) {
        if ($lines[$i] -match "missing any Windows SDK" -and $i + 1 -lt $lines.Length -and $lines[$i + 1] -match "continue") {
            # Replace the continue with setting fallback
            $lines[$i] = $lines[$i] -replace "missing any Windows SDK", "missing any Windows SDK (using fallback)"
            $lines[$i + 1] = "        info.sdk = info.sdk || '10.0.19041.0'"
            $found = $true
            Write-Host "Fixed SDK check by replacing continue" -ForegroundColor Green
            break
        }
    }
    if ($found) {
        $content = $lines -join "`n"
    }
}

# Also ensure getSDK fallback is working - check if it returns the fallback
if ($content -notmatch "return '10\.0\.19041\.0'") {
    Write-Host "WARNING: getSDK fallback may not be present" -ForegroundColor Yellow
}

# Write if changed
if ($content -ne $originalContent) {
    Set-Content $nodeGypPath $content -NoNewline
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "SDK check fixed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Backup saved to: $backupPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Now rebuild node-pty:" -ForegroundColor Yellow
    Write-Host "  rebuild-node-pty-final.bat" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "No changes made. The SDK check may already be fixed or in a different format." -ForegroundColor Yellow
}

Write-Host ""

