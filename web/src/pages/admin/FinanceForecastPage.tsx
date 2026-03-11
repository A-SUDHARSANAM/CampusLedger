import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart2,
  Calendar,
  DollarSign,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { DashBarChart, DashLineChart } from '../../components/charts';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ForecastSummary {
  current_year: number;
  forecast_window: number;
  assets_expiring: number;
  estimated_replacement_cost: number;
  inflation_rate: number;
  ml_powered?: boolean;
}

interface CategoryForecast {
  category: string;
  assets_expiring: number;
  estimated_cost: number;
}

interface TimelineForecast {
  year: number;
  assets_expiring: number;
  estimated_cost: number;
}

interface AssetDetail {
  id: string;
  asset_name: string;
  category: string;
  purchase_date: string | null;
  lifecycle_years: number;
  expiry_year: number;
  original_cost: number;
  replacement_cost: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (n >= 1_000)    return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

function fmtFull(n: number): string {
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function authHeader(): Record<string, string> {
  const token =
    localStorage.getItem('campusledger_token') ??
    localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: authHeader() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Colour palette ────────────────────────────────────────────────────────────

const PALETTE = [
  '#4F6EF7', '#22C55E', '#F59E0B', '#EF4444',
  '#A78BFA', '#06B6D4', '#F97316', '#84CC16',
  '#EC4899', '#14B8A6',
];

// ── SVG Bar Chart ─────────────────────────────────────────────────────────────

function BarChart({
  data,
  height = 220,
  labelKey = 'label',
  valueKey = 'value',
  color = '#4F6EF7',
  multiColor = false,
  currency = false,
}: {
  data: Record<string, unknown>[];
  height?: number;
  labelKey?: string;
  valueKey?: string;
  color?: string;
  multiColor?: boolean;
  currency?: boolean;
}) {
  if (!data.length) return <div className="chart-empty-msg">No data available</div>;

  const W = 520;
  const padL = 52, padR = 12, padT = 16, padB = 48;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const vals = data.map((d) => Number(d[valueKey]) || 0);
  const maxVal = Math.max(...vals, 1);
  const barW = Math.max(10, (innerW / data.length) * 0.55);
  const gap = innerW / data.length;
  const yTicks = 4;

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="cl-chart-svg" aria-label="Bar chart" role="img">
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const val = (maxVal * i) / yTicks;
        const y = padT + innerH - (i / yTicks) * innerH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL + innerW} y2={y} className="cl-grid-line" />
            <text x={padL - 5} y={y + 4} className="cl-axis-label" textAnchor="end">
              {currency ? fmt(val) : (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val))}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const bh = Math.max(2, (val / maxVal) * innerH);
        const x = padL + gap * i + gap / 2 - barW / 2;
        const y = padT + innerH - bh;
        const fill = multiColor ? PALETTE[i % PALETTE.length] : color;
        const label = String(d[labelKey] ?? '');
        return (
          <g key={label + i}>
            <rect x={x} y={y} width={barW} height={bh} rx={4} fill={fill} opacity={0.9} className="cl-bar">
              <title>{label}: {currency ? fmtFull(val) : val}</title>
            </rect>
            {val > 0 && (
              <text x={x + barW / 2} y={y - 5} className="cl-bar-val" textAnchor="middle">
                {currency ? fmt(val) : val}
              </text>
            )}
            <text
              x={x + barW / 2} y={padT + innerH + 14}
              className="cl-axis-label"
              transform={label.length > 8 ? `rotate(-30, ${x + barW / 2}, ${padT + innerH + 14})` : undefined}
              textAnchor={label.length > 8 ? 'end' : 'middle'}
            >
              {label.length > 13 ? label.slice(0, 12) + '…' : label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────

function LineChart({
  data,
  height = 200,
  color = '#4F6EF7',
  currency = false,
}: {
  data: { x: string; y: number }[];
  height?: number;
  color?: string;
  currency?: boolean;
}) {
  if (!data.length) return <div className="chart-empty-msg">No data available</div>;

  const W = 520;
  const padL = 56, padR = 16, padT = 16, padB = 36;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.y), 1);
  const xOf = (i: number) => padL + (i / Math.max(data.length - 1, 1)) * innerW;
  const yOf = (v: number) => padT + innerH - (v / maxVal) * innerH;
  const yTicks = 4;

  const points = data.map((d, i) => `${xOf(i).toFixed(1)},${yOf(d.y).toFixed(1)}`).join(' ');
  const area = [
    `M ${xOf(0).toFixed(1)} ${(padT + innerH).toFixed(1)}`,
    ...data.map((d, i) => `L ${xOf(i).toFixed(1)} ${yOf(d.y).toFixed(1)}`),
    `L ${xOf(data.length - 1).toFixed(1)} ${(padT + innerH).toFixed(1)}`,
    'Z',
  ].join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="cl-chart-svg" aria-label="Line chart" role="img">
      <defs>
        <linearGradient id="fg-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const val = (maxVal * i) / yTicks;
        const y = padT + innerH - (i / yTicks) * innerH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL + innerW} y2={y} className="cl-grid-line" />
            <text x={padL - 6} y={y + 4} className="cl-axis-label" textAnchor="end">
              {currency ? fmt(val) : Math.round(val)}
            </text>
          </g>
        );
      })}

      <path d={area} fill="url(#fg-area)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => (
        <g key={d.x}>
          <circle cx={xOf(i)} cy={yOf(d.y)} r={4} fill={color} />
          <text x={xOf(i)} y={padT + innerH + 16} className="cl-axis-label" textAnchor="middle">{d.x}</text>
          {d.y > 0 && (
            <text x={xOf(i)} y={yOf(d.y) - 10} className="cl-bar-val" textAnchor="middle">
              {currency ? fmt(d.y) : d.y}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function FinanceForecastPage() {
  const { t } = useLanguage();
  const [summary, setSummary] = useState<ForecastSummary | null>(null);
  const [categories, setCategories] = useState<CategoryForecast[]>([]);
  const [timeline, setTimeline] = useState<TimelineForecast[]>([]);
  const [assets, setAssets] = useState<AssetDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [window_, setWindow] = useState(3);
  const [catFilter, setCatFilter] = useState('');

  async function load(win = window_) {
    setLoading(true);
    setError('');
    try {
      const [s, c, tl, a] = await Promise.all([
        apiFetch<ForecastSummary>(`/finance/replacement-forecast?window=${win}`),
        apiFetch<CategoryForecast[]>(`/finance/replacement-forecast/category?window=${win}`),
        apiFetch<TimelineForecast[]>(`/finance/replacement-forecast/timeline?window=${win}`),
        apiFetch<AssetDetail[]>(`/finance/replacement-assets?window=${win}`),
      ]);
      setSummary(s);
      setCategories(c);
      setTimeline(tl);
      setAssets(a);
    } catch (e) {
      setError('Failed to load forecast data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function handleWindowChange(w: number) {
    setWindow(w);
    load(w);
  }

  const filteredAssets = catFilter
    ? assets.filter((a) => a.category === catFilter)
    : assets;

  const cats = Array.from(new Set(assets.map((a) => a.category)));

  const timelineChartData = timeline.map((t) => ({ label: String(t.year), value: t.estimated_cost }));
  const categoryBarData = categories.map((c) => ({
    label: c.category,
    value: c.estimated_cost,
    count: c.assets_expiring,
  }));
  const categoryCountData = categories.map((c) => ({
    label: c.category,
    value: c.assets_expiring,
  }));

  return (
    <div className="dashboard-grid">
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="page-intro-row">
        <div className="page-intro" style={{ margin: 0 }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <TrendingUp size={26} />
            {t('financeForecast', 'Financial Planning & Budget Forecast')}
            {summary?.ml_powered && (
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: 'linear-gradient(135deg,#4F6EF7,#A78BFA)',
                  color: '#fff',
                  padding: '2px 8px',
                  borderRadius: 20,
                  verticalAlign: 'middle',
                }}
              >
                ML Powered
              </span>
            )}
          </h2>
          <p>
            {t(
              'financeForecastDesc',
              'Predict infrastructure replacement budgets based on asset lifecycle data.',
            )}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Forecast window:
          </label>
          {[1, 2, 3, 5].map((w) => (
            <button
              key={w}
              className={`btn ${window_ === w ? 'primary-btn' : 'secondary-btn'} mini-btn`}
              type="button"
              onClick={() => handleWindowChange(w)}
            >
              {w}yr
            </button>
          ))}
          <button
            className="btn secondary-btn mini-btn"
            type="button"
            onClick={() => load()}
            disabled={loading}
          >
            <RefreshCw size={13} style={{ marginRight: 4 }} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#EF4444' }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── KPI cards ────────────────────────────────────────────────── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 16 }}>
          <div className="metric-card amber">
            <div className="metric-icon"><AlertTriangle size={20} /></div>
            <div>
              <p className="metric-label">
                {t('assetsExpiring', `Assets Expiring (next ${summary.forecast_window}yr)`)}
              </p>
              <p className="metric-value">{summary.assets_expiring.toLocaleString()}</p>
            </div>
          </div>

          <div className="metric-card violet">
            <div className="metric-icon"><DollarSign size={20} /></div>
            <div>
              <p className="metric-label">{t('estimatedBudget', 'Estimated Replacement Budget')}</p>
              <p className="metric-value" style={{ fontSize: '1.3rem' }}>
                {fmtFull(summary.estimated_replacement_cost)}
              </p>
            </div>
          </div>

          <div className="metric-card blue">
            <div className="metric-icon"><BarChart2 size={20} /></div>
            <div>
              <p className="metric-label">{t('categoriesImpacted', 'Categories Impacted')}</p>
              <p className="metric-value">{categories.length}</p>
            </div>
          </div>

          <div className="metric-card green">
            <div className="metric-icon"><Calendar size={20} /></div>
            <div>
              <p className="metric-label">{t('inflationRate', 'Inflation Rate Applied')}</p>
              <p className="metric-value">{(summary.inflation_rate * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Charts row ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(340px,1fr))', gap: 20 }}>

        {/* Timeline chart */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>
            <TrendingUp size={16} style={{ marginRight: 6 }} />
            Forecast Timeline (Year-by-Year)
          </h3>
          <DashLineChart data={timelineChartData} currency />
        </div>

        {/* Cost by category */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>
            <DollarSign size={16} style={{ marginRight: 6 }} />
            Replacement Cost by Category
          </h3>
          <DashBarChart
            data={categoryBarData}
            multiColor
            currency
          />
        </div>

        {/* Asset count by category */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>
            <BarChart2 size={16} style={{ marginRight: 6 }} />
            Assets Expiring by Category
          </h3>
          <DashBarChart
            data={categoryCountData}
            color="#F59E0B"
          />
        </div>

        {/* Category summary table */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>
            Top Categories — Budget Impact
          </h3>
          {categories.length === 0 ? (
            <div className="chart-empty-msg">No data available</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {categories.slice(0, 6).map((c, i) => {
                const pct = summary
                  ? Math.min(100, (c.estimated_cost / summary.estimated_replacement_cost) * 100)
                  : 0;
                return (
                  <div key={c.category}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{c.category}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {c.assets_expiring} assets · {fmtFull(c.estimated_cost)}
                      </span>
                    </div>
                    <div style={{ background: 'var(--bg-muted-2)', borderRadius: 6, height: 6 }}>
                      <div style={{ width: `${pct.toFixed(1)}%`, background: PALETTE[i % PALETTE.length], borderRadius: 6, height: 6, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Asset details table ───────────────────────────────────────── */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            Replacement Asset Details
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="filter-select"
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              {cats.map((c) => (
                <option key={c} value={c} style={{ textTransform: 'capitalize' }}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredAssets.length === 0 ? (
          <div className="chart-empty-msg">
            {loading ? 'Loading asset data…' : 'No assets found for the selected filters.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Asset Name</th>
                  <th>Category</th>
                  <th>Purchase Date</th>
                  <th>Lifecycle</th>
                  <th>Expiry Year</th>
                  <th>Original Cost</th>
                  <th>Est. Replacement</th>
                  <th>Urgency</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((a) => {
                  const currentYear = new Date().getFullYear();
                  const yearsLeft = a.expiry_year - currentYear;
                  const urgency = yearsLeft <= 0 ? 'Overdue' : yearsLeft === 0 ? 'This Year' : `${yearsLeft}yr`;
                  const urgencyColor =
                    yearsLeft <= 0 ? '#EF4444' :
                    yearsLeft <= 1 ? '#F59E0B' :
                    '#22C55E';
                  return (
                    <tr key={a.id}>
                      <td><strong>{a.asset_name}</strong></td>
                      <td style={{ textTransform: 'capitalize' }}>{a.category}</td>
                      <td>{a.purchase_date ? a.purchase_date.slice(0, 10) : '—'}</td>
                      <td>{a.lifecycle_years} yrs</td>
                      <td>{a.expiry_year}</td>
                      <td>{fmtFull(a.original_cost)}</td>
                      <td style={{ fontWeight: 700, color: '#4F6EF7' }}>{fmtFull(a.replacement_cost)}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ background: `${urgencyColor}20`, color: urgencyColor, border: `1px solid ${urgencyColor}40` }}
                        >
                          {urgency}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Procurement insights ──────────────────────────────────────── */}
      {categories.length > 0 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>
            Procurement Planning Insights
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
            {categories.slice(0, 6).map((c, i) => (
              <div
                key={c.category}
                style={{
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-muted)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: PALETTE[i % PALETTE.length],
                      letterSpacing: '0.06em',
                    }}
                  >
                    {c.category}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      background: `${PALETTE[i % PALETTE.length]}18`,
                      color: PALETTE[i % PALETTE.length],
                      border: `1px solid ${PALETTE[i % PALETTE.length]}30`,
                      borderRadius: 20,
                      padding: '2px 8px',
                      fontWeight: 600,
                    }}
                  >
                    {c.assets_expiring} units
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                  {fmtFull(c.estimated_cost)}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Estimated procurement budget
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
