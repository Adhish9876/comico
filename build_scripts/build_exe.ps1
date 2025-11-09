Write-Host "Building ShadowNexus Client executable..." -ForegroundColor Green
Write-Host ""

# Clean previous builds
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "Cleaned dist directory" -ForegroundColor Yellow
}

if (Test-Path "build") {
    Remove-Item -Recurse -Force "build"
    Write-Host "Cleaned build directory" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting PyInstaller build..." -ForegroundColor Cyan

# Build the executable
try {
    python -m PyInstaller --clean client.spec
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Build completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "The executable is located at: dist\ShadowNexusClient.exe" -ForegroundColor White
        Write-Host ""
        Write-Host "You can now run the client by double-clicking the executable." -ForegroundColor White
        Write-Host "Make sure the server is running before starting the client." -ForegroundColor Yellow
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Build failed! Check the error messages above." -ForegroundColor Red
        Write-Host ""
    }
} catch {
    Write-Host ""
    Write-Host "❌ Build failed with exception: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

Read-Host "Press Enter to continue"