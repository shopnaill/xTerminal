@echo off
echo ========================================
echo Patching node-gyp for VS 2026 Support
echo ========================================
echo.

set NODE_GYP_PATH=%APPDATA%\npm\node_modules\npm\node_modules\node-gyp\lib\find-visualstudio.js

if not exist "%NODE_GYP_PATH%" (
    echo ERROR: Could not find node-gyp at: %NODE_GYP_PATH%
    echo.
    echo Trying alternative location...
    where node-gyp >nul 2>&1
    if errorlevel 1 (
        echo ERROR: node-gyp not found. Please install it first.
        pause
        exit /b 1
    )
    for /f "delims=" %%i in ('where node-gyp') do set NODE_GYP_PATH=%%~dpi..\lib\find-visualstudio.js
)

echo.
echo Found node-gyp at: %NODE_GYP_PATH%
echo.
echo Creating backup...
copy "%NODE_GYP_PATH%" "%NODE_GYP_PATH%.backup" >nul 2>&1

echo.
echo This script will attempt to patch node-gyp to recognize VS 2026.
echo.
echo WARNING: This modifies node-gyp's internal files.
echo A backup will be created.
echo.
pause

echo.
echo Attempting to patch using PowerShell script...
echo.

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "patch-node-gyp-vs2026.ps1"

if errorlevel 1 (
    echo.
    echo Patch failed. Restoring backup...
    if exist "%NODE_GYP_PATH%.backup" (
        copy "%NODE_GYP_PATH%.backup" "%NODE_GYP_PATH%" >nul 2>&1
    )
    echo.
    echo Manual patching may be required.
    echo See: WORKAROUND_VS2026.md for manual instructions.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Patch applied successfully!
echo ========================================
echo.
echo Backup saved to: %NODE_GYP_PATH%.backup
echo.
echo Now try rebuilding node-pty:
echo   npm rebuild node-pty
echo.
pause

