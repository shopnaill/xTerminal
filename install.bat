@echo off
echo Setting up Visual Studio 2026 environment...
call "D:\Program Files\VS\VC\Auxiliary\Build\vcvars64.bat"
if errorlevel 1 (
    echo Failed to set up Visual Studio environment!
    pause
    exit /b 1
)
cd /d "%~dp0"
echo Installing npm packages...
call npm install
if errorlevel 1 (
    echo.
    echo Installation failed. Try running this from Developer Command Prompt instead.
    echo.
    pause
    exit /b 1
)
echo.
echo Installation completed successfully!
pause

