"""
CampusLedger — Database Migration Runner
Applies all pending migration SQL files from queries/migrations/ in order.

Usage:
    python migrate.py

Requires DATABASE_URL in .env (same as deploy_schema.py).
"""
import os
import glob
import psycopg2
from dotenv import load_dotenv

load_dotenv()

MIGRATIONS_DIR = os.path.join(os.path.dirname(__file__), "queries", "migrations")


def run_migrations():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set in .env")
        return

    print("Connecting to Supabase PostgreSQL...")
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    cursor = conn.cursor()
    print("Connected.\n")

    migration_files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "*.sql")))
    if not migration_files:
        print("No migration files found.")
        return

    for filepath in migration_files:
        name = os.path.basename(filepath)
        print(f"  Applying {name}...")
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                sql = f.read()
            cursor.execute(sql)
            print(f"    ✓ {name} applied.")
        except Exception as exc:
            print(f"    ✗ {name} FAILED: {exc}")

    cursor.close()
    conn.close()
    print("\nMigrations complete.")


if __name__ == "__main__":
    run_migrations()
