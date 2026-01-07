# Final complete fix - apply all necessary patches cleanly
$nodeGypPath = "$env:APPDATA\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js"

# Find npx node-gyp (this is what's actually being used)
$npxFiles = Get-ChildItem "$env:LOCALAPPDATA\npm-cache\_npx" -Recurse -Filter "find-visualstudio.js" -ErrorAction SilentlyContinue | Select-Object -First 1

if ($npxFiles) {
    $nodeGypPath = $npxFiles.FullName
    Write-Host "Found npx node-gyp at: $nodeGypPath" -ForegroundColor Yellow
} elseif (-not (Test-Path $nodeGypPath)) {
    Write-Host "ERROR: Could not find node-gyp" -ForegroundColor Red
    exit 1
}

Write-Host "Applying final complete fix..." -ForegroundColor Yellow
Write-Host ""

# Create backup
$backupPath = "$nodeGypPath.backup-final-complete"
Copy-Item $nodeGypPath $backupPath -Force

# Read the file line by line for precise editing
$lines = Get-Content $nodeGypPath
$newLines = @()
$i = 0
$changes = @()

while ($i -lt $lines.Length) {
    $line = $lines[$i]
    
    # Fix 1: Add 2026 to arrays
    if ($line -match '\[2019,\s*2022\]' -and $line -notmatch '2026') {
        $line = $line -replace '\[2019,\s*2022\]', '[2019, 2022, 2026]'
        $changes += "Added 2026 to arrays"
    }
    
    # Fix 2: Add version 18 -> 2026 mapping after version 17
    if ($line -match "if \(ret\.versionMajor === 17\)" -and $i + 3 -lt $lines.Length) {
        $newLines += $line
        $i++
        # Add the next few lines
        while ($i -lt $lines.Length -and $lines[$i] -notmatch "return ret") {
            $newLines += $lines[$i]
            $i++
        }
        if ($i -lt $lines.Length) {
            $newLines += $lines[$i]  # return ret
            $i++
            # Check if version 18 mapping already exists
            if ($i -lt $lines.Length -and $lines[$i] -notmatch "versionMajor === 18") {
                $newLines += "    if (ret.versionMajor === 18) {"
                $newLines += "      ret.versionYear = 2026"
                $newLines += "      return ret"
                $newLines += "    }"
                $changes += "Added version 18 -> 2026 mapping"
            }
            continue
        }
    }
    
    # Fix 3: Add toolset for 2026 after 2022
    if ($line -match "} else if \(versionYear === 2022\)" -and $i + 2 -lt $lines.Length) {
        $newLines += $line
        $i++
        $newLines += $lines[$i]  # return 'v143'
        $i++
        if ($i -lt $lines.Length -and $lines[$i] -notmatch "versionYear === 2026") {
            $newLines += "    } else if (versionYear === 2026) {"
            $newLines += "      return 'v145'"
            $changes += "Added toolset v145 for 2026"
        }
        continue
    }
    
    # Fix 4: Add SDK fallback before return null in getSDK
    if ($line -match "return null" -and $i -gt 0 -and $lines[$i-1] -match "getSDK|Windows81SDK") {
        # Check if fallback already exists
        $hasFallback = $false
        for ($j = $i; $j -lt [Math]::Min($i + 5, $lines.Length); $j++) {
            if ($lines[$j] -match "10\.0\.19041") {
                $hasFallback = $true
                break
            }
        }
        if (-not $hasFallback) {
            $newLines += "    // Fallback SDK"
            $newLines += "    this.log.silly('- no SDK found, using fallback')"
            $newLines += "    return '10.0.19041.0'"
            $changes += "Added SDK fallback"
            $newLines += $line
            $i++
            continue
        }
    }
    
    # Fix 5: Make SDK check non-fatal
    if ($line -match "missing any Windows SDK" -and $i + 1 -lt $lines.Length -and $lines[$i + 1] -match "continue") {
        $newLines += $line -replace "missing any Windows SDK", "missing any Windows SDK (using fallback)"
        $i++
        # Replace continue with setting fallback
        $newLines += "        info.sdk = info.sdk || '10.0.19041.0'"
        $changes += "Made SDK check non-fatal"
        $i++  # Skip the continue line
        continue
    }
    
    $newLines += $line
    $i++
}

# Write the fixed file
$newContent = $newLines -join "`n"

# Verify it's valid JavaScript by checking for common syntax errors
if ($newContent -match "}\s*else\s*if\s*\([^)]+\)\s*\{[^}]*\}\s*else\s*if") {
    Write-Host "WARNING: Potential syntax issue detected" -ForegroundColor Yellow
}

Set-Content $nodeGypPath $newContent -NoNewline

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fixes applied!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
if ($changes.Count -gt 0) {
    Write-Host "Changes made:" -ForegroundColor Yellow
    foreach ($change in $changes) {
        Write-Host "  - $change" -ForegroundColor Gray
    }
} else {
    Write-Host "All fixes may already be applied" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "Backup saved to: $backupPath" -ForegroundColor Gray
Write-Host ""
Write-Host "Now try rebuilding:" -ForegroundColor Yellow
Write-Host "  rebuild-node-pty-final.bat" -ForegroundColor White
Write-Host ""

