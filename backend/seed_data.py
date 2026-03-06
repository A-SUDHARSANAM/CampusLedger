"""
Seed script: adds realistic labs + departments + purchase orders + vendors to Supabase.
Run once: python seed_data.py
"""
import os, sys
from dotenv import load_dotenv
load_dotenv()
from supabase import create_client

sb = create_client(
    os.environ["SUPABASE_URL"],
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ["SUPABASE_KEY"])
)

def upsert_department(name: str) -> str:
    res = sb.table("departments").select("id").ilike("department_name", name).limit(1).execute()
    if res.data:
        return res.data[0]["id"]
    new = sb.table("departments").insert({"department_name": name}).execute()
    return new.data[0]["id"]

# ── 1. Departments ────────────────────────────────────────────────────────────
print("Seeding departments...")
dept_ids = {
    "Computer Science":   upsert_department("Computer Science"),
    "Electronics":        upsert_department("Electronics"),
    "Mechanical":         upsert_department("Mechanical"),
    "Civil Engineering":  upsert_department("Civil Engineering"),
    "Chemistry":          upsert_department("Chemistry"),
    "Physics":            upsert_department("Physics"),
}
print(f"  {len(dept_ids)} departments ready.")

# ── 2. Labs ───────────────────────────────────────────────────────────────────
print("Seeding labs...")
labs_to_seed = [
    {"lab_name": "CS Electronics Lab",        "department": "Computer Science",  "location": "Block A, Floor 1"},
    {"lab_name": "Advanced Electronics Lab",   "department": "Electronics",       "location": "Block B, Floor 2"},
    {"lab_name": "Mechanical Workshop",        "department": "Mechanical",        "location": "Block C, Ground Floor"},
    {"lab_name": "CAD / CAM Lab",              "department": "Mechanical",        "location": "Block C, Floor 1"},
    {"lab_name": "Civil Structures Lab",       "department": "Civil Engineering", "location": "Block D, Ground Floor"},
    {"lab_name": "Chemistry Research Lab",     "department": "Chemistry",         "location": "Block E, Floor 1"},
    {"lab_name": "Physics Optics Lab",         "department": "Physics",           "location": "Block F, Floor 2"},
    {"lab_name": "Network & Security Lab",     "department": "Computer Science",  "location": "Block A, Floor 2"},
]

seeded_labs = 0
lab_ids = {}
for lab in labs_to_seed:
    dept_id = dept_ids.get(lab["department"])
    # skip if already exists
    existing = sb.table("labs").select("id, lab_name").ilike("lab_name", lab["lab_name"]).limit(1).execute()
    if existing.data:
        lab_ids[lab["lab_name"]] = existing.data[0]["id"]
        print(f"  (already exists) {lab['lab_name']}")
        continue
    row = {"lab_name": lab["lab_name"], "location": lab["location"]}
    if dept_id:
        row["department_id"] = dept_id
    new = sb.table("labs").insert(row).execute()
    if new.data:
        lab_ids[lab["lab_name"]] = new.data[0]["id"]
        seeded_labs += 1
        print(f"  + {lab['lab_name']}")
    else:
        print(f"  FAILED: {lab['lab_name']}")

print(f"  {seeded_labs} new labs inserted.")

# ── 3. Vendors ────────────────────────────────────────────────────────────────
print("Seeding vendors...")
vendors_to_seed = [
    {"vendor_name": "TechSupply India",    "contact_email": "sales@techsupply.in",   "phone": "9800001111", "rating": 5},
    {"vendor_name": "LabEquip Co.",        "contact_email": "orders@labequip.com",   "phone": "9800002222", "rating": 4},
    {"vendor_name": "EduTools Pvt Ltd",    "contact_email": "support@edutools.in",   "phone": "9800003333", "rating": 4},
    {"vendor_name": "National Electronics","contact_email": "ne@natelectronics.in",  "phone": "9800004444", "rating": 3},
    {"vendor_name": "Campus Furniture Co.","contact_email": "info@campusfurnish.com","phone": "9800005555", "rating": 4},
]
vendor_ids = {}
seeded_vendors = 0
for v in vendors_to_seed:
    existing = sb.table("vendors").select("id").eq("contact_email", v["contact_email"]).limit(1).execute()
    if existing.data:
        vendor_ids[v["vendor_name"]] = existing.data[0]["id"]
        print(f"  (already exists) {v['vendor_name']}")
        continue
    new = sb.table("vendors").insert(v).execute()
    if new.data:
        vendor_ids[v["vendor_name"]] = new.data[0]["id"]
        seeded_vendors += 1
        print(f"  + {v['vendor_name']}")
print(f"  {seeded_vendors} new vendors inserted.")

# ── 4. Purchase orders ────────────────────────────────────────────────────────
# The backend purchase.py uses purchase_orders table with a flattened schema.
# Check what columns actually exist before inserting.
print("Checking purchase_requests table columns...")
probe = sb.table("purchase_requests").select("*").limit(1).execute()

# Build admin user id for requested_by_id
admin_user = sb.table("users").select("id").eq("email", "admin@campus.edu").limit(1).execute()
admin_id = admin_user.data[0]["id"] if admin_user.data else None

lab_tech_users = sb.table("users").select("id, email, roles(role_name)").execute()
lab_tech_id = None
for u in (lab_tech_users.data or []):
    role = (u.get("roles") or {}).get("role_name", "")
    if role == "lab_technician":
        lab_tech_id = u["id"]
        break

