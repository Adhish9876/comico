@echo off
title Shadow Nexus Unified Server
color 0A

echo ============================================================
echo            🚀 Shadow Nexus Unified Server Launcher 
echo ============================================================
echo.
echo This unified server includes:
echo   ✓ Chat Server (port 5555)
echo   ✓ File Server (port 5556) 
echo   ✓ Video Server (port 5000)
echo   ✓ Audio Calls Support
echo   ✓ Automatic IP Detection
echo   ✓ SSL Certificate Management
echo.

REM Check if executable exists
if not exist "dist\ShadowNexusServer\ShadowNexusServer.exe" (
    echo ❌ Unified server executable not found!
    echo Please build the server first using: build_scripts\build_unified.bat
    pause
    exit /b 1
)

echo ✓ Starting Shadow Nexus Unified Server...
echo ✓ The server will auto-detect your IP and configure everything
echo ✓ Press Ctrl+C to stop all servers
echo.
echo ============================================================

REM Launch the unified server
cd /d "%~dp0"
dist\ShadowNexusServer\ShadowNexusServer.exe

REM If server exits, show message
echo.
echo ============================================================
echo All servers have stopped. 
echo ============================================================
pause
