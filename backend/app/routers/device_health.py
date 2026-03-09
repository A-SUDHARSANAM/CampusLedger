"""
app/routers/device_health.py
=============================
Device Health Monitoring — simulated AI anomaly detection telemetry.

Endpoints
---------
GET /device-health         — all campus devices          (admin)
GET /device-health/{lab_id} — devices scoped to one lab  (admin | lab_technician)

Each device record includes:
  device_id, name, location, lab_id,
  cpu_usage, temperature, battery, network_latency,
  anomaly_score, status, last_seen, alerts
"""

from __future__ import annotations

import hashlib
import math
import time
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.db.supabase import get_admin_client
from app.routers.auth_routes import require_role

router = APIRouter(prefix="/device-health", tags=["Device Health"])

_require_admin       = require_role("admin")
_require_admin_or_tech = require_role("admin", "lab_technician")

# ---------------------------------------------------------------------------
# Thresholds for automatic status classification
# ---------------------------------------------------------------------------
_CPU_WARN   = 80   # %
_CPU_CRIT   = 95   # %
_TEMP_WARN  = 50   # °C
_TEMP_CRIT  = 70   # °C
_LAT_WARN   = 100  # ms
_BAT_WARN   = 20   # %

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class DeviceAlert(BaseModel):
    severity: str          # "warning" | "critical"
    message:  str
    anomaly_score: float

class DeviceHealth(BaseModel):
    device_id:       str
    name:            str
    location:        str
    lab_id:          Optional[str] = None
    cpu_usage:       int           # %
    temperature:     int           # °C
    battery:         int           # %
    network_latency: int           # ms
    anomaly_score:   float         # 0.0 – 1.0
    status:          str           # "healthy" | "warning" | "offline"
    last_seen:       str           # HH:MM
    alerts:          List[DeviceAlert] = []

# ---------------------------------------------------------------------------
# Simulation helpers
# ---------------------------------------------------------------------------

def _pseudo(seed: str, lo: int, hi: int) -> int:
    """Deterministic pseudo-random int in [lo, hi] based on seed + current 5-min bucket."""
    bucket = int(time.time()) // 300          # changes every 5 minutes
    h = hashlib.md5(f"{seed}:{bucket}".encode()).hexdigest()
    raw = int(h[:8], 16) % (hi - lo + 1)
    return lo + raw


def _jitter(seed: str, lo: int, hi: int, jitter: int = 5) -> int:
    """pseudo() with a tiny extra jitter so different fields vary independently."""
    bucket = int(time.time()) // 60            # changes every minute for finer variation
    h = hashlib.md5(f"{seed}:jitter:{bucket}".encode()).hexdigest()
    base = _pseudo(seed, lo, hi)
    delta = (int(h[:4], 16) % (2 * jitter + 1)) - jitter
    return max(lo, min(hi, base + delta))


def _sim_device(device_id: str, name: str, location: str, lab_id: Optional[str]) -> DeviceHealth:
    cpu  = _jitter(device_id + "cpu",  10, 98, 8)
    temp = _jitter(device_id + "tmp",  25, 75, 5)
    bat  = _jitter(device_id + "bat",  10, 100, 3)
    lat  = _jitter(device_id + "lat",  5, 200, 15)

    # Status
    if cpu >= _CPU_CRIT or temp >= _TEMP_CRIT:
        status = "offline"
    elif cpu >= _CPU_WARN or temp >= _TEMP_WARN or lat >= _LAT_WARN or bat <= _BAT_WARN:
        status = "warning"
    else:
        status = "healthy"

    # Anomaly score (higher = worse) — loosely based on deviation from ideal
    cpu_score  = max(0.0, (cpu  - 50) / 50)
    temp_score = max(0.0, (temp - 35) / 40)
    lat_score  = max(0.0, (lat  - 20) / 180)
    bat_score  = max(0.0, (20   - bat) / 20) if bat < 20 else 0.0
    anomaly = round(min(1.0, (cpu_score + temp_score + lat_score + bat_score) / 2), 2)

    # Build alert list
    alerts: list[DeviceAlert] = []
    if cpu >= _CPU_WARN:
        sev = "critical" if cpu >= _CPU_CRIT else "warning"
        alerts.append(DeviceAlert(
            severity=sev,
            message=f"CPU usage critical on {name}: {cpu}%",
            anomaly_score=anomaly,
        ))
    if temp >= _TEMP_WARN:
        sev = "critical" if temp >= _TEMP_CRIT else "warning"
        alerts.append(DeviceAlert(
            severity=sev,
            message=f"Temperature spike detected on {name}: {temp}°C",
            anomaly_score=anomaly,
        ))
    if lat >= _LAT_WARN:
        alerts.append(DeviceAlert(
            severity="warning",
            message=f"High network latency on {name}: {lat}ms",
            anomaly_score=round(lat_score, 2),
        ))
    if bat <= _BAT_WARN:
        alerts.append(DeviceAlert(
            severity="warning",
            message=f"Low battery on {name}: {bat}%",
            anomaly_score=round(bat_score, 2),
        ))

    last_seen = datetime.now(timezone.utc).strftime("%H:%M")

    return DeviceHealth(
        device_id=device_id,
        name=name,
        location=location,
        lab_id=lab_id,
        cpu_usage=cpu,
        temperature=temp,
        battery=bat,
        network_latency=lat,
        anomaly_score=anomaly,
        status=status,
        last_seen=last_seen,
        alerts=alerts,
    )


