"""network.py — LAN IP detection and server info.

Two-port design:
  HTTP  port 8000  — dashboard API  (localhost browser)
  HTTPS port 8443  — mobile camera  (phone requires HTTPS for getUserMedia)

Set LAN_IP_OVERRIDE in .env to skip auto-detection (recommended on Windows
with multiple adapters or VPN connections).
"""
import os
import socket
import subprocess


def get_lan_ip() -> str:
    """
    Returns the LAN IP to embed in QR codes.

    Priority:
      1. LAN_IP_OVERRIDE env var  (most reliable — set in .env)
      2. UDP connect trick
      3. ipconfig parsing (Windows)
      4. Fallback 127.0.0.1
    """
    # ── 1. Manual override (fastest, most reliable) ───────────────────────
    override = os.getenv("LAN_IP_OVERRIDE", "").strip()
    if override and override != "127.0.0.1":
        return override

    # ── 2. UDP connect trick ──────────────────────────────────────────────
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(2)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        # Skip loopback, link-local, and VPN tunnel ranges
        if (ip and
                not ip.startswith("127.") and
                not ip.startswith("169.254") and
                not ip.startswith("10.255")):
            return ip
    except Exception:
        pass

    # ── 3. ipconfig parsing (Windows only) ───────────────────────────────
    try:
        result = subprocess.run(
            ["ipconfig"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        in_wifi = False
        for line in result.stdout.splitlines():
            # Track when we're inside a Wi-Fi adapter block
            low = line.lower()
            if "wi-fi" in low or "wireless" in low or "wlan" in low:
                in_wifi = True
            elif line.strip() == "" and in_wifi:
                in_wifi = False
            # Extract IPv4 from Wi-Fi block first, then any adapter
            if "ipv4 address" in low or "ipv4-adresse" in low:
                parts = line.split(":")
                if len(parts) >= 2:
                    candidate = parts[-1].strip().replace("(Preferred)", "").strip()
                    if candidate.startswith("192.168.") or candidate.startswith("172."):
                        return candidate
                    if candidate.startswith("10.") and not candidate.startswith("10.255"):
                        return candidate
    except Exception:
        pass

    return "127.0.0.1"


def get_server_info() -> dict:
    """Returns server info for QR generation. Called fresh each time — no caching."""
    mobile_port = int(os.getenv("SERVER_PORT", "8443"))
    tls = os.getenv("TLS_ENABLED", "true").lower() in ("true", "1", "yes")
    scheme = "https" if tls else "http"
    ip = get_lan_ip()
    base_url = f"{scheme}://{ip}:{mobile_port}"

    return {
        "lan_ip": ip,
        "port": mobile_port,
        "scheme": scheme,
        "base_url": base_url,
        "mobile_camera_url": f"{base_url}/mobile-camera",
        "dashboard_url": "http://localhost:8000",
    }
