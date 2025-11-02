# ShadowNexus SSL Certificate Installer
# This PowerShell script installs the mkcert CA automatically
# Can be compiled to .exe using PS2EXE

param(
    [switch]$Silent = $false
)

# Colors for output
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Error-Custom { Write-Host $args -ForegroundColor Red }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning-Custom { Write-Host $args -ForegroundColor Yellow }

# Banner
Write-Host ""
Write-Host "================================================================================"
Write-Host "   ShadowNexus - SSL Certificate Installer" -ForegroundColor Cyan
Write-Host "================================================================================" 
Write-Host ""
Write-Info "This will install the trusted certificate authority for ShadowNexus video calls."
Write-Info "You will only need to run this ONCE."
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Error-Custom "ERROR: This script requires Administrator privileges!"
    Write-Host ""
    Write-Warning-Custom "Please right-click this file and select 'Run as administrator'"
    Write-Host ""
    if (-not $Silent) {
        Read-Host "Press Enter to exit"
    }
    exit 1
}

Write-Success "Running as Administrator... ✓"
Write-Host ""

# Function to find mkcert
function Find-Mkcert {
    # Check PATH
    $mkcert = Get-Command mkcert -ErrorAction SilentlyContinue
    if ($mkcert) {
        return $mkcert.Source
    }
    
    # Check common install locations
    $paths = @(
        "C:\Program Files\mkcert\mkcert.exe",
        "C:\Program Files (x86)\mkcert\mkcert.exe",
        "$env:LOCALAPPDATA\mkcert\mkcert.exe",
        "$env:APPDATA\mkcert\mkcert.exe",
        "C:\ProgramData\chocolatey\bin\mkcert.exe",
        "C:\Users\$env:USERNAME\scoop\shims\mkcert.exe"
    )
    
    foreach ($path in $paths) {
        if (Test-Path $path) {
            Write-Info "Found mkcert at: $path"
            return $path
        }
    }
    
    return $null
}

# Find or install mkcert
$mkcertPath = Find-Mkcert

if (-not $mkcertPath) {
    Write-Warning-Custom "mkcert not found. Attempting to install..."
    Write-Host ""
    
    # Try direct download from GitHub first (most reliable)
    Write-Info "Downloading mkcert from GitHub..."
    $installDir = "C:\Program Files\mkcert"
    $mkcertExe = "$installDir\mkcert.exe"
    
    try {
        # Create install directory
        if (-not (Test-Path $installDir)) {
            New-Item -ItemType Directory -Path $installDir -Force | Out-Null
        }
        
        # Download latest mkcert for Windows
        $downloadUrl = "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe"
        Write-Info "Downloading from: $downloadUrl"
        
        # Use WebClient for compatibility with older PowerShell versions
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($downloadUrl, $mkcertExe)
        
        if (Test-Path $mkcertExe) {
            Write-Success "Downloaded successfully! ✓"
            $mkcertPath = $mkcertExe
            
            # Add to PATH for future use
            $envPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
            if ($envPath -notlike "*$installDir*") {
                [Environment]::SetEnvironmentVariable("Path", "$envPath;$installDir", "Machine")
                Write-Info "Added to system PATH"
            }
        }
    }
    catch {
        Write-Warning-Custom "Direct download failed: $_"
    }
    
    # Try chocolatey as fallback
    if (-not $mkcertPath) {
        $choco = Get-Command choco -ErrorAction SilentlyContinue
        if ($choco) {
            Write-Info "Trying Chocolatey installation..."
            & choco install mkcert -y 2>&1 | Out-Null
            $mkcertPath = Find-Mkcert
        }
    }
    
    # Try scoop as fallback
    if (-not $mkcertPath) {
        $scoop = Get-Command scoop -ErrorAction SilentlyContinue
        if ($scoop) {
            Write-Info "Trying Scoop installation..."
            & scoop install mkcert 2>&1 | Out-Null
            $mkcertPath = Find-Mkcert
        }
    }
    
    # Still not found - final error
    if (-not $mkcertPath) {
        Write-Error-Custom "ERROR: Could not download or install mkcert!"
        Write-Host ""
        Write-Warning-Custom "All automatic installation methods failed."
        Write-Warning-Custom "Please install manually:"
        Write-Host ""
        Write-Host "  1. Download from: https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe"
        Write-Host "  2. Save as: C:\Program Files\mkcert\mkcert.exe"
        Write-Host "  3. Run this installer again"
        Write-Host ""
        if (-not $Silent) {
            Read-Host "Press Enter to exit"
        }
        exit 1
    }
}

Write-Success "mkcert found: $mkcertPath ✓"
Write-Host ""

# Install CA
Write-Info "Installing Certificate Authority..."
Write-Info "This will add the mkcert CA to your trusted certificate store."
Write-Host ""

try {
    & $mkcertPath -install 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "================================================================================"
        Write-Success "   ✅ SUCCESS! Certificate Authority Installed"
        Write-Host "================================================================================"
        Write-Host ""
        Write-Info "The mkcert CA has been installed and trusted by your system."
        Write-Host ""
        Write-Host "What this means:"
        Write-Host "  • You will NO LONGER see SSL warnings for ShadowNexus"
        Write-Host "  • Your browser will trust the video call connection"
        Write-Host "  • Everything is secure and encrypted"
        Write-Host ""
        Write-Success "Next steps:"
        Write-Host "  1. Close your web browser completely"
        Write-Host "  2. Reopen your browser"
        Write-Host "  3. Visit: https://10.200.14.204:5000"
        Write-Host "  4. Enjoy SSL-warning-free video calls! ✓"
        Write-Host ""
        Write-Host "================================================================================"
        Write-Host ""
        
        if (-not $Silent) {
            Read-Host "Press Enter to close this window"
        }
        exit 0
    } else {
        throw "mkcert -install failed with exit code $LASTEXITCODE"
    }
}
catch {
    Write-Host ""
    Write-Host "================================================================================"
    Write-Error-Custom "   ❌ ERROR: Installation Failed"
    Write-Host "================================================================================"
    Write-Host ""
    Write-Error-Custom "The certificate installation encountered an error:"
    Write-Host $_
    Write-Host ""
    Write-Warning-Custom "Please contact your administrator with this error message."
    Write-Host ""
    
    if (-not $Silent) {
        Read-Host "Press Enter to close this window"
    }
    exit 1
}
