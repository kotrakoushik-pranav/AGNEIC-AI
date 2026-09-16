@echo off
title Aegis AI — Startup
color 0B
echo.
echo =========================================
echo   AEGIS AI — Starting All Servers
echo =========================================
echo.

REM Auto-detect current LAN IP
for /f %%i in ('py -c "import socket; s=socket.socket(); s.connect((\"8.8.8.8\",80)); print(s.getsockname()[0]); s.close()"') do set LAN_IP=%%i
if "%LAN_IP%"=="" set LAN_IP=10.90.94.213

echo Detected LAN IP: %LAN_IP%
echo.

REM ── 1. Start Backend HTTP on port 8000 (Dashboard API)
echo [1/3] Starting Backend HTTP on port 8000...
start "Aegis Backend HTTP :8000" cmd /k "cd /d "%~dp0backend" && py -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

timeout /t 2 /nobreak >nul

REM ── 2. Start Backend HTTPS on port 8443 (Mobile Camera)
echo [2/3] Starting Backend HTTPS on port 8443 (mobile)...
start "Aegis Backend HTTPS :8443" cmd /k "cd /d "%~dp0backend" && py -m uvicorn app.main:app --host 0.0.0.0 --port 8443 --ssl-keyfile certs/server.key --ssl-certfile certs/server.crt"

timeout /t 2 /nobreak >nul

REM ── 3. Start Frontend on port 5173
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
echo   Dashboard (other device, same Wi-Fi):
echo   http://%LAN_IP%:5173
echo.
echo   API Docs:
echo   http://localhost:8000/docs
echo.
echo   Mobile Camera page (phone, same Wi-Fi):
echo   https://%LAN_IP%:8443/mobile-camera
echo.
echo   NOTE: Phone must accept cert warning (Advanced -> Proceed)
echo.
echo =========================================
timeout /t 2 /nobreak >nul
start "" "http://localhost:5173"
pause
