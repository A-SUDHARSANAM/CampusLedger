"""
Seed script: ensures lab123@gmail.com has a lab assigned and seeds
realistic maintenance records + lab assets for that user.

Run:  python seed_lab123.py

What it does:
  1. Checks if users.lab_id column exists; if not, prints instructions to add it.
  2. Looks up lab123@gmail.com; exits cleanly if they don't exist.
  3. Finds or creates a lab for them (CS Electronics Lab by default).
  4. Sets lab_id on the user if the column is present.
  5. Creates lab-appropriate assets (computers, electronics, AV, HVAC).
  6. Seeds 10 maintenance records (reported_by = lab123 user) covering
     both service_request and purchase_request types so both the lab
     technician's page AND the admin page show real data.
"""
import os, sys
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

sb = create_client(
    os.environ["SUPABASE_URL"],
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ["SUPABASE_KEY"])
)

TARGET_EMAIL = "lab123@gmail.com"
DEFAULT_LAB_NAME = "CS Electronics Lab"   # used if user has no lab assigned


# ── Helpers ───────────────────────────────────────────────────────────────────

_LAB_ID_COLUMN_EXISTS: bool | None = None

def lab_id_column_exists() -> bool:
    global _LAB_ID_COLUMN_EXISTS
    if _LAB_ID_COLUMN_EXISTS is not None:
        return _LAB_ID_COLUMN_EXISTS
    try:
        sb.table("users").select("id, lab_id").limit(1).execute()
        _LAB_ID_COLUMN_EXISTS = True
    except Exception:
        _LAB_ID_COLUMN_EXISTS = False
    return _LAB_ID_COLUMN_EXISTS


def print_migration_instructions():
    print()
    print("=" * 60)
    print("ACTION REQUIRED — users.lab_id column is missing.")
    print("Run the following SQL in Supabase SQL Editor first:")
    print("  Dashboard → SQL Editor → New query → paste & run:")
    print()
    print("  ALTER TABLE users")
    print("    ADD COLUMN IF NOT EXISTS lab_id UUID")
    print("    REFERENCES labs(id) ON DELETE SET NULL;")
    print()
    print("  (Or run: queries/migrations/008_users_lab_id.sql)")
    print()
    print("After running the SQL, re-run: python seed_lab123.py")
    print("=" * 60)
    print()


def find_user(email: str) -> dict | None:
    r = sb.table("users").select("*").eq("email", email).limit(1).execute()
    return r.data[0] if r.data else None


def find_or_create_lab(lab_name: str) -> str:
    r = sb.table("labs").select("id, lab_name").ilike("lab_name", lab_name).limit(1).execute()
    if r.data:
        return r.data[0]["id"]
    ins = sb.table("labs").insert({"lab_name": lab_name}).execute()
    if ins.data:
        lab_id = ins.data[0]["id"]
        print(f"  + Created lab '{lab_name}' (id={lab_id})")
        return lab_id
    raise RuntimeError(f"Could not create lab '{lab_name}'")


def set_user_lab(user_id: str, lab_id: str) -> bool:
    """Update user's lab_id. Returns True on success."""
    try:
        sb.table("users").update({"lab_id": lab_id}).eq("id", user_id).execute()
        print(f"  ✓ Set lab_id={lab_id} on user {user_id}")
        return True
    except Exception as exc:
        print(f"  ! Could not set lab_id (column may not exist): {exc}")
        return False


def get_or_create_category(name: str) -> str:
    r = sb.table("asset_categories").select("id").ilike("category_name", name).limit(1).execute()
    if r.data:
        return r.data[0]["id"]
    ins = sb.table("asset_categories").insert({"category_name": name}).execute()
    return ins.data[0]["id"]


def get_or_create_asset(asset_name: str, category_name: str, serial: str, lab_id: str) -> str:
    r = sb.table("assets").select("id").ilike("asset_name", asset_name).eq("lab_id", lab_id).limit(1).execute()
    if r.data:
        return r.data[0]["id"]
    cat_id = get_or_create_category(category_name)
    ins = sb.table("assets").insert({
        "asset_name":    asset_name,
        "serial_number": serial,
        "status":        "active",
        "category_id":   cat_id,
        "lab_id":        lab_id,
    }).execute()
    if ins.data:
        print(f"    + Asset: {asset_name} ({serial})")
        return ins.data[0]["id"]
    raise RuntimeError(f"Could not create asset '{asset_name}'")


