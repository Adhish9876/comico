@echo off
echo ========================================
echo Building Unified ShadowNexus Server
echo (Chat + Video + Audio in ONE EXE)
echo ========================================

REM Clean previous SERVER builds only (not entire dist folder)
echo Cleaning previous server builds...
if exist dist\ShadowNexusServer rmdir /S /Q dist\ShadowNexusServer 2>nul
if exist build\ShadowNexusServer rmdir /S /Q build\ShadowNexusServer 2>nul

echo Building unified server executable...
echo This includes:
echo   - Chat server (port 5555)
echo   - File server (port 5556)
echo   - Video server (port 5000) 
echo   - Audio calls support
echo   - Automatic IP detection
echo   - .env file generation
echo.

REM Build unified server with all components
python -m PyInstaller ^
    --onedir ^
    --console ^
    --clean ^
    --name ShadowNexusServer ^
    --log-level ERROR ^
    --noupx ^
    --add-data templates;templates ^
    --add-data static;static ^
    --add-data web;web ^
    --add-data certs;certs ^
    --hidden-import socketio ^
    --hidden-import flask ^
    --hidden-import flask_socketio ^
    --hidden-import eventlet ^
    --hidden-import dns.resolver ^
    --hidden-import ssl ^
    --hidden-import json ^
    --hidden-import sqlite3 ^
    --hidden-import backend.storage ^
    --hidden-import backend.auth_module ^
    --hidden-import backend.audio_module ^
    --hidden-import backend.video_module ^
    --hidden-import backend.cert_manager ^
    --hidden-import backend.server ^
    --hidden-import werkzeug ^
    --hidden-import jinja2 ^
    --hidden-import markupsafe ^
    --hidden-import itsdangerous ^
    --hidden-import click ^
    --hidden-import engineio ^
    --hidden-import socketio.server ^
    --hidden-import socketio.client ^
    --hidden-import eventlet.wsgi ^
    --hidden-import eventlet.green ^
    --hidden-import eventlet.green.socket ^
    --hidden-import eventlet.green.ssl ^
    --hidden-import socketio.namespace ^
    --hidden-import engineio.async_drivers.threading ^
    --hidden-import dotenv ^
    --hidden-import cryptography ^
    --hidden-import cryptography.hazmat ^
    --hidden-import cryptography.hazmat.primitives ^
    --hidden-import cryptography.hazmat.primitives.hashes ^
    --hidden-import cryptography.hazmat.primitives.serialization ^
    --hidden-import cryptography.x509 ^
    --exclude-module tkinter ^
    --exclude-module matplotlib ^
    --exclude-module numpy ^
    --exclude-module pandas ^
    --exclude-module PIL ^
    --exclude-module cv2 ^
    --exclude-module tensorflow ^
    --exclude-module torch ^
    --exclude-module scipy ^
    unified_server.py

echo.
echo ========================================
echo Checking build result...
echo ========================================

if exist dist\ShadowNexusServer\ShadowNexusServer.exe (
    echo.
    echo ========================================
    echo ✅ UNIFIED BUILD SUCCESSFUL!
    echo ========================================
    echo.
    echo Created: dist\ShadowNexusServer\ShadowNexusServer.exe
    echo Size: 
    dir dist\ShadowNexusServer\ShadowNexusServer.exe | findstr ShadowNexusServer
    echo.
    echo Features included:
    echo   ✓ Chat server (port 5555)
    echo   ✓ File server (port 5556)
    echo   ✓ Video server (port 5000)
    echo   ✓ Audio calls support
    echo   ✓ Automatic IP detection
    echo   ✓ .env file auto-generation
    echo   ✓ SSL certificate management
    echo   ✓ All templates and assets
    echo.
    echo To start the complete system:
    echo   dist\ShadowNexusServer\ShadowNexusServer.exe
    echo.
    echo The server will:
    echo   1. Auto-detect your LAN IP
    echo   2. Create/update .env file
    echo   3. Start chat + video servers together
    echo   4. Generate SSL certificates if needed
    echo.
) else (
    echo.
    echo ========================================
    echo ❌ BUILD FAILED!
    echo ========================================
    echo Check the error messages above.
    echo.
)

echo ========================================
echo Build process complete
echo ========================================
pause
