@echo off
title Aegis AI — Update LAN IP
color 0E
echo.
echo =========================================
echo   AEGIS AI — Updating LAN IP
echo =========================================
echo.

REM Detect current Wi-Fi IP using Python
for /f %%i in ('py -c "import socket; s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.connect((chr(56)+chr(46)+chr(56)+chr(46)+chr(56)+chr(46)+chr(56),80)); print(s.getsockname()[0]); s.close()"') do set LAN_IP=%%i

echo Detected LAN IP: %LAN_IP%
echo.

REM Update LAN_IP_OVERRIDE in backend/.env
py -c "
import re, sys
ip = sys.argv[1]
with open('backend/.env', 'r') as f:
    content = f.read()
content = re.sub(r'LAN_IP_OVERRIDE=.*', f'LAN_IP_OVERRIDE={ip}', content)
with open('backend/.env', 'w') as f:
    f.write(content)
print(f'Updated backend/.env: LAN_IP_OVERRIDE={ip}')
" %LAN_IP%

REM Update START_ALL.bat with new IP
py -c "
import re, sys
ip = sys.argv[1]
with open('START_ALL.bat', 'r') as f:
    content = f.read()
content = re.sub(r'https://[\d.]+:8443', f'https://{ip}:8443', content)
with open('START_ALL.bat', 'w') as f:
    f.write(content)
print(f'Updated START_ALL.bat with IP {ip}')
" %LAN_IP%

REM Regenerate SSL certificate for new IP
echo Regenerating SSL certificate...
cd backend
py generate_cert.py 2>&1 | findstr /v "DeprecationWarning" | findstr /v "utcnow" | findstr /v "py :"
cd ..

echo.
echo =========================================
echo   DONE — Now run START_ALL.bat
echo =========================================
echo.
echo   Dashboard:   http://localhost:5173
echo   Mobile:      https://%LAN_IP%:8443/mobile-camera
echo.
pause
