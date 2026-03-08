import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, BarChart2, Box, CheckCircle2, RefreshCw,
  TrendingUp, Users, Wrench, XCircle
} from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

/* ───────────────────────────────────────────
   Types
─────────────────────────────────────────── */
type ChartPoint = { label: string; value: number };

type AdminKpis = {
  totalAssets: number;
  activeAssets: number;
  damagedAssets: number;
  underMaintenance: number;
  cancelledAssets: number;
  pendingRequests: number;
  totalUsers: number;
  labs: number;
};

type DashData = {
  assets_by_location: ChartPoint[];
  asset_category_distribution: ChartPoint[];
  monthly_procurement_trend: ChartPoint[];
  maintenance_status_distribution: ChartPoint[];
  feedback_ratings_distribution: ChartPoint[];
};

type LocationAnalytics = {
  byType: ChartPoint[];
  byFacility: ChartPoint[];
  maintenanceByLocation: ChartPoint[];
};

/* ───────────────────────────────────────────
   Colour palette
─────────────────────────────────────────── */
const PALETTE = [
  '#4F6EF7', '#22C55E', '#F59E0B', '#EF4444',
  '#A78BFA', '#06B6D4', '#F97316', '#84CC16',
  '#EC4899', '#14B8A6',
];

/* ───────────────────────────────────────────
   Helper: short month label
─────────────────────────────────────────── */
function shortMonth(yyyymm: string) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const parts = yyyymm.split('-');
  if (parts.length === 2) {
    const idx = parseInt(parts[1], 10) - 1;
    return months[idx] ?? yyyymm;
  }
  return yyyymm;
}

/* ═══════════════════════════════════════════
   SVG Bar Chart (vertical, generic)
═══════════════════════════════════════════ */
function BarChart({
  data,
  height = 180,
  color = '#4F6EF7',
  multiColor = false,
  labelRotate = false,
}: {
  data: ChartPoint[];
  height?: number;
  color?: string;
  multiColor?: boolean;
  labelRotate?: boolean;
}) {
  if (!data.length) return <div className="chart-empty-msg">No data available</div>;

  const W = 500;
  const padL = 36, padR = 12, padT = 16, padB = labelRotate ? 56 : 36;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.max(8, (innerW / data.length) * 0.55);
  const gap = innerW / data.length;

  const yTicks = 4;

  return (
    <svg
      viewBox={`0 0 ${W} ${height}`}
      className="cl-chart-svg"
      aria-label="Bar chart"
      role="img"
    >
      {/* Y gridlines + labels */}
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const val = (maxVal * i) / yTicks;
        const y = padT + innerH - (i / yTicks) * innerH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL + innerW} y2={y} className="cl-grid-line" />
            <text x={padL - 6} y={y + 4} className="cl-axis-label" textAnchor="end">
              {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val)}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((d, i) => {
        const bh = Math.max(2, (d.value / maxVal) * innerH);
        const x = padL + gap * i + gap / 2 - barW / 2;
        const y = padT + innerH - bh;
        const fill = multiColor ? PALETTE[i % PALETTE.length] : color;
        return (
          <g key={d.label}>
            <rect
              x={x} y={y} width={barW} height={bh}
              rx={4} fill={fill} opacity={0.9}
              className="cl-bar"
            >
              <title>{d.label}: {d.value}</title>
            </rect>
            {/* Value label on top */}
            {d.value > 0 && (
              <text
                x={x + barW / 2} y={y - 4}
                className="cl-bar-val" textAnchor="middle"
              >{d.value}</text>
            )}
            {/* X axis label */}
            {labelRotate ? (
              <text
                x={x + barW / 2} y={padT + innerH + 14}
                className="cl-axis-label"
                transform={`rotate(-35, ${x + barW / 2}, ${padT + innerH + 14})`}
                textAnchor="end"
              >{shortMonth(d.label)}</text>
            ) : (
              <text
                x={x + barW / 2} y={padT + innerH + 14}
                className="cl-axis-label" textAnchor="middle"
              >{d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label}</text>
            )}
          </g>
        );
      })}

      {/* Y axis */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} className="cl-axis-line" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   SVG Line Chart
