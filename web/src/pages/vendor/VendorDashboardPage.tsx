import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { ProcurementRequest } from '../../types/domain';

export function VendorDashboardPage() {
  const [requests, setRequests] = useState<ProcurementRequest[]>([]);

  async function load() {
    const rows = await api.getProcurementRequests('vendor');
    setRequests(rows);
  }

  useEffect(() => {
    load();
  }, []);

  const columns: TableColumn<ProcurementRequest>[] = useMemo(
    () => [
      { key: 'requestNo', header: 'Request No' },
      { key: 'requestedByLabName', header: 'Lab' },
      { key: 'category', header: 'Category' },
      { key: 'status', header: 'Status' },
      {
        key: 'id',
        header: 'Action',
        render: (_, row) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn secondary-btn mini-btn"
              type="button"
              disabled={row.status !== 'Sent to Vendor'}
              onClick={async () => {
                await api.vendorUpdateProcurement('vendor', row.requestNo, 'Accepted by Vendor');
                await load();
              }}
            >
              Accept
            </button>
            <button
              className="btn danger-btn mini-btn"
              type="button"
              disabled={row.status !== 'Sent to Vendor'}
              onClick={async () => {
                await api.vendorUpdateProcurement('vendor', row.requestNo, 'Rejected by Vendor');
                await load();
              }}
            >
              Reject
            </button>
          </div>
        )
      }
    ],
    []
  );

  return (
    <div className="dashboard-grid">
      <section className="card">
        <h2>Vendor Portal</h2>
        <p>Review approved purchase/service requests from admin and accept them for fulfillment.</p>
      </section>
      <DataTable data={requests} columns={columns} title="Assigned Orders" subtitle="Vendor-side acceptance workflow" />
    </div>
  );
}
