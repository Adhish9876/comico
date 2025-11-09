@echo off
REM ShadowNexus SSL Certificate Installer
REM This script installs the mkcert CA so users don't see SSL warnings
REM Just double-click this file to run!

setlocal enabledelayedexpansion

echo.
echo ================================================================================
echo   ShadowNexus - SSL Certificate Installer
echo ================================================================================
echo.
echo This will install the trusted certificate authority for ShadowNexus.
echo You will only need to run this ONCE.
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires Administrator privileges!
    echo.
    echo Please:
    echo   1. Right-click this file
    echo   2. Select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo Running as Administrator... ✓
echo.

REM Check if mkcert is already installed
where mkcert >nul 2>&1
if %errorLevel% equ 0 (
    echo mkcert found in PATH
    set MKCERT_CMD=mkcert
    goto :INSTALL_CA
)

REM Try to find mkcert in common locations
if exist "C:\Program Files\mkcert\mkcert.exe" (
    echo mkcert found in Program Files
    set MKCERT_CMD=C:\Program Files\mkcert\mkcert.exe
    goto :INSTALL_CA
)

if exist "%LOCALAPPDATA%\mkcert\mkcert.exe" (
    echo mkcert found in AppData
    set MKCERT_CMD=%LOCALAPPDATA%\mkcert\mkcert.exe
    goto :INSTALL_CA
)

REM mkcert not found - try to install it
echo.
echo Installing mkcert (Certificate Tool)...
echo Downloading from chocolatey...
echo.

REM Check if chocolatey is installed
where choco >nul 2>&1
if %errorLevel% equ 0 (
    echo Chocolatey found - installing mkcert...
    choco install mkcert -y
    if %errorLevel% equ 0 (
        echo mkcert installed successfully! ✓
        set MKCERT_CMD=mkcert
        goto :INSTALL_CA
    )
)

REM If chocolatey doesn't work, try scoop
where scoop >nul 2>&1
if %errorLevel% equ 0 (
    echo Scoop found - installing mkcert...
    scoop install mkcert
    if %errorLevel% equ 0 (
        echo mkcert installed successfully! ✓
        set MKCERT_CMD=mkcert
        goto :INSTALL_CA
    )
)

REM If all fails, show error
echo.
echo ERROR: Could not find or install mkcert!
echo.
echo Please install it manually:
echo   1. Download from: https://github.com/FiloSottile/mkcert/releases
echo   2. Run: mkcert.exe -install
echo.
pause
exit /b 1

:INSTALL_CA
echo.
echo Installing CA (Certificate Authority)...
echo This will add the mkcert CA to your trusted certificate store.
echo.

REM Run mkcert -install
"%MKCERT_CMD%" -install

if %errorLevel% equ 0 (
    echo.
    echo ================================================================================
    echo   ✅ SUCCESS! Certificate Authority Installed
    echo ================================================================================
    echo.
    echo The mkcert CA has been installed and trusted by your system.
    echo.
    echo What this means:
    echo   • You will NO LONGER see SSL warnings for ShadowNexus
    echo   • Your browser will trust the video call connection
    echo   • Everything is secure and encrypted
    echo.
    echo Next steps:
    echo   1. Close your web browser completely
    echo   2. Reopen your browser
    echo   3. Visit: https://10.200.14.204:5000
    echo   4. Enjoy SSL-warning-free video calls! ✓
    echo.
    echo ================================================================================
    echo.
    pause
    exit /b 0
) else (
    echo.
    echo ================================================================================
    echo   ❌ ERROR: Installation Failed
    echo ================================================================================
    echo.
    echo The certificate installation encountered an error.
    echo.
    echo Please contact your administrator with this error code: %errorLevel%
    echo.
    pause
    exit /b 1
)
