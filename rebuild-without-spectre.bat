@echo off
echo ========================================
echo Rebuilding node-pty without Spectre mitigation
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

echo Step 2: Disabling Spectre mitigation in binding.gyp...
if not exist "node_modules\node-pty\binding.gyp" (
    echo ERROR: binding.gyp not found!
    pause
    exit /b 1
)

echo Creating backup...
copy "node_modules\node-pty\binding.gyp" "node_modules\node-pty\binding.gyp.backup" >nul

REM Remove Spectre mitigation
powershell -Command "$content = Get-Content 'node_modules\node-pty\binding.gyp' -Raw; $content = $content -replace '''SpectreMitigation'':\s*''Spectre''', '''SpectreMitigation'': ''Disabled'''; $content = $content -replace '''/guard:cf'',', ''; $content = $content -replace '''/ZH:SHA_256'',', ''; Set-Content 'node_modules\node-pty\binding.gyp' $content -NoNewline"

if errorlevel 1 (
    echo Failed to modify binding.gyp
    pause
    exit /b 1
)

echo Spectre mitigation disabled!
echo.

echo Step 3: Rebuilding node-pty...
cd node_modules\node-pty
call npx node-gyp rebuild

cd ..\..

if errorlevel 1 (
    echo.
    echo ========================================
    echo Rebuild failed
    echo ========================================
    echo.
    echo Check the error messages above.
    echo.
    pause
    exit /b 1
)

echo.
echo Step 4: Checking for built files...
if exist "node_modules\node-pty\build\Release\*.node" (
    echo Found .node files!
    echo.
    echo Step 5: Verifying installation...
    call node -e "const pty = require('node-pty'); console.log('SUCCESS: node-pty loaded successfully!');"
    
    if errorlevel 1 (
        echo.
        echo WARNING: Module test failed, but .node files exist.
    ) else (
        echo.
        echo ========================================
        echo SUCCESS! Everything is working!
        echo ========================================
        echo.
        echo You can now start the terminal app:
        echo   npm start
        echo.
    )
) else (
    echo.
    echo ERROR: No .node files found after rebuild.
    echo Check the build output above for errors.
)

echo.
pause

