/**
 * QRScanner.tsx
 * ─────────────
 * QR Feature 1: Identify an asset by scanning its QR code.
 * QR Feature 2: Quick maintenance report link (pre-fills asset_id).
 * QR Feature 3: Audit verification scan.
 *
 * Supports:
 *  - Manual asset-ID entry (for demo / keyboard input)
 *  - File / camera capture decoded via jsQR
 */
import React, { useRef, useState } from 'react';
import { Camera, CheckCircle2, ClipboardList, QrCode, RefreshCw, Search } from 'lucide-react';
import { api, type AssetIdentifyResult, type VerificationLog } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

interface Props {
  /** Called to open QR maintenance modal in parent */
  onOpenMaintenance?: (assetId: string, assetName: string) => void;
}

export default function QRScanner({ onOpenMaintenance }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [manualId, setManualId]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [asset, setAsset]             = useState<AssetIdentifyResult | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [verifyLog, setVerifyLog]     = useState<VerificationLog | null>(null);
  const [verifying, setVerifying]     = useState(false);
  const [verifyLocation, setVerifyLocation] = useState('');

  // ── Decode from file capture ──────────────────────────────────────────────
  function handleFileCapture(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        try {
          // Dynamic import so jsqr resolves at runtime after npm install
          const jsQRModule = await import('jsqr');
          const jsQR = jsQRModule.default ?? jsQRModule;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const code = (jsQR as any)(imageData.data, imageData.width, imageData.height);
          if (!code) { setError('No QR code detected. Try a clearer photo.'); return; }
          let decoded: string = code.data;
          // 1. Try legacy JSON format: {"asset_id": "..."}
          try {
            const parsed = JSON.parse(decoded);
            if (parsed.asset_id) decoded = parsed.asset_id;
          } catch {
            // 2. Try URL format: .../public/asset/{uuid}  (current QR encoding)
            const urlMatch = decoded.match(/\/public\/asset\/([^/?#\s]+)/i);
            if (urlMatch) decoded = urlMatch[1];
            // 3. Otherwise use raw string as-is (plain UUID or manual entry)
          }
          lookupAsset(decoded.trim());
        } catch {
          setError('QR library not available. Please run npm install in the web directory.');
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    // reset so same file can re-trigger
    e.target.value = '';
  }

  // ── Identify asset by ID ──────────────────────────────────────────────────
  async function lookupAsset(id: string) {
    if (!id) return;
    setLoading(true);
    setError(null);
    setAsset(null);
    setVerifyLog(null);
    try {
      const result = await api.identifyAsset(id);
      if (!result) { setError('Asset not found.'); return; }
      setAsset(result);
    } catch {
      setError('Failed to identify asset. Check the ID and try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleManualSearch(e: React.FormEvent) {
    e.preventDefault();
    lookupAsset(manualId.trim());
  }

  // ── Audit verification scan ───────────────────────────────────────────────
  async function handleVerify() {
    if (!asset) return;
    setVerifying(true);
    try {
      const log = await api.verifyAsset({
        asset_id:    asset.asset_id,
        verified_by: user?.email ?? 'admin',
        location:    verifyLocation || (asset.location_name ?? 'Unknown'),
        scan_method: 'qr',
        notes:       'QR code scan via admin panel',
      });
      setVerifyLog(log);
    } catch {
      setError('Verification failed.');
    } finally {
      setVerifying(false);
    }
  }

  function reset() {
    setAsset(null);
    setError(null);
    setVerifyLog(null);
    setManualId('');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Input row ── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>

        {/* Camera / file capture */}
        <button
          className="btn secondary-btn"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => fileRef.current?.click()}
          disabled={loading}
        >
          <Camera size={16} />
          Scan QR Code
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFileCapture}
        />

        {/* Manual entry */}
        <form onSubmit={handleManualSearch} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 260 }}>
          <input
            type="text"
            value={manualId}
            onChange={e => setManualId(e.target.value)}
            placeholder="Enter Asset ID manually…"
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-surface)', color: 'var(--text-primary)',
              fontSize: 14,
            }}
          />
          <button type="submit" className="btn primary-btn" disabled={loading || !manualId.trim()}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
            Identify
          </button>
        </form>

        {asset && (
          <button className="btn secondary-btn" onClick={reset}>
            Clear
          </button>
        )}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: 8,
          background: 'rgba(239,68,68,.1)', color: '#ef4444',
          border: '1px solid rgba(239,68,68,.25)', fontSize: 14,
        }}>
          {error}
        </div>
      )}

      {/* ── Asset result card ── */}
      {asset && (
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border-color)',
          borderRadius: 12, padding: 24, display: 'flex', gap: 24, flexWrap: 'wrap',
        }}>
          {/* QR code thumbnail */}
          {asset.qr_code_b64 && (
            <img
              src={`data:image/png;base64,${asset.qr_code_b64}`}
              alt="QR code"
              style={{ width: 100, height: 100, borderRadius: 8, flexShrink: 0 }}
            />
          )}
          {!asset.qr_code_b64 && (
            <div style={{
              width: 100, height: 100, borderRadius: 8, flexShrink: 0,
              background: 'var(--bg-muted)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', opacity: 0.4,
            }}>
              <QrCode size={40} />
            </div>
          )}

          {/* Asset details */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{asset.asset_name}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: '6px 16px', fontSize: 13 }}>
              <Detail label="Category"     value={asset.category_name} />
              <Detail label="Status"       value={asset.status} />
              <Detail label="Lab"          value={asset.lab_name} />
              <Detail label="Location"     value={asset.location_name} />
              <Detail label="Serial No."   value={asset.serial_number} />
            </div>
            {asset.condition_notes && (
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>Notes: {asset.condition_notes}</div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>

            {/* Verify / audit */}
            {!verifyLog ? (
              <>
                <input
                  type="text"
                  placeholder="Verification location…"
                  value={verifyLocation}
                  onChange={e => setVerifyLocation(e.target.value)}
                  style={{
                    padding: '7px 10px', borderRadius: 7, fontSize: 12,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-surface)', color: 'var(--text-primary)',
                  }}
                />
                <button
                  className="btn primary-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                  onClick={handleVerify}
                  disabled={verifying}
                >
                  {verifying
                    ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : <CheckCircle2 size={14} />}
                  Verify (Audit)
                </button>
              </>
            ) : (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 8,
                background: 'rgba(34,197,94,.12)', color: '#15803d', fontSize: 13,
              }}>
                <CheckCircle2 size={14} /> Verified &amp; logged
              </div>
            )}

            {/* Quick maintenance */}
            {onOpenMaintenance && (
              <button
                className="btn secondary-btn"
                style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                onClick={() => onOpenMaintenance(asset.asset_id, asset.asset_name)}
              >
                <ClipboardList size={14} />
                Report Issue
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <span style={{ opacity: 0.55, marginRight: 4 }}>{label}:</span>
      <span style={{ fontWeight: 500 }}>{value}</span>
    </div>
  );
}
