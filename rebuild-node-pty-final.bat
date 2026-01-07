@echo off
echo ========================================
echo Final node-pty Rebuild for VS 2026
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
echo Checking for Windows SDK...
REM Try to find Windows SDK version
set WindowsSDKVersion=
for /f "tokens=*" %%i in ('dir /b /ad "C:\Program Files (x86)\Windows Kits\10\Include" 2^>nul ^| findstr /r "^10\."') do (
    set WindowsSDKVersion=%%i.0
    goto :sdk_found
)
REM Check VS SDK location
for /f "tokens=*" %%i in ('dir /b /ad "D:\Program Files\VS\SDK" 2^>nul ^| findstr /r "^10\."') do (
    set WindowsSDKVersion=%%i.0
    goto :sdk_found
)
:sdk_found
if "%WindowsSDKVersion%"=="" (
    echo WARNING: Windows SDK not found!
    echo.
    echo You need to install Windows SDK. Options:
    echo 1. Install via Visual Studio Installer - Individual components - Windows SDK
    echo 2. Download from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
    echo.
    echo The build may fail without Windows SDK.
    echo.
) else (
    echo Using Windows SDK: %WindowsSDKVersion%
)

echo.
echo Step 2: Navigating to project...
cd /d "%~dp0"

echo.
echo Step 3: Checking if node-pty is installed...
if not exist "node_modules\node-pty" (
    echo node-pty not found. Installing...
    call npm install node-pty --ignore-scripts
    if errorlevel 1 (
        echo ERROR: Failed to install node-pty!
        pause
        exit /b 1
    )
)

echo.
echo Step 4: Rebuilding node-pty...
echo This may take a few minutes...
echo.
cd node_modules\node-pty
call npx node-gyp rebuild

if errorlevel 1 (
    echo.
    echo ========================================
    echo Rebuild failed
    echo ========================================
    echo.
    echo Check the error messages above.
    cd ..\..
    pause
    exit /b 1
)

cd ..\..

echo.
echo Step 5: Checking for built files...
if exist "node_modules\node-pty\build\Release\*.node" (
    echo Found .node files!
    echo.
    echo Step 6: Verifying installation...
    call node -e "const pty = require('node-pty'); console.log('SUCCESS: node-pty loaded successfully!');"
    
    if errorlevel 1 (
        echo.
        echo WARNING: Module test failed, but .node files exist.
        echo The build may have succeeded but there's a loading issue.
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
) else (
    echo.
    echo ========================================
    echo ERROR: No .node files found
    echo ========================================
    echo.
    echo The rebuild completed but no native modules were built.
    echo Check the build output above for errors.
    echo.
    echo Try checking:
    echo   node_modules\node-pty\build\Release\
    echo.
)

echo.
pause

