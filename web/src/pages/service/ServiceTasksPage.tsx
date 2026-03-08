import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QrCode, ScanLine, X } from 'lucide-react';
import { DataTable, type TableColumn } from '../../components/tables';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import type { MaintenanceRequest, MaintenanceStatus } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

// ─── QR scan helpers ──────────────────────────────────────────────────────────
type MaintenanceQRPayload = {
  issue_id: string;
  asset_id: string;
  assigned_staff_id: string;
};

function parseMaintenanceQR(raw: string): MaintenanceQRPayload | null {
  try {
    const obj = JSON.parse(raw);
    if (
      obj && typeof obj === 'object' &&
      typeof obj.issue_id === 'string' &&
      typeof obj.asset_id === 'string' &&
      typeof obj.assigned_staff_id === 'string'
    ) return obj as MaintenanceQRPayload;
  } catch { /* not JSON */ }
  return null;
}

function nextStatus(current: MaintenanceStatus): MaintenanceStatus {
  if (current === 'Pending') return 'In Progress';
  if (current === 'In Progress') return 'Completed';
  return 'Completed';
}

export function ServiceTasksPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<MaintenanceRequest[]>([]);
  const [remarkInputs, setRemarkInputs] = useState<Record<string, string>>({});

  // ── QR scan state ──────────────────────────────────────────────────────────
  const [showScanner, setShowScanner] = useState(false);
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'submitting' | 'success' | 'error'>('idle');
  const [scanMessage, setScanMessage] = useState('');
  const [manualInput, setManualInput] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  async function load() {
    const rows = await api.getMaintenanceRequests('service');
    setTasks(rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleStatusUpdate(row: MaintenanceRequest) {
    const status = nextStatus(row.status);
    const remarks = remarkInputs[row.id]?.trim()
      || (status === 'In Progress' ? 'Technician started diagnostics' : 'Issue resolved and verified');
    await api.updateMaintenanceStatus('service', row.requestId, status, remarks);
    setRemarkInputs((prev) => { const next = { ...prev }; delete next[row.id]; return next; });
    await load();
  }

  // ── QR scanner logic ───────────────────────────────────────────────────────
  const submitQRPayload = useCallback(async (payload: MaintenanceQRPayload) => {
    if (!user?.id) { setScanMessage(t('mustBeLoggedIn', 'You must be logged in.')); setScanStatus('error'); return; }
    setScanStatus('submitting');
    try {
      const res = await api.scanMaintenanceQR(payload.issue_id, payload.asset_id, payload.assigned_staff_id);
      setScanMessage(res.message ?? t('qrScanSuccess', 'Maintenance task completed successfully.'));
      setScanStatus('success');
      await load();
    } catch (err: unknown) {
      setScanMessage(err instanceof Error ? err.message : t('qrScanFailed', 'QR scan failed.'));
      setScanStatus('error');
    }
  }, [user?.id, t]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setScanStatus('scanning');
    setScanMessage('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Use BarcodeDetector if available (Chrome 88+, Edge 88+)
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const tick = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) {
            animFrameRef.current = requestAnimationFrame(tick);
            return;
          }
          try {
            const codes: Array<{ rawValue: string }> = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              stopCamera();
              const payload = parseMaintenanceQR(codes[0].rawValue);
              if (payload) {
                await submitQRPayload(payload);
              } else {
                setScanMessage(t('qrNotMaintenance', 'QR code is not a maintenance request.'));
                setScanStatus('error');
              }
              return;
            }
          } catch { /* detect() can throw on empty frame */ }
          animFrameRef.current = requestAnimationFrame(tick);
        };
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        setScanMessage(t('barcodeApiUnsupported', 'Camera QR detection is not supported in this browser. Use the manual input below.'));
        setScanStatus('idle');
      }
    } catch {
      setScanMessage(t('cameraAccessDenied', 'Camera access denied. Use the manual input below.'));
      setScanStatus('idle');
    }
  }, [stopCamera, submitQRPayload, t]);

  function openScanner() {
    setShowScanner(true);
    setScanStatus('idle');
    setScanMessage('');
    setManualInput('');
  }

  function closeScanner() {
    stopCamera();
    setShowScanner(false);
    setScanStatus('idle');
    setScanMessage('');
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = parseMaintenanceQR(manualInput.trim());
    if (!payload) {
      setScanMessage(t('invalidQRPayload', 'Invalid QR payload. Expected JSON with issue_id, asset_id, assigned_staff_id.'));
      setScanStatus('error');
      return;
    }
    submitQRPayload(payload);
  }

  // Stop camera when leaving the page
  useEffect(() => () => stopCamera(), [stopCamera]);

  const columns: TableColumn<MaintenanceRequest>[] = useMemo(
    () => [
      { key: 'requestId', header: t('requestId', 'Request ID') },
      { key: 'assetName', header: t('asset', 'Asset') },
      { key: 'labName', header: t('labsTitle', 'Lab') },
      { key: 'issue', header: t('issue', 'Issue'), render: (v) => (
        <span title={String(v)} style={{ maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {String(v ?? '-')}
        </span>
      )},
      { key: 'priority', header: t('priority', 'Priority') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'createdAt', header: t('reportedOn', 'Reported On'), render: (v) => String(v ?? '-') },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) =>
          row.status === 'Completed' ? (
            <span style={{ opacity: 0.5, fontSize: '0.875em' }}>{t('closed', 'Closed')}</span>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="btn secondary-btn"
                type="text"
                style={{ padding: '4px 8px', minWidth: 160 }}
                placeholder={t('remarksPlaceholder', 'Add remarks (optional)')}
                value={remarkInputs[row.id] ?? ''}
                onChange={(e) => setRemarkInputs((prev) => ({ ...prev, [row.id]: e.target.value }))}
              />
              <button
                className="btn primary-btn mini-btn"
                type="button"
                onClick={() => handleStatusUpdate(row)}
              >
                {t('mark', 'Mark')} {t(nextStatus(row.status), nextStatus(row.status))}
              </button>
            </div>
          )
      }
    ],
    [t, remarkInputs]
  );

  const pending = tasks.filter((r) => r.status === 'Pending').length;
  const inProgress = tasks.filter((r) => r.status === 'In Progress').length;
  const completed = tasks.filter((r) => r.status === 'Completed').length;

  return (
    <div className="dashboard-grid">
      <div className="page-intro page-intro-row">
        <div>
          <h2>{t('assignedTasksTitle', 'Assigned Tasks')}</h2>
          <p>{t('assignedTasksDesc', 'Update maintenance status and add remarks for each assigned request.')}</p>
        </div>
        <button className="btn primary-btn page-action-primary" type="button" onClick={openScanner}>
          <QrCode size={15} /> {t('scanQR', 'Scan QR to Complete')}
        </button>
      </div>

      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-title">{t('pending', 'Pending')}</p>
          <p className="metric-value">{pending}</p>
        </article>
        <article className="metric-card">
          <p className="metric-title">{t('inProgress', 'In Progress')}</p>
          <p className="metric-value">{inProgress}</p>
        </article>
        <article className="metric-card">
          <p className="metric-title">{t('completed', 'Completed')}</p>
          <p className="metric-value">{completed}</p>
        </article>
      </section>

      <DataTable data={tasks} columns={columns} title={t('serviceTasksTitle', 'Service Tasks')} subtitle={t('serviceTasksDesc', 'Pending and active requests assigned to you by admin')} />

      {/* ── QR Scanner Modal ──────────────────────────────────────────── */}
      {showScanner && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={closeScanner}>
          <div className="modal-box" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><QrCode size={16} style={{ marginRight: 6 }} />{t('scanQRTitle', 'Scan Maintenance QR Code')}</h3>
              <button className="modal-close-btn" type="button" onClick={closeScanner}><X size={16} /></button>
            </div>

            {/* Camera viewfinder */}
            <div style={{ position: 'relative', background: '#0f172a', borderRadius: 10, overflow: 'hidden', marginBottom: 16, minHeight: 220 }}>
              <video
                ref={videoRef}
                muted
                playsInline
                style={{ width: '100%', display: scanStatus === 'scanning' ? 'block' : 'none', borderRadius: 10 }}
              />
              {scanStatus !== 'scanning' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 220, gap: 12, padding: 20 }}>
                  <QrCode size={48} color="#475569" />
                  {scanStatus === 'idle' && (
                    <button className="btn primary-btn" type="button" onClick={startCamera} style={{ gap: 6 }}>
                      <ScanLine size={15} /> {t('openCamera', 'Open Camera')}
                    </button>
                  )}
                  {scanStatus === 'submitting' && (
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{t('submitting', 'Submitting…')}</p>
                  )}
                  {scanStatus === 'success' && (
                    <p style={{ color: '#22c55e', fontWeight: 600, fontSize: '0.95rem', textAlign: 'center' }}>✓ {scanMessage}</p>
                  )}
                  {scanStatus === 'error' && (
                    <p style={{ color: '#ef4444', fontSize: '0.875rem', textAlign: 'center' }}>{scanMessage}</p>
                  )}
                </div>
              )}
              {/* Scan-frame corners overlay */}
              {scanStatus === 'scanning' && (
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 180, height: 180, position: 'relative' }}>
                    {(['topLeft','topRight','bottomLeft','bottomRight'] as const).map((corner) => (
                      <div key={corner} style={{
                        position: 'absolute',
                        width: 36, height: 36,
                        borderColor: '#3b82f6',
                        borderTopWidth: corner.startsWith('top') ? 3 : 0,
                        borderBottomWidth: corner.startsWith('bottom') ? 3 : 0,
                        borderLeftWidth: corner.endsWith('Left') ? 3 : 0,
                        borderRightWidth: corner.endsWith('Right') ? 3 : 0,
                        borderStyle: 'solid',
                        top: corner.startsWith('top') ? 0 : undefined,
                        bottom: corner.startsWith('bottom') ? 0 : undefined,
                        left: corner.endsWith('Left') ? 0 : undefined,
                        right: corner.endsWith('Right') ? 0 : undefined,
                      }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Manual JSON input fallback */}
            <form onSubmit={handleManualSubmit}>
              <label className="form-label" style={{ marginBottom: 8 }}>
                {t('manualQRLabel', 'Paste decoded QR text (fallback)')}
                <textarea
                  className="input"
                  rows={3}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder={'{"issue_id":"...","asset_id":"...","assigned_staff_id":"..."}'}
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn secondary-btn" onClick={closeScanner}>{t('cancel', 'Cancel')}</button>
                <button type="submit" className="btn primary-btn" disabled={!manualInput.trim() || scanStatus === 'submitting'}>
                  {t('submitQR', 'Submit QR')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

