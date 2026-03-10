"""
Seed script: inserts realistic maintenance requests into Supabase.
Covers CPU/computers, electronics, lab equipment, and furniture.
Run once: python seed_maintenance.py

Priority ordering intent (matches the frontend sort):
  Critical → High → Medium → Low
  Within same priority: CPU/Electronics → Lab Equipment → Furniture
"""
import os, sys
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

sb = create_client(
    os.environ["SUPABASE_URL"],
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ["SUPABASE_KEY"])
)

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_or_create_asset(asset_name: str, category_name: str, asset_code: str,
                        lab_name: str | None = None) -> str | None:
    """Return an existing asset ID or create a new one."""
    existing = (
        sb.table("assets")
        .select("id")
        .ilike("asset_name", asset_name)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]["id"]

    # Resolve lab_id
    lab_id = None
    if lab_name:
        lr = sb.table("labs").select("id").ilike("lab_name", lab_name).limit(1).execute()
        if lr.data:
            lab_id = lr.data[0]["id"]

    # Resolve or create category
    cat_res = (
        sb.table("asset_categories")
        .select("id")
        .ilike("category_name", category_name)
        .limit(1)
        .execute()
    )
    cat_id = cat_res.data[0]["id"] if cat_res.data else None
    if not cat_id:
        new_cat = sb.table("asset_categories").insert({"category_name": category_name}).execute()
        cat_id = new_cat.data[0]["id"] if new_cat.data else None

    row: dict = {
        "asset_name":    asset_name,
        "serial_number": asset_code,   # actual column name in DB
        "status":        "active",
    }
    if cat_id:
        row["category_id"] = cat_id
    if lab_id:
        row["lab_id"] = lab_id

    try:
        ins = sb.table("assets").insert(row).execute()
        if ins.data:
            print(f"    + asset: {asset_name}")
            return ins.data[0]["id"]
    except Exception as exc:
        print(f"    ! asset creation failed ({asset_name}): {exc}")
    return None


def already_exists(asset_id: str, issue_description: str) -> bool:
    """Avoid inserting the same request twice."""
    res = (
        sb.table("maintenance_requests")
        .select("id")
        .eq("asset_id", asset_id)
        .ilike("issue_description", issue_description)
        .limit(1)
        .execute()
    )
    return bool(res.data)


def get_admin_id() -> str | None:
    r = sb.table("users").select("id").eq("email", "admin@campus.edu").limit(1).execute()
    if r.data:
        return r.data[0]["id"]
    # fallback: any admin-role user
    r2 = (
        sb.table("users")
        .select("id, roles(role_name)")
        .limit(20)
        .execute()
    )
    for u in (r2.data or []):
        role = (u.get("roles") or {}).get("role_name", "")
        if "admin" in role.lower():
            return u["id"]
    return None


def get_lab_tech_id() -> str | None:
    """Return the ID of the first lab_technician user found."""
    r = sb.table("users").select("id").eq("email", "labtech@campus.edu").limit(1).execute()
    if r.data:
        return r.data[0]["id"]
    # fallback: any user whose role is lab_technician via join
    r2 = (
        sb.table("users")
        .select("id, roles(role_name)")
        .limit(20)
        .execute()
    )
    for u in (r2.data or []):
        role = (u.get("roles") or {}).get("role_name", "")
        if "lab_technician" in role.lower() or "lab technician" in role.lower():
            return u["id"]
    return None


# ── Seed records ──────────────────────────────────────────────────────────────
#
# Format:
#   (asset_name, category, asset_code, lab_name, issue_description, priority,
#    status, assigned_staff_name_hint)
#
# Priority groups:
#   critical → CPU / Network gear (most urgent)
#   high     → Electronics & computers
#   medium   → Lab instruments & projectors
#   low      → Furniture & miscellaneous

