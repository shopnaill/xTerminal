# Find and set the correct Windows SDK version
Write-Host "Finding installed Windows SDK versions..." -ForegroundColor Yellow
Write-Host ""

$sdkPath = "C:\Program Files (x86)\Windows Kits\10\Include"
$installedSDKs = @()

if (Test-Path $sdkPath) {
    $installedSDKs = Get-ChildItem $sdkPath -Directory | Where-Object { $_.Name -match '^10\.' } | Select-Object -ExpandProperty Name | Sort-Object -Descending
}

if ($installedSDKs.Count -eq 0) {
    Write-Host "WARNING: No Windows SDK found in standard location" -ForegroundColor Red
    Write-Host ""
    Write-Host "You need to install Windows SDK:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/" -ForegroundColor White
    Write-Host "2. Or install via Visual Studio Installer -> Individual components -> Windows SDK" -ForegroundColor White
    Write-Host ""
    exit 1
}

Write-Host "Found Windows SDK versions:" -ForegroundColor Green
foreach ($sdk in $installedSDKs) {
    Write-Host "  - $sdk" -ForegroundColor Gray
}

$latestSDK = $installedSDKs[0]
Write-Host ""
Write-Host "Using latest SDK: $latestSDK" -ForegroundColor Green
Write-Host ""

# Create a script to set the SDK version
$scriptContent = @"
@echo off
REM Set Windows SDK version for node-pty build
set WindowsSDKVersion=$latestSDK.0
echo Windows SDK version set to: %WindowsSDKVersion%
"@

Set-Content "set-sdk-version.bat" $scriptContent

Write-Host "Created set-sdk-version.bat" -ForegroundColor Green
Write-Host ""
Write-Host "To use this SDK version, run before rebuilding:" -ForegroundColor Yellow
Write-Host "  set-sdk-version.bat" -ForegroundColor White
Write-Host "  rebuild-node-pty-final.bat" -ForegroundColor White
Write-Host ""