def already_exists(asset_id: str, description: str) -> bool:
    r = (
        sb.table("maintenance_requests")
        .select("id")
        .eq("asset_id", asset_id)
        .ilike("issue_description", description)
        .limit(1)
        .execute()
    )
    return bool(r.data)


# ── Asset definitions (matched to a CS Electronics lab) ──────────────────────
# (asset_name, category, serial)
LAB_ASSETS = [
    ("Dell OptiPlex 7090 Desktop",      "Computers",    "CL-PC-001"),
    ("HP EliteBook 840 G9 Laptop",      "Computers",    "CL-LAP-001"),
    ("Core i7 Desktop PC",              "Computers",    "CL-PC-002"),
    ("24\" LED Monitor (Dell P2423D)",  "Computers",    "CL-MON-001"),
    ("Tektronix Oscilloscope 100MHz",   "Lab Equipment","CL-OSC-001"),
    ("Digital Multimeter (Fluke 87V)",  "Lab Equipment","CL-DMM-001"),
    ("Power Supply Unit (30V/5A)",      "Lab Equipment","CL-PSU-001"),
    ("Soldering Station (Hakko 888D)",  "Lab Equipment","CL-SOL-001"),
    ("LED Projector (4K)",              "Projectors",   "CL-PROJ-001"),
    ("HVAC Split Unit (2-Ton)",         "HVAC",         "CL-AC-001"),
    ("HP LaserJet Pro M404dn",          "Printers",     "CL-PRN-001"),
    ("24-Port Gigabit Network Switch",  "Networking",   "CL-SW-001"),
    ("UPS Power Backup (1500VA)",       "Electrical",   "CL-UPS-001"),
    ("Lab Chair (Ergonomic)",           "Furniture",    "CL-CHAIR-001"),
    ("Workbench (Steel Top)",           "Furniture",    "CL-WB-001"),
]

# ── Maintenance records for lab123 ────────────────────────────────────────────
# (asset_name_hint, issue_type, priority, status, description)
MAINTENANCE_RECORDS = [
    # --- service_requests (repair / maintenance) ---
    ("Dell OptiPlex 7090 Desktop",
     "service_request", "high", "pending",
     "System crashes with BSOD (MEMORY_MANAGEMENT) every 2-3 hours — suspect faulty RAM"),

    ("HP EliteBook 840 G9 Laptop",
     "service_request", "high", "pending",
     "Battery swelling detected — laptop shuts off randomly under load, battery replacement needed"),

    ("Tektronix Oscilloscope 100MHz",
     "service_request", "medium", "pending",
     "Channel 2 showing incorrect waveform readings after last calibration — needs re-calibration"),

    ("LED Projector (4K)",
     "service_request", "medium", "pending",
     "Projector lamp burnt out completely — unable to display during lectures"),

    ("HVAC Split Unit (2-Ton)",
     "service_request", "high", "pending",
     "AC not cooling — room temperature stays at 29°C even on max setting, gas refill likely needed"),

    ("24-Port Gigabit Network Switch",
     "service_request", "critical", "pending",
     "4 PoE ports non-functional, causing connectivity issues for lab stations in row B"),

    ("Soldering Station (Hakko 888D)",
     "service_request", "low", "pending",
     "Temperature control knob unresponsive — iron stuck at 180°C, cannot adjust for fine work"),

    # --- purchase_requests (procurement) ---
    ("Digital Multimeter (Fluke 87V)",
     "purchase_request", "medium", "pending",
     "Purchase request: replacement leads set (TL910) — existing leads are damaged and giving wrong readings"),

    ("HP LaserJet Pro M404dn",
     "purchase_request", "low", "pending",
     "Purchase request: toner cartridge (CF258A, high-yield) — current cartridge critically low (<3%)"),

    ("Power Supply Unit (30V/5A)",
     "purchase_request", "medium", "pending",
     "Purchase request: replacement PSU (30V/5A) — output voltage fluctuating ±1.2V, affecting circuit experiments"),
]


