import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { MaintenanceRequest, ProcurementRequest, UserRecord } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

export function AdminProcurementPage() {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [serviceRequests, setServiceRequests] = useState<MaintenanceRequest[]>([]);
  const [serviceStaff, setServiceStaff] = useState<UserRecord[]>([]);
  const [activeType, setActiveType] = useState<'All' | 'Purchase' | 'Service'>('All');
  const [statusMsg, setStatusMsg] = useState('');
  // Service-request assignment state
  const [assigningServiceId, setAssigningServiceId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState('');

  async function load() {
    const [rows, svcRows, staff] = await Promise.all([
      api.getProcurementRequests('admin'),
      api.getMaintenanceRequests('admin'),
      api.getServiceStaff(),
    ]);
    setRequests(rows);
    setServiceRequests(svcRows);
    setServiceStaff(staff);
  }

  useEffect(() => {
    load();
  }, []);

  /** Resolve a service-staff UUID to a human-readable name. */
  function resolveStaffName(id?: string): string {
    if (!id) return t('unassigned', 'Unassigned');
    return serviceStaff.find((s) => s.id === id)?.name ?? id;
  }

  const filteredPurchase = useMemo(
    () => requests.filter((r) => (activeType === 'Purchase' ? true : true)),
    [requests]
  );

  const pendingCount = requests.filter((r) => r.status === 'Pending Admin Approval').length;
  const approvedCount = requests.filter((r) => r.status === 'Approved by Admin').length;
  const openServiceCount = serviceRequests.filter((r) => r.status !== 'Completed').length;

  // ── Purchase handlers ──────────────────────────────────────────────────────
  async function handleApprove(row: ProcurementRequest) {
    try {
      await api.approveProcurementRequest('admin', row.id);
      setStatusMsg(t('approved', 'Request approved.'));
      await load();
    } catch { setStatusMsg(t('actionFailed', 'Action failed.')); }
  }

  async function handleReject(row: ProcurementRequest) {
    try {
      await api.rejectProcurementRequest('admin', row.id, 'Rejected by admin');
      setStatusMsg(t('rejected', 'Request rejected.'));
      await load();
    } catch { setStatusMsg(t('actionFailed', 'Action failed.')); }
  }

  async function handlePlaceOrder(row: ProcurementRequest) {
    try {
      await api.sendProcurementToVendor('admin', row.id, 'Campus Vendor Partner');
      setStatusMsg(t('orderPlaced', 'Order placed.'));
      await load();
    } catch { setStatusMsg(t('actionFailed', 'Action failed.')); }
  }

  async function handleConfirmPayment(row: ProcurementRequest) {
    try {
      await api.confirmPayment(row.id);
      setStatusMsg(t('paymentConfirmed', 'Payment confirmed.'));
      await load();
    } catch { setStatusMsg(t('actionFailed', 'Action failed.')); }
  }

  // ── Service-request assignment handler ────────────────────────────────────
  async function handleAssignService(requestId: string) {
    if (!selectedStaffId) return;
    try {
      await api.assignMaintenanceRequest('admin', requestId, selectedStaffId);
      setStatusMsg(t('assignedSuccess', 'Service staff assigned successfully.'));
      setAssigningServiceId(null);
      setSelectedStaffId('');
      await load();
    } catch {
      setStatusMsg(t('assignFailed', 'Assignment failed. Ensure the selected user is an active service staff member.'));
    }
  }

  // ── Purchase columns ───────────────────────────────────────────────────────
  const purchaseColumns: TableColumn<ProcurementRequest>[] = useMemo(
    () => [
      { key: 'requestNo', header: t('requestNo', 'Request No') },
      { key: 'requestedByLabName', header: t('requestedBy', 'Requested By') },
      { key: 'category', header: t('category', 'Category') },
      { key: 'createdDate', header: t('date', 'Date') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'vendorName', header: t('vendor', 'Vendor'), render: (value) => String(value ?? '-') },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) => (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {row.status === 'Pending Admin Approval' && (
              <>
                <button className="btn primary-btn mini-btn" type="button" onClick={() => handleApprove(row)}>
                  {t('approve', 'Approve')}
                </button>
                <button className="btn danger-btn mini-btn" type="button" onClick={() => handleReject(row)}>
                  {t('reject', 'Reject')}
                </button>
              </>
            )}
            {row.status === 'Approved by Admin' && (
              <button className="btn primary-btn mini-btn" type="button" onClick={() => handlePlaceOrder(row)}>
                {t('placeOrder', 'Place Order')}
              </button>
            )}
            {row.status === 'Sent to Vendor' && (
              <button className="btn secondary-btn mini-btn" type="button" onClick={() => handleConfirmPayment(row)}>
                {t('confirmPayment', 'Confirm Payment')}
              </button>
            )}
          </div>
        )
      }
    ],
    [t, requests]
  );

  // ── Service-request columns ────────────────────────────────────────────────
  const serviceColumns: TableColumn<MaintenanceRequest>[] = useMemo(
    () => [
      { key: 'requestId', header: t('requestId', 'Request ID') },
      { key: 'assetName', header: t('asset', 'Asset') },
      { key: 'labName', header: t('labsTitle', 'Lab') },
      { key: 'issue', header: t('issue', 'Issue') },
      { key: 'priority', header: t('priority', 'Priority') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'createdAt', header: t('date', 'Reported On'), render: (v) => String(v ?? '-') },
      {
        key: 'assignedTo',
        header: t('assignedTo', 'Assigned Staff'),
        render: (value) => resolveStaffName(value as string | undefined),
      },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) =>
          row.status === 'Completed' ? (
            <span style={{ opacity: 0.5, fontSize: '0.875em' }}>{t('closed', 'Closed')}</span>
          ) : assigningServiceId === row.id ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                className="btn secondary-btn"
                style={{ padding: '4px 8px', minWidth: 160 }}
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
              >
                <option value="">{t('selectStaff', '— Select Staff —')}</option>
                {serviceStaff
                  .filter((s) => s.status === 'approved' || s.is_approved)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.department ? ` — ${s.department}` : ''}
                    </option>
                  ))}
              </select>
              <button
                className="btn primary-btn mini-btn"
                type="button"
                onClick={() => handleAssignService(row.id)}
                disabled={!selectedStaffId}
              >
                {t('confirm', 'Confirm')}
              </button>
              <button
                className="btn secondary-btn mini-btn"
                type="button"
                onClick={() => { setAssigningServiceId(null); setSelectedStaffId(''); }}
              >
                {t('cancel', 'Cancel')}
              </button>
            </div>
          ) : (
            <button
              className="btn secondary-btn"
              type="button"
              onClick={() => { setAssigningServiceId(row.id); setSelectedStaffId(''); }}
            >
              {row.assignedTo ? t('reassign', 'Reassign') : t('assignService', 'Assign Service Staff')}
            </button>
          ),
      },
    ],
    [t, assigningServiceId, selectedStaffId, serviceStaff]
  );

  return (
    <div className="dashboard-grid">
      <section className="card">
        <h2>{t('procurementCenter', 'Procurement Command Center')}</h2>
        <p>{t('procurementCenterDesc', 'Approve lab purchase requests, place orders, confirm payments, and assign service staff to asset issues.')}</p>
      </section>

      {statusMsg && <p style={{ padding: '4px 0', opacity: 0.75, fontSize: '0.875em' }}>{statusMsg}</p>}

      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-title">{t('pendingApproval', 'Pending Approval')}</p>
          <p className="metric-value">{pendingCount}</p>
        </article>
        <article className="metric-card">
          <p className="metric-title">{t('approvedRequests', 'Approved')}</p>
          <p className="metric-value">{approvedCount}</p>
        </article>
        <article className="metric-card">
          <p className="metric-title">{t('openServiceRequests', 'Open Service Requests')}</p>
          <p className="metric-value">{openServiceCount}</p>
        </article>
      </section>

      <section className="card procurement-filter-row">
        <button className={`btn secondary-btn mini-btn ${activeType === 'All' ? 'active-tab' : ''}`} type="button" onClick={() => setActiveType('All')}>
          {t('all', 'All')}
        </button>
        <button className={`btn secondary-btn mini-btn ${activeType === 'Purchase' ? 'active-tab' : ''}`} type="button" onClick={() => setActiveType('Purchase')}>
          {t('purchase', 'Purchase Requests')}
        </button>
        <button className={`btn secondary-btn mini-btn ${activeType === 'Service' ? 'active-tab' : ''}`} type="button" onClick={() => setActiveType('Service')}>
          {t('service', 'Service Requests')}
        </button>
      </section>

      {(activeType === 'All' || activeType === 'Purchase') && (
        <DataTable
          data={filteredPurchase}
          columns={purchaseColumns}
          title={t('labPurchaseRequests', 'Lab Purchase Requests')}
          subtitle={t('adminProcurementSubtitle', 'Admin acceptance, order placement, and payment flow')}
        />
      )}

      {(activeType === 'All' || activeType === 'Service') && (
        <DataTable
          data={serviceRequests}
          columns={serviceColumns}
          title={t('assetServiceRequests', 'Asset Service Requests')}
          subtitle={t('serviceRequestsDesc', 'Lab-reported asset issues — assign a service staff member to resolve each request')}
        />
      )}
    </div>
  );
}
