@echo off
REM Shadow Nexus - Start All Servers
REM Runs Chat Server (8082) and Video Server (5000) in same terminal

setlocal enabledelayedexpansion

cls
color 0B
echo.
echo ============================================================
echo. 🚀 Shadow Nexus - Starting All Servers
echo ============================================================
echo.

REM Kill processes on ports 5000, 5555, and 5556
echo 🧹 Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5000"') do (
    taskkill /PID %%a /F 2>nul
    echo ✓ Freed port 5000
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5555"') do (
    taskkill /PID %%a /F 2>nul
    echo ✓ Freed port 5555
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5556"') do (
    taskkill /PID %%a /F 2>nul
    echo ✓ Freed port 5556
)

timeout /t 1 /nobreak

echo.
echo ============================================================
echo 📡 Starting Chat Server on port 5555 and 5556...
echo ============================================================
echo.

REM Start chat server in background (using /b flag to stay in same terminal)
start /b "" python backend\server.py

timeout /t 3 /nobreak

echo.
echo ============================================================
echo 📹 Starting Video Server on port 5000...
echo ============================================================
echo.

REM Start video server in foreground (will block until stopped)
python -W ignore backend\video_module.py

echo.
echo ============================================================
echo ✅ All Servers Stopped
echo ============================================================
echo.
