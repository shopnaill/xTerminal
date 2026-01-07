@echo off
echo ========================================
echo Rebuilding node-pty with Visual Studio
echo ========================================
echo.

echo Setting up Visual Studio 2026 environment...
call "D:\Program Files\VS\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 (
    echo ERROR: Failed to set up Visual Studio environment!
    echo Make sure Visual Studio is installed at: D:\Program Files\VS
    pause
    exit /b 1
)

echo.
echo Environment set up successfully!
echo.

cd /d "%~dp0"

echo Checking if node-pty is installed...
if not exist "node_modules\node-pty" (
    echo ERROR: node-pty is not installed!
    echo Please run: npm run install:no-build
    pause
    exit /b 1
)

echo.
echo Setting environment variables for node-gyp...
set GYP_MSVS_VERSION=2022
set npm_config_msvs_version=2022
set VCINSTALLDIR=D:\Program Files\VS\VC
set VSINSTALLDIR=D:\Program Files\VS

echo.
echo Rebuilding node-pty...
call npm rebuild node-pty

if errorlevel 1 (
    echo.
    echo ========================================
    echo Rebuild failed with npm rebuild
    echo ========================================
    echo.
    echo Trying manual build with node-gyp...
    cd node_modules\node-pty
    call node-gyp rebuild --msvs_version=2022
    cd ..\..
    
    if errorlevel 1 (
        echo.
        echo ========================================
        echo Manual rebuild also failed!
        echo ========================================
        echo.
        echo The issue is that node-gyp cannot detect Visual Studio 2026
        echo from the custom installation path.
        echo.
        echo Possible solutions:
        echo 1. Try installing Visual Studio 2022 in the standard location
        echo 2. Create a symlink from standard location to your VS installation
        echo 3. Use a pre-built node-pty binary (if available)
        echo.
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo node-pty rebuild completed!
echo ========================================
echo.
echo Verifying installation...
call node -e "const pty = require('node-pty'); console.log('node-pty loaded successfully!');"
if errorlevel 1 (
    echo WARNING: node-pty rebuild completed but module test failed.
    echo The .node file may not have been built correctly.
    echo Check node_modules\node-pty\build\Release for .node files
) else (
    echo.
    echo SUCCESS! You can now run: npm start
)
echo.

pause
