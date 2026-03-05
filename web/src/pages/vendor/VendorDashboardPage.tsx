import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { ProcurementRequest } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

export function VendorDashboardPage() {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);

  async function load() {
    const rows = await api.getProcurementRequests('purchase_dept');
    setRequests(rows);
  }

  useEffect(() => {
    load();
  }, []);

  const columns: TableColumn<ProcurementRequest>[] = useMemo(
    () => [
      { key: 'requestNo', header: t('requestNo', 'Request No') },
      { key: 'requestedByLabName', header: t('labsTitle', 'Lab') },
      { key: 'category', header: t('category', 'Category') },
      { key: 'status', header: t('status', 'Status') },
      {
        key: 'id',
        header: t('action', 'Action'),
        render: (_, row) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn secondary-btn mini-btn"
              type="button"
              disabled={row.status !== 'Sent to Vendor'}
              onClick={async () => {
                await api.vendorUpdateProcurement('purchase_dept', row.requestNo, 'Accepted by Vendor');
                await load();
              }}
            >
              {t('accept', 'Accept')}
            </button>
            <button
              className="btn danger-btn mini-btn"
              type="button"
              disabled={row.status !== 'Sent to Vendor'}
              onClick={async () => {
                await api.vendorUpdateProcurement('purchase_dept', row.requestNo, 'Rejected by Vendor');
                await load();
              }}
            >
              {t('reject', 'Reject')}
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
        <h2>{t('vendorPortal', 'Vendor Portal')}</h2>
        <p>{t('vendorPortalDesc', 'Review approved purchase/service requests from admin and accept them for fulfillment.')}</p>
      </section>
      <DataTable data={requests} columns={columns} title={t('assignedOrders', 'Assigned Orders')} subtitle={t('vendorWorkflowDesc', 'Vendor-side acceptance workflow')} />
    </div>
  );
}
