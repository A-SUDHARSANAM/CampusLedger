"""
CampusLedger — Electronics Catalog + Student Borrow Sample Data Seed
Seeds the `stock` table with realistic catalog items and `student_borrows`
with sample borrow records for demonstration.

Run AFTER migrate.py:
    python migrate.py
    python seed_catalog.py
"""
import os
import sys
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()

from supabase import create_client

sb = create_client(
    os.environ["SUPABASE_URL"],
    os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ["SUPABASE_KEY"]),
)


# ---------------------------------------------------------------------------
# 1. Fetch the first available lab to attach stock items
# ---------------------------------------------------------------------------
print("Fetching lab IDs...")
lab_res = sb.table("labs").select("id, lab_name").limit(6).execute()
labs = lab_res.data or []
if not labs:
    print("  WARNING: No labs found. Stock items will not be linked to a lab.")
    default_lab_id = None
else:
    default_lab_id = labs[0]["id"]
    print(f"  Using primary lab: {labs[0]['lab_name']} ({default_lab_id})")


# ---------------------------------------------------------------------------
# 2. Seed electronics catalog into `stock`
# ---------------------------------------------------------------------------
print("\nSeeding electronics catalog (stock table)...")

# reorder_level = minimum on-hand quantity before a reorder is triggered
# quantities chosen to produce deliberate variation: ~4 items below threshold
catalog_items = [
    # name, category, quantity, reorder_level, sku, unit_cost (Rs.), warranty_months
    # ── SAFE (stock > threshold) ──
    {"item_name": "Arduino Uno R3",                    "category": "Microcontroller",      "quantity": 40,  "reorder_level": 15, "sku": "ELEC-KIT-001", "unit_cost": 1200.0,  "warranty_months": 12},
    {"item_name": "Ultrasonic Sensor HC-SR04",         "category": "Sensor",               "quantity": 150, "reorder_level": 50, "sku": "ELEC-SNS-002", "unit_cost":  180.0,  "warranty_months":  6},
    {"item_name": "L298N Motor Driver",                "category": "Motor Driver",          "quantity": 70,  "reorder_level": 25, "sku": "ELEC-DRV-003", "unit_cost":  320.0,  "warranty_months":  6},
    {"item_name": "16x2 LCD Display",                 "category": "Display",              "quantity": 60,  "reorder_level": 25, "sku": "ELEC-DSP-004", "unit_cost":  280.0,  "warranty_months":  6},
    {"item_name": "Jumper Wires (40-pack)",            "category": "Cables & Connectors",  "quantity": 200, "reorder_level": 60, "sku": "ELEC-CAB-005", "unit_cost":  120.0,  "warranty_months":  3},
    {"item_name": "Resistor Kit (600-pack)",           "category": "Passive Components",   "quantity": 50,  "reorder_level": 20, "sku": "ELEC-PAS-006", "unit_cost":  350.0,  "warranty_months": 12},
    # ── REORDER NEEDED (stock < threshold) ──
    {"item_name": "Raspberry Pi 5",                   "category": "Embedded Board",       "quantity": 8,   "reorder_level": 20, "sku": "ELEC-RPI-007", "unit_cost": 7600.0,  "warranty_months": 12},
    {"item_name": "Breadboard 830-pt",                "category": "Prototyping",           "quantity": 18,  "reorder_level": 30, "sku": "ELEC-BBD-008", "unit_cost":  150.0,  "warranty_months":  6},
    {"item_name": "DHT11 Temperature & Humidity Sensor", "category": "Sensor",            "quantity": 12,  "reorder_level": 35, "sku": "ELEC-SNS-009", "unit_cost":  130.0,  "warranty_months":  6},
    {"item_name": "ESP32 Wi-Fi Module",               "category": "Microcontroller",      "quantity": 35,  "reorder_level": 40, "sku": "ELEC-MCU-010", "unit_cost":  950.0,  "warranty_months": 12},
    {"item_name": "IR Obstacle Sensor",               "category": "Sensor",               "quantity": 90,  "reorder_level": 30, "sku": "ELEC-SNS-011", "unit_cost":   95.0,  "warranty_months":  6},
    {"item_name": "OLED Display 0.96in",              "category": "Display",              "quantity": 45,  "reorder_level": 20, "sku": "ELEC-DSP-012", "unit_cost":  380.0,  "warranty_months":  6},
    {"item_name": "5V 2A Power Adapter",              "category": "Power Supply",         "quantity": 55,  "reorder_level": 20, "sku": "ELEC-PWR-013", "unit_cost":  250.0,  "warranty_months": 12},
    {"item_name": "Servo Motor SG90",                 "category": "Actuator",             "quantity": 75,  "reorder_level": 25, "sku": "ELEC-ACT-014", "unit_cost":  180.0,  "warranty_months":  6},
    {"item_name": "LDR Photoresistor Kit",            "category": "Sensor",               "quantity": 120, "reorder_level": 40, "sku": "ELEC-SNS-015", "unit_cost":   60.0,  "warranty_months":  6},
]