# Determine schema by checking existing columns from probe row or just try with known backend fields
# The backend uses: item_name, item_description, quantity, estimated_cost, priority, notes,
#                   requested_by_id, status, po_number, vendor_name, expected_delivery_date,
#                   actual_delivery_date, invoice_url, approved_by_id, ordered_by_id

# ── purchase_requests uses actual DB schema ───────────────────────────────────
# Columns: id, item_name, quantity, requested_by (UUID FK→users),
#          admin_approval (bool), vendor_id (UUID FK→vendors),
#          payment_status (unpaid/pending/paid/refunded),
#          order_status (pending/ordered/delivered/cancelled),
#          delivery_date, created_at

def get_vendor_id(name: str) -> str | None:
    r = sb.table("vendors").select("id").ilike("vendor_name", name).limit(1).execute()
    return r.data[0]["id"] if r.data else None

PURCHASE_REQUESTS = [
    # pending_review: admin_approval=False, order_status='pending'
    {
        "item_name": "Dell Monitors (27 inch, FHD)",
        "quantity": 10,
        "requested_by": lab_tech_id or admin_id,
        "admin_approval": False,
        "order_status": "pending",
        "payment_status": "unpaid",
    },
    {
        "item_name": "3D Printer Filaments (PLA, 1kg spools)",
        "quantity": 20,
        "requested_by": lab_tech_id or admin_id,
        "admin_approval": False,
        "order_status": "pending",
        "payment_status": "unpaid",
    },
    # approved: admin_approval=True, order_status='pending'
    {
        "item_name": "Arduino Mega 2560 Kits",
        "quantity": 30,
        "requested_by": lab_tech_id or admin_id,
        "admin_approval": True,
        "order_status": "pending",
        "payment_status": "unpaid",
    },
    {
        "item_name": "Whiteboard Markers & Erasers (bulk)",
        "quantity": 5,
        "requested_by": lab_tech_id or admin_id,
        "admin_approval": True,
        "order_status": "pending",
        "payment_status": "unpaid",
    },
    # ordered: admin_approval=True, order_status='ordered', vendor assigned
    {
        "item_name": "Oscilloscopes (100 MHz, Dual-Channel)",
        "quantity": 5,
        "requested_by": lab_tech_id or admin_id,
        "admin_approval": True,
        "vendor_id": get_vendor_id("National Electronics"),
        "order_status": "ordered",
        "payment_status": "unpaid",
        "delivery_date": "2026-03-25",
    },
    # payment_confirmed: payment_status='paid', order_status='ordered'
    {
        "item_name": "Lab Stools (Adjustable Height)",
        "quantity": 50,
        "requested_by": lab_tech_id or admin_id,
        "admin_approval": True,
        "vendor_id": get_vendor_id("Campus Furniture Co."),
        "order_status": "ordered",
        "payment_status": "paid",
        "delivery_date": "2026-03-18",
    },
    # delivered: order_status='delivered'
    {
        "item_name": "Network Switches (24-port Gigabit)",
        "quantity": 3,
        "requested_by": lab_tech_id or admin_id,
        "admin_approval": True,
        "vendor_id": get_vendor_id("TechSupply India"),
        "order_status": "delivered",
        "payment_status": "paid",
        "delivery_date": "2026-03-01",
    },
    # rejected: order_status='cancelled'
    {
        "item_name": "Raspberry Pi 5 (4GB)",
        "quantity": 15,
        "requested_by": lab_tech_id or admin_id,
        "admin_approval": False,
        "order_status": "cancelled",
        "payment_status": "unpaid",
    },
]

print("Seeding purchase_requests...")
seeded_po = 0
for pr in PURCHASE_REQUESTS:
    # Deduplicate by item_name + requested_by
    existing = sb.table("purchase_requests").select("id").eq("item_name", pr["item_name"]).limit(1).execute()
    if existing.data:
        print(f"  (already exists) {pr['item_name']}")
        continue
    row = {k: v for k, v in pr.items() if v is not None}
    try:
        new = sb.table("purchase_requests").insert(row).execute()
        if new.data:
            seeded_po += 1
            status_label = "pending" if not pr["admin_approval"] and pr["order_status"] == "pending" else pr["order_status"]
            print(f"  + {pr['item_name']} [{status_label}]")
        else:
            print(f"  FAILED (no data): {pr['item_name']}")
    except Exception as e:
        print(f"  ERROR {pr['item_name']}: {e}")

print(f"  {seeded_po} new purchase requests inserted.")

# ── 5. Asset categories (ensure common ones exist) ───────────────────────────
print("Ensuring asset categories...")
categories = [
    "computers", "networking", "lab_equipment", "furniture",
    "projectors", "printers", "measurement_tools", "safety_equipment",
    "storage_devices", "audio_visual"
]
cat_seeded = 0
for cat in categories:
    existing = sb.table("asset_categories").select("id").ilike("category_name", cat).limit(1).execute()
    if not existing.data:
        sb.table("asset_categories").insert({"category_name": cat}).execute()
        cat_seeded += 1
        print(f"  + {cat}")
print(f"  {cat_seeded} new categories added.")

print("\n✓ Seeding complete!")
print(f"  Labs: {len(lab_ids)} total  |  Vendors: {len(vendor_ids)} total  |  POs: {seeded_po} new")
