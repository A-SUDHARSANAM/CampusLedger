import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Brain, TrendingDown, TrendingUp } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
type ChartPoint = { label: string; value: number };

type InventoryItem = {
  id: string;
  name: string;
  current_stock: number;
};

type PredictionResult = InventoryItem & {
  predicted_demand: number;
  reorder_level: number;
  reorder_alert: boolean;
  risk: 'safe' | 'low' | 'reorder';
  suggested_order: number;
};

/* ─────────────────────────────────────────
   Colour palette (same as AdminDashboardPage)
───────────────────────────────────────── */
const PALETTE = [
  '#4F6EF7', '#22C55E', '#F59E0B', '#EF4444',
  '#A78BFA', '#06B6D4', '#F97316', '#84CC16',
  '#EC4899', '#14B8A6',
];

/* ═══════════════════════════════════════
   SVG Bar Chart
═══════════════════════════════════════ */
function BarChart({
  data,
  height = 220,
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
  const padL = 36, padR = 12, padT = 16, padB = labelRotate ? 64 : 36;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const barW = Math.max(8, (innerW / data.length) * 0.55);
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
            <text x={padL - 6} y={y + 4} className="cl-axis-label" textAnchor="end">
              {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : Math.round(val)}
            </text>
          </g>
        );
      })}

      {data.map((d, i) => {
        const bh = Math.max(2, (d.value / maxVal) * innerH);
        const x = padL + gap * i + gap / 2 - barW / 2;
        const y = padT + innerH - bh;
        const fill = multiColor ? PALETTE[i % PALETTE.length] : color;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={bh} rx={4} fill={fill} opacity={0.9} className="cl-bar">
              <title>{d.label}: {d.value}</title>
            </rect>
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 4} className="cl-bar-val" textAnchor="middle">{d.value}</text>
            )}
            {labelRotate ? (
              <text
                x={x + barW / 2} y={padT + innerH + 14}
                className="cl-axis-label"
                transform={`rotate(-40, ${x + barW / 2}, ${padT + innerH + 14})`}
                textAnchor="end"
              >{d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label}</text>
            ) : (
              <text x={x + barW / 2} y={padT + innerH + 14} className="cl-axis-label" textAnchor="middle">
                {d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label}
              </text>
            )}
          </g>
        );
      })}

      <line x1={padL} y1={padT} x2={padL} y2={padT + innerH} className="cl-axis-line" />
    </svg>
  );
}

