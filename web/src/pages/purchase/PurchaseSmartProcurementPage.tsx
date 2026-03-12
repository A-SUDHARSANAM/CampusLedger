import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, Brain, CheckCircle2, RefreshCw, ShoppingCart,
  TrendingUp, Package, AlertCircle, Zap, BarChart2,
} from 'lucide-react';
import CountUp from 'react-countup';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

type PredictionRow = {
  id: string;
  name: string;
  current_stock: number;
  predicted_demand: number;
  reorder_level: number;
  reorder_alert: boolean;
  suggested_order: number;
  risk: 'safe' | 'low' | 'reorder';
  ordering: boolean;
  ordered: boolean;
  orderError: string;
};

/* ─── Recharts tooltip skin ─── */
const TT_STYLE: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 10,
  padding: '9px 14px',
  fontSize: '0.82rem',
  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
};

function RiskBadge({ risk }: { risk: PredictionRow['risk'] }) {
  if (risk === 'safe')
    return (
      <span className="risk-badge safe">
        <CheckCircle2 size={11} /> Safe
      </span>
    );
  if (risk === 'low')
    return (
      <span className="risk-badge low">
        <AlertTriangle size={11} /> Low Stock
      </span>
    );
  return (
    <span className="risk-badge reorder">
      <AlertTriangle size={11} /> Reorder
    </span>
  );
}

