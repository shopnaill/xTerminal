@echo off
echo ========================================
echo Direct Build of node-pty
echo Bypassing node-gyp version detection
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

cd node_modules\node-pty

echo.
echo Setting up build environment...
set GYP_MSVS_VERSION=
set npm_config_msvs_version=
set VCINSTALLDIR=D:\Program Files\VS\VC
set VSINSTALLDIR=D:\Program Files\VS
set WindowsSdkDir=D:\Program Files\VS\SDK
set PATH=%VCINSTALLDIR%\Tools\MSVC\14.44.35207\bin\Hostx64\x64;%PATH%

echo.
echo Attempting to configure build...
call node-gyp configure --target_arch=x64 --dist-url=https://electronjs.org/headers

if errorlevel 1 (
    echo Configuration failed. Trying alternative approach...
    echo.
    echo Creating build directory manually...
    if not exist build mkdir build
    if not exist build\Release mkdir build\Release
    
    echo.
    echo NOTE: Manual configuration may be needed.
    echo The build process requires specific gyp configuration.
    echo.
    echo You may need to:
    echo 1. Create the symlink: create-vs-symlink.bat (as Admin)
    echo 2. Or install VS 2022 in standard location
    echo 3. Or use a pre-built binary
    pause
    exit /b 1
)

echo.
echo Building...
call node-gyp build --target_arch=x64

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
    ) else (
        echo.
        echo You can now run: npm start
    )
) else (
    echo.
    echo ========================================
    echo Build may have failed
    echo ========================================
    echo.
    echo The symlink approach is recommended.
    echo Run as Administrator: create-vs-symlink.bat
)

echo.
pause

