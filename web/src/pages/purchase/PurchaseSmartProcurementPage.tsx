import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Brain, CheckCircle2, RefreshCw, ShoppingCart } from 'lucide-react';
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

function RiskBadge({ risk }: { risk: PredictionRow['risk'] }) {
  if (risk === 'safe')
    return (
      <span style={{ color: '#22C55E', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
        <CheckCircle2 size={13} /> Safe
      </span>
    );
  if (risk === 'low')
    return (
      <span style={{ color: '#F59E0B', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
        <AlertTriangle size={13} /> Low Stock
      </span>
    );
  return (
    <span style={{ color: '#EF4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
      <AlertTriangle size={13} /> Reorder
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

  return (
    <div className="dashboard-grid">
      {/* Header */}
      <div className="page-intro">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Brain size={22} style={{ color: '#4F6EF7' }} />
          <h2 style={{ margin: 0 }}>{t('smartProcurement', 'Smart Procurement')}</h2>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '0.88rem', opacity: 0.65 }}>
          {t('smartProcurementDesc', 'ML-driven inventory demand forecasting for the coming month. Generate purchase requests directly from predictions.')}
        </p>
        <div style={{ marginTop: 10 }}>
          <button
            className="btn primary-btn"
            onClick={() => { loadedRef.current = false; loadData(); }}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem' }}
          >
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            {loading ? t('loading', 'Loading…') : t('refreshPredictions', 'Refresh Predictions')}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card" style={{ borderLeft: '4px solid #EF4444', padding: '14px 16px', display: 'flex', gap: 8 }}>
          <AlertTriangle size={18} color="#EF4444" />
          <span style={{ fontSize: '0.9rem' }}>{error}</span>
        </div>
      )}

      {/* Global success message */}
      {globalMsg && !loading && (
        <div className="card" style={{ borderLeft: '4px solid #22C55E', padding: '12px 16px', display: 'flex', gap: 8 }}>
          <CheckCircle2 size={18} color="#22C55E" />
          <span style={{ fontSize: '0.9rem' }}>{globalMsg}</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card" style={{ padding: 24, textAlign: 'center', opacity: 0.6 }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', display: 'block' }} />
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Fetching ML predictions…</p>
        </div>
      )}

      {/* Summary row */}
      {!loading && rows.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
            {[
              { label: t('itemsAnalysed', 'Items Analysed'), value: rows.length, color: '#4F6EF7' },
              { label: t('reorderRequired', 'Reorder Required'), value: reorderCount, color: '#EF4444' },
              { label: t('totalUnitsToOrder', 'Total Units to Order'), value: totalToOrder, color: '#F97316' },
            ].map((kpi) => (
              <article key={kpi.label} className="metric-card touch-card" style={{ borderTop: `3px solid ${kpi.color}` }}>
                <div className="metric-top">
                  <p className="metric-title">{kpi.label}</p>
                </div>
                <p className="metric-value" style={{ color: kpi.color }}>{kpi.value}</p>
              </article>
            ))}
          </div>

          {/* Smart Procurement Table */}
          <section className="card">
            <div className="chart-head" style={{ marginBottom: 16 }}>
              <h3>{t('smartProcurementSuggestions', 'Smart Procurement Suggestions')}</h3>
              <p>{t('smartProcurementSuggestionsDesc', 'Click "Generate Request" for items that need restocking')}</p>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color, #e5e7eb)' }}>
                    {[
                      t('item', 'Item'),
                      t('currentStock', 'Current Stock'),
                      t('predictedDemand', 'Predicted Demand'),
                      t('reorderLevel', 'Reorder Level'),
                      t('suggestedOrder', 'Suggested Qty'),
                      t('riskStatus', 'Risk'),
                      t('actions', 'Action'),
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 12px',
                          textAlign: 'left',
                          fontWeight: 600,
                          opacity: 0.75,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      style={{
                        borderBottom: '1px solid var(--border-color, #f3f4f6)',
                        background:
                          row.risk === 'reorder'
                            ? 'rgba(239,68,68,0.04)'
                            : row.risk === 'low'
                            ? 'rgba(245,158,11,0.04)'
                            : 'transparent',
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.name}</td>
                      <td style={{ padding: '10px 12px' }}>{row.current_stock}</td>
                      <td style={{ padding: '10px 12px', color: '#4F6EF7', fontWeight: 600 }}>
                        {row.predicted_demand}
                      </td>
                      <td style={{ padding: '10px 12px' }}>{row.reorder_level}</td>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontWeight: 700,
                          color: row.suggested_order > 0 ? '#F97316' : '#22C55E',
                        }}
                      >
                        {row.suggested_order > 0 ? `+${row.suggested_order}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <RiskBadge risk={row.risk} />
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {row.ordered ? (
                          <span style={{ color: '#22C55E', fontWeight: 600, fontSize: '0.82rem' }}>
                            ✓ Requested
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
                          <span style={{ opacity: 0.4, fontSize: '0.82rem' }}>—</span>
                        )}
                        {row.orderError && (
                          <p style={{ margin: '4px 0 0', color: '#EF4444', fontSize: '0.78rem' }}>
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
        </>
      )}

      {/* Empty state */}
      {!loading && !error && rows.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', opacity: 0.6 }}>
          <Brain size={32} style={{ margin: '0 auto 10px', display: 'block' }} />
          <p style={{ margin: 0 }}>No inventory items to analyse yet.</p>
        </div>
      )}
    </div>
  );
}
