@echo off
echo ========================================
echo Rebuilding node-pty with VS 2026
echo Using direct path method
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
echo Method 1: Using VS path directly...
cd node_modules\node-pty

REM Try using the path directly - node-gyp supports this
set npm_config_msvs_version=D:\Program Files\VS
call npx node-gyp configure --msvs_version="D:\Program Files\VS"

if errorlevel 1 (
    echo.
    echo Method 1 failed. Trying Method 2: Force version 2022...
    set npm_config_msvs_version=2022
    set GYP_MSVS_VERSION=2022
    call npx node-gyp configure --msvs_version=2022
)

if errorlevel 1 (
    echo.
    echo Method 2 failed. Trying Method 3: No version flag...
    set npm_config_msvs_version=
    set GYP_MSVS_VERSION=
    call npx node-gyp configure
)

if errorlevel 1 (
    echo.
    echo ========================================
    echo All configuration methods failed
    echo ========================================
    echo.
    echo The issue is that node-gyp cannot detect VS 2026.
    echo.
    echo Options:
    echo 1. Patch node-gyp (see WORKAROUND_VS2026.md)
    echo 2. Install VS 2022 Build Tools alongside VS 2026
    echo 3. Use pre-built binary
    echo.
    cd ..\..
    pause
    exit /b 1
)

echo.
echo Configuration successful! Building...
call npx node-gyp build

cd ..\..

if exist "node_modules\node-pty\build\Release\*.node" (
    echo.
    echo ========================================
    echo SUCCESS! Build completed
    echo ========================================
    echo.
    call node -e "const pty = require('node-pty'); console.log('node-pty loaded successfully!');"
    if errorlevel 1 (
        echo WARNING: Module test failed, but files exist.
        echo Check: node_modules\node-pty\build\Release\
    ) else (
        echo.
        echo You can now run: npm start
    )
) else (
    echo.
    echo ========================================
    echo Build may have failed - no .node files found
    echo ========================================
    echo.
    echo Check the output above for errors.
)

echo.
pause