MAINTENANCE_RECORDS = [
    # ── CRITICAL: Servers / Core Network ──────────────────────────────────
    ("Dell PowerEdge R740 Server",   "Servers",   "SRV-001", "Network & Security Lab",
     "Server not booting — BIOS POST failure, requires immediate diagnosis",
     "critical", "pending", None),

    ("Cisco Catalyst 2960 Switch",   "Networking", "SW-001", "Network & Security Lab",
     "Core switch — 6 ports non-functional, causing lab-wide network outage",
     "critical", "assigned", "Ramesh"),

    ("UPS Power Backup Unit",        "Electrical", "UPS-001", "CS Electronics Lab",
     "UPS battery depleted; server room at risk during power cuts",
     "critical", "pending", None),

    # ── HIGH: Computers / Laptops ─────────────────────────────────────────
    ("HP EliteBook 840 G9 Laptop",   "Computers",  "LAP-001", "CS Electronics Lab",
     "Battery swollen, system shuts down randomly under load",
     "high", "in_progress", "Suresh"),

    ("Core i7 Desktop PC",           "Computers",  "PC-003",  "CS Electronics Lab",
     "System overheating — CPU temperature exceeds 95°C, fan replacement needed",
     "high", "pending", None),

    ("Dell OptiPlex 7090",           "Computers",  "DL-1010", "CS Electronics Lab",
     "Blue-screen crashes (MEMORY_MANAGEMENT) — probable faulty RAM module",
     "high", "assigned", "Suresh"),

    ("24-Port Gigabit Network Switch","Networking", "SW-002",  "Network & Security Lab",
     "PoE port cluster overloaded; switch restarting every 2 hours",
     "high", "pending", None),

    ("LED Projector (4K)",           "Projectors", "PROJ-002","Advanced Electronics Lab",
     "Projector lamp burnt out — cannot display during lectures",
     "high", "in_progress", "Priya"),

    # ── HIGH: Electronics & Instruments ──────────────────────────────────
    ("Tektronix Oscilloscope 100MHz","Lab Equipment","OSC-001","Advanced Electronics Lab",
     "Channel 2 shows incorrect waveform readings after recent calibration",
     "high", "pending", None),

    ("Power Supply Unit (30V/5A)",   "Lab Equipment","PSU-002","Advanced Electronics Lab",
     "Output voltage fluctuating ±0.8V — impacting circuit experiments",
     "high", "assigned", "Kavitha"),

    # ── MEDIUM: Lab Equipment / Instruments ──────────────────────────────
    ("Soldering Station (Hakko 888D)","Lab Equipment","SOL-001","Advanced Electronics Lab",
     "Temperature knob unresponsive — iron stuck at 200°C",
     "medium", "pending", None),

    ("Digital Function Generator",   "Lab Equipment","FG-001", "Advanced Electronics Lab",
     "Frequency output unstable above 1 MHz — requires re-calibration",
     "medium", "in_progress", "Ramesh"),

    ("pH Meter (Testo 206)",         "Lab Equipment","PHM-001","Chemistry Research Lab",
     "pH readings drift by ±0.3 after 5 minutes — buffer calibration failing",
     "medium", "pending", None),

    ("Centrifuge (Eppendorf 5424)",  "Lab Equipment","CENT-001","Chemistry Research Lab",
     "Rotor vibration noise at speeds above 8000 rpm — safety concern",
     "medium", "assigned", "Priya"),

    ("Laser Printer (HP LaserJet)",  "Printers",   "PRN-001","CS Electronics Lab",
     "Paper jam occurring every 20–30 pages; roller wear suspected",
     "medium", "pending", None),

    ("HVAC Split Unit (2-Ton)",      "HVAC",       "AC-001",  "CS Electronics Lab",
     "AC cooling inadequate — room temperature stays at 28°C even on full blast",
     "medium", "in_progress", "Suresh"),

    ("Digital Multimeter (Fluke 87V)","Lab Equipment","DMM-001","Physics Optics Lab",
     "Display fading, continuity beeper intermittent — battery and display check",
     "medium", "pending", None),

    ("Stereo Microscope (Olympus)",  "Lab Equipment","MICRO-001","Chemistry Research Lab",
     "Left eyepiece lens cracked — image quality affected for fine observations",
     "medium", "assigned", "Kavitha"),

    # ── MEDIUM: Projectors / AV ───────────────────────────────────────────
    ("Epson EB-X41 Projector",       "Projectors", "PROJ-001","CAD / CAM Lab",
     "HDMI input not detecting laptop signal — VGA works as workaround",
     "medium", "pending", None),

    # ── LOW: Furniture & Miscellaneous ───────────────────────────────────
    ("Lab Chair (Ergonomic)",        "Furniture",  "CHAIR-005","CS Electronics Lab",
     "Armrest broken off — safety hazard for students",
     "low", "pending", None),

    ("Storage Cabinet (Steel)",      "Furniture",  "CAB-003", "Mechanical Workshop",
     "Lock cylinder jammed — tools inaccessible without damage risk",
     "low", "assigned", "Priya"),

    ("Workbench (Wooden Top)",       "Furniture",  "WB-007",  "Mechanical Workshop",
     "Tabletop surface cracked and splintering — needs resurfacing",
     "low", "pending", None),

    ("Whiteboard (Magnetic)",        "Furniture",  "WB-WH-002","Physics Optics Lab",
     "Surface coating worn — markers smearing, difficult to erase",
     "low", "completed", "Ramesh"),

    ("Window Blind (Roller)",        "Furniture",  "BLIND-004","CAD / CAM Lab",
     "Blind cord broken — sunlight glare affecting projector visibility",
     "low", "pending", None),
]

