"""
carbon_service.py
=================
Calculates energy consumption and carbon emissions for tracked electronic
devices (PCs, servers, projectors, networking gear).

Formulas
--------
Energy (kWh/year) = Power_W × HOURS_PER_DAY × WORKING_DAYS / 1000
CO₂ (kg/year)     = Energy × CO2_PER_KWH

Savings estimate
----------------
Old devices (age >= AGE_THRESHOLD_YEARS) are assumed to benefit from a
replacement that cuts power draw by REPLACEMENT_SAVING_FACTOR (20 %).

Constants follow typical Indian grid / sustainability baselines:
  CO2_PER_KWH    = 0.4 kg CO₂/kWh  (India CEA emission factor 2023-24)
  HOURS_PER_DAY  = 8
  WORKING_DAYS   = 250
"""

from __future__ import annotations

from typing import Any, Optional

from supabase import Client

# ── Constants ─────────────────────────────────────────────────────────────────
HOURS_PER_DAY           = 8
WORKING_DAYS            = 250
CO2_PER_KWH             = 0.4          # kg CO₂ per kWh
AGE_THRESHOLD_YEARS     = 5            # devices older than this qualify for upgrade savings
REPLACEMENT_SAVING_PCT  = 0.20         # 20 % power reduction on replacement

# Default watt estimates by inferred device type (keyword → watts)
_DEFAULT_WATTS: list[tuple[list[str], int]] = [
    (["server"],                           400),
    (["workstation"],                      250),
    (["desktop", "pc", "computer", "cpu"], 150),
    (["laptop", "notebook"],                45),
    (["monitor", "display"],                30),
    (["projector"],                        200),
    (["switch", "router", "network"],       30),
    (["printer"],                           50),
    (["ups"],                              100),
    (["ac", "hvac", "air"],               1500),
    (["oscilloscope", "function gen"],      60),
    (["centrifuge", "incubator"],          300),
]
_FALLBACK_WATTS = 100   # generic electronic device if nothing matches


def _infer_watts(asset_name: str, stored_watts: Optional[int]) -> int:
    """Return power (W) — stored value wins; otherwise infer from name."""
    if stored_watts and stored_watts > 0:
        return stored_watts
    name_lower = asset_name.lower()
    for keywords, watts in _DEFAULT_WATTS:
        if any(kw in name_lower for kw in keywords):
            return watts
    return _FALLBACK_WATTS


def _energy_kwh(power_w: int) -> float:
    return (power_w * HOURS_PER_DAY * WORKING_DAYS) / 1000.0


def _co2_kg(energy_kwh: float) -> float:
    return energy_kwh * CO2_PER_KWH


# ── Category breakdown helpers ────────────────────────────────────────────────
CATEGORY_GROUPS = [
    ("Computing",    ["server", "workstation", "desktop", "pc", "computer", "cpu", "laptop"]),
    ("Projectors",   ["projector"]),
    ("Networking",   ["switch", "router", "network", "wifi"]),
    ("Printing",     ["printer", "copier", "scanner"]),
    ("Lab Equipment",["oscilloscope", "centrifuge", "incubator", "ph meter", "spectrometer",
                      "function gen", "multimeter"]),
    ("HVAC/Climate", ["ac", "hvac", "air", "cooling"]),
    ("Monitors",     ["monitor", "display"]),
    ("UPS",          ["ups"]),
]


def _category_of(name: str) -> str:
    lower = name.lower()
    for cat, kws in CATEGORY_GROUPS:
        if any(kw in lower for kw in kws):
            return cat
    return "Other"


