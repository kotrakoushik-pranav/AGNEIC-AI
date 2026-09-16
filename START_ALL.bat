@echo off
title Aegis AI — Startup
color 0B
echo.
echo =========================================
echo   AEGIS AI — Starting All Servers
echo =========================================
echo.

REM ── Check required files ─────────────────────────────────────
if not exist "backend\.env" (
    echo [WARNING] backend\.env not found. Copying from .env.example...
    copy "backend\.env.example" "backend\.env" >nul 2>&1
    echo          Edit backend\.env with your real credentials.
)
if not exist "frontend\.env" (
    echo [WARNING] frontend\.env not found. Copying from .env.example...
    copy "frontend\.env.example" "frontend\.env" >nul 2>&1
    echo          Edit frontend\.env with your Supabase credentials.
)

REM ── Auto-detect current LAN IP ───────────────────────────────
for /f %%i in ('py -c "import socket; s=socket.socket(); s.connect((\"8.8.8.8\",80)); print(s.getsockname()[0]); s.close()"') do set LAN_IP=%%i
if "%LAN_IP%"=="" set LAN_IP=127.0.0.1

echo Detected LAN IP: %LAN_IP%
echo.

REM ── Supabase configuration check ─────────────────────────────
py -c "
import os
from pathlib import Path
env_file = Path('backend/.env')
if env_file.exists():
    for line in env_file.read_text().splitlines():
        if line.startswith('SUPABASE_URL=') and 'YOUR_PROJECT_ID' not in line and line.split('=',1)[1].strip():
            print('Supabase: CONFIGURED')
            exit()
print('Supabase: NOT configured (local-only mode)')
" 2>nul
echo.

REM ── 1. Start Backend HTTP on port 8000 (Dashboard API) ───────
echo [1/3] Starting Backend HTTP on port 8000...
start "Aegis Backend HTTP :8000" cmd /k "cd /d "%~dp0backend" && py -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

REM ── 2. Start Backend HTTPS on port 8443 (Mobile Camera) ──────
echo [2/3] Starting Backend HTTPS on port 8443 (mobile)...
if exist "backend\certs\server.crt" (
    start "Aegis Backend HTTPS :8443" cmd /k "cd /d "%~dp0backend" && py -m uvicorn app.main:app --host 0.0.0.0 --port 8443 --ssl-keyfile certs/server.key --ssl-certfile certs/server.crt"
) else (
    echo [WARNING] No SSL cert found. Skipping HTTPS server.
    echo           Run UPDATE_IP.bat first to generate a certificate.
)

timeout /t 2 /nobreak >nul

REM ── 3. Start Frontend on port 5173 ───────────────────────────
echo [3/3] Starting Frontend on port 5173...
start "Aegis Frontend :5173" cmd /k "cd /d "%~dp0frontend" && npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo =========================================
echo   ALL SERVERS STARTED
echo =========================================
echo.
echo   Dashboard (this PC):
echo   http://localhost:5173
echo.
echo   Dashboard (LAN device, same Wi-Fi):
echo   http://%LAN_IP%:5173
echo.
echo   API Docs:
echo   http://localhost:8000/docs
echo.
echo   Mobile Camera page (phone, same Wi-Fi):
echo   https://%LAN_IP%:8443/mobile-camera
echo.
echo   WebSocket:
echo   ws://localhost:8000/ws
echo.
echo   NOTE: Phone must accept the cert warning (Advanced -> Proceed).
echo   NOTE: If Supabase is configured, authentication is required to
echo         access the dashboard.
echo.
echo =========================================
timeout /t 2 /nobreak >nul
start "" "http://localhost:5173"
pause
