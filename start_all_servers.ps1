# Shadow Nexus - Start All Servers
# Runs both Chat Server and Video Server with SSL warnings suppressed

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🚀 Shadow Nexus - Starting All Servers" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kill any existing processes on ports 5000 and 8082
Write-Host "🧹 Cleaning up old processes..." -ForegroundColor Yellow

try {
    Get-NetTCPConnection -LocalPort 5000 -ErrorAction SilentlyContinue | ForEach-Object { 
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "✓ Freed port 5000" -ForegroundColor Green
    }
} catch { }

try {
    Get-NetTCPConnection -LocalPort 8082 -ErrorAction SilentlyContinue | ForEach-Object { 
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "✓ Freed port 8082" -ForegroundColor Green
    }
} catch { }

Start-Sleep -Seconds 1

# Set environment variable to suppress SSL warnings
$env:PYTHONWARNINGS = "ignore::DeprecationWarning,ignore::Warning"

Write-Host ""
Write-Host "📡 Starting Chat Server on port 8082..." -ForegroundColor Cyan
# Start Chat Server in a new window
$chatProcess = Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$PWD'; python server.py 2>&1 | Where-Object {`$_ -notmatch 'ssl|SSL|warning|Warning|DeprecationWarning'}`"" -PassThru

Start-Sleep -Seconds 2

Write-Host "📹 Starting Video Server on port 5000..." -ForegroundColor Cyan
# Start Video Server in a new window
$videoProcess = Start-Process powershell -ArgumentList "-NoExit -Command `"cd '$PWD'; python -W ignore video_module.py 2>&1 | Where-Object {`$_ -notmatch 'ssl|SSL|warning|Warning|DeprecationWarning'}`"" -PassThru

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ All Servers Started Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Chat Server:   http://localhost:8082" -ForegroundColor Cyan
Write-Host "📹 Video Server:  https://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "⏹️  To stop servers: Close the terminal windows" -ForegroundColor Yellow
Write-Host ""

# Keep main window open
Read-Host "Press Enter to exit..."
