import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { ProcurementRequest } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

export function AdminProcurementPage() {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [activeType, setActiveType] = useState<'All' | 'Purchase' | 'Service'>('All');
  const [statusMsg, setStatusMsg] = useState('');

  async function load() {
    const rows = await api.getProcurementRequests('admin');
    setRequests(rows);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () => requests.filter((request) => (activeType === 'All' ? true : request.category === activeType)),
    [activeType, requests]
  );

  const pendingCount = requests.filter((r) => r.status === 'Pending Admin Approval').length;
  const approvedCount = requests.filter((r) => r.status === 'Approved by Admin').length;

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

  const columns: TableColumn<ProcurementRequest>[] = useMemo(
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

  return (
    <div className="dashboard-grid">
      <section className="card">
        <h2>{t('procurementCenter', 'Procurement Command Center')}</h2>
        <p>{t('procurementCenterDesc', 'Approve lab requests, place orders, and confirm payments.')}</p>
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
      </section>

      <section className="card procurement-filter-row">
        <button className={`btn secondary-btn mini-btn ${activeType === 'All' ? 'active-tab' : ''}`} type="button" onClick={() => setActiveType('All')}>
          {t('all', 'All')}
        </button>
        <button className={`btn secondary-btn mini-btn ${activeType === 'Purchase' ? 'active-tab' : ''}`} type="button" onClick={() => setActiveType('Purchase')}>
          {t('purchase', 'Purchase')}
        </button>
        <button className={`btn secondary-btn mini-btn ${activeType === 'Service' ? 'active-tab' : ''}`} type="button" onClick={() => setActiveType('Service')}>
          {t('service', 'Service')}
        </button>
      </section>

      <DataTable data={filtered} columns={columns} title={t('labRequests', 'Lab Requests')} subtitle={t('adminProcurementSubtitle', 'Admin acceptance, order placement, and payment flow')} />
    </div>
  );
}
