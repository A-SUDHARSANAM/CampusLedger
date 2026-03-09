/**
 * AssetMovementPanel.tsx
 * ──────────────────────
 * RFID Feature 1 & 2: Shows RFID movement history + unauthorized alerts.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { api, type RfidMovement } from '../../services/api';

export default function AssetMovementPanel() {
  const [movements, setMovements]     = useState<RfidMovement[]>([]);
  const [loading, setLoading]         = useState(false);
  const [filter, setFilter]           = useState<'all' | 'alerts'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getRfidMovements({
        unauthorized_only: filter === 'alerts',
        limit: 100,
      });
      setMovements(data);
    } catch {
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const alertCount = movements.filter(m => !m.is_authorized).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`btn ${filter === 'all' ? 'primary-btn' : 'secondary-btn'}`}
            style={{ padding: '6px 14px', fontSize: 13 }}
            onClick={() => setFilter('all')}
          >
            All Movements
          </button>
          <button
            className={`btn ${filter === 'alerts' ? 'primary-btn' : 'secondary-btn'}`}
            style={{ padding: '6px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={() => setFilter('alerts')}
          >
            <AlertTriangle size={13} />
            Alerts {alertCount > 0 && filter !== 'alerts' && (
              <span style={{
                background: '#ef4444', color: '#fff',
                borderRadius: 99, fontSize: 10, padding: '1px 6px', marginLeft: 2,
              }}>
                {alertCount}
              </span>
            )}
          </button>
        </div>
        <button
          className="btn secondary-btn"
          style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
          Refresh
        </button>
      </div>

      {/* Unauthorized banner */}
      {filter === 'all' && alertCount > 0 && (
        <div style={{
          padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: 'rgba(239,68,68,.1)', color: '#dc2626',
          border: '1px solid rgba(239,68,68,.25)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={15} />
          {alertCount} unauthorized movement{alertCount > 1 ? 's' : ''} detected.
        </div>
      )}

      {/* Table */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted, var(--bg-surface))', borderBottom: '1px solid var(--border-color)' }}>
                {['Asset', 'RFID Tag', 'From', 'To', 'Status', 'Time'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, opacity: 0.7 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr
                  key={m.id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    background: m.is_authorized ? undefined : 'rgba(239,68,68,.04)',
                  }}
                >
                  <td style={td}><strong>{m.asset_name}</strong></td>
                  <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>{m.rfid_tag}</td>
                  <td style={{ ...td, opacity: 0.65 }}>{m.from_location ?? '—'}</td>
                  <td style={td}>{m.to_location}</td>
                  <td style={td}>
                    {m.is_authorized ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 99, fontSize: 11,
                        background: 'rgba(34,197,94,.12)', color: '#15803d',
                      }}>
                        <CheckCircle2 size={10} /> Authorized
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 99, fontSize: 11,
                        background: 'rgba(239,68,68,.12)', color: '#dc2626',
                      }}>
                        <AlertTriangle size={10} /> ALERT
                      </span>
                    )}
                  </td>
                  <td style={{ ...td, opacity: 0.6 }}>{fmtDate(m.created_at)}</td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 24, textAlign: 'center', opacity: 0.4 }}>
                    {loading ? 'Loading…' : 'No movement records'}
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
