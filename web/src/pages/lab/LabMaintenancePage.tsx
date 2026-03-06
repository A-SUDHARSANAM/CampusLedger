import React, { useEffect, useMemo, useState } from 'react';
import { QrCode, ScanLine, Wrench, X } from 'lucide-react';
import { DataList, DataTable, type ListItem, type TableColumn } from '../../components/tables';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import type { Asset, MaintenanceRequest, Priority } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

const PRIORITIES: Priority[] = ['Low', 'Medium', 'High'];

export function LabMaintenancePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [statusMessage, setStatusMessage] = useState('');

  // Report Issue modal
  const [showModal, setShowModal] = useState(false);
  const [modalAssetId, setModalAssetId] = useState('');
  const [modalIssue, setModalIssue] = useState('');
  const [modalPriority, setModalPriority] = useState<Priority>('Medium');
  const [modalError, setModalError] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  async function loadData() {
    if (!user?.labId) return;
    const [assetRows, maintenanceRows] = await Promise.all([
      api.getAssets('lab', user.labId),
      api.getMaintenanceRequests('lab', user.labId)
    ]);
    setAssets(assetRows);
    setRequests(maintenanceRows);
  }

  useEffect(() => {
    loadData();
  }, [user?.labId]);

  function openModal() {
    setModalAssetId(assets[0]?.id ?? '');
    setModalIssue('');
    setModalPriority('Medium');
    setModalError('');
    setShowModal(true);
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!modalIssue.trim()) { setModalError(t('issueRequired', 'Please describe the issue.')); return; }
    if (!modalAssetId) { setModalError(t('assetRequired', 'Please select an asset.')); return; }
    if (!user?.labId) return;
    setModalError('');
    setModalSaving(true);
    try {
      await api.raiseMaintenanceRequest('lab', {
        assetId: modalAssetId,
        labId: user.labId,
        issue: modalIssue.trim(),
        priority: modalPriority
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
      { key: 'labName', header: t('reportedBy', 'Reported By') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'priority', header: t('priority', 'Priority') }
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
          disabled={assets.length === 0}
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
                {t('selectAsset', 'Asset')} *
                <select
                  className="input"
                  value={modalAssetId}
                  onChange={(e) => setModalAssetId(e.target.value)}
                  required
                >
                  <option value="">{t('selectAssetPlaceholder', '— Select asset —')}</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} {a.assetCode ? `(${a.assetCode})` : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-label">
                {t('issueDescription', 'Issue Description')} *
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

