@echo off
echo ========================================
echo Simple node-pty Rebuild for VS 2026
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

if not exist "node_modules\node-pty" (
    echo ERROR: node-pty is not installed!
    echo Please run: npm run install:no-build
    pause
    exit /b 1
)

echo.
echo Rebuilding node-pty using npm...
echo This will use npm's node-gyp which should work with the VS environment.
echo.

call npm rebuild node-pty

if errorlevel 1 (
    echo.
    echo ========================================
    echo Rebuild failed
    echo ========================================
    echo.
    echo The issue is that node-gyp cannot detect VS 2026.
    echo.
    echo Next steps:
    echo 1. Patch node-gyp first: patch-node-gyp-vs2026.bat
    echo 2. Then run this script again
    echo.
    echo OR
    echo.
    echo Install VS 2022 Build Tools alongside VS 2026
    echo (they can coexist and node-gyp will use VS 2022)
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
    echo SUCCESS! You can now run: npm start
)

echo.
pause