═══════════════════════════════════════════ */
function LineChart({ data, height = 180 }: { data: ChartPoint[]; height?: number }) {
  if (!data.length) return <div className="chart-empty-msg">No data available</div>;

  const W = 500;
  const padL = 36, padR = 12, padT = 16, padB = 36;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const yTicks = 4;
  const n = data.length;

  const xOf = (i: number) => padL + (i / Math.max(n - 1, 1)) * innerW;
  const yOf = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const linePts = data.map((d, i) => `${xOf(i).toFixed(1)},${yOf(d.value).toFixed(1)}`).join(' ');
  const areaPath = [
    `M ${xOf(0).toFixed(1)} ${(padT + innerH).toFixed(1)}`,
    ...data.map((d, i) => `L ${xOf(i).toFixed(1)} ${yOf(d.value).toFixed(1)}`),
    `L ${xOf(n - 1).toFixed(1)} ${(padT + innerH).toFixed(1)}`,
    'Z',
  ].join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="cl-chart-svg" aria-label="Line chart" role="img">
      <defs>
        <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4F6EF7" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#4F6EF7" stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const val = (maxVal * i) / yTicks;
        const y = padT + innerH - (i / yTicks) * innerH;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={padL + innerW} y2={y} className="cl-grid-line" />
            <text x={padL - 6} y={y + 4} className="cl-axis-label" textAnchor="end">
              {Math.round(val)}
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill="url(#lineAreaGrad)" />
      <polyline points={linePts} fill="none" stroke="#4F6EF7" strokeWidth="2.5"
        strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => (
        <g key={d.label}>
          <circle cx={xOf(i)} cy={yOf(d.value)} r={3.5} fill="#4F6EF7" stroke="#fff" strokeWidth="2">
            <title>{d.label}: {d.value}</title>
          </circle>
          {(i === 0 || i === n - 1 || i % Math.ceil(n / 6) === 0) && (
            <text x={xOf(i)} y={padT + innerH + 14} className="cl-axis-label" textAnchor="middle">
              {shortMonth(d.label)}
            </text>
          )}
        </g>
      ))}

      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} className="cl-axis-line" />
    </svg>
  );
}

