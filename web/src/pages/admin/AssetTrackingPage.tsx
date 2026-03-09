/**
 * AssetTrackingPage.tsx
 * ──────────────────────
 * Admin page combining:
 *   Tab 1 — QR Scanner   (Feature 1 + 3: identify & verify)
 *   Tab 2 — RFID Tracker (Feature 1 + 2 + 3: simulate scan, alerts, usage)
 *   Tab 3 — Movement Log (RFID movement history + unauthorized alerts)
 *   Tab 4 — Verifications (QR/RFID/manual audit log)
 *   Tab 5 — RFID Tags     (register & manage tag → asset mapping)
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode, Radio, MapPin, ShieldCheck, Tag, Plus, RefreshCw } from 'lucide-react';
import QRScanner from '../../components/tracking/QRScanner';
import RFIDTracker from '../../components/tracking/RFIDTracker';
import AssetMovementPanel from '../../components/tracking/AssetMovementPanel';
import AssetVerificationLogs from '../../components/tracking/AssetVerificationLogs';
import { api, type RfidTag } from '../../services/api';

// ── Quick Maintenance Modal ─────────────────────────────────────────────────
type MaintModal = { assetId: string; assetName: string } | null;

function MaintenanceQuickModal({ modal, onClose }: { modal: MaintModal; onClose: () => void }) {
  const navigate = useNavigate();
  if (!modal) return null;
  const { assetId, assetName } = modal;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9000,
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
        borderRadius: 14, padding: 28, width: 380, maxWidth: '90vw',
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 16 }}>Report Issue — {assetName}</h3>
        <p style={{ margin: '0 0 18px 0', fontSize: 13, opacity: 0.65 }}>
          To submit a maintenance request for this asset, go to the Maintenance page
          and reference asset ID: <code style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{assetId}</code>
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn secondary-btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary-btn"
            onClick={() => { onClose(); navigate('/admin/maintenance'); }}
          >
            Go to Maintenance
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RFID Tags Management Tab ─────────────────────────────────────────────────
function TagsTab() {
  const [tags, setTags]         = useState<RfidTag[]>([]);
  const [loading, setLoading]   = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rfidTag, setRfidTag]   = useState('');
  const [assetId, setAssetId]   = useState('');
  const [assetName, setAssetName] = useState('');
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getRfidTags();
      setTags(data);
    } catch {
      setTags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      await api.registerRfidTag({ rfid_tag: rfidTag.trim(), asset_id: assetId.trim(), asset_name: assetName.trim() || undefined });
      setRfidTag(''); setAssetId(''); setAssetName('');
      setShowForm(false);
      load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed.';
      setErr(msg.includes('already') || msg.includes('409') ? 'This RFID tag is already registered.' : msg || 'Registration failed — check Asset ID and tag uniqueness.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <Tag size={16} style={{ color: '#a855f7' }} />
          RFID Tag Registry
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn secondary-btn" onClick={load} disabled={loading} style={{ padding: '6px 12px' }}>
            <RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : undefined} />
          </button>
          <button
            className="btn primary-btn"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setShowForm(v => !v)}
          >
            <Plus size={14} /> Register Tag
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleRegister} style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
          borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Register New RFID Tag</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
            <Field label="RFID Tag" value={rfidTag} onChange={setRfidTag} placeholder="TAG-0001" required />
            <Field label="Asset ID (UUID)" value={assetId} onChange={setAssetId} placeholder="xxxxxxxx-xxxx-…" required />
            <Field label="Asset Name (optional)" value={assetName} onChange={setAssetName} placeholder="Laptop #12" />
          </div>
          {err && <div style={{ color: '#ef4444', fontSize: 13 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" className="btn primary-btn" disabled={saving}>
              {saving ? 'Registering…' : 'Register'}
            </button>
            <button type="button" className="btn secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {['RFID Tag', 'Asset', 'Asset ID', 'Active', 'Registered'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, opacity: 0.7 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tags.map(t => (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{t.rfid_tag}</td>
                  <td style={{ padding: '10px 14px' }}>{t.asset_name}</td>
                  <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 11, opacity: 0.6 }}>
                    {t.asset_id ? `${t.asset_id.slice(0, 18)}…` : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: 11,
                      background: t.is_active ? 'rgba(34,197,94,.12)' : 'rgba(100,116,139,.12)',
                      color: t.is_active ? '#15803d' : '#6b7280',
                    }}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', opacity: 0.6 }}>
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
              {tags.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: 'center', opacity: 0.4 }}>
                    {loading ? 'Loading…' : 'No RFID tags registered yet'}
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

function Field({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, opacity: 0.6, marginBottom: 4 }}>{label}</label>
      <input
        type="text" value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        style={{
          width: '100%', padding: '7px 10px', borderRadius: 7, fontSize: 13,
          border: '1px solid var(--border-color)',
          background: 'var(--bg-surface)', color: 'var(--text-primary)',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// ── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'qr',            label: 'QR Scanner',    icon: QrCode      },
  { id: 'rfid',          label: 'RFID Tracker',  icon: Radio       },
  { id: 'movements',     label: 'Movements',     icon: MapPin      },
  { id: 'verifications', label: 'Verifications', icon: ShieldCheck },
  { id: 'tags',          label: 'RFID Tags',     icon: Tag         },
] as const;

type TabId = typeof TABS[number]['id'];

// ── Main page ────────────────────────────────────────────────────────────────
export default function AssetTrackingPage() {
  const [tab, setTab]           = useState<TabId>('qr');
  const [animate, setAnimate]   = useState(false);
  const [maintModal, setMaintModal] = useState<MaintModal>(null);

  // Trigger slide-in animation on tab change (also fires on initial mount)
  useEffect(() => {
    setAnimate(false);
    const t = setTimeout(() => setAnimate(true), 16);
    return () => clearTimeout(t);
  }, [tab]);

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <QrCode size={22} style={{ color: 'var(--accent-primary, #4F6EF7)' }} />
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>QR &amp; RFID Asset Tracking</h1>
        </div>
        <p style={{ margin: 0, opacity: 0.55, fontSize: 13 }}>
          Automated tracking — scan QR codes to identify assets, simulate RFID reader events, monitor movement and verify asset locations.
        </p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, borderBottom: '1px solid var(--border-color)',
        marginBottom: 24, overflowX: 'auto',
      }}>
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? 'var(--accent-primary, #4F6EF7)' : 'var(--text-primary)',
                borderBottom: tab === t.id ? '2px solid var(--accent-primary, #4F6EF7)' : '2px solid transparent',
                whiteSpace: 'nowrap', transition: 'color .15s',
              }}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className={`entry-animate ${animate ? 'in' : ''}`}>
        {tab === 'qr'            && <QRScanner onOpenMaintenance={(id, name) => setMaintModal({ assetId: id, assetName: name })} />}
        {tab === 'rfid'          && <RFIDTracker />}
        {tab === 'movements'     && <AssetMovementPanel />}
        {tab === 'verifications' && <AssetVerificationLogs />}
        {tab === 'tags'          && <TagsTab />}
      </div>

      {/* Quick maintenance overlay */}
      <MaintenanceQuickModal modal={maintModal} onClose={() => setMaintModal(null)} />
    </div>
  );
}
