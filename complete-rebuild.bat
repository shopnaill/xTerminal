@echo off
echo ========================================
echo Complete node-pty Rebuild Process
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
echo Step 2: Navigating to project...
cd /d D:\Work\Terminal
if errorlevel 1 (
    echo ERROR: Could not navigate to project directory!
    pause
    exit /b 1
)

echo.
echo Step 3: Rebuilding node-pty...
echo This may take a few minutes...
echo.
call npm rebuild node-pty

if errorlevel 1 (
    echo.
    echo ========================================
    echo Rebuild failed
    echo ========================================
    echo.
    echo Check the error messages above.
    echo.
    echo Common issues:
    echo - Make sure the patch was applied: patch-node-gyp-vs2026.ps1
    echo - Make sure you're in the correct directory
    echo - Make sure VS 2026 C++ workload is installed
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo Rebuild completed!
echo ========================================
echo.
echo Step 4: Verifying installation...
call node -e "const pty = require('node-pty'); console.log('SUCCESS: node-pty loaded successfully!');"

if errorlevel 1 (
    echo.
    echo WARNING: Module test failed.
    echo.
    echo Checking for built files...
    if exist "node_modules\node-pty\build\Release\*.node" (
        echo Found .node files in build\Release\
        echo The build may have succeeded but there's a loading issue.
    ) else (
        echo No .node files found. Build may have failed.
    )
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

echo.
pause

