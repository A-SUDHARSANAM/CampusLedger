/**
 * CarbonFootprintCard.tsx
 * ────────────────────────────────────────────────────────
 * Carbon footprint & energy usage summary panel.
 * Displayed at the bottom of DeviceHealthDashboard.
 *
 * – Fetches data from GET /api/v1/carbon-footprint
 * – Shows 4 KPI tiles (total energy, CO₂ tons, potential savings, CO₂ reduction)
 * – Renders two SVG bar charts: Energy by Category, Energy by Lab
 * – Lists top emitters table with savings-potential flag
 */

import React, { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';
import { api } from '../../services/api';
import type { CarbonFootprintResult } from '../../services/api';

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 1): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function energyTier(kwh: number): 'green' | 'orange' | 'red' {
  if (kwh <= 2000) return 'green';
  if (kwh <= 5000) return 'orange';
  return 'red';
}

// ── SVG bar chart ─────────────────────────────────────────────────────────────

interface BarChartProps {
  data: { label: string; value: number }[];
  color: string;
  unit?: string;
}

function BarChart({ data, color, unit = 'kWh' }: BarChartProps) {
  if (!data || data.length === 0) return <p className="cf-empty">No data available</p>;

  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, 10);
  const max = sorted[0]?.value || 1;

  return (
    <div className="cf-bar-chart">
      {sorted.map((item) => {
        const pct = (item.value / max) * 100;
        return (
          <div key={item.label} className="cf-bar-row">
            <span className="cf-bar-label" title={item.label}>{item.label}</span>
            <div className="cf-bar-track">
              <div
                className="cf-bar-fill"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
            <span className="cf-bar-value">{fmt(item.value)} {unit}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── KPI tile ──────────────────────────────────────────────────────────────────

interface KpiTileProps {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}

function KpiTile({ label, value, sub, accent }: KpiTileProps) {
  return (
    <div className="cf-kpi-tile" style={{ borderLeftColor: accent }}>
      <p className="cf-kpi-label">{label}</p>
      <p className="cf-kpi-value" style={{ color: accent }}>{value}</p>
      {sub && <p className="cf-kpi-sub">{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CarbonFootprintCard() {
  const [data, setData] = useState<CarbonFootprintResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCarbonFootprint()
      .then((res) => setData(res))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load carbon data'))
      .finally(() => setLoading(false));
  }, []);

  const tier = data ? energyTier(data.total_energy_kwh) : 'green';
  const tierColor = tier === 'green' ? '#22c55e' : tier === 'orange' ? '#f59e0b' : '#ef4444';

  return (
    <section className="cf-section">
      {/* ── Header ── */}
      <div className="cf-header">
        <span className="cf-header-icon" style={{ color: '#22c55e' }}>
          <Leaf size={18} />
        </span>
        <h3 className="cf-title">Carbon Footprint &amp; Energy Usage</h3>
        <span className="cf-badge" style={{ background: tier === 'green' ? '#dcfce7' : tier === 'orange' ? '#fef3c7' : '#fee2e2', color: tierColor }}>
          {tier === 'green' ? 'Low Impact' : tier === 'orange' ? 'Moderate Impact' : 'High Impact'}
        </span>
      </div>

      <p className="cf-hint">
        Estimated based on {data?.hours_per_day ?? 8}h/day × {data?.working_days ?? 250} working days.
        CO₂ factor: {data?.co2_per_kwh_factor ?? 0.4} kg / kWh (grid average).
      </p>

      {/* ── Loading / Error ── */}
      {loading && <div className="cf-loading">Calculating carbon footprint…</div>}
      {error && <div className="alert alert-danger" style={{ margin: 0 }}>{error}</div>}

      {data && (
        <>
          {/* ── KPI row ── */}
          <div className="cf-kpi-row">
            <KpiTile
              label="Total Energy"
              value={`${fmt(data.total_energy_kwh)} kWh / yr`}
              sub={`${data.total_devices} tracked devices`}
              accent={tierColor}
            />
            <KpiTile
              label="CO₂ Emissions"
              value={`${fmt(data.carbon_emission_tons, 2)} t CO₂`}
              sub={`${fmt(data.carbon_emission_kg)} kg total`}
              accent="#ef4444"
            />
            <KpiTile
              label="Potential Savings"
              value={`${fmt(data.potential_savings_kwh)} kWh / yr`}
              sub="by replacing aged devices"
              accent="#f59e0b"
            />
            <KpiTile
              label="CO₂ Reduction"
              value={`${fmt(data.potential_co2_reduction)} kg`}
              sub="if savings achieved"
              accent="#22c55e"
            />
          </div>

          {/* ── Charts row ── */}
          <div className="cf-charts-row">
            <div className="cf-chart-card">
              <p className="cf-chart-title">Energy by Category (kWh/yr)</p>
              <BarChart data={data.by_category_chart} color="#6366f1" unit="kWh" />
            </div>
            <div className="cf-chart-card">
              <p className="cf-chart-title">Energy by Lab (kWh/yr)</p>
              <BarChart data={data.by_lab_chart} color="#0ea5e9" unit="kWh" />
            </div>
          </div>

          {/* ── Top emitters table ── */}
          {data.top_emitters.length > 0 && (
            <div className="cf-emitters-wrap">
              <p className="cf-chart-title">Top Emitting Devices</p>
              <div className="cf-table-scroll">
                <table className="cf-emitters-table">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Category</th>
                      <th>Watts</th>
                      <th>Energy / yr</th>
                      <th>CO₂ / yr</th>
                      <th>Age</th>
                      <th>Replace?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.top_emitters.map((e) => (
                      <tr key={e.asset_id} className={e.savings_potential ? 'cf-row-flag' : ''}>
                        <td className="cf-emitter-name">{e.asset_name}</td>
                        <td><span className="cf-category-tag">{e.category}</span></td>
                        <td>{e.power_watts}W</td>
                        <td>{fmt(e.energy_kwh)} kWh</td>
                        <td>{fmt(e.co2_kg)} kg</td>
                        <td>{e.age_years > 0 ? `${e.age_years} yr` : '—'}</td>
                        <td>
                          {e.savings_potential ? (
                            <span className="cf-replace-yes">✓ Yes</span>
                          ) : (
                            <span className="cf-replace-no">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
