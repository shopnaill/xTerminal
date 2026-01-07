@echo off
echo ========================================
echo Rebuilding node-pty for Electron
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

echo Step 2: Rebuilding node-pty for Electron...
npx electron-rebuild -f -w node-pty

if errorlevel 1 (
    echo.
    echo ========================================
    echo Rebuild failed - check errors above
    echo ========================================
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build completed successfully!
echo ========================================
echo.
pause

