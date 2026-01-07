@echo off
echo ========================================
echo Rebuilding node-pty after patch
echo ========================================
echo.

echo Setting up Visual Studio 2026 environment...
call "D:\Program Files\VS\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 (
    echo ERROR: Failed to set up Visual Studio environment!
    pause
    exit /b 1
)

echo.
cd /d "%~dp0"

echo Rebuilding node-pty...
call npm rebuild node-pty

if errorlevel 1 (
    echo.
    echo ========================================
    echo Rebuild failed
    echo ========================================
    echo.
    echo Check the error messages above.
    echo The patch was applied, but there may be other issues.
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Rebuild completed!
echo ========================================
echo.
echo Verifying installation...
call node -e "const pty = require('node-pty'); console.log('node-pty loaded successfully!');"

if errorlevel 1 (
    echo.
    echo WARNING: Module test failed.
    echo Check if .node files exist in: node_modules\node-pty\build\Release\
) else (
    echo.
    echo ========================================
    echo SUCCESS! node-pty is working!
    echo ========================================
    echo.
    echo You can now run: npm start
)

echo.
pause

