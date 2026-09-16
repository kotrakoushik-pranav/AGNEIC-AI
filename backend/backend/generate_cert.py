"""
generate_cert.py — Generate self-signed TLS cert for LAN HTTPS.
Run once: py generate_cert.py
Produces: certs/server.crt  certs/server.key
"""
import os, ipaddress, datetime
from pathlib import Path

CERTS_DIR = Path(__file__).parent / "certs"
CERTS_DIR.mkdir(exist_ok=True)
CERT_FILE = CERTS_DIR / "server.crt"
KEY_FILE  = CERTS_DIR / "server.key"


def get_lan_ip():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


try:
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    lan_ip = get_lan_ip()
    print(f"LAN IP detected: {lan_ip}")

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Aegis AI"),
        x509.NameAttribute(NameOID.COMMON_NAME, lan_ip),
    ])
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime.datetime.utcnow())
        .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=825))
        .add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.IPAddress(ipaddress.IPv4Address("127.0.0.1")),
                x509.IPAddress(ipaddress.IPv4Address(lan_ip)),
            ]),
            critical=False,
        )
        .sign(key, hashes.SHA256())
    )
    KEY_FILE.write_bytes(key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.TraditionalOpenSSL,
        serialization.NoEncryption(),
    ))
    CERT_FILE.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    print(f"Certificate generated: {CERT_FILE}")
    print(f"Key generated:         {KEY_FILE}")
    print(f"\nTo start server with TLS:")
    print(f"  py -m uvicorn app.main:app --host 0.0.0.0 --port 8443 --ssl-keyfile certs/server.key --ssl-certfile certs/server.crt")
    print(f"\nPhone camera URL: https://{lan_ip}:8443/mobile-camera")

except ImportError:
    print("Installing cryptography...")
    os.system("py -m pip install cryptography")
    print("Re-run: py generate_cert.py")