# ── Lab Technician Purchase Requests ─────────────────────────────────────────
# These records use the lab technician's account as reported_by so they:
#   - appear on the lab technician's maintenance page
#   - appear on the admin's maintenance page (admin sees all)
# issue_type = 'purchase_request' so proof upload is relevant

LAB_TECH_PURCHASE_RECORDS = [
    ("Dell OptiPlex 7090",            "Computers",   "DL-1010", "CS Electronics Lab",
     "Requesting replacement RAM modules (2x16GB DDR4) — current RAM causing BSOD crashes",
     "high", "pending", None),

    ("Tektronix Oscilloscope 100MHz", "Lab Equipment","OSC-001", "Advanced Electronics Lab",
     "Purchase request: replacement probe set (x10/x1) — existing probes damaged beyond calibration",
     "medium", "pending", None),

    ("HP LaserJet Pro M404dn",        "Printers",    "PRN-002", "CS Electronics Lab",
     "Requesting new toner cartridge (CF258A) — current cartridge at 5% remaining, will run out next week",
     "low", "pending", None),

    ("HVAC Split Unit (2-Ton)",       "HVAC",        "AC-001",  "CS Electronics Lab",
     "Purchase request: AC gas refill and filter replacement kit — cooling efficiency critically low",
     "high", "pending", None),

    ("Soldering Station (Hakko 888D)","Lab Equipment","SOL-001", "Advanced Electronics Lab",
     "Requesting replacement soldering tips (T18 series, 5-pack) — all tips oxidized",
     "medium", "pending", None),

    ("Stereo Microscope (Olympus)",   "Lab Equipment","MICRO-001","Chemistry Research Lab",
     "Purchase request: replacement eyepiece lens set — left eyepiece cracked, right eyepiece scratched",
     "medium", "pending", None),
]


# ── Run ───────────────────────────────────────────────────────────────────────

