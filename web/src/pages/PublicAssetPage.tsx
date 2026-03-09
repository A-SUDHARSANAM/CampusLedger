/**
 * PublicAssetPage — accessible without login.
 * Shown when a phone/browser scans a CampusLedger QR code.
 * Route: /public/asset/:id
 */
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface PublicAsset {
  id: string;
  asset_name: string;
  status: string;
  category: string | null;
  lab_name: string | null;
  location_name: string | null;
  serial_number: string | null;
  condition_rating: number | null;
  condition_notes: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active:      '#22c55e',
  maintenance: '#f59e0b',
  retired:     '#ef4444',
  reserved:    '#3b82f6',
};

export default function PublicAssetPage() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<PublicAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setError('Invalid QR code — no asset ID.'); setLoading(false); return; }
    fetch(`/api/v1/qr-track/public/asset/${encodeURIComponent(id)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || `Error ${res.status}`);
        }
        return res.json() as Promise<PublicAsset>;
      })
      .then((data) => { setAsset(data); setLoading(false); })
      .catch((e: Error) => { setError(e.message); setLoading(false); });
  }, [id]);

  const statusColor = asset ? (STATUS_COLORS[asset.status] ?? '#6b7280') : '#6b7280';

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.logo}>CampusLedger</span>
          <span style={styles.subtitle}>Asset Information</span>
        </div>

        {loading && (
          <div style={styles.center}>
            <div style={styles.spinner} />
            <p style={styles.loadingText}>Loading asset…</p>
          </div>
        )}

        {error && !loading && (
          <div style={styles.errorBox}>
            <span style={styles.errorIcon}>⚠</span>
            <p style={styles.errorText}>{error}</p>
          </div>
        )}

        {asset && !loading && (
          <>
            <h1 style={styles.assetName}>{asset.asset_name}</h1>

            <span style={{ ...styles.statusBadge, background: statusColor }}>
              {asset.status.toUpperCase()}
            </span>

            <div style={styles.grid}>
              {asset.category && <InfoRow label="Category" value={asset.category} />}
              {asset.lab_name && <InfoRow label="Lab" value={asset.lab_name} />}
              {asset.location_name && <InfoRow label="Location" value={asset.location_name} />}
              {asset.serial_number && <InfoRow label="Serial No." value={asset.serial_number} />}
              {asset.condition_rating != null && (
                <InfoRow label="Condition" value={`${asset.condition_rating} / 5`} />
              )}
              {asset.condition_notes && <InfoRow label="Notes" value={asset.condition_notes} />}
            </div>

            <p style={styles.footer}>
              Scanned via CampusLedger QR · This information is read-only
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.row}>
      <span style={styles.rowLabel}>{label}</span>
      <span style={styles.rowValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    fontFamily: "'Inter', sans-serif",
  },
  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '1rem',
    padding: '2rem',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    paddingBottom: '1rem',
    borderBottom: '1px solid #334155',
  },
  logo: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#38bdf8',
    letterSpacing: '0.05em',
  },
  subtitle: {
    fontSize: '0.8rem',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  assetName: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#f1f5f9',
    margin: '0 0 0.75rem',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.7rem',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.08em',
    marginBottom: '1.5rem',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.6rem 0.75rem',
    background: '#0f172a',
    borderRadius: '0.5rem',
  },
  rowLabel: {
    fontSize: '0.8rem',
    color: '#64748b',
    fontWeight: 500,
  },
  rowValue: {
    fontSize: '0.85rem',
    color: '#e2e8f0',
    fontWeight: 600,
    maxWidth: '60%',
    textAlign: 'right',
  },
  footer: {
    fontSize: '0.7rem',
    color: '#475569',
    textAlign: 'center',
    marginTop: '1.5rem',
    paddingTop: '1rem',
    borderTop: '1px solid #334155',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '2rem 0',
  },
  spinner: {
    width: '2rem',
    height: '2rem',
    border: '3px solid #334155',
    borderTop: '3px solid #38bdf8',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: {
    marginTop: '0.75rem',
    color: '#64748b',
    fontSize: '0.9rem',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '0.5rem',
    padding: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  errorIcon: {
    fontSize: '1.25rem',
    color: '#ef4444',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: '0.9rem',
    margin: 0,
  },
};