seeded_stock_ids = {}
for item in catalog_items:
    existing = (
        sb.table("stock")
        .select("id, item_name, reorder_level")
        .eq("item_name", item["item_name"])
        .limit(1)
        .execute()
    )
    if existing.data:
        rec = existing.data[0]
        seeded_stock_ids[item["item_name"]] = rec["id"]
        old_rl = rec.get("reorder_level", 0)
        # Update quantity/reorder_level and backfill sku/unit_cost/warranty_months
        if old_rl != item["reorder_level"] or not rec.get("sku"):
            sb.table("stock").update({
                "quantity":        item["quantity"],
                "reorder_level":   item["reorder_level"],
                "sku":             item["sku"],
                "unit_cost":       item["unit_cost"],
                "warranty_months": item["warranty_months"],
            }).eq("id", rec["id"]).execute()
            print(f"  ↻ {item['item_name']}  (updated)")
        else:
            print(f"  (ok) {item['item_name']}")
        continue

    row = dict(item)
    if default_lab_id:
        row["lab_id"] = default_lab_id

    result = sb.table("stock").insert(row).execute()
    if result.data:
        seeded_stock_ids[item["item_name"]] = result.data[0]["id"]
        print(f"  + {item['item_name']} (qty={item['quantity']}, sku={item['sku']}, Rs.{item['unit_cost']})")
    else:
        print(f"  FAILED: {item['item_name']}")

print(f"  Catalog seeding done. {len(seeded_stock_ids)} items available.")


# ---------------------------------------------------------------------------
# 3. Seed sample student borrow records into `student_borrows`
# ---------------------------------------------------------------------------
print("\nSeeding sample student borrow records...")

# Fetch a lab_technician user to act as "created_by"
lab_tech_res = (
    sb.table("users")
    .select("id, name, roles(role_name)")
    .limit(20)
    .execute()
)
lab_tech_id = None
for u in (lab_tech_res.data or []):
    role_obj = u.get("roles") or {}
    if isinstance(role_obj, dict) and "lab" in role_obj.get("role_name", "").lower():
        lab_tech_id = u["id"]
        print(f"  Using lab tech: {u['name']} ({lab_tech_id})")
        break

if not lab_tech_id and lab_tech_res.data:
    lab_tech_id = lab_tech_res.data[0]["id"]
    print(f"  Fallback user: {lab_tech_res.data[0].get('name')}")

