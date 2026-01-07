@echo off
echo ========================================
echo Creating Visual Studio Symlink
echo ========================================
echo.
echo This will create a symlink from:
echo   C:\Program Files\Microsoft Visual Studio\2022\BuildTools
echo   to
echo   D:\Program Files\VS
echo.
echo This requires Administrator privileges.
echo.
pause

echo.
echo Creating directory structure...
mkdir "C:\Program Files\Microsoft Visual Studio\2022" 2>nul

echo.
echo Creating symlink (requires Admin)...
mklink /J "C:\Program Files\Microsoft Visual Studio\2022\BuildTools" "D:\Program Files\VS"

if errorlevel 1 (
    echo.
    echo ========================================
    echo FAILED: Could not create symlink
    echo ========================================
    echo.
    echo This requires Administrator privileges.
    echo.
    echo Please run this script as Administrator:
    echo 1. Right-click on this file
    echo 2. Select "Run as administrator"
    echo.
    pause
    exit /b 1
) else (
    echo.
    echo ========================================
    echo SUCCESS! Symlink created
    echo ========================================
    echo.
    echo Now try rebuilding node-pty:
    echo   npm rebuild node-pty
    echo.
    echo Or use the rebuild script:
    echo   rebuild-node-pty.bat
    echo.
)

pause

