import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { ProcurementRequest } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

export function AdminProcurementPage() {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);
  const [activeType, setActiveType] = useState<'All' | 'Purchase' | 'Service'>('All');

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

  const purchaseCount = requests.filter((request) => request.category === 'Purchase').length;
  const serviceCount = requests.filter((request) => request.category === 'Service').length;

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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn secondary-btn mini-btn"
              type="button"
              disabled={row.status !== 'Pending Admin Approval'}
              onClick={async () => {
                await api.approveProcurementRequest('admin', row.requestNo);
                await load();
              }}
            >
              {t('approve', 'Approve')}
            </button>
            <button
              className="btn primary-btn mini-btn"
              type="button"
              disabled={row.status !== 'Approved by Admin'}
              onClick={async () => {
                await api.sendProcurementToVendor('admin', row.requestNo, 'Campus Vendor Partner');
                await load();
              }}
            >
              {t('sendVendor', 'Send Vendor')}
            </button>
          </div>
        )
      }
    ],
    [t]
  );

  return (
    <div className="dashboard-grid">
      <section className="card">
        <h2>{t('procurementCenter', 'Procurement Command Center')}</h2>
        <p>{t('procurementCenterDesc', 'Approve lab requests and route to vendor with separate Purchase and Service controls.')}</p>
      </section>
      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-title">{t('purchaseRequests', 'Purchase Requests')}</p>
          <p className="metric-value">{purchaseCount}</p>
        </article>
        <article className="metric-card">
          <p className="metric-title">{t('serviceRequests', 'Service Requests')}</p>
          <p className="metric-value">{serviceCount}</p>
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

      <DataTable data={filtered} columns={columns} title={t('labRequests', 'Lab Requests')} subtitle={t('adminProcurementSubtitle', 'Admin acceptance and vendor routing workflow')} />
    </div>
  );
}
