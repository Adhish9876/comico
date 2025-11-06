#!/usr/bin/env powershell
<#
.SYNOPSIS
Build Shadow Nexus Server Executable

.DESCRIPTION
This script creates a standalone server .exe that includes:
- server_launcher.py (manages both servers)
- server.py (chat server)
- video_module.py (video server)
- All dependencies bundled together

.PARAMETER CleanOnly
If specified, only cleans build artifacts without building

.EXAMPLE
.\build_server.ps1                  # Build the server
.\build_server.ps1 -CleanOnly       # Clean only
#>

param(
    [switch]$CleanOnly = $false
)

$ErrorActionPreference = "Continue"

function Write-Section {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

# Main execution
Write-Section "Shadow Nexus - Server Executable Builder"

# Check if PyInstaller is installed
Write-Host "Checking PyInstaller..." -ForegroundColor White
$pyinstaller_check = python -m PyInstaller --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "PyInstaller not found!"
    Write-Host "Please install it with: pip install pyinstaller" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Success "PyInstaller is installed"
Write-Host ""

# Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor White
$directories_to_clean = @("dist", "build", "__pycache__")

foreach ($dir in $directories_to_clean) {
    if (Test-Path $dir) {
        try {
            Remove-Item -Recurse -Force $dir -ErrorAction Stop
            Write-Host "   Removed: $dir" -ForegroundColor Gray
        } catch {
            Write-Warning-Custom "Could not remove $dir : $_"
        }
    }
}
Write-Success "Cleanup complete"
Write-Host ""

# Verify required files
Write-Host "📋 Verifying required files..." -ForegroundColor White
$required_files = @("server_launcher.py", "server.py", "video_module.py", ".env")

foreach ($file in $required_files) {
    if (Test-Path $file) {
        Write-Host "   ✓ $file" -ForegroundColor Green
    } else {
        if ($file -eq ".env") {
            Write-Warning-Custom "$file not found. Creating with defaults..."
            "SERVER_IP=127.0.0.1" | Out-File -FilePath ".env" -Encoding UTF8
        } else {
            Write-Error-Custom "$file not found! Cannot continue."
            Read-Host "Press Enter to exit"
            exit 1
        }
    }
}
Write-Success "All required files verified"
Write-Host ""

# If CleanOnly is specified, exit here
if ($CleanOnly) {
    Write-Section "✅ Cleanup Complete"
    exit 0
}

# Build the executable
Write-Section "🔨 Building Server Executable"
Write-Host "This may take 2-3 minutes..." -ForegroundColor Yellow
Write-Host "Please wait..." -ForegroundColor Gray
Write-Host ""

python -m PyInstaller --clean server.spec

if ($LASTEXITCODE -eq 0) {
    Write-Section "✅ Build Completed Successfully!"
    
    Write-Host ""
    Write-Host "📦 Output Location:" -ForegroundColor White
    Write-Host "   dist\ShadowNexusServer\ShadowNexusServer.exe" -ForegroundColor Cyan
    
    Write-Host ""
    Write-Host "📋 What's Included:" -ForegroundColor White
    Write-Host "   ✓ Unified server launcher" -ForegroundColor Green
    Write-Host "   ✓ Chat server (port 5555)" -ForegroundColor Green
    Write-Host "   ✓ File server (port 5556)" -ForegroundColor Green
    Write-Host "   ✓ Audio server (port 5557)" -ForegroundColor Green
    Write-Host "   ✓ Video/WebRTC server (port 5000)" -ForegroundColor Green
    Write-Host "   ✓ Automatic .env management" -ForegroundColor Green
    Write-Host "   ✓ Auto-detect LAN IP" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "🚀 How to Run:" -ForegroundColor White
    Write-Host "   1. Double-click ShadowNexusServer.exe" -ForegroundColor Yellow
    Write-Host "   2. It will auto-detect your LAN IP" -ForegroundColor Yellow
    Write-Host "   3. Share the displayed IP with clients" -ForegroundColor Yellow
    
    Write-Host ""
    Write-Host "💡 Command-Line Usage:" -ForegroundColor White
    Write-Host "   .\ShadowNexusServer.exe                  # Auto-detect IP" -ForegroundColor Gray
    Write-Host "   .\ShadowNexusServer.exe 192.168.1.100    # Specific IP" -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "📁 Distribution:" -ForegroundColor White
    Write-Host "   1. Copy entire 'dist/ShadowNexusServer' folder" -ForegroundColor Yellow
    Write-Host "   2. Can run on any Windows machine without Python installed" -ForegroundColor Yellow
    Write-Host "   3. All dependencies are bundled" -ForegroundColor Yellow
    
    Write-Host ""
    Write-Section "✅ Ready to Deploy!"
    
} else {
    Write-Host ""
    Write-Section "❌ Build Failed"
    Write-Error-Custom "Check the error messages above for details"
    Write-Host ""
}

Read-Host "Press Enter to exit"
