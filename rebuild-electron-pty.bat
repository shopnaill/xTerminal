@echo off
echo ========================================
echo Rebuilding node-pty for Electron
echo ========================================
echo.

echo Step 1: Setting up Visual Studio 2026 environment...
call "D:\Program Files\VS\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 (
    echo ERROR: Failed to set up Visual Studio environment!
    echo Trying to continue anyway...
)

echo.
cd /d "%~dp0"

echo Step 2: Patching node-gyp to detect VS 2026...
powershell -ExecutionPolicy Bypass -File ".\final-fix-vs2026.ps1"
if errorlevel 1 (
    echo WARNING: Patch script failed, continuing anyway...
)

echo.
echo Step 3: Rebuilding node-pty for Electron...
echo This will rebuild for Electron's Node.js version...
npx electron-rebuild -f -w node-pty

if errorlevel 1 (
    echo.
    echo ========================================
    echo Rebuild failed. Trying alternative method...
    echo ========================================
    echo.
    echo Attempting manual rebuild with node-gyp...
    cd node_modules\node-pty
    npx node-gyp rebuild --target=%ELECTRON_VERSION% --arch=x64 --dist-url=https://electronjs.org/headers
    cd ..\..
)

echo.
echo ========================================
echo Rebuild process completed
echo ========================================
echo.
pause

