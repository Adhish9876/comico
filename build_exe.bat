@echo off
echo Building ShadowNexus Client executable...
echo.

REM Clean previous builds
if exist "dist" rmdir /s /q "dist"
if exist "build" rmdir /s /q "build"

echo Cleaning previous builds...
echo.

REM Build the executable
echo Starting PyInstaller build...
python -m PyInstaller --clean client.spec

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Build completed successfully!
    echo.
    echo The executable is located at: dist\ShadowNexusClient.exe
    echo.
    echo You can now run the client by double-clicking the executable.
    echo Make sure the server is running before starting the client.
    echo.
    pause
) else (
    echo.
    echo ❌ Build failed! Check the error messages above.
    echo.
    pause
)