today = date.today()
sample_borrows = [
    {
        "student_name": "Akhil Sharma",
        "project_name": "Smart Irrigation System",
        "bill_no": "BILL-2026-001",
        "invoice_no": "INV-2026-001",
        "due_date": (today + timedelta(days=7)).isoformat(),
        "status": "borrowed",
        "fine_amount": 0.0,
        "items": [
            {
                "stock_id": seeded_stock_ids.get("Arduino Uno R3"),
                "sku": "ELEC-KIT-001",
                "product_name": "Arduino Uno R3",
                "quantity": 1,
                "unit_cost": 1200.0,
                "warranty_months": 12,
            },
            {
                "stock_id": seeded_stock_ids.get("Ultrasonic Sensor HC-SR04"),
                "sku": "ELEC-SNS-002",
                "product_name": "Ultrasonic Sensor HC-SR04",
                "quantity": 2,
                "unit_cost": 180.0,
                "warranty_months": 6,
            },
        ],
        "issue_updates": ["Issued by lab technician"],
    },
    {
        "student_name": "Priya Nair",
        "project_name": "Line Following Robot",
        "bill_no": "BILL-2026-002",
        "invoice_no": "INV-2026-002",
        "due_date": (today - timedelta(days=2)).isoformat(),
        "status": "late_return",
        "fine_amount": 150.0,
        "items": [
            {
                "stock_id": seeded_stock_ids.get("L298N Motor Driver"),
                "sku": "ELEC-DRV-003",
                "product_name": "L298N Motor Driver",
                "quantity": 1,
                "unit_cost": 320.0,
                "warranty_months": 6,
            },
            {
                "stock_id": seeded_stock_ids.get("Breadboard 830-pt"),
                "sku": "ELEC-BBD-007",
                "product_name": "Breadboard 830-pt",
                "quantity": 1,
                "unit_cost": 150.0,
                "warranty_months": 6,
            },
        ],
        "issue_updates": ["Issued by lab technician", "Return overdue by 2 days \u2014 fine applied"],
    },
    {
        "student_name": "Rahul Verma",
        "project_name": "Weather Station with IoT",
        "bill_no": "BILL-2026-003",
        "invoice_no": "INV-2026-003",
        "due_date": (today + timedelta(days=14)).isoformat(),
        "status": "borrowed",
        "fine_amount": 0.0,
        "items": [
            {
                "stock_id": seeded_stock_ids.get("ESP32 Wi-Fi Module"),
                "sku": "ELEC-MCU-009",
                "product_name": "ESP32 Wi-Fi Module",
                "quantity": 1,
                "unit_cost": 950.0,
                "warranty_months": 12,
            },
            {
                "stock_id": seeded_stock_ids.get("DHT11 Temperature & Humidity Sensor"),
                "sku": "ELEC-SNS-008",
                "product_name": "DHT11 Temperature & Humidity Sensor",
                "quantity": 1,
                "unit_cost": 130.0,
                "warranty_months": 6,
            },
        ],
        "issue_updates": ["Issued by lab technician"],
    },
]

seeded_borrows = 0
try:
    for borrow in sample_borrows:
        existing = (
            sb.table("student_borrows")
            .select("id")
            .eq("bill_no", borrow["bill_no"])
            .limit(1)
            .execute()
        )
        if existing.data:
            print(f"  (already exists) {borrow['bill_no']} — {borrow['student_name']}")
            continue

        row = dict(borrow)
        if default_lab_id:
            row["lab_id"] = default_lab_id
        if lab_tech_id:
            row["created_by"] = lab_tech_id

        result = sb.table("student_borrows").insert(row).execute()
        if result.data:
            seeded_borrows += 1
            print(f"  + {borrow['bill_no']} — {borrow['student_name']} ({borrow['project_name']})")
        else:
            print(f"  FAILED: {borrow['bill_no']}")

    print(f"  {seeded_borrows} borrow records inserted.")

except Exception as e:
    if "student_borrows" in str(e):
        print("\n  [SKIP] student_borrows table does not exist yet.")
        print("  To create it, run this SQL in the Supabase Dashboard → SQL Editor:")
        print("  (file: backend/queries/migrations/002_student_borrows.sql)")
        try:
            sql_path = os.path.join(os.path.dirname(__file__), "queries", "migrations", "002_student_borrows.sql")
            with open(sql_path) as f:
                print("\n" + "-" * 60)
                print(f.read())
                print("-" * 60)
        except Exception:
            pass
        print("\n  After running the SQL, re-run this seed script to insert sample borrows.")
    else:
        raise

