@echo off
title Shadow Nexus - Start All Services

echo ======================================
echo Starting Shadow Nexus Services
echo ======================================

:: Check Python
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Python is not installed. Install Python 3.8+
    exit /b 1
)

:: Install requirements if needed
python -c "import eel, flask, flask_socketio" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Installing required packages...
    pip install -r requirements.txt
)

:: Start Video Server
echo.
echo Starting Video Server (port 5000)...
start "Video Server" /B python video_server.py

:: Start Chat Server
echo Starting Chat Server (port 5555)...
start "Chat Server" /B python server.py

:: Start Client 1
echo Starting Client 1 (port 8080)...
start "Client 1" /B python client_eel.py 8080

:: Start Client 2
echo Starting Client 2 (port 8081)...
start "Client 2" /B python client_eel.py 8081

echo.
echo ======================================
echo Shadow Nexus is running!
echo ======================================
echo Services:
echo   Video Server:  http://localhost:5000
echo   Chat Server:   localhost:5555
echo   Client 1:      http://localhost:8080
echo   Client 2:      http://localhost:8081
echo.
echo Press CTRL+C in this window to stop manually
pause
