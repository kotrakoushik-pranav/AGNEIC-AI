"""
clean_db.py — Remove all stale test data from the SQLite database.
Run once from backend/ to reset to a clean state:
    py clean_db.py
"""
import sqlite3
import os

db_path = "aegis_ai.db"

if not os.path.exists(db_path):
    print("DB not found — nothing to clean.")
else:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    # Show current state
    c.execute("SELECT COUNT(*) FROM incidents")
    print(f"Incidents before : {c.fetchone()[0]}")
    c.execute("SELECT COUNT(*) FROM alerts")
    print(f"Alerts before    : {c.fetchone()[0]}")
    c.execute("SELECT id, name, status FROM cameras")
    rows = c.fetchall()
    print(f"Cameras          : {rows}")

    # Delete ALL old incidents and alerts
    c.execute("DELETE FROM incidents")
    c.execute("DELETE FROM alerts")

    # Reset all cameras to OFFLINE + not monitoring
    c.execute("UPDATE cameras SET status='OFFLINE', is_monitoring=0")

    # Reset SQLite auto-increment counters if the table exists
    c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'")
    if c.fetchone():
        c.execute("DELETE FROM sqlite_sequence WHERE name='incidents'")
        c.execute("DELETE FROM sqlite_sequence WHERE name='alerts'")

    conn.commit()

    # Verify
    c.execute("SELECT COUNT(*) FROM incidents")
    print(f"Incidents after  : {c.fetchone()[0]}")
    c.execute("SELECT COUNT(*) FROM alerts")
    print(f"Alerts after     : {c.fetchone()[0]}")
    c.execute("SELECT id, name, status, is_monitoring FROM cameras")
    print(f"Cameras after    : {c.fetchall()}")

    conn.close()
    print("\nDatabase cleaned. All cameras reset to OFFLINE.")
    print("Start the backend server and open http://localhost:5173")
