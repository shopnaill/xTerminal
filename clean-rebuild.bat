@echo off
echo ========================================
echo Clean Rebuild of node-pty
echo ========================================
echo.

echo Step 1: Setting up Visual Studio 2026 environment...
call "D:\Program Files\VS\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 (
    echo ERROR: Failed to set up Visual Studio environment!
    pause
    exit /b 1
)

echo.
cd /d "%~dp0"

echo Step 2: Cleaning previous build...
if exist "node_modules\node-pty\build" (
    echo Removing build directory...
    rmdir /s /q "node_modules\node-pty\build" 2>nul
)

echo.
echo Step 3: Ensuring Spectre is disabled...
if exist "node_modules\node-pty\binding.gyp" (
    powershell -Command "$content = Get-Content 'node_modules\node-pty\binding.gyp' -Raw; if ($content -match '''SpectreMitigation'':\s*''Spectre''') { $content = $content -replace '''SpectreMitigation'':\s*''Spectre''', '''SpectreMitigation'': ''Disabled'''; $content = $content -replace '''/guard:cf'',', ''; $content = $content -replace '''/ZH:SHA_256'',', ''; Set-Content 'node_modules\node-pty\binding.gyp' $content -NoNewline; Write-Host 'Spectre mitigation disabled' } else { Write-Host 'Spectre already disabled' }"
)

echo.
echo Step 4: Rebuilding node-pty...
cd node_modules\node-pty
call npx node-gyp rebuild

cd ..\..

if errorlevel 1 (
    echo.
    echo ========================================
    echo Rebuild failed
    echo ========================================
    echo.
    pause
    exit /b 1
)

echo.
echo Step 5: Verifying...
if exist "node_modules\node-pty\build\Release\*.node" (
    echo.
    echo ========================================
    echo SUCCESS! Build completed!
    echo ========================================
    echo.
    call node -e "const pty = require('node-pty'); console.log('SUCCESS: node-pty loaded successfully!');"
    if errorlevel 1 (
        echo WARNING: Module test failed, but files exist.
    ) else (
        echo.
        echo You can now run: npm start
    )
) else (
    echo ERROR: No .node files found.
)

echo.
pause

