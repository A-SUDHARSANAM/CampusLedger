import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Link2, RefreshCw, ShieldCheck, ShieldOff } from 'lucide-react';
import { api, type BlockchainBlock } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

// ── Action colour map ─────────────────────────────────────────────────────────
const ACTION_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  CHAIN_INIT:          { bg: '#64748b', text: '#fff', label: 'Chain Init'       },
  ASSET_CREATED:       { bg: '#22c55e', text: '#fff', label: 'Asset Created'    },
  ASSET_UPDATED:       { bg: '#3b82f6', text: '#fff', label: 'Asset Updated'    },
  ASSET_TRANSFERRED:   { bg: '#f59e0b', text: '#fff', label: 'Transferred'      },
  ASSET_REPAIRED:      { bg: '#a855f7', text: '#fff', label: 'Repaired'         },
  ASSET_DISPOSED:      { bg: '#ef4444', text: '#fff', label: 'Disposed'         },
  MAINTENANCE_RAISED:  { bg: '#f97316', text: '#fff', label: 'Maintenance'      },
  MAINTENANCE_DONE:    { bg: '#10b981', text: '#fff', label: 'Maint. Done'      },
  PROCUREMENT:         { bg: '#06b6d4', text: '#fff', label: 'Procurement'      },
};

function actionStyle(action: string) {
  return ACTION_COLORS[action] ?? { bg: '#6b7280', text: '#fff', label: action };
}

// ── Truncate hash for display ─────────────────────────────────────────────────
function shortHash(h: string) {
  if (!h || h.length < 16) return h;
  return `${h.slice(0, 8)}...${h.slice(-8)}`;
}