def _generate_devices(sb, lab_id: Optional[str] = None) -> List[DeviceHealth]:
    """
    Pull real labs/assets from Supabase and generate one simulated device per
    electronic asset (category contains 'computer', 'projector', 'server', 'pc',
    'laptop', 'monitor', or 'electronic').
    """
    try:
        q = sb.table("assets") \
              .select("id, asset_name, serial_number, lab_id, asset_categories(category_name), labs(lab_name)") \
              .in_("status", ["active", "Active"]) \
              .limit(50)
        if lab_id:
            q = q.eq("lab_id", lab_id)
        result = q.execute()
        assets = result.data or []
    except Exception:
        assets = []

    ELECTRONIC_KEYWORDS = ("computer", "projector", "server", "pc", "laptop",
                           "monitor", "printer", "scanner", "router", "switch",
                           "tablet", "device", "electronic")

    devices: List[DeviceHealth] = []
    for i, a in enumerate(assets):
        cat_name = ""
        try:
            cat_name = (a.get("asset_categories") or {}).get("category_name", "").lower()
        except Exception:
            pass

        if not any(k in cat_name for k in ELECTRONIC_KEYWORDS):
            # If no category matches, still include up to 12 items as generic devices
            if i >= 12:
                continue

        name     = a.get("asset_name") or a.get("name") or f"Device {i+1}"
        dev_id   = a.get("serial_number") or f"DEV_{a['id'][:6].upper()}"
        lab_name = ""
        try:
            lab_name = (a.get("labs") or {}).get("lab_name", "")
        except Exception:
            pass
        location = lab_name or "Campus"
        devices.append(_sim_device(a["id"], name, location, a.get("lab_id")))

    # Always return at least 8 simulated devices so the UI is never empty
    if len(devices) < 8:
        FALLBACK = [
            ("PC_101",  "Lab Computer",   "CS Lab"),
            ("PC_102",  "Lab Computer 2", "CS Lab"),
            ("PROJ_01", "Projector",       "Lecture Hall A"),
            ("SRV_001", "Server PC",       "IT Lab"),
            ("PC_203",  "Admin Desktop",   "Admin Office"),
            ("LPT_011", "Laptop Station",  "Physics Lab"),
            ("PC_305",  "Lab Station",     "Electronics Lab"),
            ("PROJ_02", "Projector",       "Lecture Hall B"),
            ("RTR_001", "Network Router",  "Server Room"),
            ("PC_401",  "CAD Workstation", "Design Lab"),
        ]
        seen_ids = {d.device_id for d in devices}
        for did, dname, dloc in FALLBACK:
            if did not in seen_ids:
                if lab_id and dloc not in ("CS Lab", "IT Lab", "Physics Lab"):
                    continue
                devices.append(_sim_device(did, dname, dloc, lab_id))

    return devices[:50]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get(
    "",
    response_model=List[DeviceHealth],
    summary="Get all campus device telemetry (admin)",
)
def get_all_device_health(
    sb=Depends(get_admin_client),
    _: dict = Depends(_require_admin),
):
    return _generate_devices(sb)


@router.get(
    "/lab/{lab_id}",
    response_model=List[DeviceHealth],
    summary="Get device telemetry for one lab (admin or lab technician)",
)
def get_lab_device_health(
    lab_id: str,
    sb=Depends(get_admin_client),
    _: dict = Depends(_require_admin_or_tech),
):
    return _generate_devices(sb, lab_id=lab_id)
