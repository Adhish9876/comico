# Manual mkcert installation script
Write-Host "Downloading mkcert..." -ForegroundColor Yellow

$url = "https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-windows-amd64.exe"
$output = "mkcert.exe"

try {
    Invoke-WebRequest -Uri $url -OutFile $output
    Write-Host "SUCCESS: mkcert downloaded" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to download mkcert: $_" -ForegroundColor Red
    exit 1
}

# Install local CA
Write-Host "Installing local Certificate Authority..." -ForegroundColor Yellow
.\mkcert.exe -install

# Read SERVER_IP from .env
$serverIP = "172.20.10.9"
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "^SERVER_IP=(.+)$") {
            $serverIP = $matches[1].Trim()
            break
        }
    }
}

Write-Host "Generating certificates for: localhost, 127.0.0.1, $serverIP, 0.0.0.0" -ForegroundColor Cyan

# Remove old certificates
if (Test-Path "cert.pem") { Remove-Item "cert.pem" -Force }
if (Test-Path "key.pem") { Remove-Item "key.pem" -Force }

# Generate certificates
.\mkcert.exe -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 $serverIP 0.0.0.0

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "SSL Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Certificates generated successfully!" -ForegroundColor White
Write-Host "Start your server with: python video_module.py" -ForegroundColor Cyan
Write-Host "Access at: https://$serverIP:5000" -ForegroundColor Cyan
Write-Host ""