/* ═══════════════════════════════════════════
   Conic Pie / Donut Chart
═══════════════════════════════════════════ */
function ConicChart({
  data,
  donut = false,
}: {
  data: ChartPoint[];
  donut?: boolean;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0 || !data.length) {
    return (
      <div className="conic-chart-wrap">
        <div className="conic-disc" style={{ background: 'var(--bg-muted-2)' }}>
          {donut && <div className="conic-hole" />}
          <span className="conic-center-text">—</span>
        </div>
        <div className="conic-legend"><p className="chart-empty-msg">No data</p></div>
      </div>
    );
  }

  let acc = 0;
  const segments = data.map((d, i) => {
    const pct = (d.value / total) * 100;
    const seg = { ...d, pct, start: acc, color: PALETTE[i % PALETTE.length] };
    acc += pct;
    return seg;
  });

  const conic = segments.map((s) =>
    `${s.color} ${s.start.toFixed(2)}% ${(s.start + s.pct).toFixed(2)}%`
  ).join(', ');

  const largest = segments.reduce((a, b) => (b.pct > a.pct ? b : a));

  return (
    <div className="conic-chart-wrap">
      <div className="conic-disc" style={{ background: `conic-gradient(${conic})` }}>
        {donut && <div className="conic-hole" />}
        <span className="conic-center-text">
          {donut ? `${Math.round(largest.pct)}%` : ''}
        </span>
      </div>
      <div className="conic-legend">
        {segments.map((s) => (
          <div key={s.label} className="conic-legend-row">
            <span className="conic-dot" style={{ background: s.color }} />
            <span className="conic-legend-label">{s.label}</span>
            <span className="conic-legend-val">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   KPI Card
═══════════════════════════════════════════ */
function KpiCard({
  title, value, icon, color, delay: entryDelay, animate,
}: {
  title: string;
  value: number | string | null | undefined;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'violet' | 'rose' | 'cyan' | 'default';
  delay: number;
  animate: boolean;
}) {
  return (
    <article
      className={`metric-card ${color} touch-card entry-animate ${animate ? 'in' : ''}`}
      style={{ '--delay': `${entryDelay}ms` } as React.CSSProperties}
    >
      <div className="metric-top">
        <p className="metric-title">{title}</p>
        <span className="metric-icon">{icon}</span>
      </div>
      <p className="metric-value">{value ?? '—'}</p>
    </article>
  );
}

/* ═══════════════════════════════════════════
   Chart Card wrapper
═══════════════════════════════════════════ */
function ChartCard({
  title, subtitle, children, delay: entryDelay, animate, className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay: number;
  animate: boolean;
  className?: string;
}) {
  return (
    <section
      className={`dashboard-chart-card touch-card entry-animate ${animate ? 'in' : ''} ${className}`}
      style={{ '--delay': `${entryDelay}ms` } as React.CSSProperties}
    >
      <div className="chart-head">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/* ═══════════════════════════════════════════
   Main page
═══════════════════════════════════════════ */
export function AdminDashboardPage() {
  const { t } = useLanguage();

  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [dash, setDash] = useState<DashData | null>(null);
  const [locationAnalytics, setLocationAnalytics] = useState<LocationAnalytics | null>(null);
  const [animate, setAnimate] = useState(false);
  const [runningChecks, setRunningChecks] = useState(false);
  const [checksMsg, setChecksMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  async function loadData() {
    setLoading(true);
    try {
      const [dashData, locData] = await Promise.all([
        api.getAnalyticsDashboard(),
        api.getLocationAnalytics(),
      ]);
      if (dashData) {
        const k = dashData.asset_kpis;
        setKpis({
          totalAssets: k.total_assets,
          activeAssets: k.active_assets,
          damagedAssets: k.damaged_assets,
          underMaintenance: k.under_maintenance,
          cancelledAssets: k.cancelled_assets,
          pendingRequests: k.pending_maintenance,
          totalUsers: k.total_users,
          labs: k.labs_count,
        });
        setDash({
          assets_by_location: dashData.assets_by_location ?? [],
          asset_category_distribution: dashData.asset_category_distribution ?? [],
          monthly_procurement_trend: dashData.monthly_procurement_trend ?? [],
          maintenance_status_distribution: dashData.maintenance_status_distribution ?? [],
          feedback_ratings_distribution: dashData.feedback_ratings_distribution ?? [],
        });
      }
      if (locData) setLocationAnalytics(locData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      const id = window.requestAnimationFrame(() => setAnimate(true));
      return () => window.cancelAnimationFrame(id);
    }
  }, [loading]);

  async function handleRunChecks() {
    setRunningChecks(true);
    setChecksMsg('');
    try {
      await api.runChecks();
      setChecksMsg(t('checksComplete', 'Checks completed.'));
      await loadData();
    } catch {
      setChecksMsg(t('checksFailed', 'Checks failed — backend may be offline.'));
    } finally {
      setRunningChecks(false);
    }
  }

  const kpiCards: Array<{
    title: string;
    value: number | undefined;
    icon: React.ReactNode;
    color: 'blue' | 'green' | 'amber' | 'violet' | 'rose' | 'cyan' | 'default';
  }> = [
    { title: t('totalAssets', 'Total Assets'), value: kpis?.totalAssets, icon: <Box size={16} />, color: 'blue' },
    { title: t('activeAssets', 'Active Assets'), value: kpis?.activeAssets, icon: <CheckCircle2 size={16} />, color: 'green' },
    { title: t('damagedAssets', 'Damaged Assets'), value: kpis?.damagedAssets, icon: <AlertTriangle size={16} />, color: 'amber' },
    { title: t('underMaintenance', 'Under Maintenance'), value: kpis?.underMaintenance, icon: <Wrench size={16} />, color: 'violet' },
    { title: t('totalUsers', 'Total Users'), value: kpis?.totalUsers, icon: <Users size={16} />, color: 'cyan' },
    { title: t('cancelledAssets', 'Cancelled Assets'), value: kpis?.cancelledAssets, icon: <XCircle size={16} />, color: 'rose' },
    { title: t('pendingMaintenance', 'Pending Maintenance'), value: kpis?.pendingRequests, icon: <TrendingUp size={16} />, color: 'default' },
  ];

  return (
    <div className="dashboard-grid">

      {/* ── Page intro ───────────────────────── */}
      <div
        className={`page-intro entry-animate ${animate ? 'in' : ''}`}
        style={{ '--delay': '20ms' } as React.CSSProperties}
      >
        <h2>{t('adminDashboard', 'Admin Dashboard')}</h2>
        <p>{t('adminOverview', "Welcome back. Here's your complete campus overview.")}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <button
            className="btn secondary-btn"
            type="button"
            onClick={handleRunChecks}
            disabled={runningChecks}
          >
            <RefreshCw size={14} style={{ marginRight: 4 }} />
            {runningChecks ? t('running', 'Running...') : t('runChecks', 'Run Checks')}
          </button>
          {checksMsg && <span style={{ fontSize: '0.85em', opacity: 0.75 }}>{checksMsg}</span>}
        </div>
      </div>

      {/* ── KPI grid (7 cards) ───────────────── */}
      <div className="metric-grid kpi-grid-seven">
        {kpiCards.map((kpi, i) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            color={kpi.color}
            delay={70 + i * 55}
            animate={animate}
          />
        ))}
      </div>

      {/* ── Row 1: Assets by Lab (bar) + Category (pie) ── */}
      <div className="chart-grid chart-grid-6-4">
        <ChartCard
          title={t('assetsByLab', 'Assets by Lab Location')}
          subtitle={t('excludesNetworking', 'Excludes networking category')}
          delay={420} animate={animate}
        >
          <BarChart
            data={dash?.assets_by_location ?? []}
            multiColor
            height={190}
          />
        </ChartCard>

        <ChartCard
          title={t('categoryDistribution', 'Asset Category Distribution')}
          subtitle={t('excludesNetworking', 'Excludes networking category')}
          delay={480} animate={animate}
        >
          <ConicChart data={dash?.asset_category_distribution ?? []} />
        </ChartCard>
      </div>

      {/* ── Row 2: Procurement trend (line) ────── */}
      <ChartCard
        title={t('monthlyProcurement', 'Monthly Procurement Trend')}
        subtitle={t('last12Months', 'Order count — last 12 months')}
        delay={540} animate={animate}
      >
        <LineChart data={dash?.monthly_procurement_trend ?? []} height={190} />
      </ChartCard>

      {/* ── Row 3: Maintenance donut + Feedback ratings ── */}
      <div className="chart-grid chart-grid-balanced">
        <ChartCard
          title={t('maintenanceStatus', 'Maintenance Status Distribution')}
          delay={600} animate={animate}
        >
          <ConicChart data={dash?.maintenance_status_distribution ?? []} donut />
        </ChartCard>

        <ChartCard
          title={t('feedbackRatings', 'Feedback Ratings Distribution')}
          subtitle={t('ratingScale', 'Rating scale 1–5')}
          delay={660} animate={animate}
        >
          <BarChart
            data={dash?.feedback_ratings_distribution ?? []}
            color="#F59E0B"
            height={190}
          />
        </ChartCard>
      </div>

      {/* ── Row 4: Location Analytics ─────────── */}
      <div
        className={`page-intro entry-animate ${animate ? 'in' : ''}`}
        style={{ '--delay': '700ms', marginTop: 8 } as React.CSSProperties}
      >
        <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{t('locationAnalytics', 'Location Analytics')}</h3>
        <p style={{ margin: '2px 0 0', fontSize: '0.85rem', opacity: 0.65 }}>
          {t('locationAnalyticsDesc', 'Asset distribution and maintenance across academic and non-academic facilities')}
        </p>
      </div>

      <div className="chart-grid chart-grid-balanced">
        <ChartCard
          title={t('assetsByLocationType', 'Assets by Location Type')}
          subtitle={t('academicVsNonAcademic', 'Academic vs Non-Academic')}
          delay={720} animate={animate}
        >
          <ConicChart data={locationAnalytics?.byType ?? []} donut />
        </ChartCard>

        <ChartCard
          title={t('maintenanceByLocation', 'Maintenance by Location')}
          subtitle={t('requestsPerFacility', 'Requests per facility')}
          delay={780} animate={animate}
        >
          <BarChart
            data={locationAnalytics?.maintenanceByLocation ?? []}
            multiColor
            height={190}
            labelRotate
          />
        </ChartCard>
      </div>

      <ChartCard
        title={t('assetsByFacility', 'Assets by Facility')}
        subtitle={t('allLocations', 'All locations — academic + non-academic')}
        delay={840} animate={animate}
      >
        <BarChart
          data={locationAnalytics?.byFacility ?? []}
          multiColor
          height={200}
          labelRotate
        />
      </ChartCard>

    </div>
  );
}

