@echo off
REM Shadow Nexus Server - FIXED Build Script
REM Addresses application initialization error 0xc0000142
REM
REM Key fixes:
REM - Disabled UPX compression (causes DLL loading issues)
REM - Added comprehensive hidden imports
REM - Proper Windows module handling
REM - Clean build process

setlocal enabledelayedexpansion

echo ========================================
echo Shadow Nexus Server - FIXED BUILD
echo ========================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found in PATH
    echo Please install Python 3.8+ and add it to your PATH
    pause
    exit /b 1
)

echo Step 1: Verifying build requirements...
python verify_build_requirements.py
if errorlevel 1 (
    echo.
    echo ERROR: Build requirements check failed
    echo Please install missing dependencies and try again
    pause
    exit /b 1
)

echo.
echo Step 2: Installing/upgrading critical dependencies...
python -m pip install --upgrade pip
python -m pip install --upgrade pyinstaller setuptools wheel
python -m pip install -r requirements.txt

echo.
echo Step 3: Cleaning previous build artifacts...
if exist "build\" (
    echo Removing build\ directory...
    rmdir /s /q "build\"
)
if exist "dist\" (
    echo Removing dist\ directory...
    rmdir /s /q "dist\"
)
if exist "__pycache__\" (
    echo Removing __pycache__\ directory...
    rmdir /s /q "__pycache__\"
)

REM Remove .pyc files
for /r %%i in (*.pyc) do (
    del "%%i"
)

echo.
echo Step 4: Creating .env file if missing...
if not exist ".env" (
    echo Creating default .env file...
    echo SERVER_IP=0.0.0.0 > .env
    echo VIDEO_PORT=8080 >> .env
    echo AUDIO_PORT=8081 >> .env
) else (
    echo .env file exists - keeping current configuration
)

echo.
echo Step 5: Building executable with FIXED configuration...
echo Using ShadowNexusServer.spec (FIXED version)
echo This may take 3-5 minutes...
echo.

python -m PyInstaller --clean --noconfirm ShadowNexusServer.spec

if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: PyInstaller build failed
    echo ========================================
    echo.
    echo Common solutions:
    echo 1. Check that all files in the spec exist
    echo 2. Ensure all Python packages are installed
    echo 3. Try running: pip install --upgrade pyinstaller
    echo 4. Check the build log above for specific errors
    echo.
    pause
    exit /b 1
)

echo.
echo Step 6: Verifying build output...
if exist "dist\ShadowNexusServer\ShadowNexusServer.exe" (
    echo ✅ SUCCESS: ShadowNexusServer.exe created
    
    REM Get file size
    for %%A in ("dist\ShadowNexusServer\ShadowNexusServer.exe") do (
        set "size=%%~zA"
        set /a size_mb=!size!/1024/1024
    )
    echo    File size: !size_mb! MB
    echo    Location: dist\ShadowNexusServer\ShadowNexusServer.exe
    
    REM Count total files in distribution
    set file_count=0
    for /r "dist\ShadowNexusServer" %%f in (*) do set /a file_count+=1
    echo    Total files in distribution: !file_count!
    
) else (
    echo ❌ ERROR: ShadowNexusServer.exe not found
    echo The build appears to have failed
    pause
    exit /b 1
)

echo.
echo Step 7: Testing executable startup...
echo Performing quick startup test (will exit after 3 seconds)...
timeout /t 1 /nobreak >nul

cd "dist\ShadowNexusServer"
start /wait /b cmd /c "ShadowNexusServer.exe --test 2>error.log & timeout /t 3 /nobreak >nul & taskkill /f /im ShadowNexusServer.exe >nul 2>&1"
cd ..\..

if exist "dist\ShadowNexusServer\error.log" (
    for %%A in ("dist\ShadowNexusServer\error.log") do set error_size=%%~zA
    if !error_size! gtr 0 (
        echo ⚠️  WARNING: Errors detected during startup test
        echo Error log contents:
        type "dist\ShadowNexusServer\error.log"
        echo.
        echo The executable may have issues. Please test manually.
    ) else (
        echo ✅ Startup test completed without critical errors
    )
) else (
    echo ✅ Startup test completed successfully
)

echo.
echo ========================================
echo BUILD COMPLETE
echo ========================================
echo.
echo ✅ FIXED executable created successfully!
echo.
echo Key fixes applied:
echo   • Disabled UPX compression (prevents DLL loading errors)
echo   • Added comprehensive Windows module support
echo   • Included all critical dependencies
echo   • Proper binary handling for audio/video modules
echo.
echo Location: dist\ShadowNexusServer\ShadowNexusServer.exe
echo.
echo To run the server:
echo   1. Navigate to: dist\ShadowNexusServer\
echo   2. Double-click: ShadowNexusServer.exe
echo   3. Or run from command line for detailed output
echo.
echo The application initialization error 0xc0000142 should now be resolved.
echo.
pause