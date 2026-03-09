/**
 * RFIDTracker.tsx
 * ───────────────
 * RFID Feature 1: Simulate an RFID reader scan (movement tracking).
 * RFID Feature 2: Unauthorized movement alert panel (live feed).
 * RFID Feature 3: Usage session start/stop.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Play, RefreshCw, Square, Wifi } from 'lucide-react';
import { api, type RfidTag, type RfidMovement, type UsageSession } from '../../services/api';

// ── Demo RFID tags for the simulation dropdown ───────────────────────────────
// We load them from the DB; if empty we show a text field
export default function RFIDTracker() {
  const [tags, setTags]               = useState<RfidTag[]>([]);
  const [selectedTag, setSelectedTag] = useState('');
  const [customTag, setCustomTag]     = useState('');
  const [location, setLocation]       = useState('');
  const [scanning, setScanning]       = useState(false);
  const [lastScan, setLastScan]       = useState<RfidMovement | null>(null);
  const [scanError, setScanError]     = useState<string | null>(null);

  // Usage session
  const [usageSessions, setUsageSessions] = useState<UsageSession[]>([]);
  const [loadingUsage, setLoadingUsage]   = useState(false);
  const [usageAssetId, setUsageAssetId]   = useState('');
  const [usageLocation, setUsageLocation] = useState('');
  const [startingSession, setStartingSession] = useState(false);
  const [endingSessionId, setEndingSessionId] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    try {
      const data = await api.getRfidTags();
      setTags(data);
      if (data.length > 0) setSelectedTag(data[0].rfid_tag);
    } catch {
      setTags([]);
    }
  }, []);

  const loadUsage = useCallback(async () => {
    setLoadingUsage(true);
    try {
      const data = await api.getUsageSessions({ limit: 20 });
      setUsageSessions(data);
    } catch {
      setUsageSessions([]);
    } finally {
      setLoadingUsage(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
    loadUsage();
  }, [loadTags, loadUsage]);

  // ── Simulate RFID scan ────────────────────────────────────────────────────
  async function handleScan() {
    const tag = customTag.trim() || selectedTag;
    if (!tag || !location.trim()) return;
    setScanning(true);
    setScanError(null);
    setLastScan(null);
    try {
      const result = await api.rfidScan({ rfid_tag: tag, reader_location: location.trim() });
      if (!result) throw new Error('No response');
      setLastScan(result);
    } catch {
      setScanError('Scan failed — tag may not be registered.');
    } finally {
      setScanning(false);
    }
  }

  // ── Usage sessions ────────────────────────────────────────────────────────
  async function handleStartSession() {
    if (!usageAssetId.trim() || !usageLocation.trim()) return;
    setStartingSession(true);
    try {
      await api.startUsageSession({ asset_id: usageAssetId.trim(), location: usageLocation.trim(), triggered_by: 'rfid' });
      setUsageAssetId('');
      setUsageLocation('');
      loadUsage();
    } catch { /* ignore */ }
    finally { setStartingSession(false); }
  }

  async function handleEndSession(id: string) {
    setEndingSessionId(id);
    try {
      await api.endUsageSession(id);
      loadUsage();
    } catch { /* ignore */ }
    finally { setEndingSessionId(null); }
  }

  const openSessions = usageSessions.filter(s => !s.end_time);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Scan simulator ── */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
        borderRadius: 12, padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontWeight: 600 }}>
          <Wifi size={16} style={{ color: '#3b82f6' }} />
          RFID Reader Simulation
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 12 }}>
          {/* Tag selector */}
          {tags.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Registered Tag</label>
              <select
                value={selectedTag}
                onChange={e => { setSelectedTag(e.target.value); setCustomTag(''); }}
                style={inputStyle}
              >
                {tags.map(t => (
                  <option key={t.id} value={t.rfid_tag}>
                    {t.rfid_tag} — {t.asset_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Or custom tag */}
          <div>
            <label style={{ display: 'block', fontSize: 12, opacity: 0.6, marginBottom: 4 }}>
              {tags.length > 0 ? 'Or custom tag' : 'RFID Tag'}
            </label>
            <input
              type="text" value={customTag}
              onChange={e => setCustomTag(e.target.value)}
              placeholder="e.g. TAG-0042"
              style={inputStyle}
            />
          </div>

          {/* Reader location */}
          <div>
            <label style={{ display: 'block', fontSize: 12, opacity: 0.6, marginBottom: 4 }}>Reader Location</label>
            <input
              type="text" value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Computer Lab A"
              style={inputStyle}
            />
          </div>
        </div>

        <button
          className="btn primary-btn"
          style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={handleScan}
          disabled={scanning || (!(customTag.trim()) && !selectedTag) || !location.trim()}
        >
          {scanning
            ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : <Wifi size={14} />}
          Simulate Scan
        </button>

        {/* Scan result */}
        {lastScan && (
          <div style={{
            marginTop: 12, padding: '12px 16px', borderRadius: 8, fontSize: 13,
            background: lastScan.is_authorized ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
            border: `1px solid ${lastScan.is_authorized ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`,
            color:  lastScan.is_authorized ? '#15803d' : '#dc2626',
          }}>
            {lastScan.is_authorized ? '✓ Movement logged' : '⚠ UNAUTHORIZED movement logged'} —{' '}
            <strong>{lastScan.asset_name}</strong>{' '}
            {lastScan.from_location ? `from "${lastScan.from_location}" ` : ''}to "{lastScan.to_location}"
          </div>
        )}

        {scanError && (
          <div style={{
            marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 13,
            background: 'rgba(239,68,68,.1)', color: '#dc2626',
          }}>
            {scanError}
          </div>
        )}
      </div>

      {/* ── Usage sessions ── */}
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
        borderRadius: 12, padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
            <Play size={16} style={{ color: '#22c55e' }} /> Usage Sessions
          </div>
          <button
            className="btn secondary-btn"
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={loadUsage}
            disabled={loadingUsage}
          >
            <RefreshCw size={12} style={loadingUsage ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
        </div>

        {/* Start session form */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <input
            type="text" value={usageAssetId}
            onChange={e => setUsageAssetId(e.target.value)}
            placeholder="Asset ID…"
            style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          />
          <input
            type="text" value={usageLocation}
            onChange={e => setUsageLocation(e.target.value)}
            placeholder="Location…"
            style={{ ...inputStyle, flex: 1, minWidth: 160 }}
          />
          <button
            className="btn primary-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            onClick={handleStartSession}
            disabled={startingSession || !usageAssetId.trim() || !usageLocation.trim()}
          >
            <Play size={13} /> Start Session
          </button>
        </div>

        {/* Open sessions */}
        {openSessions.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 6 }}>Active sessions</div>
            {openSessions.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 8, marginBottom: 6,
                background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)',
                fontSize: 13,
              }}>
                <span>
                  <strong>{s.asset_name}</strong>{' '}
                  <span style={{ opacity: 0.55 }}>@ {s.location}</span>
                </span>
                <button
                  className="btn secondary-btn"
                  style={{ padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
                  onClick={() => handleEndSession(s.id)}
                  disabled={endingSessionId === s.id}
                >
                  <Square size={11} /> End
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Recent sessions table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['Asset', 'Location', 'Start', 'End', 'Duration', 'Triggered'].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, opacity: 0.7 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usageSessions.slice(0, 10).map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={tdStyle}>{s.asset_name}</td>
                  <td style={tdStyle}>{s.location}</td>
                  <td style={tdStyle}>{fmtDate(s.start_time)}</td>
                  <td style={tdStyle}>{s.end_time ? fmtDate(s.end_time) : <span style={{ color: '#22c55e', fontWeight: 600 }}>Active</span>}</td>
                  <td style={tdStyle}>{s.duration_minutes != null ? `${s.duration_minutes} min` : '—'}</td>
                  <td style={tdStyle}>{s.triggered_by}</td>
                </tr>
              ))}
              {usageSessions.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 20, textAlign: 'center', opacity: 0.4, fontSize: 13 }}>
                    No usage sessions yet
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

// ── Styles ────────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-surface)', color: 'var(--text-primary)',
  fontSize: 13, boxSizing: 'border-box',
};

const tdStyle: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'top' };

function fmtDate(d: string) {
  return new Date(d).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
