import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, CheckCircle2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Database, Hash, Link2, RefreshCw, ShieldCheck, ShieldOff, User, Clock,
} from 'lucide-react';
import { api, type BlockchainBlock } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

// â”€â”€ Action colour map â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ACTION_COLORS: Record<string, { bg: string; gradient: string; text: string; label: string }> = {
  CHAIN_INIT:          { bg: '#64748b', gradient: 'linear-gradient(135deg,#64748b,#475569)', text: '#fff', label: 'Chain Init'    },
  ASSET_CREATED:       { bg: '#22c55e', gradient: 'linear-gradient(135deg,#22c55e,#16a34a)', text: '#fff', label: 'Asset Created' },
  ASSET_UPDATED:       { bg: '#3b82f6', gradient: 'linear-gradient(135deg,#3b82f6,#2563eb)', text: '#fff', label: 'Asset Updated' },
  ASSET_TRANSFERRED:   { bg: '#f59e0b', gradient: 'linear-gradient(135deg,#f59e0b,#d97706)', text: '#fff', label: 'Transferred'   },
  ASSET_REPAIRED:      { bg: '#a855f7', gradient: 'linear-gradient(135deg,#a855f7,#9333ea)', text: '#fff', label: 'Repaired'      },
  ASSET_DISPOSED:      { bg: '#ef4444', gradient: 'linear-gradient(135deg,#ef4444,#dc2626)', text: '#fff', label: 'Disposed'      },
  MAINTENANCE_RAISED:  { bg: '#f97316', gradient: 'linear-gradient(135deg,#f97316,#ea580c)', text: '#fff', label: 'Maintenance'   },
  MAINTENANCE_DONE:    { bg: '#10b981', gradient: 'linear-gradient(135deg,#10b981,#059669)', text: '#fff', label: 'Maint. Done'   },
  PROCUREMENT:         { bg: '#06b6d4', gradient: 'linear-gradient(135deg,#06b6d4,#0891b2)', text: '#fff', label: 'Procurement'   },
};

