# Aegis AI — HTTPS Server for Mobile Camera
# Run this IN A SECOND TERMINAL alongside start.ps1
#
# Usage (from backend/ folder):
#   .\start_https.ps1

Write-Host ""
Write-Host "======================================" -ForegroundColor Magenta
Write-Host "  AEGIS AI — HTTPS Mobile Server" -ForegroundColor Magenta
Write-Host "======================================" -ForegroundColor Magenta
Write-Host ""

$lanIp = (py -c "import socket; s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.connect(('8.8.8.8',80)); print(s.getsockname()[0]); s.close()" 2>$null)
if (-not $lanIp) { $lanIp = "YOUR_LAN_IP" }

$cert = "certs\server.crt"
$key  = "certs\server.key"

if (-not (Test-Path $cert)) {
    Write-Host "Generating TLS certificate..." -ForegroundColor Yellow
    py generate_cert.py
}

Write-Host "HTTPS Mobile URL  : https://${lanIp}:8443/mobile-camera" -ForegroundColor Green
Write-Host ""
Write-Host "Scan the QR code from the dashboard to get this URL on your phone." -ForegroundColor Cyan
Write-Host ""

py -m uvicorn app.main:app --host 0.0.0.0 --port 8443 --ssl-keyfile $key --ssl-certfile $cert
