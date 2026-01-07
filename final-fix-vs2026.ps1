# Final fix for VS 2026 version detection
# This adds logic to infer version 2026 when detection fails

$nodeGypPath = "$env:APPDATA\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js"

if (-not (Test-Path $nodeGypPath)) {
    Write-Host "ERROR: Could not find node-gyp" -ForegroundColor Red
    exit 1
}

Write-Host "Applying final fix for VS 2026 version detection..." -ForegroundColor Yellow
Write-Host ""

# Create backup
$backupPath = "$nodeGypPath.backup3"
Copy-Item $nodeGypPath $backupPath -Force

# Read the file
$content = Get-Content $nodeGypPath -Raw
$originalContent = $content

# Fix 1: In processData, when versionYear is undefined but path matches VS 2026, set it to 2026
$pattern1 = '(\s+vsInfo = vsInfo\.filter\(\(info\) => \{[^}]+unknown.*?version.*?found at[^}]+\})'
$replacement1 = @'
$1
      // Fix for VS 2026: If version is undefined but path matches our VS installation, infer 2026
      vsInfo = vsInfo.map((info) => {
        if (!info.versionYear && info.path) {
          const pathLower = info.path.toLowerCase().replace(/\\/g, '/')
          // Check if this looks like our VS 2026 installation
          if (pathLower.includes('d:/program files/vs') || 
              pathLower.includes('vs') && (pathLower.includes('2026') || pathLower.includes('insiders'))) {
            info.versionYear = 2026
            info.version = '18.3.0'
            this.addLog(`- inferred VS2026 from path: ${info.path}`)
          }
        }
        return info
      })
'@

if ($content -match $pattern1) {
    $content = $content -replace $pattern1, $replacement1
    Write-Host "Added version inference in processData" -ForegroundColor Green
}

# Fix 2: In getVersionInfo, if version parsing fails but we have a path hint, return 2026
$pattern2 = '(getVersionInfo\s*\(info\)\s*\{[^}]+if\s*\(!match\)\s*\{[^}]+\})'
$replacement2 = @'
$1
      // Fallback: If version parsing failed, check if path suggests VS 2026
      if (!match && info.path) {
        const pathLower = info.path.toLowerCase().replace(/\\/g, '/')
        if (pathLower.includes('d:/program files/vs') || 
            (pathLower.includes('vs') && (pathLower.includes('2026') || pathLower.includes('insiders')))) {
          this.log.silly('- inferring VS2026 from path:', info.path)
          return { versionYear: 2026, version: '18.3.0' }
        }
      }
'@

if ($content -match $pattern2) {
    $content = $content -replace $pattern2, $replacement2
    Write-Host "Added fallback in getVersionInfo" -ForegroundColor Green
}

# Fix 3: Simpler approach - in the filter that removes undefined versions, add exception for our path
$simplePattern = '(\s+if\s*\(info\.versionYear\s*&&\s*supportedYears\.indexOf\(info\.versionYear\)\s*!==\s*-1\)\s*\{[^}]+\})'
$simpleReplacement = @'
$1
      // Exception: If versionYear is undefined but path matches VS 2026, set it
      if (!info.versionYear && info.path) {
        const pathLower = info.path.toLowerCase().replace(/\\/g, '/')
        if (pathLower.includes('d:/program files/vs') || 
            (pathLower.includes('/vs/') && supportedYears.indexOf(2026) !== -1)) {
          info.versionYear = 2026
          info.version = info.version || '18.3.0'
          this.addLog(`- auto-detected VS2026 from path: ${info.path}`)
        }
      }
'@

if ($content -match $simplePattern) {
    $content = $content -replace $simplePattern, $simpleReplacement
    Write-Host "Added auto-detection in filter" -ForegroundColor Green
}

# Write if changed
if ($content -ne $originalContent) {
    Set-Content $nodeGypPath $content -NoNewline
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Fix applied successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Backup saved to: $backupPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Now rebuild node-pty from Command Prompt:" -ForegroundColor Yellow
    Write-Host "  1. Open Command Prompt" -ForegroundColor White
    Write-Host "  2. Run: `"D:\Program Files\VS\VC\Auxiliary\Build\vcvars64.bat`"" -ForegroundColor White
    Write-Host "  3. Run: cd D:\Work\Terminal" -ForegroundColor White
    Write-Host "  4. Run: npm rebuild node-pty" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "No changes made. The file structure may be different." -ForegroundColor Yellow
    Write-Host "You may need to manually edit the file." -ForegroundColor Yellow
}

Write-Host ""

