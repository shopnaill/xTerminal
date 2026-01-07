# Apply all fixes cleanly to npx node-gyp
$nodeGypPath = "$env:APPDATA\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js"

# Find npx node-gyp
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
Write-Host "Applying all fixes cleanly..." -ForegroundColor Yellow

# Create backup
$backupPath = "$nodeGypPath.backup-clean"
Copy-Item $nodeGypPath $backupPath -Force

# Read the file
$content = Get-Content $nodeGypPath -Raw
$originalContent = $content
$changes = @()

# Fix 1: Add 2026 to version arrays
if ($content -notmatch "\[2019,\s*2022,\s*2026\]") {
    $content = $content -replace "\[2019,\s*2022\]", "[2019, 2022, 2026]"
    $changes += "Added 2026 to version arrays"
}

# Fix 2: Add version 18 -> 2026 mapping in getVersionInfo
if ($content -notmatch "versionMajor === 18") {
    $content = $content -replace "(if\s*\(ret\.versionMajor\s*===\s*17\)\s*\{[^}]+\})", "`$1`n    if (ret.versionMajor === 18) {`n      ret.versionYear = 2026`n      return ret`n    }"
    $changes += "Added version 18 -> 2026 mapping"
}

# Fix 3: Add SDK fallback in getSDK (only if not already there)
if ($content -notmatch "return '10\.0\.19041\.0'") {
    # Find the end of getSDK function and add fallback before the closing brace
    $pattern = '(getSDK\s*\(info\)\s*\{[^}]+return null\s*\})'
    $replacement = @'
getSDK (info) {
    const win8SDK = 'Microsoft.VisualStudio.Component.Windows81SDK'
    const win10SDKPrefix = 'Microsoft.VisualStudio.Component.Windows10SDK.'
    const win11SDKPrefix = 'Microsoft.VisualStudio.Component.Windows11SDK.'

    let Win10or11SDKVer = 0
    info.packages.forEach((pkg) => {
      if (!pkg.startsWith(win10SDKPrefix) && !pkg.startsWith(win11SDKPrefix)) {
        return
      }
      const parts = pkg.split('.')
      if (parts.length > 5 && parts[5] !== 'Desktop') {
        this.log.silly('- ignoring non-Desktop Win10/11SDK:', pkg)
        return
      }
      const foundSdkVer = parseInt(parts[4], 10)
      if (isNaN(foundSdkVer)) {
        this.log.silly('- failed to parse Win10/11SDK number:', pkg)
        return
      }
      this.log.silly('- found Win10/11SDK:', foundSdkVer)
      Win10or11SDKVer = Math.max(Win10or11SDKVer, foundSdkVer)
    })

    if (Win10or11SDKVer !== 0) {
      return `10.0.${Win10or11SDKVer}.0`
    } else if (info.packages.indexOf(win8SDK) !== -1) {
      this.log.silly('- found Win8SDK')
      return '8.1'
    }
    
    // Fallback: Use default SDK version
    this.log.silly('- no SDK found in packages, using fallback')
    return '10.0.19041.0'
  }
'@
    if ($content -match $pattern) {
        $content = $content -replace $pattern, $replacement
        $changes += "Added SDK fallback"
    }
}

# Fix 4: Make SDK check non-fatal in processData
if ($content -match "missing any Windows SDK.*continue") {
    $content = $content -replace "(- missing any Windows SDK[^\n]+\n\s+continue)", "- missing any Windows SDK (using fallback)`n        info.sdk = info.sdk || '10.0.19041.0'"
    $changes += "Made SDK check non-fatal"
}

# Fix 5: Add toolset support for 2026
if ($content -notmatch "versionYear === 2026.*v145") {
    $content = $content -replace "(else if\s*\(versionYear\s*===\s*2022\)\s*\{[^}]+\})", "`$1`n    } else if (versionYear === 2026) {`n      return 'v145'"
    $changes += "Added toolset v145 for 2026"
}

# Write if changed
if ($content -ne $originalContent) {
    Set-Content $nodeGypPath $content -NoNewline
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "All fixes applied!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Changes made:" -ForegroundColor Yellow
    foreach ($change in $changes) {
        Write-Host "  - $change" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Backup saved to: $backupPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Now rebuild node-pty:" -ForegroundColor Yellow
    Write-Host "  rebuild-node-pty-final.bat" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "No changes needed - fixes may already be applied." -ForegroundColor Yellow
}

Write-Host ""

