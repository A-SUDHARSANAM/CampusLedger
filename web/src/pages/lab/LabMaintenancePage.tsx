import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, QrCode, ScanLine, Wrench, X } from 'lucide-react';
import { DataList, DataTable, type ListItem, type TableColumn } from '../../components/tables';
import { OCRScanner, type OCRResult } from '../../components/OCRScanner';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import type { Asset, LocationInfo, MaintenanceRequest, Priority } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];

export function LabMaintenancePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [statusMessage, setStatusMessage] = useState('');

  // Locations list (for modal)
  const [locationsList, setLocationsList] = useState<LocationInfo[]>([]);

  // Report Issue modal
  const [showModal, setShowModal] = useState(false);
  const [modalLocationId, setModalLocationId] = useState('');
  const [modalLocationAssets, setModalLocationAssets] = useState<{ id: string; name: string; assetCode?: string }[]>([]);
  const [modalLoadingAssets, setModalLoadingAssets] = useState(false);
  const [modalAssetId, setModalAssetId] = useState('');
  const [modalIssue, setModalIssue] = useState('');
  const [modalPriority, setModalPriority] = useState<Priority>('Medium');
  const [modalIssueType, setModalIssueType] = useState<'service_request' | 'purchase_request'>('service_request');
  const [modalError, setModalError] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  // QR code viewer
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrModalCode, setQrModalCode] = useState('');

  // OCR scan
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrScanFile, setOcrScanFile] = useState<File | null>(null);
  const ocrFileInputRef = useRef<HTMLInputElement>(null);

  function handleOcrResult(result: OCRResult) {
    const fields = result.detected_fields;
    const parts: string[] = [];
    if (fields.asset_name) parts.push(`Asset: ${fields.asset_name}`);
    if (fields.serial_number) parts.push(`S/N: ${fields.serial_number}`);
    if (fields.model) parts.push(`Model: ${fields.model}`);
    if (parts.length) setModalIssue((prev) => prev ? `${prev}\n${parts.join(' | ')}` : parts.join(' | '));
    setShowOcrModal(false);
  }

  async function loadData() {
    const [assetRows, maintenanceRows] = await Promise.all([
      api.getAssets('lab', user?.labId),
      api.getMaintenanceRequests('lab', user?.labId)
    ]);
    setAssets(assetRows);
    setRequests(maintenanceRows);
  }

  useEffect(() => {
    loadData();
    api.getLocations().then(setLocationsList).catch(() => { });
  }, [user?.labId]);

  // When location changes in modal, load assets for that location.
  // If the location returns no assets (common when location ↔ asset mapping
  // is not set up), fall back to the lab's own asset list already in state.
  useEffect(() => {
    if (!modalLocationId) {
      // No location selected — show all lab assets as fallback
      const fallback = assets.map((a) => ({ id: a.id, name: a.name, assetCode: a.assetCode }));
      setModalLocationAssets(fallback);
      setModalAssetId(fallback[0]?.id ?? '');
      return;
    }
    setModalLoadingAssets(true);
    api.getLocationAssets(modalLocationId)
      .then((rows) => {
        // If location returned assets, use them; otherwise use lab assets
        const list = rows.length > 0
          ? rows
          : assets.map((a) => ({ id: a.id, name: a.name, assetCode: a.assetCode }));
        setModalLocationAssets(list);
        setModalAssetId(list[0]?.id ?? '');
      })
      .catch(() => {
        const fallback = assets.map((a) => ({ id: a.id, name: a.name, assetCode: a.assetCode }));
        setModalLocationAssets(fallback);
        setModalAssetId(fallback[0]?.id ?? '');
      })
      .finally(() => setModalLoadingAssets(false));
  }, [modalLocationId, assets]);

  function openModal() {
    const firstLoc = locationsList[0]?.id ?? '';
    setModalLocationId(firstLoc);
    setModalAssetId('');
    setModalIssue('');
    setModalPriority('Medium');
    setModalIssueType('service_request');
    setModalError('');
    setShowModal(true);
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!modalIssue.trim()) { setModalError(t('issueRequired', 'Please describe the issue.')); return; }
    if (!modalAssetId) { setModalError(t('assetRequired', 'Please select an asset.')); return; }
    setModalError('');
    setModalSaving(true);
    try {
      await api.raiseMaintenanceRequest('lab', {
        assetId: modalAssetId,
        labId: user?.labId ?? '',
        issue: modalIssue.trim(),
        priority: modalPriority,
        issueType: modalIssueType,
      });
      setShowModal(false);
      setStatusMessage(t('maintenanceRequestCreated', 'Maintenance request submitted.'));
      await loadData();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : t('requestFailed', 'Failed to submit request.'));
    } finally {
      setModalSaving(false);
    }
  }

  async function handleQRScan() {
    if (!user?.labId || assets.length === 0) {
      setStatusMessage(t('noLabAssetsForRequest', 'No lab assets available to raise a request.'));
      return;
    }
    openModal();
  }

  const historyItems: ListItem[] = useMemo(
    () =>
      requests.flatMap((request) =>
        request.history.map((entry) => ({
          id: `${request.requestId}-${entry.id}`,
          title: `${request.requestId} - ${entry.status}`,
          subtitle: entry.remarks,
          meta: `${entry.date} | ${entry.updatedBy}`,
          status: entry.status === 'Completed' ? 'active' : entry.status === 'In Progress' ? 'pending' : 'critical'
        }))
      ),
    [requests]
  );

  const columns: TableColumn<MaintenanceRequest>[] = useMemo(
    () => [
      { key: 'assetCode', header: t('assetCode', 'Asset Code') },
      { key: 'assetName', header: t('asset', 'Asset') },
      { key: 'issue', header: t('issue', 'Issue') },
      {
        key: 'issueType',
        header: t('issueType', 'Type'),
        render: (value) => {
          const v = String(value ?? 'service_request');
          return v === 'purchase_request'
            ? <span className="ri-type-badge ri-type-purchase">Purchase Request</span>
            : <span className="ri-type-badge ri-type-service">Service Request</span>;
        },
      },
      {
        key: 'status',
        header: t('status', 'Status'),
        render: (v) => {
          const s = String(v ?? 'Pending');
          const colors: Record<string, { bg: string; color: string }> = {
            'Pending': { bg: 'rgba(234,179,8,.14)', color: '#ca8a04' },
            'In Progress': { bg: 'rgba(59,130,246,.14)', color: '#2563eb' },
            'Completed': { bg: 'rgba(34,197,94,.14)', color: '#16a34a' },
          };
          const c = colors[s] ?? { bg: 'rgba(148,163,184,.12)', color: '#64748b' };
          return (
            <span style={{
              display: 'inline-block', padding: '2px 9px', borderRadius: 20,
              fontSize: 11, fontWeight: 700, background: c.bg, color: c.color,
              whiteSpace: 'nowrap',
            }}>
              {s}
            </span>
          );
        },
      },
      {
        key: 'assignedTo',
        header: t('assignedTo', 'Assigned To'),
        render: (v) => v
          ? (
            <span style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
              {String(v)}
            </span>
          )
          : <span style={{ opacity: 0.4, fontSize: 12 }}>Not yet assigned</span>,
      },
      { key: 'priority', header: t('priority', 'Priority') },
      {
        key: 'qrCode',
        header: t('qrCode', 'QR Code'),
        render: (_value, row) =>
          row.qrCode ? (
            <button
              className="btn secondary-btn mini-btn"
              type="button"
              onClick={() => { setQrModalCode(row.qrCode!); setQrModalVisible(true); }}
            >
              <QrCode size={14} /> {t('viewQR', 'View QR')}
            </button>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: '0.85em' }}>—</span>
          ),
      }
    ],
    [t]
  );

  return (
    <div className="dashboard-grid">
      <div className="page-intro page-intro-row">
        <div>
          <h2>{t('maintenanceTitle', 'Maintenance')}</h2>
          <p>{t('maintenanceDesc', 'View and raise maintenance requests')}</p>
        </div>
        <button
          className="btn primary-btn page-action-primary"
          type="button"
          onClick={openModal}
        >
          <Wrench size={15} /> {t('reportIssue', 'Report Issue')}
        </button>
      </div>

      <section className="card quick-scan-card">
        <h3>
          <ScanLine size={16} /> {t('quickScan', 'Quick Scan')}
        </h3>
        <div className="scanner-panel">
          <div className="scanner-icon">
            <QrCode size={30} />
          </div>
          <h4>{t('scanAssetQr', 'Scan Asset QR Code')}</h4>
          <p>{t('qrDesc', "Point your device camera at the asset's QR code to quickly log a maintenance issue.")}</p>
          <button className="btn secondary-btn scanner-btn" type="button" onClick={handleQRScan}>
            <ScanLine size={14} /> {t('openScanner', 'Open Scanner')}
          </button>
        </div>
      </section>

      {statusMessage ? <p className="settings-status">{statusMessage}</p> : null}

      <DataTable data={requests} columns={columns} title={t('maintenanceLog', 'Maintenance Log')} subtitle={t('maintenanceLogDesc', 'Lab request history and current statuses')} />
      <DataList items={historyItems} title={t('maintenanceHistory', 'Maintenance History')} subtitle={t('maintenanceHistoryDesc', 'Status timeline for all requests')} />

      {/* ── QR Code Viewer Modal ───────────────────────────── */}
      {qrModalVisible && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setQrModalVisible(false)}>
          <div className="modal-box" style={{ maxWidth: 360, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><QrCode size={16} style={{ marginRight: 6 }} />{t('maintenanceQRTitle', 'Maintenance QR Code')}</h3>
              <button className="modal-close-btn" type="button" onClick={() => setQrModalVisible(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '16px 0' }}>
              <img
                src={`data:image/png;base64,${qrModalCode}`}
                alt={t('maintenanceQRAlt', 'Maintenance QR Code')}
                style={{ width: 240, height: 240, display: 'block', margin: '0 auto', borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <p style={{ marginTop: 12, fontSize: '0.875rem', color: '#64748b' }}>
                {t('qrScanInstructions', 'Show this QR code to the assigned service staff to confirm repair completion.')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── OCR Scan Modal ──────────────────────────────────── */}
      {showOcrModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setShowOcrModal(false)}>
          <div className="modal-box" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Camera size={16} style={{ marginRight: 6 }} />Scan Asset Label</h3>
              <button className="modal-close-btn" type="button" onClick={() => setShowOcrModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: '12px 0' }}>
              <OCRScanner
                title="Scan Asset Label"
                description="Upload a photo of the asset's label or tag to auto-fill the issue description."
                displayFields={['asset_name', 'serial_number', 'model']}
                onResult={handleOcrResult}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Report Issue Modal ─────────────────────────────── */}
      {showModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('reportIssueTitle', 'Report Maintenance Issue')}</h3>
              <button className="modal-close-btn" type="button" onClick={() => setShowModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSubmitReport} className="modal-form">
              <label className="form-label">
                {t('issueType', 'Issue Type')} *
                <div className="ri-type-toggle">
                  <button
                    type="button"
                    className={`ri-type-opt${modalIssueType === 'service_request' ? ' ri-type-opt-active' : ''}`}
                    onClick={() => setModalIssueType('service_request')}
                  >
                    🔧 Service Request
                  </button>
                  <button
                    type="button"
                    className={`ri-type-opt${modalIssueType === 'purchase_request' ? ' ri-type-opt-active' : ''}`}
                    onClick={() => setModalIssueType('purchase_request')}
                  >
                    🛒 Purchase Request
                  </button>
                </div>
                <p className="ri-type-hint">
                  {modalIssueType === 'service_request'
                    ? 'Report a repair or maintenance need for an existing asset.'
                    : 'Request procurement of a new asset or replacement part.'}
                </p>
              </label>
              <label className="form-label">
                {t('selectLocation', 'Location')} *
                <select
                  className="input"
                  value={modalLocationId}
                  onChange={(e) => { setModalLocationId(e.target.value); setModalAssetId(''); }}
                  required
                >
                  <option value="">{t('selectLocationPlaceholder', '— Select location —')}</option>
                  {['academic', 'non_academic'].map((type) => {
                    const group = locationsList.filter((l) => l.type === type);
                    if (!group.length) return null;
                    return (
                      <optgroup key={type} label={type === 'academic' ? 'Academic' : 'Non-Academic'}>
                        {group.map((loc) => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </label>
              <label className="form-label">
                {t('selectAsset', 'Asset')} *
                <select
                  className="input"
                  value={modalAssetId}
                  onChange={(e) => setModalAssetId(e.target.value)}
                  required
                  disabled={!modalLocationId || modalLoadingAssets}
                >
                  <option value="">
                    {modalLoadingAssets
                      ? t('loadingAssets', 'Loading assets…')
                      : !modalLocationId
                        ? t('selectLocationFirst', '— Select a location first —')
                        : t('selectAssetPlaceholder', '— Select asset —')}
                  </option>
                  {modalLocationAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} {a.assetCode ? `(${a.assetCode})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-label">
                {t('issueDescription', 'Issue Description')} *
                <div style={{ display: 'flex', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn secondary-btn mini-btn"
                    onClick={() => setShowOcrModal(true)}
                    title="Scan asset label to auto-fill"
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Camera size={13} /> Scan Label
                  </button>
                </div>
                <textarea
                  className="input"
                  rows={3}
                  value={modalIssue}
                  onChange={(e) => setModalIssue(e.target.value)}
                  placeholder={t('describeIssue', 'Describe the problem in detail…')}
                  required
                />
              </label>

              <label className="form-label">
                {t('priority', 'Priority')}
                <select
                  className="input"
                  value={modalPriority}
                  onChange={(e) => setModalPriority(e.target.value as Priority)}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>

              {modalError && <p className="form-error">{modalError}</p>}

              <div className="modal-actions">
                <button type="button" className="btn secondary-btn" onClick={() => setShowModal(false)}>
                  {t('cancel', 'Cancel')}
                </button>
                <button type="submit" className="btn primary-btn" disabled={modalSaving}>
                  {modalSaving ? t('submitting', 'Submitting…') : t('submitRequest', 'Submit Request')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

