@echo off
title Shadow Nexus Server
color 0A

echo ============================================================
echo            🚀 Shadow Nexus Server Launcher 
echo ============================================================
echo.

REM Check if executable exists
if not exist "dist\ShadowNexusServer.exe" (
    echo ❌ Server executable not found!
    echo Please build the server first using: emergency_build.bat
    pause
    exit /b 1
)

echo ✓ Starting Shadow Nexus Server...
echo ✓ Press Ctrl+C in the server window to stop
echo.

REM Launch the server
cd /d "%~dp0"
dist\ShadowNexusServer.exe

REM If server exits, show message
echo.
echo ============================================================
echo Server has stopped. 
echo ============================================================
pause
