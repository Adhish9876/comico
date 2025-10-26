@echo off
echo ========================================
echo Building ShadowNexus Client
echo ========================================
echo.

REM Ensure icon files are in web folder
echo Copying icon files to web folder...
copy /Y icon.ico web\icon.ico >nul 2>&1
copy /Y icon.png web\icon.png >nul 2>&1
echo ✓ Icon files copied
echo.

REM Clean previous builds
echo Cleaning previous builds...
if exist "dist" rmdir /s /q "dist"
if exist "build" rmdir /s /q "build"
echo ✓ Cleaned
echo.

REM Build the executable
echo Building executable...
python -m PyInstaller --clean client.spec

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo ✅ Build completed successfully!
    echo ========================================
    echo.
    echo The executable is located at:
    echo   dist\ShadowNexusClient\ShadowNexusClient.exe
    echo.
    echo Features included:
    echo   ✓ Custom icon on executable
    echo   ✓ Favicon in browser window
    echo   ✓ Automatic port detection
    echo   ✓ Audio message persistence
    echo   ✓ Colorful video thumbnails
    echo.
    echo You can now run the client!
    echo.
) else (
    echo.
    echo ========================================
    echo ❌ Build failed!
    echo ========================================
    echo Check the error messages above.
    echo.
)

pause
