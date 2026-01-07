# Fix version detection for VS 2026
# This patches node-gyp to better handle version detection from custom paths

$nodeGypPath = "$env:APPDATA\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js"

if (-not (Test-Path $nodeGypPath)) {
    Write-Host "ERROR: Could not find node-gyp" -ForegroundColor Red
    exit 1
}

Write-Host "Fixing version detection in node-gyp..." -ForegroundColor Yellow
Write-Host ""

# Read the file
$content = Get-Content $nodeGypPath -Raw
$originalContent = $content

# Find the function that extracts version from path and make it more lenient
# Look for patterns that extract version and add fallback for 2026

# 1. If version detection fails and path contains "VS" or "Visual Studio", try to infer 2026
# Look for error handling around "unknown version"
if ($content -match 'unknown version.*found at') {
    # Add logic to infer 2026 if path matches our VS installation
    $pattern = '(unknown version[^}]+found at[^}]+})'
    $replacement = @'
$1
      // Workaround: If version is undefined and path matches VS 2026 location, assume 2026
      if (versionYear === undefined && vsPath && (vsPath.includes('VS') || vsPath.includes('Visual Studio'))) {
        // Check if this looks like VS 2026 (Insiders)
        const vsPathLower = vsPath.toLowerCase()
        if (vsPathLower.includes('2026') || vsPathLower.includes('insiders') || vsPathLower.includes('\\vs\\')) {
          versionYear = 2026
          this.addLog(`- inferred version 2026 from path: ${vsPath}`)
        }
      }
'@
    $content = $content -replace $pattern, $replacement
    Write-Host "Added version inference logic" -ForegroundColor Green
}

# 2. In findVSFromSpecifiedLocation, add fallback for undefined versions
if ($content -match 'async findVSFromSpecifiedLocation') {
    # Look for where it processes the version and add fallback
    $pattern = '(versionYear\s*=\s*parseInt\([^)]+\))'
    if ($content -match $pattern) {
        $replacement = @'
$1
        // Fallback: If version detection fails but path exists and contains VS indicators, assume 2026
        if (isNaN(versionYear) && this.envVcInstallDir && (this.envVcInstallDir.includes('VS') || this.envVcInstallDir.includes('Visual Studio'))) {
          const pathLower = this.envVcInstallDir.toLowerCase()
          if (pathLower.includes('2026') || pathLower.includes('insiders') || pathLower.match(/[\\/]vs[\\/]/)) {
            versionYear = 2026
            this.addLog(`- using inferred version 2026 for path: ${this.envVcInstallDir}`)
          }
        }
'@
        $content = $content -replace $pattern, $replacement
        Write-Host "Added version fallback in findVSFromSpecifiedLocation" -ForegroundColor Green
    }
}

# Write if changed
if ($content -ne $originalContent) {
    # Create backup
    $backupPath = "$nodeGypPath.backup2"
    Copy-Item $nodeGypPath $backupPath -Force
    Write-Host "Backup created: $backupPath" -ForegroundColor Green
    
    Set-Content $nodeGypPath $content -NoNewline
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Version detection fix applied!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Now try rebuilding node-pty from Command Prompt with VS environment set up." -ForegroundColor Yellow
} else {
    Write-Host "No changes needed or patterns not found." -ForegroundColor Yellow
    Write-Host "The patch may need manual adjustment." -ForegroundColor Yellow
}

Write-Host ""

