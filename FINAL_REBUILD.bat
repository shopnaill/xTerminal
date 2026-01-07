@echo off
echo ========================================
echo FINAL Rebuild - All Fixes Applied
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

echo Step 2: Cleaning build directory...
if exist "node_modules\node-pty\build" (
    echo Removing old build...
    rmdir /s /q "node_modules\node-pty\build" 2>nul
)

echo.
echo Step 3: Rebuilding node-pty (Spectre already disabled)...
cd node_modules\node-pty
call npx node-gyp rebuild

cd ..\..

if errorlevel 1 (
    echo.
    echo ========================================
    echo Rebuild failed - check errors above
    echo ========================================
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build completed!
echo ========================================
echo.
echo Verifying installation...
call node -e "const pty = require('node-pty'); console.log('SUCCESS: node-pty loaded successfully!');"

if errorlevel 1 (
    echo.
    echo WARNING: Module test failed.
    if exist "node_modules\node-pty\build\Release\*.node" (
        echo But .node files exist - may still work.
    )
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

echo.
pause

