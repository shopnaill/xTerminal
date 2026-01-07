# Fix version mapping for VS 2026 (version 18)
# Add mapping: versionMajor 18 -> versionYear 2026

$nodeGypPath = "$env:APPDATA\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js"

if (-not (Test-Path $nodeGypPath)) {
    Write-Host "ERROR: Could not find node-gyp" -ForegroundColor Red
    exit 1
}

Write-Host "Fixing version mapping for VS 2026..." -ForegroundColor Yellow
Write-Host ""

# Create backup
$backupPath = "$nodeGypPath.backup-version"
Copy-Item $nodeGypPath $backupPath -Force

# Read the file
$content = Get-Content $nodeGypPath -Raw
$originalContent = $content

# Find getVersionInfo and add mapping for version 18 -> 2026
# Pattern: if (ret.versionMajor === 17) { ret.versionYear = 2022; return ret }
$pattern = '(if\s*\(ret\.versionMajor\s*===\s*17\)\s*\{[^}]+\})'
$replacement = @'
if (ret.versionMajor === 17) {
      ret.versionYear = 2022
      return ret
    }
    if (ret.versionMajor === 18) {
      ret.versionYear = 2026
      return ret
    }
'@

if ($content -match $pattern) {
    $content = $content -replace $pattern, $replacement
    Write-Host "Added version 18 -> 2026 mapping" -ForegroundColor Green
} else {
    # Try alternative pattern - look for the exact structure
    $pattern2 = '(ret\.versionMajor\s*===\s*17[^}]+return ret[^}]+})'
    if ($content -match $pattern2) {
        $content = $content -replace $pattern2, "$matches[0]`n    if (ret.versionMajor === 18) {`n      ret.versionYear = 2026`n      return ret`n    }"
        Write-Host "Added version 18 -> 2026 mapping (alternative)" -ForegroundColor Green
    } else {
        # Manual insertion after version 17 check
        $lines = $content -split "`n"
        $found = $false
        for ($i = 0; $i -lt $lines.Length; $i++) {
            if ($lines[$i] -match "versionMajor === 17" -and $lines[$i + 1] -match "versionYear = 2022") {
                # Find the return statement
                $j = $i + 1
                while ($j -lt $lines.Length -and $lines[$j] -notmatch "return ret") {
                    $j++
                }
                if ($j -lt $lines.Length) {
                    # Insert after the return
                    $insertIndex = $j + 1
                    $newLines = @()
                    $newLines += "    if (ret.versionMajor === 18) {"
                    $newLines += "      ret.versionYear = 2026"
                    $newLines += "      return ret"
                    $newLines += "    }"
                    $lines = $lines[0..($insertIndex - 1)] + $newLines + $lines[$insertIndex..($lines.Length - 1)]
                    $content = $lines -join "`n"
                    $found = $true
                    Write-Host "Added version 18 -> 2026 mapping (manual)" -ForegroundColor Green
                    break
                }
            }
        }
        if (-not $found) {
            Write-Host "WARNING: Could not find version 17 mapping to add version 18 mapping" -ForegroundColor Yellow
        }
    }
}

# Write if changed
if ($content -ne $originalContent) {
    Set-Content $nodeGypPath $content -NoNewline
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Version mapping fixed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Backup saved to: $backupPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Now rebuild node-pty from Command Prompt with VS environment:" -ForegroundColor Yellow
    Write-Host "  rebuild-node-pty-final.bat" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "No changes made. Version mapping may already exist or structure is different." -ForegroundColor Yellow
}

Write-Host ""

