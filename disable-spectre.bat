@echo off
echo ========================================
echo Disabling Spectre Mitigation
echo ========================================
echo.

cd /d "%~dp0"

if not exist "node_modules\node-pty\binding.gyp" (
    echo ERROR: binding.gyp not found!
    pause
    exit /b 1
)

echo Creating backup...
copy "node_modules\node-pty\binding.gyp" "node_modules\node-pty\binding.gyp.backup" >nul

echo.
echo Removing Spectre mitigation from binding.gyp...
powershell -Command "(Get-Content 'node_modules\node-pty\binding.gyp') -replace 'SpectreMitigation.*?Spectre', '' -replace '/guard:cf', '' -replace '/ZH:SHA_256', '' | Set-Content 'node_modules\node-pty\binding.gyp' -NoNewline"

if errorlevel 1 (
    echo Failed to modify binding.gyp
    copy "node_modules\node-pty\binding.gyp.backup" "node_modules\node-pty\binding.gyp" >nul
    pause
    exit /b 1
)

echo.
echo Spectre mitigation disabled!
echo.
echo Now rebuild node-pty:
echo   rebuild-node-pty-final.bat
echo.
pause