# ---------------------------------------------------------------------------
# 4. Seed sample purchase_requests (demo procurement workflow records)
# ---------------------------------------------------------------------------
print("\nSeeding sample purchase requests...")

# Fetch a lab_technician user to act as requested_by
lab_user_id = None
for u in (lab_tech_res.data or []):
    role_obj = u.get("roles") or {}
    if isinstance(role_obj, dict) and "lab" in role_obj.get("role_name", "").lower():
        lab_user_id = u["id"]
        break
if not lab_user_id and lab_tech_res.data:
    lab_user_id = lab_tech_res.data[0]["id"]

from datetime import datetime

sample_requests = [
    {
        "item_name":      "Raspberry Pi 5",
        "quantity":       5,
        "estimated_cost": 38000.0,
        "notes":          "Needed for AI/ML embedded lab expansion — Batch 2026.",
        "admin_approval": None,
        "order_status":   None,
        "payment_status": None,
    },
    {
        "item_name":      "ESP32 Wi-Fi Module",
        "quantity":       20,
        "estimated_cost": 19000.0,
        "notes":          "IoT practicals for 3rd year ECE students.",
        "admin_approval": True,
        "order_status":   None,
        "payment_status": None,
    },
    {
        "item_name":      "Arduino Uno R3",
        "quantity":       15,
        "estimated_cost": 18000.0,
        "notes":          "Replacement units for damaged kits in Lab-3.",
        "admin_approval": True,
        "order_status":   "ordered",
        "payment_status": None,
    },
    {
        "item_name":      "Servo Motor SG90",
        "quantity":       30,
        "estimated_cost":  5400.0,
        "notes":          "Robotics club semester project requirement.",
        "admin_approval": True,
        "order_status":   "ordered",
        "payment_status": "paid",
    },
    {
        "item_name":      "DHT11 Temperature & Humidity Sensor",
        "quantity":       25,
        "estimated_cost":  3250.0,
        "notes":          "Weather-station practicals for Environmental Engineering lab.",
        "admin_approval": None,
        "order_status":   "cancelled",
        "payment_status": None,
    },
]

seeded_requests = 0
try:
    for req in sample_requests:
        existing_req = (
            sb.table("purchase_requests")
            .select("id")
            .eq("item_name", req["item_name"])
            .eq("quantity", req["quantity"])
            .limit(1)
            .execute()
        )
        if existing_req.data:
            print(f"  (already exists) {req['item_name']} × {req['quantity']}")
            continue

        row = {
            "item_name":      req["item_name"],
            "quantity":       req["quantity"],
            "estimated_cost": req["estimated_cost"],
            "notes":          req["notes"],
        }
        if lab_user_id:
            row["requested_by"] = lab_user_id
        if default_lab_id:
            row["lab_id"] = default_lab_id
        if req["admin_approval"] is not None:
            row["admin_approval"] = req["admin_approval"]
        if req["order_status"]:
            row["order_status"] = req["order_status"]
        if req["payment_status"]:
            row["payment_status"] = req["payment_status"]

        result = sb.table("purchase_requests").insert(row).execute()
        if result.data:
            seeded_requests += 1
            status_str = req["order_status"] or ("approved" if req["admin_approval"] else "pending")
            print(f"  + {req['item_name']} × {req['quantity']}  [{status_str}]")
        else:
            print(f"  FAILED: {req['item_name']}")

    print(f"  {seeded_requests} purchase request records inserted.")

except Exception as e:
    if "purchase_requests" in str(e):
        print("  [SKIP] purchase_requests table not found — run migrate.py first.")
    else:
        raise

print("\nCatalog seed complete.")
