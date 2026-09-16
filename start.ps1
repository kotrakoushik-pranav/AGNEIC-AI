# ================================================================
# Aegis AI — Development Startup Script (HTTPS mode)
# Usage: Right-click → Run with PowerShell
#        OR from terminal: .\start.ps1
#
# Backend  : https://localhost:8443  (TLS/HTTPS)
# Frontend : http://localhost:5173
# Mobile   : https://192.168.0.105:8443/mobile-camera?session=...
# ================================================================

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Aegis AI — Starting (HTTPS mode)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- 0. Check certs exist ---
if (-not (Test-Path "$ROOT\backend\certs\server.crt")) {
    Write-Host "[SETUP] Generating TLS certificate..." -ForegroundColor Yellow
    Push-Location "$ROOT\backend"
    py generate_cert.py
    Pop-Location
    if (-not (Test-Path "$ROOT\backend\certs\server.crt")) {
        Write-Host "ERROR: Certificate generation failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "   Certificate created." -ForegroundColor Green
}

# --- 1. Kill any processes already on ports 8443 / 5173 ---
Write-Host "[1/5] Clearing ports 8443 and 5173..." -ForegroundColor Yellow
foreach ($port in @(8443, 5173, 8000)) {
    $lines = netstat -ano 2>$null | Select-String ":$port " | Select-String "LISTENING"
    foreach ($line in $lines) {
        $pid_ = ($line -split '\s+')[-1]
        if ($pid_ -match '^\d+$') {
            try { Stop-Process -Id ([int]$pid_) -Force -ErrorAction SilentlyContinue } catch {}
        }
    }
}
Start-Sleep -Seconds 2

# --- 2. Start backend (HTTPS on 8443) ---
Write-Host "[2/5] Starting backend (FastAPI HTTPS on port 8443)..." -ForegroundColor Yellow
$backendProc = Start-Process -FilePath "py" `
    -ArgumentList "-m","uvicorn","app.main:app","--host","0.0.0.0","--port","8443",
                  "--ssl-keyfile","certs/server.key","--ssl-certfile","certs/server.crt" `
    -WorkingDirectory "$ROOT\backend" `
    -WindowStyle Minimized `
    -PassThru

# --- 3. Wait for backend health ---
Write-Host "[3/5] Waiting for backend..." -ForegroundColor Yellow
$maxWait = 30
$elapsed = 0
$backendOk = $false
# Disable cert check for self-signed
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13
while ($elapsed -lt $maxWait) {
    Start-Sleep -Seconds 2; $elapsed += 2
    try {
        $h = Invoke-RestMethod "https://localhost:8443/api/health" -TimeoutSec 3
        if ($h.status -eq "ok") {
            $backendOk = $true
            Write-Host "   Backend ONLINE (HTTPS) — face_engine=$($h.face_engine)" -ForegroundColor Green
            break
        }
    } catch { <# still starting #> }
    Write-Host "   ...waiting ($elapsed/$maxWait s)"
}

if (-not $backendOk) {
    Write-Host "ERROR: Backend failed to start within $maxWait s." -ForegroundColor Red
    exit 1
}

# --- 4. Start frontend ---
Write-Host "[4/5] Starting frontend (Vite on port 5173)..." -ForegroundColor Yellow
$frontendProc = Start-Process -FilePath "cmd" `
    -ArgumentList "/c","npm run dev" `
    -WorkingDirectory "$ROOT\frontend" `
    -WindowStyle Minimized `
    -PassThru

# --- 5. Wait for frontend ---
$elapsed = 0; $frontendOk = $false
while ($elapsed -lt 30) {
    Start-Sleep -Seconds 2; $elapsed += 2
    try {
        $r = Invoke-WebRequest "http://localhost:5173" -UseBasicParsing -TimeoutSec 3
        if ($r.StatusCode -eq 200) { $frontendOk = $true; break }
    } catch { <# still starting #> }
    Write-Host "   ...waiting ($elapsed/30 s)"
}

if (-not $frontendOk) {
    Write-Host "ERROR: Frontend failed to start." -ForegroundColor Red; exit 1
}
Write-Host "   Frontend ONLINE" -ForegroundColor Green

# --- Done ---
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  APPLICATION READY" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  DASHBOARD (PC)   : http://localhost:5173" -ForegroundColor White
Write-Host "  BACKEND (HTTPS)  : https://localhost:8443" -ForegroundColor White
Write-Host "  HEALTH CHECK     : https://localhost:8443/api/health" -ForegroundColor White
Write-Host "  API DOCS         : https://localhost:8443/docs" -ForegroundColor White
Write-Host "  WEBSOCKET        : wss://localhost:8443/ws" -ForegroundColor White
Write-Host ""
Write-Host "  PHONE (same WiFi): https://192.168.0.105:8443/mobile-camera?session=..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  On Android: tap Advanced -> Proceed to bypass the self-signed cert warning." -ForegroundColor Yellow
Write-Host ""
Write-Host "  Press Ctrl+C or close this window to stop." -ForegroundColor Gray

try { while ($true) { Start-Sleep -Seconds 60 } }
finally {
    Write-Host "Stopping services..." -ForegroundColor Yellow
    if ($backendProc)  { Stop-Process -Id $backendProc.Id  -Force -ErrorAction SilentlyContinue }
    if ($frontendProc) { Stop-Process -Id $frontendProc.Id -Force -ErrorAction SilentlyContinue }
}
