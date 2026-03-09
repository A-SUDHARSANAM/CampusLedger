"""
CampusLedger — Supabase Schema Deployment
Runs all SQL files against Supabase PostgreSQL in dependency order.
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# ── Deployment order (respects FK dependencies) ───────────────────────────────
DEPLOY_ORDER = [
    # 1. Extensions & types
    "queries/schemas/extensions.sql",
    "queries/schemas/enums.sql",

    # 2. Reference / lookup tables (no FKs)
    "queries/tables/departments.sql",
    "queries/tables/roles.sql",
    "queries/tables/asset_categories.sql",
    "queries/tables/purchase_department.sql",

    # 3. Core entity tables
    "queries/tables/labs.sql",               # depends on: departments
    "queries/tables/users.sql",              # depends on: roles, departments

    # 4. Assets
    "queries/tables/assets.sql",             # depends on: asset_categories, labs, users

    # 5. Maintenance
    "queries/tables/maintenance_requests.sql",  # depends on: assets, users
    "queries/tables/maintenance_logs.sql",      # depends on: maintenance_requests, users

    # 6. Procurement
    "queries/tables/purchase_requests.sql",  # depends on: users, purchase_department
    "queries/tables/purchase_orders.sql",    # depends on: purchase_requests, purchase_department
    "queries/tables/approval_logs.sql",      # depends on: users

    # 7. Asset lifecycle
    "queries/tables/asset_movements.sql",    # depends on: assets, labs, users
    "queries/tables/asset_verification.sql", # depends on: assets, users
    "queries/tables/depreciation_logs.sql",  # depends on: assets

    # 8. Borrowing & stock
    "queries/tables/borrow_records.sql",     # depends on: assets
    "queries/tables/stock.sql",              # depends on: labs
    "queries/tables/stock_movements.sql",    # depends on: stock, users
    "queries/tables/consumption_history.sql",# depends on: stock, users

    # 9. Notifications, feedback, logging
    "queries/tables/notifications.sql",      # depends on: users
    "queries/tables/feedback.sql",           # depends on: users
    "queries/tables/transaction_logs.sql",   # depends on: users
    "queries/tables/anomaly_alerts.sql",     # no FKs

    # 10. Views
    "queries/views/asset_summary.sql",
    "queries/views/maintenance_summary.sql",

    # 11. Indexes (must be last)
    "queries/schemas/indexes.sql",

    # 12. Migrations (additive, safe to re-run)
    "queries/migrations/001_stock_extra_cols.sql",
    "queries/migrations/002_student_borrows.sql",
    "queries/migrations/003_purchase_requests_extra_cols.sql",
    "queries/migrations/004_student_queries.sql",
    "queries/migrations/005_maintenance_issue_type.sql",
]


def deploy():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not set in .env")
        return

    print(f"Connecting to Supabase PostgreSQL...")
    conn = psycopg2.connect(db_url)
    print("Connected.\n")

    succeeded = []
    failed = []

    for filepath in DEPLOY_ORDER:
        full_path = os.path.join(os.path.dirname(__file__), filepath)
        if not os.path.exists(full_path):
            print(f"  SKIP  {filepath}  (file not found)")
            continue

        with open(full_path, "r", encoding="utf-8") as f:
            sql = f.read().strip()

        if not sql:
            print(f"  SKIP  {filepath}  (empty)")
            continue

        try:
            with conn:                  # auto-commit on success, rollback on error
                with conn.cursor() as cur:
                    cur.execute(sql)
            print(f"  OK    {filepath}")
            succeeded.append(filepath)
        except Exception as exc:
            msg = str(exc).split("\n")[0]
            print(f"  FAIL  {filepath}  →  {msg}")
            failed.append((filepath, msg))
            conn.rollback()

    conn.close()

    print(f"\n{'='*60}")
    print(f"  Deployed : {len(succeeded)}")
    print(f"  Failed   : {len(failed)}")
    if failed:
        print("\nFailed files:")
        for fp, err in failed:
            print(f"  {fp}\n    {err}")
    else:
        print("\n  All schemas and tables deployed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    deploy()