def main():
    admin_id = get_admin_id()
    if not admin_id:
        print("ERROR: No admin user found in DB. Run seed_data.py first and ensure an admin user exists.")
        sys.exit(1)
    print(f"Using admin_id: {admin_id}")

    lab_tech_id = get_lab_tech_id()
    if lab_tech_id:
        print(f"Using lab_tech_id: {lab_tech_id}")
    else:
        print("WARNING: No lab_technician user found — purchase-request records will use admin_id as fallback")

    inserted = 0
    skipped  = 0

    # ── Standard service_request records (reported by admin) ──────────────
    for (asset_name, category, asset_code, lab_name,
         issue_desc, priority, req_status, assigned_hint) in MAINTENANCE_RECORDS:

        print(f"\n[{priority.upper()}] {asset_name}")

        asset_id = get_or_create_asset(asset_name, category, asset_code, lab_name)
        if not asset_id:
            print(f"  SKIP — could not resolve asset ID")
            skipped += 1
            continue

        if already_exists(asset_id, issue_desc):
            print(f"  SKIP — already in DB")
            skipped += 1
            continue

        # Resolve assigned_staff UUID if a name hint was provided
        assigned_staff_id = None
        if assigned_hint:
            staff_res = (
                sb.table("users")
                .select("id")
                .ilike("name", f"%{assigned_hint}%")
                .limit(1)
                .execute()
            )
            if staff_res.data:
                assigned_staff_id = staff_res.data[0]["id"]

        row: dict = {
            "asset_id":          asset_id,
            "issue_description": issue_desc,
            "issue_type":        "service_request",
            "priority":          priority,
            "status":            req_status,
            "reported_by":       admin_id,
        }
        if assigned_staff_id:
            row["assigned_staff"] = assigned_staff_id

        try:
            res = sb.table("maintenance_requests").insert(row).execute()
            if res.data:
                print(f"  + inserted (id={res.data[0]['id']}, status={req_status})")
                inserted += 1
            else:
                print(f"  ! insert returned no data")
                skipped += 1
        except Exception as exc:
            # Retry without issue_type column (older schema)
            row.pop("issue_type", None)
            try:
                res = sb.table("maintenance_requests").insert(row).execute()
                if res.data:
                    print(f"  + inserted (no issue_type column, id={res.data[0]['id']})")
                    inserted += 1
                else:
                    print(f"  ! insert failed: {exc}")
                    skipped += 1
            except Exception as exc2:
                print(f"  ! insert failed: {exc2}")
                skipped += 1

    # ── Purchase-request records (reported by lab technician) ─────────────
    print("\n\n--- Lab Technician Purchase Requests ---")
    reporter_id = lab_tech_id or admin_id

    for (asset_name, category, asset_code, lab_name,
         issue_desc, priority, req_status, assigned_hint) in LAB_TECH_PURCHASE_RECORDS:

        print(f"\n[PURCHASE/{priority.upper()}] {asset_name}")

        asset_id = get_or_create_asset(asset_name, category, asset_code, lab_name)
        if not asset_id:
            print(f"  SKIP — could not resolve asset ID")
            skipped += 1
            continue

        if already_exists(asset_id, issue_desc):
            print(f"  SKIP — already in DB")
            skipped += 1
            continue

        row = {
            "asset_id":          asset_id,
            "issue_description": issue_desc,
            "issue_type":        "purchase_request",
            "priority":          priority,
            "status":            req_status,
            "reported_by":       reporter_id,
        }

        try:
            res = sb.table("maintenance_requests").insert(row).execute()
            if res.data:
                print(f"  + inserted purchase_request (id={res.data[0]['id']}, reporter={'lab_tech' if reporter_id == lab_tech_id else 'admin'})")
                inserted += 1
            else:
                print(f"  ! insert returned no data")
                skipped += 1
        except Exception as exc:
            row.pop("issue_type", None)
            try:
                res = sb.table("maintenance_requests").insert(row).execute()
                if res.data:
                    print(f"  + inserted (no issue_type column, id={res.data[0]['id']})")
                    inserted += 1
                else:
                    print(f"  ! insert failed: {exc}")
                    skipped += 1
            except Exception as exc2:
                print(f"  ! insert failed: {exc2}")
                skipped += 1

    print(f"\n{'='*50}")
    print(f"Done. Inserted: {inserted}  /  Skipped: {skipped}")


if __name__ == "__main__":
    main()