function actionStyle(action: string) {
  return ACTION_COLORS[action] ?? { bg: '#6b7280', gradient: 'linear-gradient(135deg,#6b7280,#4b5563)', text: '#fff', label: action };
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function shortHash(h: string) {
  if (!h || h.length < 16) return h;
  return `${h.slice(0, 10)}...${h.slice(-10)}`;
}

function formatDate(ts: string) {
  if (!ts) return '-';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// â”€â”€ Block card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function BlockCard({ block, isLast }: { block: BlockchainBlock; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const st = actionStyle(block.action);

  return (
    <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
      {/* Timeline spine */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40, flexShrink: 0 }}>
        {/* Dot */}
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: st.gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, zIndex: 1, boxShadow: `0 0 0 4px ${st.bg}22`,
        }}>
          <Hash size={13} color="#fff" />
        </div>
        {/* Connector line */}
        {!isLast && (
          <div style={{
            width: 2, flexGrow: 1, minHeight: 16,
            background: 'linear-gradient(to bottom, var(--border-color,#e5e7eb), transparent)',
            marginTop: 2,
          }} />
        )}
      </div>

      {/* Card */}
      <div style={{
        flex: 1, marginLeft: 12, marginBottom: isLast ? 0 : 14,
        background: 'var(--bg-card,#fff)',
        borderRadius: 12,
        border: '1px solid var(--border-color,#e5e7eb)',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        transition: 'box-shadow 0.2s',
      }}>
        {/* Card header */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', background: 'none', border: 'none',
            cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)',
          }}
        >
          {/* Block index pill */}
          <span style={{
            fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 700,
            background: 'var(--bg-muted,#f3f4f6)', color: 'var(--text-muted,#6b7280)',
            padding: '2px 8px', borderRadius: 6, flexShrink: 0,
          }}>#{block.block_index}</span>

          {/* Asset info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {block.asset_name}
            </p>
            <p style={{ margin: 0, fontSize: '0.73rem', opacity: 0.5, fontFamily: 'monospace' }}>
              {block.asset_id === 'GENESIS' ? 'GENESIS' : block.asset_id.slice(0, 24) + '...'}
            </p>
          </div>

          {/* Action badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: st.gradient, color: st.text,
            borderRadius: 20, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 700,
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>{st.label}</span>

          {/* Timestamp */}
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: '0.75rem', opacity: 0.55, flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            <Clock size={11} /> {formatDate(block.created_at)}
          </span>

          {/* Expand toggle */}
          <div style={{ flexShrink: 0, opacity: 0.5 }}>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div style={{
            borderTop: '1px solid var(--border-color,#f0f0f0)',
            padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {/* Meta row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              <div style={{
                background: 'var(--bg-muted,#f8fafc)', borderRadius: 8, padding: '8px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <User size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: '0.68rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Performed By</p>
                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }}>{block.performed_by}</p>
                </div>
              </div>
              <div style={{
                background: 'var(--bg-muted,#f8fafc)', borderRadius: 8, padding: '8px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Activity size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: '0.68rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Block Index</p>
                  <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, fontFamily: 'monospace' }}>{block.block_index}</p>
                </div>
              </div>
            </div>

            {/* Hash chain */}
            <div style={{
              background: 'var(--bg-muted,#0f172a08)', borderRadius: 8, padding: '10px 14px',
              border: '1px solid var(--border-color,#e5e7eb)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Link2 size={12} style={{ color: '#22c55e' }} />
                <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.6 }}>Hash Chain</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px 10px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.68rem', opacity: 0.5, textTransform: 'uppercase' }}>This block</span>
                <code style={{ fontSize: '0.72rem', color: '#22c55e', fontWeight: 700, wordBreak: 'break-all', background: '#f0fdf4', padding: '2px 6px', borderRadius: 4 }}>
                  {block.block_hash}
                </code>
                <span style={{ fontSize: '0.68rem', opacity: 0.5, textTransform: 'uppercase' }}>Previous</span>
                <code style={{ fontSize: '0.72rem', opacity: 0.65, wordBreak: 'break-all', background: 'var(--bg-card,#fff)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-color,#e5e7eb)' }}>
                  {block.prev_hash}
                </code>
              </div>
            </div>

            {/* Block data */}
            {block.block_data && Object.keys(block.block_data).length > 0 && (
              <div style={{
                background: 'var(--bg-muted,#f8fafc)', borderRadius: 8, padding: '10px 14px',
                border: '1px solid var(--border-color,#e5e7eb)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Database size={12} style={{ opacity: 0.5 }} />
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.6 }}>Payload</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(block.block_data).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                    <div key={k} style={{
                      background: 'var(--bg-card,#fff)', borderRadius: 6, padding: '4px 10px',
                      border: '1px solid var(--border-color,#e5e7eb)', fontSize: '0.75rem',
                    }}>
                      <span style={{ opacity: 0.5 }}>{k}: </span>
                      <span style={{ fontWeight: 600 }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// â”€â”€ Filter options â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'ASSET_CREATED',      label: 'Asset Created'    },
  { value: 'ASSET_UPDATED',      label: 'Asset Updated'    },
  { value: 'ASSET_TRANSFERRED',  label: 'Transferred'      },
  { value: 'ASSET_REPAIRED',     label: 'Repaired'         },
  { value: 'ASSET_DISPOSED',     label: 'Disposed'         },
  { value: 'MAINTENANCE_RAISED', label: 'Maintenance'      },
  { value: 'MAINTENANCE_DONE',   label: 'Maint. Done'      },
  { value: 'PROCUREMENT',        label: 'Procurement'      },
];

// â”€â”€ Stat card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card,#fff)',
      borderRadius: 12,
      padding: '14px 18px',
      border: '1px solid var(--border-color,#e5e7eb)',
      borderTop: `3px solid ${color}`,
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: `${color}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</p>
        <p style={{ margin: 0, fontWeight: 800, fontSize: '1.5rem', color, lineHeight: 1.2 }}>{value}</p>
      </div>
    </div>
  );
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function BlockchainAuditPage() {
  const { t } = useLanguage();
  const [blocks, setBlocks]         = useState<BlockchainBlock[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [animate, setAnimate]       = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ intact: boolean; total_blocks: number; message: string } | null>(null);
  const [verifying, setVerifying]   = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [seedMsg, setSeedMsg]       = useState('');
  const [offset, setOffset]         = useState(0);
  const [hasMore, setHasMore]       = useState(false);
  const [stats, setStats]           = useState({ total_events: 0, assets_created: 0, transferred: 0, disposed: 0, maintenance_raised: 0, maintenance_done: 0, procurement: 0 });
  const loadedRef = useRef(false);
  const LIMIT = 30;

  const load = useCallback(async (off = 0, filter = actionFilter) => {
    setLoading(true);
    setError('');
    try {
      const [data, statsData] = await Promise.all([
        api.getBlockchainLedger({ limit: LIMIT + 1, offset: off, action: filter || undefined }),
        off === 0 ? api.getBlockchainStats().catch(() => null) : Promise.resolve(null),
      ]);
      setHasMore(data.length > LIMIT);
      const pageBlocks = data.slice(0, LIMIT);
      setBlocks(pageBlocks);
      setOffset(off);

      if (statsData && statsData.total_events > 0) {
        // Server-side stats available
        setStats(statsData);
      } else if (off === 0) {
        // Fallback: derive from all loaded blocks (fetch all for accurate count)
        const allData = await api.getBlockchainLedger({ limit: 500, offset: 0 }).catch(() => pageBlocks);
        const count = (action: string) => allData.filter(b => b.action === action).length;
        setStats({
          total_events: allData.length,
          assets_created:   count('ASSET_CREATED'),
          transferred:      count('ASSET_TRANSFERRED'),
          disposed:         count('ASSET_DISPOSED'),
          maintenance_raised: count('MAINTENANCE_RAISED'),
          maintenance_done:   count('MAINTENANCE_DONE'),
          procurement:        count('PROCUREMENT'),
        });
      }
    } catch {
      setError('Failed to load blockchain ledger.');
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    load(0);
  }, [load]);

  useEffect(() => {
    if (!loading) {
      const id = window.requestAnimationFrame(() => setAnimate(true));
      return () => window.cancelAnimationFrame(id);
    }
    setAnimate(false);
  }, [loading]);

  async function handleVerify() {
    setVerifying(true);
    try {
      const res = await api.verifyBlockchain();
      setVerifyResult(res);
    } catch {
      setVerifyResult({ intact: false, total_blocks: 0, message: 'Verification request failed.' });
    } finally {
      setVerifying(false);
    }
  }

  function handleFilterChange(val: string) {
    setActionFilter(val);
    loadedRef.current = false;
    load(0, val);
  }

  async function handleSeedDemo() {
    setSeedingDemo(true);
    setSeedMsg('');
    try {
      const res = await api.seedBlockchainDemo();
      setSeedMsg(res.message);
      if (res.seeded) {
        loadedRef.current = false;
        await load(0);
      }
    } catch (err) {
      setSeedMsg(err instanceof Error ? err.message : 'Failed to seed demo data — check your connection.');
    } finally {
      setSeedingDemo(false);
    }
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1040, margin: '0 auto' }}>

      {/* â”€â”€ Hero header â”€â”€ */}
      <div style={{
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #06b6d4 100%)',
        borderRadius: 16, padding: '24px 28px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
        boxShadow: '0 4px 24px rgba(99,102,241,0.25)',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.3)',
          }}>
            <Link2 size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#fff' }}>
              {t('blockchainAudit', 'Blockchain Audit Trail')}
            </h1>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', marginTop: 2 }}>
              Immutable SHA-256 chained log  |  every campus asset lifecycle event
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 14px',
            color: '#fff', fontSize: '0.8rem', fontWeight: 600,
            border: '1px solid rgba(255,255,255,0.2)',
          }}>
            {stats.total_events} Blocks
          </div>
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.35)',
              borderRadius: 8, padding: '7px 16px', color: '#fff', fontWeight: 700,
              fontSize: '0.85rem', cursor: verifying ? 'not-allowed' : 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            {verifying ? <RefreshCw size={14} className="spin" /> : <ShieldCheck size={14} />}
            Verify Chain
          </button>
        </div>
      </div>

      {/* â”€â”€ Verify result banner â”€â”€ */}
      {verifyResult && (
        <div style={{
          marginBottom: 20, padding: '12px 18px', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 10,
          background: verifyResult.intact
            ? 'linear-gradient(135deg,#dcfce7,#bbf7d0)'
            : 'linear-gradient(135deg,#fee2e2,#fecaca)',
          color: verifyResult.intact ? '#166534' : '#991b1b',
          fontWeight: 600, fontSize: '0.88rem',
          border: `1px solid ${verifyResult.intact ? '#86efac' : '#fca5a5'}`,
          boxShadow: `0 2px 12px ${verifyResult.intact ? '#22c55e22' : '#ef444422'}`,
        }}>
          {verifyResult.intact
            ? <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
            : <ShieldOff size={18} style={{ color: '#dc2626', flexShrink: 0 }} />}
          <span>{verifyResult.message}</span>
          <span style={{ fontWeight: 400, fontSize: '0.8rem', opacity: 0.7 }}>({verifyResult.total_blocks} blocks checked)</span>
          <button
            type="button"
            onClick={() => setVerifyResult(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '1.1rem', lineHeight: 1 }}
          >&times;</button>
        </div>
      )}

      {/* â”€â”€ Stats grid â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Total Events"    value={stats.total_events}    color="#6366f1" icon={<Activity size={18} />} />
        <StatCard label="Assets Created"  value={stats.assets_created}  color="#22c55e" icon={<Database size={18} />} />
        <StatCard label="Transferred"     value={stats.transferred}     color="#f59e0b" icon={<RefreshCw size={18} />} />
        <StatCard label="Disposed"        value={stats.disposed}        color="#ef4444" icon={<ShieldOff size={18} />} />
      </div>

      {/* â”€â”€ Secondary stats â”€â”€ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Maintenance Raised" value={stats.maintenance_raised} color="#f97316" icon={<Activity size={18} />} />
        <StatCard label="Maintenance Done"   value={stats.maintenance_done}   color="#10b981" icon={<CheckCircle2 size={18} />} />
        <StatCard label="Procurement"        value={stats.procurement}        color="#06b6d4" icon={<ShieldCheck size={18} />} />
      </div>

      {/* â”€â”€ Controls bar â”€â”€ */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
        padding: '10px 14px',
        background: 'var(--bg-card,#fff)',
        borderRadius: 10, border: '1px solid var(--border-color,#e5e7eb)',
        flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.5, marginRight: 4 }}>Filter:</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
          {ACTION_OPTIONS.map((o) => {
            const isActive = actionFilter === o.value;
            const ac = o.value ? actionStyle(o.value) : null;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => handleFilterChange(o.value)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem',
                  fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                  border: isActive
                    ? `1.5px solid ${ac?.bg ?? '#6366f1'}`
                    : '1.5px solid var(--border-color,#e5e7eb)',
                  background: isActive
                    ? (ac ? ac.gradient : 'linear-gradient(135deg,#6366f1,#8b5cf6)')
                    : 'var(--bg-muted,#f3f4f6)',
                  color: isActive ? '#fff' : 'var(--text-muted,#6b7280)',
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => { loadedRef.current = false; load(0); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-color,#e5e7eb)',
            background: 'var(--bg-muted,#f3f4f6)', cursor: 'pointer',
            fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted,#6b7280)',
          }}
        >
          <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
        </button>
        <button
          type="button"
          onClick={handleSeedDemo}
          disabled={seedingDemo}
          title="Insert 16 realistic demo events into the blockchain (admin only, skips if data already exists)"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', borderRadius: 8,
            border: '1px solid #a5b4fc',
            background: seedingDemo ? '#e0e7ff' : '#eef2ff',
            cursor: seedingDemo ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem', fontWeight: 600, color: '#4338ca',
            whiteSpace: 'nowrap',
          }}
        >
          {seedingDemo
            ? <RefreshCw size={13} className="spin" />
            : <Database size={13} />}
          Load Demo Data
        </button>
      </div>
      {seedMsg && (
        <div style={{
          marginBottom: 16, padding: '10px 16px', borderRadius: 8, fontSize: '0.82rem',
          background: seedMsg.includes('Seeded') ? '#f0fdf4' : '#fefce8',
          border: `1px solid ${seedMsg.includes('Seeded') ? '#bbf7d0' : '#fde68a'}`,
          color: seedMsg.includes('Seeded') ? '#166534' : '#92400e',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {seedMsg.includes('Seeded')
            ? <CheckCircle2 size={14} />
            : <Activity size={14} />}
          {seedMsg}
          <button type="button" onClick={() => setSeedMsg('')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '1rem' }}>×</button>
        </div>
      )}

      {/* â”€â”€ Content â”€â”€ */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 64, opacity: 0.4 }}>
          <RefreshCw size={28} className="spin" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: 10, fontSize: '0.9rem' }}>Loading chain...</p>
        </div>
      )}

      {error && !loading && (
        <div style={{
          padding: 24, borderRadius: 12, textAlign: 'center',
          background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
        }}>
          <ShieldOff size={28} style={{ margin: '0 auto 8px', opacity: 0.7 }} />
          <p style={{ margin: 0, fontWeight: 700 }}>{error}</p>
          <p style={{ margin: '6px 0 0', fontSize: '0.8rem', opacity: 0.7 }}>
            Run the blockchain migration SQL in Supabase to enable this feature.
          </p>
        </div>
      )}

      {!loading && !error && blocks.length === 0 && (
        <div style={{
          padding: 48, borderRadius: 14, textAlign: 'center',
          background: 'var(--bg-card,#fff)', border: '2px dashed var(--border-color,#e5e7eb)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg,#eef2ff,#f5f3ff)',
            border: '1px solid #c7d2fe',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Link2 size={28} style={{ color: '#6366f1', opacity: 0.7 }} />
          </div>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>No blockchain events recorded yet</p>
          <p style={{ margin: '8px 0 24px', fontSize: '0.85rem', opacity: 0.5 }}>
            Events are recorded automatically when assets are created, updated, or disposed.<br />
            Or load demo data to explore the audit trail interface.
          </p>
          <button
            type="button"
            onClick={handleSeedDemo}
            disabled={seedingDemo}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 24px', borderRadius: 10, cursor: seedingDemo ? 'not-allowed' : 'pointer',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              border: 'none', color: '#fff', fontWeight: 700, fontSize: '0.9rem',
              boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
            }}
          >
            {seedingDemo
              ? <RefreshCw size={15} className="spin" />
              : <Database size={15} />}
            {seedingDemo ? 'Seeding demo data…' : 'Load Demo Data'}
          </button>
          <p style={{ margin: '12px 0 0', fontSize: '0.75rem', opacity: 0.4 }}>
            Inserts 16 realistic audit events (admin only · idempotent)
          </p>
        </div>
      )}

      {!loading && !error && blocks.length > 0 && (
        <>
          {/* Section label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ height: 1, flex: 1, background: 'var(--border-color,#e5e7eb)' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              Event Timeline &mdash; {offset + 1} to {offset + blocks.length}
            </span>
            <div style={{ height: 1, flex: 1, background: 'var(--border-color,#e5e7eb)' }} />
          </div>

          {/* Timeline */}
          <div style={{ paddingLeft: 4 }}>
            {blocks.map((block, i) => (
              <div
                key={block.id}
                className={`entry-animate ${animate ? 'in' : ''}`}
                style={{ '--delay': `${i * 40}ms` } as React.CSSProperties}
              >
                <BlockCard block={block} isLast={i === blocks.length - 1} />
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 20, padding: '10px 16px',
            background: 'var(--bg-card,#fff)', borderRadius: 10,
            border: '1px solid var(--border-color,#e5e7eb)',
          }}>
            <button
              type="button"
              onClick={() => load(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
                border: '1px solid var(--border-color,#e5e7eb)',
                background: offset === 0 ? 'var(--bg-muted,#f3f4f6)' : 'var(--bg-card,#fff)',
                color: offset === 0 ? 'var(--text-muted,#9ca3af)' : 'var(--text-primary)',
                cursor: offset === 0 ? 'not-allowed' : 'pointer',
              }}
            ><ChevronLeft size={15} /> Previous</button>
            <span style={{ fontSize: '0.8rem', opacity: 0.5, fontWeight: 600 }}>
              Blocks {offset + 1} &ndash; {offset + blocks.length}
            </span>
            <button
              type="button"
              onClick={() => load(offset + LIMIT)}
              disabled={!hasMore}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
                border: '1px solid var(--border-color,#e5e7eb)',
                background: !hasMore ? 'var(--bg-muted,#f3f4f6)' : 'var(--bg-card,#fff)',
                color: !hasMore ? 'var(--text-muted,#9ca3af)' : 'var(--text-primary)',
                cursor: !hasMore ? 'not-allowed' : 'pointer',
              }}
            >Next <ChevronRight size={15} /></button>
          </div>
        </>
      )}
    </div>
  );
}
