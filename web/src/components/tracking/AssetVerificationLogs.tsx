/**
 * AssetVerificationLogs.tsx
 * ─────────────────────────
 * QR Feature 3: Table of asset_verification_logs (QR/manual audit scans).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { api, type VerificationLog } from '../../services/api';

const METHOD_STYLE: Record<string, { bg: string; color: string }> = {
  qr:     { bg: 'rgba(59,130,246,.12)',  color: '#2563eb' },
  rfid:   { bg: 'rgba(168,85,247,.12)',  color: '#7c3aed' },
  manual: { bg: 'rgba(100,116,139,.12)', color: '#475569' },
};

export default function AssetVerificationLogs() {
  const [logs, setLogs]       = useState<VerificationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [assetFilter, setAssetFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getVerificationLogs({
        asset_id: assetFilter.trim() || undefined,
        limit: 100,
      });
      setLogs(data);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [assetFilter]);

  useEffect(() => { load(); }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <ShieldCheck size={16} style={{ color: '#3b82f6' }} />
          Verification Audit Log
        </div>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <input
            type="text"
            value={assetFilter}
            onChange={e => setAssetFilter(e.target.value)}
            placeholder="Filter by asset ID…"
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 13,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)', color: 'var(--text-primary)',
              width: 220,
            }}
          />
          <button type="submit" className="btn secondary-btn" style={{ padding: '6px 12px' }}>Filter</button>
        </form>
        <button
          className="btn secondary-btn"
          style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
        </button>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted, var(--bg-surface))', borderBottom: '1px solid var(--border-color)' }}>
                {['Asset', 'Verified by', 'Location', 'Method', 'Notes', 'Time'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, opacity: 0.7 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(l => {
                const ms = METHOD_STYLE[l.scan_method] ?? METHOD_STYLE.manual;
                return (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={td}><strong>{l.asset_name}</strong></td>
                    <td style={td}>{l.verified_by}</td>
                    <td style={td}>{l.location}</td>
                    <td style={td}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 99,
                        fontSize: 11, fontWeight: 600,
                        background: ms.bg, color: ms.color,
                      }}>
                        {l.scan_method.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ ...td, opacity: 0.6, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.notes ?? '—'}
                    </td>
                    <td style={{ ...td, opacity: 0.6 }}>{fmtDate(l.created_at)}</td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: 'center', opacity: 0.4 }}>
                    {loading ? 'Loading…' : 'No verification logs yet'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const td: React.CSSProperties = { padding: '10px 14px', verticalAlign: 'top' };

function fmtDate(d: string) {
  return new Date(d).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
