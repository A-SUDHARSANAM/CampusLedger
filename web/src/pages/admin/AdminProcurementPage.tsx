import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { ProcurementRequest } from '../../types/domain';

export function AdminProcurementPage() {
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
      { key: 'requestNo', header: 'Request No' },
      { key: 'requestedByLabName', header: 'Requested By' },
      { key: 'category', header: 'Category' },
      { key: 'createdDate', header: 'Date' },
      { key: 'status', header: 'Status' },
      { key: 'vendorName', header: 'Vendor', render: (value) => String(value ?? '-') },
      {
        key: 'id',
        header: 'Actions',
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
              Approve
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
              Send Vendor
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
        <h2>Procurement Command Center</h2>
        <p>Approve lab requests and route to vendor with separate Purchase and Service controls.</p>
      </section>
      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-title">Purchase Requests</p>
          <p className="metric-value">{purchaseCount}</p>
        </article>
        <article className="metric-card">
          <p className="metric-title">Service Requests</p>
          <p className="metric-value">{serviceCount}</p>
        </article>
      </section>

      <section className="card procurement-filter-row">
        <button className={`btn secondary-btn mini-btn ${activeType === 'All' ? 'active-tab' : ''}`} type="button" onClick={() => setActiveType('All')}>
          All
        </button>
        <button className={`btn secondary-btn mini-btn ${activeType === 'Purchase' ? 'active-tab' : ''}`} type="button" onClick={() => setActiveType('Purchase')}>
          Purchase
        </button>
        <button className={`btn secondary-btn mini-btn ${activeType === 'Service' ? 'active-tab' : ''}`} type="button" onClick={() => setActiveType('Service')}>
          Service
        </button>
      </section>

      <DataTable data={filtered} columns={columns} title="Lab Requests" subtitle="Admin acceptance and vendor routing workflow" />
    </div>
  );
}
