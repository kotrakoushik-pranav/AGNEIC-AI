# Aegis AI — Backend Startup Script
# Runs HTTP server (port 8000) for the dashboard API.
# The QR codes link to HTTPS port 8443 on the LAN IP.
#
# Usage (from backend/ folder):
#   .\start.ps1

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  AEGIS AI — Backend Startup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Detect LAN IP
$lanIp = (py -c "import socket; s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.connect(('8.8.8.8',80)); print(s.getsockname()[0]); s.close()" 2>$null)
if (-not $lanIp) { $lanIp = "YOUR_LAN_IP" }

Write-Host "Dashboard (HTTP)  : http://localhost:8000" -ForegroundColor Green
Write-Host "API Docs          : http://localhost:8000/docs" -ForegroundColor Green
Write-Host "Mobile Camera URL : https://${lanIp}:8443/mobile-camera" -ForegroundColor Yellow
Write-Host ""
Write-Host "NOTE: The QR code will show the HTTPS URL above." -ForegroundColor Yellow
Write-Host "      Phone must be on the same Wi-Fi as this computer." -ForegroundColor Yellow
Write-Host "      Accept the certificate warning on the phone (Advanced -> Proceed)." -ForegroundColor Yellow
Write-Host ""

# Start HTTP server for dashboard on port 8000
py -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