# ── Run ───────────────────────────────────────────────────────────────────────

def main():
    # 0. Check if users.lab_id column exists
    has_lab_id_col = lab_id_column_exists()
    if not has_lab_id_col:
        print_migration_instructions()

    # 1. Find target user
    user = find_user(TARGET_EMAIL)
    if not user:
        print(f"ERROR: User '{TARGET_EMAIL}' not found in the database.")
        print("       Create this account via the app's registration page first, then re-run this script.")
        sys.exit(1)

    user_id = user["id"]
    print(f"Found user: {user['name']} ({TARGET_EMAIL})  id={user_id}")

    # 2. Resolve lab
    lab_id = user.get("lab_id") if has_lab_id_col else None
    if lab_id:
        print(f"User already has lab_id={lab_id}")
    else:
        print(f"Finding/creating lab '{DEFAULT_LAB_NAME}' …")
        lab_id = find_or_create_lab(DEFAULT_LAB_NAME)
        if has_lab_id_col:
            set_user_lab(user_id, lab_id)
        else:
            print(f"  ⚠  lab_id column missing — lab_id will NOT be saved to user profile.")
            print(f"     Run the SQL migration, then re-run this script to link the user to their lab.")

    # 3. Ensure lab assets exist (creates them if missing, tagged to this lab)
    print(f"\nEnsuring assets for lab_id={lab_id} …")
    asset_map: dict[str, str] = {}   # name → id
    for (asset_name, category, serial) in LAB_ASSETS:
        try:
            aid = get_or_create_asset(asset_name, category, serial, lab_id)
            asset_map[asset_name] = aid
        except Exception as exc:
            print(f"  ! Could not create asset '{asset_name}': {exc}")

    # 4. Seed maintenance records
    print(f"\nSeeding maintenance records (reported_by={user_id}) …")
    inserted = 0
    skipped  = 0

    for (asset_hint, issue_type, priority, req_status, description) in MAINTENANCE_RECORDS:
        # Match asset by checking keys that start with the hint
        asset_id = next(
            (v for k, v in asset_map.items() if asset_hint.lower() in k.lower()),
            None
        )
        if not asset_id:
            print(f"  SKIP (no asset matched for hint='{asset_hint}')")
            skipped += 1
            continue

        if already_exists(asset_id, description):
            print(f"  SKIP (already exists): {description[:60]}…")
            skipped += 1
            continue

        row: dict = {
            "asset_id":          asset_id,
            "issue_description": description,
            "issue_type":        issue_type,
            "priority":          priority,
            "status":            req_status,
            "reported_by":       user_id,
        }

        try:
            res = sb.table("maintenance_requests").insert(row).execute()
            if res.data:
                print(f"  + [{issue_type}/{priority}] {description[:60]}…")
                inserted += 1
            else:
                # Retry without issue_type (older schema)
                row.pop("issue_type", None)
                res2 = sb.table("maintenance_requests").insert(row).execute()
                if res2.data:
                    print(f"  + [no issue_type/{priority}] {description[:60]}…")
                    inserted += 1
                else:
                    print(f"  ! insert returned no data")
                    skipped += 1
        except Exception as exc:
            row.pop("issue_type", None)
            try:
                res2 = sb.table("maintenance_requests").insert(row).execute()
                if res2.data:
                    print(f"  + [no issue_type/{priority}] {description[:60]}…")
                    inserted += 1
                else:
                    print(f"  ! insert failed: {exc}")
                    skipped += 1
            except Exception as exc2:
                print(f"  ! insert failed: {exc2}")
                skipped += 1

    print(f"\n{'='*55}")
    print(f"Done. Assets ensured: {len(asset_map)}  |  Inserted: {inserted}  |  Skipped: {skipped}")
    print(f"\nNow log in as {TARGET_EMAIL} and visit /lab/maintenance to see the records.")


if __name__ == "__main__":
    main()