// ── Single block row ──────────────────────────────────────────────────────────
function BlockRow({ block }: { block: BlockchainBlock }) {
  const [expanded, setExpanded] = useState(false);
  const st = actionStyle(block.action);

  const date = block.created_at
    ? new Date(block.created_at).toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

  return (
    <div
      style={{
        borderLeft: `4px solid ${st.bg}`,
        background: 'var(--bg-card, #fff)',
        borderRadius: 8,
        marginBottom: 8,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '44px 1fr 140px 160px auto',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--text-primary)',
        }}
      >
        {/* Block index */}
        <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', opacity: 0.55 }}>
          #{block.block_index}
        </span>

        {/* Asset + action */}
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem' }}>{block.asset_name}</p>
          <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.6 }}>{block.asset_id !== 'GENESIS' ? block.asset_id.slice(0, 18) + '…' : 'GENESIS'}</p>
        </div>

        {/* Action badge */}
        <span style={{
          display: 'inline-block',
          background: st.bg,
          color: st.text,
          borderRadius: 20,
          padding: '2px 10px',
          fontSize: '0.72rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
        }}>
          {st.label}
        </span>

        {/* Timestamp */}
        <span style={{ fontSize: '0.78rem', opacity: 0.6 }}>{date}</span>

        {/* Expand icon */}
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding: '0 14px 12px 14px',
          borderTop: '1px solid var(--border-color, #f0f0f0)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: '0.8rem',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <p style={{ margin: 0, opacity: 0.55 }}>Performed By</p>
              <p style={{ margin: 0, fontWeight: 600 }}>{block.performed_by}</p>
            </div>
            <div>
              <p style={{ margin: 0, opacity: 0.55 }}>Block Index</p>
              <p style={{ margin: 0, fontWeight: 600, fontFamily: 'monospace' }}>{block.block_index}</p>
            </div>
          </div>

          {/* Hash chain */}
          <div style={{ background: 'var(--bg-muted-2, #f8fafc)', borderRadius: 6, padding: '8px 10px' }}>
            <p style={{ margin: '0 0 4px', opacity: 0.55, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Link2 size={11} /> Block Hash
            </p>
            <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', color: '#22c55e', fontWeight: 700 }}>
              {block.block_hash}
            </p>
            <p style={{ margin: '6px 0 4px', opacity: 0.55, fontSize: '0.75rem' }}>Previous Hash</p>
            <p style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all', opacity: 0.7 }}>
              {block.prev_hash}
            </p>
          </div>

          {/* Extra data */}
          {block.block_data && Object.keys(block.block_data).length > 0 && (
            <div style={{ background: 'var(--bg-muted-2, #f8fafc)', borderRadius: 6, padding: '8px 10px' }}>
              <p style={{ margin: '0 0 4px', opacity: 0.55, fontSize: '0.75rem' }}>Block Data</p>
              <pre style={{ margin: 0, fontSize: '0.72rem', opacity: 0.8, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(block.block_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
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

// ── Page ──────────────────────────────────────────────────────────────────────
export function BlockchainAuditPage() {
  const { t } = useLanguage();
  const [blocks, setBlocks]         = useState<BlockchainBlock[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [animate, setAnimate]       = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [verifyResult, setVerifyResult] = useState<{ intact: boolean; total_blocks: number; message: string } | null>(null);
  const [verifying, setVerifying]   = useState(false);
  const [offset, setOffset]         = useState(0);
  const [hasMore, setHasMore]       = useState(false);
  const loadedRef                   = useRef(false);
  const LIMIT = 30;

  const load = useCallback(async (off = 0, filter = actionFilter) => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getBlockchainLedger({ limit: LIMIT + 1, offset: off, action: filter || undefined });
      setHasMore(data.length > LIMIT);
      setBlocks(data.slice(0, LIMIT));
      setOffset(off);
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

  const stats = {
    total: blocks.length + (offset),
    created:  blocks.filter((b) => b.action === 'ASSET_CREATED').length,
    transferred: blocks.filter((b) => b.action === 'ASSET_TRANSFERRED').length,
    disposed: blocks.filter((b) => b.action === 'ASSET_DISPOSED').length,
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto' }}>
      {/* ── Page header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Link2 size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800 }}>
              {t('blockchainAudit', 'Blockchain Audit Trail')}
            </h1>
            <p style={{ margin: 0, opacity: 0.55, fontSize: '0.85rem' }}>
              Immutable SHA-256 chained log of every campus asset lifecycle event
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Events',  value: blocks.length,         color: '#6366f1' },
          { label: 'Assets Created', value: stats.created,        color: '#22c55e' },
          { label: 'Transferred',   value: stats.transferred,     color: '#f59e0b' },
          { label: 'Disposed',      value: stats.disposed,        color: '#ef4444' },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: '12px 16px', borderLeft: `4px solid ${s.color}` }}>
            <p style={{ margin: 0, opacity: 0.55, fontSize: '0.75rem' }}>{s.label}</p>
            <p style={{ margin: 0, fontWeight: 800, fontSize: '1.4rem', color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Controls ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={actionFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          style={{
            padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border-color)',
            background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.85rem',
          }}
        >
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          type="button"
          className="btn secondary-btn"
          onClick={() => { loadedRef.current = false; load(0); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh
        </button>

        <button
          type="button"
          className="btn primary-btn"
          onClick={handleVerify}
          disabled={verifying}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}
        >
          {verifying ? <RefreshCw size={14} className="spin" /> : <ShieldCheck size={14} />}
          Verify Chain Integrity
        </button>
      </div>

      {/* ── Verify result banner ── */}
      {verifyResult && (
        <div style={{
          marginBottom: 16,
          padding: '10px 16px',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: verifyResult.intact ? '#dcfce7' : '#fee2e2',
          color:      verifyResult.intact ? '#166534' : '#991b1b',
          fontWeight: 600,
          fontSize: '0.88rem',
        }}>
          {verifyResult.intact
            ? <CheckCircle2 size={16} />
            : <ShieldOff size={16} />}
          {verifyResult.message}
          <span style={{ fontWeight: 400, fontSize: '0.8rem', opacity: 0.8 }}>
            ({verifyResult.total_blocks} blocks)
          </span>
          <button
            type="button"
            onClick={() => setVerifyResult(null)}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '1rem' }}
          >×</button>
        </div>
      )}

      {/* ── Content ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 48, opacity: 0.5 }}>
          <RefreshCw size={24} className="spin" />
          <p style={{ marginTop: 8 }}>Loading chain…</p>
        </div>
      )}

      {error && !loading && (
        <div className="card" style={{ padding: 20, color: '#ef4444', textAlign: 'center' }}>
          {error}
          <br />
          <small style={{ opacity: 0.7 }}>
            Run the blockchain migration SQL in Supabase to enable this feature.
          </small>
        </div>
      )}

      {!loading && !error && blocks.length === 0 && (
        <div className="card" style={{ padding: 32, textAlign: 'center', opacity: 0.55 }}>
          <Link2 size={32} style={{ margin: '0 auto 8px' }} />
          <p>No blockchain events recorded yet.</p>
          <p style={{ fontSize: '0.82rem' }}>Events are recorded automatically when assets are created, updated, or disposed.</p>
        </div>
      )}

      {!loading && !error && blocks.length > 0 && (
        <>
          {/* Chain legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {Object.values(ACTION_COLORS).map((a) => (
              <span key={a.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: a.bg, color: a.text,
                borderRadius: 20, padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700,
              }}>{a.label}</span>
            ))}
          </div>

          {blocks.map((block) => (
            <div
              key={block.id}
              className={`entry-animate ${animate ? 'in' : ''}`}
              style={{ '--delay': '0ms' } as React.CSSProperties}
            >
              <BlockRow block={block} />
            </div>
          ))}

          {/* Pagination */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <button
              type="button"
              className="btn secondary-btn"
              disabled={offset === 0}
              onClick={() => load(Math.max(0, offset - LIMIT))}
            >← Previous</button>
            <span style={{ fontSize: '0.82rem', opacity: 0.6 }}>
              Showing blocks {offset + 1}–{offset + blocks.length}
            </span>
            <button
              type="button"
              className="btn secondary-btn"
              disabled={!hasMore}
              onClick={() => load(offset + LIMIT)}
            >Next →</button>
          </div>
        </>
      )}
    </div>
  );
}
