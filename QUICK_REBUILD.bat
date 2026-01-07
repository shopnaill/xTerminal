@echo off
echo ========================================
echo Quick Rebuild for node-pty
echo ========================================
echo.
echo This script will rebuild node-pty for the current Node.js version.
echo For Electron, you'll need to rebuild separately with electron-rebuild.
echo.

cd /d "%~dp0"

echo Rebuilding node-pty...
cd node_modules\node-pty
call npx node-gyp rebuild

if errorlevel 1 (
    echo.
    echo ========================================
    echo Rebuild FAILED
    echo ========================================
    echo.
    echo Please run this from Visual Studio Developer Command Prompt:
    echo   1. Open "Visual Studio 2026 Developer Command Prompt"
    echo   2. cd D:\Work\Terminal
    echo   3. Run this script again
    echo.
    pause
    exit /b 1
)

cd ..\..

echo.
echo ========================================
echo Rebuild SUCCESSFUL for Node.js
echo ========================================
echo.
echo To rebuild for Electron, run:
echo   npx electron-rebuild -f -w node-pty
echo.
pause

