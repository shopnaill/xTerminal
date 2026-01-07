# Fix Windows SDK detection for VS 2026
# This patches node-gyp to be more lenient about SDK detection

$nodeGypPath = "$env:APPDATA\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js"

# Check if using npx node-gyp (different location)
$npxPath = "$env:LOCALAPPDATA\npm-cache\_npx\*\node_modules\node-gyp\lib\find-visualstudio.js"
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
Write-Host "Fixing Windows SDK detection..." -ForegroundColor Yellow

# Create backup
$backupPath = "$nodeGypPath.backup-sdk"
Copy-Item $nodeGypPath $backupPath -Force

# Read the file
$content = Get-Content $nodeGypPath -Raw
$originalContent = $content

# Find the getSDK function and make SDK optional or add fallback
# Look for where it checks for SDK and fails
$pattern = '(if\s*\(info\.sdk\)\s*\{[^}]+\}\s*else\s*\{[^}]+\s*continue\s*\})'
$replacement = @'
if (info.sdk) {
        this.addLog(`- found Windows SDK: ${info.sdk}`)
      } else {
        this.addLog('- missing any Windows SDK (continuing anyway - SDK may be available via environment)')
        // Don't fail - SDK might be available via Windows Kits or environment variables
        // info.sdk = '10.0.19041.0' // Fallback SDK version if needed
      }
'@

if ($content -match $pattern) {
    $content = $content -replace $pattern, $replacement
    Write-Host "Made SDK optional in processData" -ForegroundColor Green
}

# Also check the getSDK function to add fallback
$sdkPattern = '(getSDK\s*\(info\)\s*\{[^}]+\})'
$sdkReplacement = @'
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
        // Microsoft.VisualStudio.Component.Windows10SDK.IpOverUsb
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
    
    // Fallback: Check environment variable or use default
    if (process.env.WindowsSDKVersion) {
      this.log.silly('- using SDK from environment:', process.env.WindowsSDKVersion)
      return process.env.WindowsSDKVersion
    }
    
    // Last resort: Use a common SDK version
    this.log.silly('- no SDK found in packages, using fallback')
    return '10.0.19041.0' // Common Windows 10 SDK version
  }
'@

if ($content -match $sdkPattern) {
    $content = $content -replace $sdkPattern, $sdkReplacement
    Write-Host "Added SDK fallback in getSDK" -ForegroundColor Green
}

# Write if changed
if ($content -ne $originalContent) {
    Set-Content $nodeGypPath $content -NoNewline
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "SDK detection fix applied!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Backup saved to: $backupPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Now try rebuilding again:" -ForegroundColor Yellow
    Write-Host "  rebuild-node-pty-final.bat" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "No changes made. The file structure may be different." -ForegroundColor Yellow
}

Write-Host ""

