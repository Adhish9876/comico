@echo off
title ShadowNexus Client Launcher
echo.
echo ========================================
echo    ShadowNexus Client Launcher
echo ========================================
echo.

REM Check if executable exists
if not exist "dist\ShadowNexusClient\ShadowNexusClient.exe" (
    echo ❌ Error: ShadowNexusClient.exe not found in dist\ShadowNexusClient folder
    echo.
    echo Please build the executable first by running:
    echo   build_exe.bat
    echo.
    pause
    exit /b 1
)

echo ✅ Found ShadowNexusClient.exe
echo.
echo Starting ShadowNexus Client...
echo.
echo 💡 Tips:
echo   - Make sure the server is running first
echo   - The client will open in your web browser
echo   - Startup time: ~1 second (optimized!)
echo.

REM Launch the executable
cd /d "%~dp0"
start "" "dist\ShadowNexusClient\ShadowNexusClient.exe"

echo.
echo 🚀 Client launched successfully!
echo.
echo Press any key to close this launcher...
pause >nul