export function PurchaseSmartProcurementPage() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<PredictionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [globalMsg, setGlobalMsg] = useState('');
  const loadedRef = useRef(false);

  const nextMonth = new Date().getMonth() + 2; // 1-indexed next month

  async function loadData() {
    setLoading(true);
    setError('');
    setGlobalMsg('');
    try {
      const predictions = await api.getInventoryPredictions(nextMonth);
      if (!predictions.length) {
        setError('No inventory items found.');
        return;
      }
      setRows(
        predictions.map((p) => ({
          ...p,
          ordering: false,
          ordered: false,
          orderError: '',
        })),
      );
    } catch (err) {
      setError('Failed to load ML predictions. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadData();
  }, []);

  async function handleGenerateRequest(rowId: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row || row.suggested_order <= 0) return;

    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, ordering: true, orderError: '' } : r))
    );

    try {
      await api.generatePurchaseRequestML(row.id, row.name, row.suggested_order);
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, ordering: false, ordered: true } : r))
      );
      setGlobalMsg(`Purchase request created for "${row.name}" (qty: ${row.suggested_order}).`);
    } catch {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId ? { ...r, ordering: false, orderError: 'Request failed.' } : r
        )
      );
    }
  }

  const totalToOrder = rows.reduce((s, r) => s + r.suggested_order, 0);
  const reorderCount = rows.filter((r) => r.risk === 'reorder').length;
  const safeCount = rows.filter((r) => r.risk === 'safe').length;
  const lowCount = rows.filter((r) => r.risk === 'low').length;

  /* Chart data */
  const barData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.suggested_order - a.suggested_order)
        .slice(0, 8)
        .map((r) => ({
          name: r.name.length > 13 ? r.name.slice(0, 13) + '…' : r.name,
          'Current Stock': r.current_stock,
          'Predicted Demand': r.predicted_demand,
        })),
    [rows],
  );

  const pieData = useMemo(
    () => [
      { name: 'Safe',        value: safeCount,    fill: '#22C55E' },
      { name: 'Low Stock',   value: lowCount,     fill: '#F59E0B' },
      { name: 'Reorder Now', value: reorderCount, fill: '#EF4444' },
    ].filter((d) => d.value > 0),
    [safeCount, lowCount, reorderCount],
  );

  /* Top urgent items */
  const urgentItems = useMemo(
    () =>
      rows
        .filter((r) => r.risk === 'reorder' && r.suggested_order > 0)
        .sort((a, b) => b.suggested_order - a.suggested_order)
        .slice(0, 3),
    [rows],
  );

  const healthPct = rows.length ? Math.round((safeCount / rows.length) * 100) : 0;

  return (
    <div className="dashboard-grid">
      {/* ── Header ─────────────────────────────────── */}
      <div className="page-intro page-intro-row">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'linear-gradient(135deg,#4F6EF7,#7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Brain size={20} color="#fff" />
            </span>
            <h2 style={{ margin: 0 }}>{t('smartProcurement', 'Smart Procurement')}</h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {t('smartProcurementDesc', 'ML-driven inventory demand forecasting for the coming month.')}
          </p>
        </div>
        <button
          className="btn primary-btn page-action-primary"
          onClick={() => { loadedRef.current = false; loadData(); }}
          disabled={loading}
        >
          <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          {loading ? t('loading', 'Loading…') : t('refreshPredictions', 'Refresh Predictions')}
        </button>
      </div>

      {/* ── Error banner ───────────────────────────── */}
      {error && (
        <div className="card" style={{
          borderLeft: '4px solid var(--danger)', padding: '14px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--danger-soft)',
        }}>
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--danger)' }}>{error}</span>
        </div>
      )}

      {/* ── Success banner ─────────────────────────── */}
      {globalMsg && !loading && (
        <div className="card" style={{
          borderLeft: '4px solid var(--success)', padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--success-soft)',
        }}>
          <CheckCircle2 size={18} style={{ color: 'var(--success)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.9rem', color: '#16A34A' }}>{globalMsg}</span>
        </div>
      )}

      {/* ── KPI cards ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {loading ? (
          <>
            <Skeleton height={110} borderRadius={14} />
            <Skeleton height={110} borderRadius={14} />
            <Skeleton height={110} borderRadius={14} />
          </>
        ) : (
          <>
            {[
              { label: t('itemsAnalysed', 'Items Analysed'), value: rows.length,   color: 'blue',   icon: <Package size={18} /> },
              { label: t('reorderRequired', 'Reorder Required'), value: reorderCount, color: 'rose',  icon: <AlertCircle size={18} /> },
              { label: t('totalUnitsToOrder', 'Total Units to Order'), value: totalToOrder, color: 'amber', icon: <TrendingUp size={18} /> },
            ].map((kpi, i) => (
              <article
                key={kpi.label}
                className={`metric-card ${kpi.color} touch-card`}
              >
                <div className="metric-top">
                  <p className="metric-title">{kpi.label}</p>
                  <span className="metric-icon">{kpi.icon}</span>
                </div>
                <p className="metric-value" style={{ animationDelay: `${i * 80}ms` }}>
                  <CountUp end={kpi.value} duration={1.4} delay={0.1} />
                </p>
              </article>
            ))}
          </>
        )}
      </div>

      {/* ── Charts ─────────────────────────────────── */}
      {loading ? (
        <div className="charts-2col">
          <Skeleton height={234} borderRadius={14} />
          <Skeleton height={234} borderRadius={14} />
        </div>
      ) : rows.length > 0 ? (
        <div className="charts-2col">
          {/* Bar chart: Stock vs Demand */}
          <section className="dashboard-chart-card">
            <div className="chart-head">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <BarChart2 size={16} style={{ color: 'var(--accent-primary)' }} />
                {t('stockVsDemand', 'Stock vs Predicted Demand')}
              </h3>
              <p>{t('top8ByUrgency', 'Top items by urgency')}</p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="4 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                <Tooltip contentStyle={TT_STYLE} cursor={{ fill: 'var(--bg-muted)' }} />
                <Bar dataKey="Current Stock"    fill="#4F6EF7" radius={[4,4,0,0]} maxBarSize={18} />
                <Bar dataKey="Predicted Demand" fill="#F59E0B" radius={[4,4,0,0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#4F6EF7', display: 'inline-block' }} />
                Current Stock
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#F59E0B', display: 'inline-block' }} />
                Predicted Demand
              </span>
            </div>
          </section>

          {/* Pie chart: Risk distribution */}
          <section className="dashboard-chart-card">
            <div className="chart-head">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Zap size={16} style={{ color: '#F59E0B' }} />
                {t('riskDistribution', 'Risk Distribution')}
              </h3>
              <p>{t('inventoryHealthOverview', 'Inventory health overview')}</p>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={44}
                  outerRadius={72}
                  strokeWidth={0}
                  dataKey="value"
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TT_STYLE} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4 }}>
              {pieData.map((d) => (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{d.name}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {/* ── AI Insight Panel ───────────────────────── */}
      {!loading && rows.length > 0 && (
        <div className="ai-insight-panel">
          <div className="ai-insight-head">
            <div>
              <p className="ai-insight-title">
                <Brain size={16} style={{ display: 'inline', marginRight: 7, verticalAlign: 'text-bottom' }} />
                {t('aiInsights', 'AI Procurement Insights')}
              </p>
              <p className="ai-insight-sub">
                {t('aiInsightsSub', 'Automated analysis of your inventory based on ML demand forecasting')}
              </p>
            </div>
            <span className="ai-insight-badge">
              <Zap size={11} /> ML Powered
            </span>
          </div>

          <div className="ai-insight-stats">
            <div className="ai-insight-stat">
              <div className="ai-insight-stat-value">
                <CountUp end={healthPct} suffix="%" duration={1.6} />
              </div>
              <div className="ai-insight-stat-label">Inventory Health</div>
            </div>
            <div className="ai-insight-stat">
              <div className="ai-insight-stat-value">
                <CountUp end={reorderCount} duration={1.4} />
              </div>
              <div className="ai-insight-stat-label">Items Critical</div>
            </div>
            <div className="ai-insight-stat">
              <div className="ai-insight-stat-value">
                <CountUp end={totalToOrder} duration={1.5} />
              </div>
              <div className="ai-insight-stat-label">Units Needed</div>
            </div>
            <div className="ai-insight-stat">
              <div className="ai-insight-stat-value">
                <CountUp end={rows.length - reorderCount} duration={1.4} />
              </div>
              <div className="ai-insight-stat-label">Items Stable</div>
            </div>
          </div>

          {urgentItems.length > 0 && (
            <div className="ai-urgent-section">
              <p className="ai-urgent-label">Urgent Attention Required</p>
              <div className="ai-urgent-list">
                {urgentItems.map((item) => (
                  <div key={item.id} className="ai-urgent-item">
                    <span className="ai-urgent-dot" />
                    <span className="ai-urgent-name">{item.name}</span>
                    <span style={{ fontSize: 12, color: 'rgba(165,180,252,0.7)', marginLeft: 'auto', marginRight: 8 }}>
                      stock: {item.current_stock} → need: {item.reorder_level}
                    </span>
                    <span className="ai-urgent-qty">+{item.suggested_order} units</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Procurement table ──────────────────────── */}
      {!loading && rows.length > 0 && (
        <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="chart-head" style={{ padding: '18px 20px 0' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <ShoppingCart size={16} style={{ color: 'var(--accent-primary)' }} />
              {t('smartProcurementSuggestions', 'Smart Procurement Suggestions')}
            </h3>
            <p>{t('smartProcurementSuggestionsDesc', 'Click "Generate Request" for items that need restocking')}</p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="proc-table">
              <thead>
                <tr>
                  {[
                    t('item', 'Item'),
                    t('currentStock', 'Current Stock'),
                    t('predictedDemand', 'Predicted Demand'),
                    t('reorderLevel', 'Reorder Level'),
                    t('suggestedOrder', 'Suggested Qty'),
                    t('riskStatus', 'Risk'),
                    t('actions', 'Action'),
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.risk === 'reorder' ? 'row-reorder' : row.risk === 'low' ? 'row-low' : ''}
                  >
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td>{row.current_stock}</td>
                    <td style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                      {row.predicted_demand}
                    </td>
                    <td>{row.reorder_level}</td>
                    <td style={{ fontWeight: 700, color: row.suggested_order > 0 ? '#F97316' : 'var(--success)' }}>
                      {row.suggested_order > 0 ? `+${row.suggested_order}` : '—'}
                    </td>
                    <td>
                      <RiskBadge risk={row.risk} />
                    </td>
                    <td>
                      {row.ordered ? (
                        <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={13} /> Requested
                        </span>
                      ) : row.suggested_order > 0 ? (
                        <button
                          className="btn primary-btn mini-btn"
                          type="button"
                          disabled={row.ordering}
                          onClick={() => handleGenerateRequest(row.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                          <ShoppingCart size={12} />
                          {row.ordering ? 'Sending…' : t('generateRequest', 'Generate Request')}
                        </button>
                      ) : (
                        <span style={{ opacity: 0.35, fontSize: '0.82rem' }}>—</span>
                      )}
                      {row.orderError && (
                        <p style={{ margin: '4px 0 0', color: 'var(--danger)', fontSize: '0.78rem' }}>
                          {row.orderError}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Skeleton table (loading) ────────────────── */}
      {loading && (
        <section className="card" style={{ padding: 20 }}>
          <Skeleton height={22} width="40%" style={{ marginBottom: 16 }} />
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} height={42} style={{ marginBottom: 8 }} borderRadius={8} />
          ))}
        </section>
      )}

      {/* ── Empty state ────────────────────────────── */}
      {!loading && !error && rows.length === 0 && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <Brain size={32} />
            </div>
            <p className="empty-state-title">No inventory data yet</p>
            <p className="empty-state-sub">
              Add inventory items to the catalog and the ML model will generate demand forecasts automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
