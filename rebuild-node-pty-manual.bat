@echo off
echo ========================================
echo Manual node-pty rebuild (bypassing version detection)
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
    pause
    exit /b 1
)

echo.
echo Attempting to build node-pty manually...
echo.

cd node_modules\node-pty

echo Step 1: Configuring build...
call node-gyp configure --msvs_version=2022 --target_arch=x64 2>nul
if errorlevel 1 (
    echo Trying without msvs_version flag...
    call node-gyp configure --target_arch=x64
)

echo.
echo Step 2: Building...
call node-gyp build --msvs_version=2022 --target_arch=x64 2>nul
if errorlevel 1 (
    echo Trying without msvs_version flag...
    call node-gyp build --target_arch=x64
)

cd ..\..

echo.
echo Checking for built files...
if exist "node_modules\node-pty\build\Release\*.node" (
    echo SUCCESS! Found .node files in build\Release
    echo.
    echo Verifying...
    call node -e "const pty = require('node-pty'); console.log('node-pty loaded successfully!');"
    if errorlevel 1 (
        echo WARNING: Module test failed, but files were built.
        echo You may need to check the build output.
    ) else (
        echo.
        echo ========================================
        echo SUCCESS! node-pty is working!
        echo ========================================
    )
) else (
    echo.
    echo ========================================
    echo Build may have failed - no .node files found
    echo ========================================
    echo.
    echo Check the output above for errors.
    echo You may need to install Visual Studio 2022
    echo in the standard location for node-gyp to work.
)

echo.
pause