# ── Main public function ──────────────────────────────────────────────────────
def calculate_carbon_impact(sb: Client) -> dict[str, Any]:
    """
    Fetch active assets that look like electronic devices, compute energy and
    CO₂ totals, and return a rich summary dict suitable for the API response.
    """
    # Fetch all active assets (status = 'active' | 'Active')
    rows = (
        sb.table("assets")
        .select("id, asset_name, status, condition_rating")
        .execute()
        .data or []
    )

    # Also try to read power_watts / device_age from a separate query
    # (these columns may not exist yet → graceful fallback)
    power_map: dict[str, int] = {}
    age_map: dict[str, int] = {}
    try:
        extra = (
            sb.table("assets")
            .select("id, power_watts, device_age")
            .execute()
            .data or []
        )
        for r in extra:
            if r.get("power_watts"):
                power_map[r["id"]] = int(r["power_watts"])
            if r.get("device_age"):
                age_map[r["id"]] = int(r["device_age"])
    except Exception:
        pass  # columns don't exist yet — use inference only

    total_energy   = 0.0
    total_co2      = 0.0
    savings_energy = 0.0
    savings_co2    = 0.0

    by_category: dict[str, float] = {}
    device_rows: list[dict[str, Any]] = []

    for r in rows:
        status = (r.get("status") or "").lower()
        if status in ("retired", "cancelled"):
            continue

        asset_id   = r["id"]
        name       = r.get("asset_name") or "Unknown"
        watts      = _infer_watts(name, power_map.get(asset_id))
        age        = age_map.get(asset_id, 0)
        energy     = _energy_kwh(watts)
        co2        = _co2_kg(energy)
        category   = _category_of(name)

        total_energy += energy
        total_co2    += co2
        by_category[category] = by_category.get(category, 0.0) + energy

        # Upgrade-savings: old devices get flagged
        is_old = age >= AGE_THRESHOLD_YEARS
        if not is_old and r.get("condition_rating") is not None:
            # condition_rating 1-2 also flags for replacement
            is_old = int(r["condition_rating"]) <= 2

        if is_old:
            saved_e = energy * REPLACEMENT_SAVING_PCT
            saved_c = _co2_kg(saved_e)
            savings_energy += saved_e
            savings_co2    += saved_c

        device_rows.append({
            "asset_id":         asset_id,
            "asset_name":       name,
            "category":         category,
            "power_watts":      watts,
            "energy_kwh":       round(energy, 2),
            "co2_kg":           round(co2, 2),
            "age_years":        age,
            "savings_potential":is_old,
        })

    # Sort devices by CO₂ desc for the "top emitters" list
    device_rows.sort(key=lambda d: d["co2_kg"], reverse=True)

    # Build lab-level breakdown if lab_id present
    lab_map: dict[str, float] = {}
    try:
        lab_res = (
            sb.table("assets")
            .select("id, lab_id, labs(lab_name)")
            .execute()
            .data or []
        )
        lid_to_name: dict[str, str] = {}
        for r2 in lab_res:
            labs_obj = r2.get("labs")
            lab_name = (
                labs_obj["lab_name"]
                if isinstance(labs_obj, dict) and labs_obj.get("lab_name")
                else r2.get("lab_id") or "Unassigned"
            )
            lid_to_name[r2["id"]] = lab_name

        for dev in device_rows:
            lab = lid_to_name.get(dev["asset_id"], "Unassigned")
            lab_map[lab] = lab_map.get(lab, 0.0) + dev["energy_kwh"]
    except Exception:
        pass

    # Build chart-friendly series
    category_chart = [
        {"label": cat, "value": round(kwh, 2)}
        for cat, kwh in sorted(by_category.items(), key=lambda x: -x[1])
    ]
    lab_chart = [
        {"label": lab, "value": round(kwh, 2)}
        for lab, kwh in sorted(lab_map.items(), key=lambda x: -x[1])
    ]

    return {
        "total_devices":          len(device_rows),
        "total_energy_kwh":       round(total_energy, 2),
        "carbon_emission_kg":     round(total_co2, 2),
        "carbon_emission_tons":   round(total_co2 / 1000, 3),
        "potential_savings_kwh":  round(savings_energy, 2),
        "potential_co2_reduction":round(savings_co2, 2),
        "co2_per_kwh_factor":     CO2_PER_KWH,
        "hours_per_day":          HOURS_PER_DAY,
        "working_days":           WORKING_DAYS,
        "by_category_chart":      category_chart,
        "by_lab_chart":           lab_chart,
        "top_emitters":           device_rows[:10],
    }