/* ═══════════════════════════════════════
   Conic Pie / Donut Chart
═══════════════════════════════════════ */
function ConicChart({ data, donut = false }: { data: ChartPoint[]; donut?: boolean }) {
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
        <span className="conic-center-text">{donut ? `${Math.round(largest.pct)}%` : ''}</span>
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

/* ═══════════════════════════════════════
   Chart Card wrapper
═══════════════════════════════════════ */
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

/* ═══════════════════════════════════════
   Risk badge
═══════════════════════════════════════ */
function RiskBadge({ risk }: { risk: PredictionResult['risk'] }) {
  if (risk === 'safe')   return <span style={{ color: '#22C55E', fontWeight: 600 }}>✓ Safe</span>;
  if (risk === 'low')    return <span style={{ color: '#F59E0B', fontWeight: 600 }}>⚠ Low Stock</span>;
  return <span style={{ color: '#EF4444', fontWeight: 600 }}>✗ Reorder</span>;
}

/* ═══════════════════════════════════════
   Prediction Card
═══════════════════════════════════════ */
function PredictionCard({
  item, delay: entryDelay, animate,
}: {
  item: PredictionResult;
  delay: number;
  animate: boolean;
}) {
  const borderColor =
    item.risk === 'safe' ? '#22C55E' : item.risk === 'low' ? '#F59E0B' : '#EF4444';

  return (
    <article
      className={`card touch-card entry-animate ${animate ? 'in' : ''}`}
      style={{
        '--delay': `${entryDelay}ms`,
        borderLeft: `4px solid ${borderColor}`,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      } as React.CSSProperties}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>{item.name}</p>
        <RiskBadge risk={item.risk} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.82rem' }}>
        <div>
          <span style={{ opacity: 0.6 }}>Current Stock</span>
          <p style={{ margin: 0, fontWeight: 600 }}>{item.current_stock}</p>
        </div>
        <div>
          <span style={{ opacity: 0.6 }}>Predicted Demand</span>
          <p style={{ margin: 0, fontWeight: 600, color: '#4F6EF7' }}>{item.predicted_demand}</p>
        </div>
        <div>
          <span style={{ opacity: 0.6 }}>Reorder Level</span>
          <p style={{ margin: 0, fontWeight: 600 }}>{item.reorder_level}</p>
        </div>
        <div>
          <span style={{ opacity: 0.6 }}>Suggested Order</span>
          <p style={{ margin: 0, fontWeight: 600, color: item.suggested_order > 0 ? '#F97316' : '#22C55E' }}>
            {item.suggested_order > 0 ? `+${item.suggested_order}` : '—'}
          </p>
        </div>
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════
   Main Page
═══════════════════════════════════════ */
export function AdminInventoryIntelligencePage() {
  const { t } = useLanguage();
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [animate, setAnimate] = useState(false);
  const loadedRef = useRef(false);

  const nextMonth = new Date().getMonth() + 2; // 1-indexed, next month

  async function loadPredictions() {
    setLoading(true);
    setError('');
    try {
      const results = await api.getInventoryPredictions(nextMonth);
      if (!results.length) {
        setError('No inventory items found. Make sure assets are registered.');
        return;
      }
      setPredictions(results);
    } catch (err) {
      setError('Failed to load predictions. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadPredictions();
  }, []);

  useEffect(() => {
    if (!loading) {
      const id = window.requestAnimationFrame(() => setAnimate(true));
      return () => window.cancelAnimationFrame(id);
    }
  }, [loading]);

  // Chart data derived from predictions
  const demandChartData: ChartPoint[] = predictions.map((p) => ({
    label: p.name,
    value: p.predicted_demand,
  }));

  const riskCounts = predictions.reduce(
    (acc, p) => {
      acc[p.risk] = (acc[p.risk] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  const riskChartData: ChartPoint[] = [
    { label: 'Safe', value: riskCounts['safe'] ?? 0 },
    { label: 'Low Stock', value: riskCounts['low'] ?? 0 },
    { label: 'Reorder Required', value: riskCounts['reorder'] ?? 0 },
  ].filter((d) => d.value > 0);

  const safeCount    = riskCounts['safe']   ?? 0;
  const lowCount     = riskCounts['low']    ?? 0;
  const reorderCount = riskCounts['reorder'] ?? 0;

  return (
    <div className="dashboard-grid">
      {/* Page header */}
      <div
        className={`page-intro entry-animate ${animate ? 'in' : ''}`}
        style={{ '--delay': '0ms' } as React.CSSProperties}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brain size={22} style={{ color: '#4F6EF7' }} />
          <h2 style={{ margin: 0 }}>{t('inventoryIntelligence', 'Inventory Intelligence (ML)')}</h2>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '0.88rem', opacity: 0.65 }}>
          {t('inventoryIntelligenceDesc', 'Machine learning–powered demand predictions for the coming month. Reorder alerts and suggested quantities are auto-calculated.')}
        </p>
        <div style={{ marginTop: 10 }}>
          <button
            className="btn primary-btn"
            onClick={() => { loadedRef.current = false; loadPredictions(); }}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            {loading ? t('loading', 'Loading…') : t('refreshPredictions', 'Refresh Predictions')}
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="card" style={{ borderLeft: '4px solid #EF4444', padding: '14px 16px', display: 'flex', gap: 8, alignItems: 'center' }}>
          <AlertTriangle size={18} color="#EF4444" />
          <span style={{ fontSize: '0.9rem' }}>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="card" style={{ padding: 24, textAlign: 'center', opacity: 0.6 }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Fetching ML predictions…</p>
        </div>
      )}

      {/* Summary KPI row */}
      {!loading && predictions.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            {[
              {
                label: t('totalItems', 'Items Analysed'),
                value: predictions.length,
                color: '#4F6EF7',
                icon: <Brain size={18} />,
              },
              {
                label: t('safeItems', 'Safe'),
                value: safeCount,
                color: '#22C55E',
                icon: <CheckCircle2 size={18} />,
              },
              {
                label: t('lowStockItems', 'Low Stock'),
                value: lowCount,
                color: '#F59E0B',
                icon: <TrendingDown size={18} />,
              },
              {
                label: t('reorderItems', 'Reorder Required'),
                value: reorderCount,
                color: '#EF4444',
                icon: <AlertTriangle size={18} />,
              },
              {
                label: t('totalSuggested', 'Total Units to Order'),
                value: predictions.reduce((s, p) => s + p.suggested_order, 0),
                color: '#F97316',
                icon: <TrendingUp size={18} />,
              },
            ].map((kpi, i) => (
              <article
                key={kpi.label}
                className={`metric-card touch-card entry-animate ${animate ? 'in' : ''}`}
                style={{ '--delay': `${100 + i * 60}ms`, borderTop: `3px solid ${kpi.color}` } as React.CSSProperties}
              >
                <div className="metric-top">
                  <p className="metric-title">{kpi.label}</p>
                  <span className="metric-icon" style={{ color: kpi.color }}>{kpi.icon}</span>
                </div>
                <p className="metric-value" style={{ color: kpi.color }}>{kpi.value}</p>
              </article>
            ))}
          </div>

          {/* Charts row */}
          <div className="chart-grid chart-grid-balanced">
            <ChartCard
              title={t('predictedDemand', 'Predicted Demand by Item')}
              subtitle={t('nextMonthForecast', 'Next month ML forecast')}
              delay={400} animate={animate}
            >
              <BarChart data={demandChartData} multiColor height={220} labelRotate />
            </ChartCard>

            <ChartCard
              title={t('inventoryRiskStatus', 'Inventory Risk Status')}
              subtitle={t('riskDistribution', 'Safe / Low Stock / Reorder')}
              delay={480} animate={animate}
            >
              <ConicChart data={riskChartData} donut />
            </ChartCard>
          </div>

          {/* Prediction cards grid */}
          <div
            className={`page-intro entry-animate ${animate ? 'in' : ''}`}
            style={{ '--delay': '540ms', marginTop: 4 } as React.CSSProperties}
          >
            <h3 style={{ margin: 0, fontSize: '1.02rem' }}>{t('itemDetails', 'Item-Level Predictions')}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.83rem', opacity: 0.65 }}>
              {t('itemDetailsDesc', 'Current stock vs predicted demand — reorder alerts highlighted')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {predictions.map((item, i) => (
              <PredictionCard key={item.id} item={item} delay={580 + i * 40} animate={animate} />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && !error && predictions.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', opacity: 0.6 }}>
          <Brain size={32} style={{ margin: '0 auto 10px', display: 'block' }} />
          <p style={{ margin: 0 }}>No inventory items to analyse yet.</p>
        </div>
      )}
    </div>
  );
}
