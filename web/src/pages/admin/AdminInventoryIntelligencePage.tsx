import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BellRing, CheckCircle2, Edit2, RefreshCw, Brain, TrendingDown, TrendingUp, X } from 'lucide-react';
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

type ReorderRecord = { qty: number; notes: string; sentAt: string };

/** localStorage key for per-item reorder records { [itemId]: ReorderRecord } */
const REORDER_RECORDS_KEY = 'campusLedger_reorder_records';

function readReorderRecords(): Record<string, ReorderRecord> {
  try {
    const raw = localStorage.getItem(REORDER_RECORDS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, ReorderRecord>;
  } catch { /* ignore */ }
  return {};
}

function writeReorderRecords(records: Record<string, ReorderRecord>): void {
  try {
    localStorage.setItem(REORDER_RECORDS_KEY, JSON.stringify(records));
  } catch { /* ignore */ }
}

function PredictionCard({
  item, delay: entryDelay, animate, isNotified, onNotified, onRevoke,
}: {
  item: PredictionResult;
  delay: number;
  animate: boolean;
  isNotified: boolean;
  onNotified: (qty: number, notes: string) => void;
  /** called when user chooses to edit/cancel a sent reorder */
  onRevoke: () => void;
}) {
  const [mode, setMode] = useState<'idle' | 'form' | 'sending' | 'error'>('idle');
  const [qty, setQty] = useState(item.suggested_order > 0 ? item.suggested_order : 1);
  const [notes, setNotes] = useState('');
  const [editMode, setEditMode] = useState(false); // editing an already-sent reorder

  const borderColor =
    item.risk === 'safe' ? '#22C55E' : item.risk === 'low' ? '#F59E0B' : '#EF4444';

  // Load stored record if this item was auto-notified or previously sent
  const [record, setRecord] = useState<ReorderRecord | null>(() => {
    const records = readReorderRecords();
    return records[item.id] ?? null;
  });

  function openForm() {
    // Pre-fill from prior record when editing
    if (record) {
      setQty(record.qty);
      setNotes(record.notes);
    } else {
      setQty(item.suggested_order > 0 ? item.suggested_order : 1);
      setNotes('');
    }
    setEditMode(isNotified);
    setMode('form');
  }

  function cancelForm() {
    setMode('idle');
    setEditMode(false);
  }

  async function handleSend() {
    if (qty < 1) return;
    setMode('sending');
    try {
      await api.triggerReorderAlert({
        item_id: item.id,
        item_name: item.name,
        current_stock: item.current_stock,
        suggested_order: qty,
        reorder_level: item.reorder_level,
      });
      const rec: ReorderRecord = { qty, notes, sentAt: new Date().toISOString() };
      const records = readReorderRecords();
      records[item.id] = rec;
      writeReorderRecords(records);
      setRecord(rec);
      onNotified(qty, notes);
      setMode('idle');
      setEditMode(false);
    } catch {
      setMode('error');
      setTimeout(() => setMode('form'), 3000);
    }
  }

  function handleRevoke() {
    // Remove stored record + unlock the card
    const records = readReorderRecords();
    delete records[item.id];
    writeReorderRecords(records);
    setRecord(null);
    onRevoke();
    setMode('idle');
    setEditMode(false);
  }

  const sentAt = record?.sentAt
    ? new Date(record.sentAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

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
      {/* ── Header row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>{item.name}</p>
        <RiskBadge risk={item.risk} />
      </div>

      {/* ── Stats grid ── */}
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

      {/* ── Reorder section — only when reorder_alert is true ── */}
      {item.reorder_alert && (
        <div style={{ marginTop: 4 }}>

          {/* FORM MODE (new reorder or edit) */}
          {(mode === 'form' || mode === 'sending' || mode === 'error') && (
            <div style={{
              background: 'var(--bg-muted-2, #f9fafb)',
              border: '1px solid var(--border-color, #e5e7eb)',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {editMode ? 'Edit Reorder Request' : 'New Reorder Request'}
                </span>
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={mode === 'sending'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)' }}
                  title="Cancel"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Quantity row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: '0.78rem', opacity: 0.7, flexShrink: 0, minWidth: 90 }}>
                  Quantity to order
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => setQty((q) => Math.max(1, q - 1))}
                    disabled={mode === 'sending' || qty <= 1}
                    style={{
                      width: 26, height: 26, borderRadius: 4, border: '1px solid var(--border-color, #d1d5db)',
                      background: 'var(--bg-surface)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >-</button>
                  <input
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={mode === 'sending'}
                    style={{
                      width: 56, textAlign: 'center', fontSize: '0.88rem', fontWeight: 600,
                      border: '1px solid var(--border-color, #d1d5db)', borderRadius: 4,
                      padding: '3px 4px', background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setQty((q) => q + 1)}
                    disabled={mode === 'sending'}
                    style={{
                      width: 26, height: 26, borderRadius: 4, border: '1px solid var(--border-color, #d1d5db)',
                      background: 'var(--bg-surface)', cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >+</button>
                  <button
                    type="button"
                    onClick={() => setQty(item.suggested_order > 0 ? item.suggested_order : 1)}
                    disabled={mode === 'sending'}
                    style={{
                      fontSize: '0.72rem', padding: '2px 6px', borderRadius: 4,
                      border: '1px solid var(--border-color, #d1d5db)',
                      background: 'var(--bg-surface)', cursor: 'pointer',
                      color: '#4F6EF7', fontWeight: 600,
                    }}
                    title="Reset to ML suggested quantity"
                  >Suggested</button>
                </div>
              </div>

              {/* Notes row */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <label style={{ fontSize: '0.78rem', opacity: 0.7 }}>Notes to Purchase Dept (optional)</label>
                <input
                  type="text"
                  maxLength={160}
                  placeholder="e.g. Urgent — lab exam next week"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={mode === 'sending'}
                  style={{
                    fontSize: '0.82rem', padding: '5px 8px',
                    border: '1px solid var(--border-color, #d1d5db)', borderRadius: 4,
                    background: 'var(--bg-surface)', color: 'var(--text-primary)',
                  }}
                />
              </div>

              {/* Error inline */}
              {mode === 'error' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#EF4444', fontSize: '0.8rem' }}>
                  <AlertTriangle size={13} /> Failed to send — retrying in a moment…
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn"
                  type="button"
                  onClick={handleSend}
                  disabled={mode === 'sending' || mode === 'error' || qty < 1}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 5, fontSize: '0.82rem', padding: '6px 10px',
                    background: mode === 'sending' || mode === 'error' ? '#aaa' : '#EF4444',
                    color: '#fff', border: 'none', borderRadius: 6,
                    cursor: mode === 'sending' || mode === 'error' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {mode === 'sending'
                    ? <><RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> Sending…</>
                    : <><BellRing size={12} /> {editMode ? 'Resend Updated Alert' : 'Send Reorder Alert'}</>}
                </button>
                {editMode && (
                  <button
                    type="button"
                    onClick={handleRevoke}
                    disabled={mode === 'sending'}
                    title="Cancel this reorder entirely"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '6px 10px', fontSize: '0.78rem',
                      background: 'none', border: '1px solid var(--border-color, #d1d5db)',
                      borderRadius: 6, cursor: 'pointer', color: 'var(--text-muted)',
                    }}
                  >
                    <X size={12} /> Cancel Reorder
                  </button>
                )}
              </div>
            </div>
          )}

          {/* SENT / LOCKED MODE */}
          {mode === 'idle' && isNotified && (
            <div style={{
              background: 'var(--bg-muted-2, #f3f4f6)',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16A34A', fontSize: '0.82rem', fontWeight: 700 }}>
                  <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
                  Reorder Alert Sent
                </div>
                <button
                  type="button"
                  onClick={openForm}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', fontSize: '0.75rem',
                    background: 'none', border: '1px solid var(--border-color, #d1d5db)',
                    borderRadius: 5, cursor: 'pointer', color: 'var(--text-muted)',
                  }}
                  title="Edit or re-send this reorder"
                >
                  <Edit2 size={11} /> Edit
                </button>
              </div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
                {record && <span>Qty: <strong>+{record.qty}</strong></span>}
                {sentAt  && <span>Sent: {sentAt}</span>}
                {record?.notes && <span style={{ fontStyle: 'italic', marginTop: 1, width: '100%' }}>“{record.notes}”</span>}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Button re-enables automatically when stock is replenished.
              </span>
            </div>
          )}

          {/* IDLE (not yet notified) */}
          {mode === 'idle' && !isNotified && (
            <button
              className="btn"
              type="button"
              onClick={openForm}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 6, fontSize: '0.82rem',
                padding: '6px 12px', background: '#EF4444', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer',
              }}
            >
              <BellRing size={13} />
              ✗ Reorder — Notify Purchase Dept
            </button>
          )}
        </div>
      )}
    </article>
  );
}

/* ═══════════════════════════════════════
   Reorder alert persistence (localStorage)
═══════════════════════════════════════ */
/** localStorage key storing the set of item IDs whose reorder alert was sent */
const REORDER_STORAGE_KEY = 'campusLedger_reorder_notified';

/**
 * Items with stock=0 OR stock < (reorder_level * this ratio) are auto-triggered
 * immediately when the page loads — no manual button click needed.
 */
const AUTO_TRIGGER_RATIO = 0.2;

function readNotifiedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(REORDER_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set<string>();
}

function writeNotifiedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(REORDER_STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
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

  /** Persisted set of item IDs that have had a reorder alert sent */
  const [notifiedIds, setNotifiedIds] = useState<Set<string>>(readNotifiedIds);

  function markNotified(itemId: string, qty: number, notes: string) {
    const records = readReorderRecords();
    records[itemId] = { qty, notes, sentAt: new Date().toISOString() };
    writeReorderRecords(records);
    setNotifiedIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      writeNotifiedIds(next);
      return next;
    });
  }

  function markRevoked(itemId: string) {
    setNotifiedIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      writeNotifiedIds(next);
      return next;
    });
  }

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

  /**
   * Runs every time predictions are (re-)loaded:
   *   1. Remove notified flag for items whose stock is now replenished.
   *   2. Auto-trigger notification for critically low items (stock=0 or <20% of reorder level).
   */
  useEffect(() => {
    if (!predictions.length) return;
    const updated = new Set(notifiedIds);
    let changed = false;

    // Step 1: clear stale flags when stock has been replenished
    for (const item of predictions) {
      if (item.current_stock >= item.reorder_level && updated.has(item.id)) {
        updated.delete(item.id);
        changed = true;
      }
    }

    // Step 2: auto-notify critically low / out-of-stock items
    const autoItems = predictions.filter(
      (item) =>
        item.reorder_alert &&
        !updated.has(item.id) &&
        (item.current_stock === 0 ||
          item.current_stock < item.reorder_level * AUTO_TRIGGER_RATIO),
    );
    for (const item of autoItems) {
      updated.add(item.id);
      changed = true;
      api.triggerReorderAlert({
        item_id: item.id,
        item_name: item.name,
        current_stock: item.current_stock,
        suggested_order: item.suggested_order,
        reorder_level: item.reorder_level,
      }).catch(() => { /* silent — notification failure must not block UI */ });
    }

    if (changed) {
      setNotifiedIds(new Set(updated));
      writeNotifiedIds(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [predictions]);

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
              <PredictionCard
                key={item.id}
                item={item}
                delay={580 + i * 40}
                animate={animate}
                isNotified={notifiedIds.has(item.id)}
                onNotified={(qty, notes) => markNotified(item.id, qty, notes)}
                onRevoke={() => markRevoked(item.id)}
              />
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
