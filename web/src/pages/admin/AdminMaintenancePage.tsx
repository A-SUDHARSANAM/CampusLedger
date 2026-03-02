import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { MaintenanceRequest } from '../../types/domain';

export function AdminMaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);

  async function load() {
    const rows = await api.getMaintenanceRequests('admin');
    setRequests(rows);
  }

  useEffect(() => {
    load();
  }, []);

  const columns: TableColumn<MaintenanceRequest>[] = useMemo(
    () => [
      { key: 'requestId', header: 'Request ID' },
      { key: 'assetName', header: 'Asset' },
      { key: 'labName', header: 'Lab' },
      { key: 'status', header: 'Status' },
      { key: 'assignedTo', header: 'Assigned To', render: (value) => String(value ?? 'Unassigned') },
      { key: 'priority', header: 'Priority' },
      {
        key: 'id',
        header: 'Actions',
        render: (_, row) => (
          <button
            className="btn secondary-btn"
            type="button"
            onClick={async () => {
              await api.assignMaintenanceRequest('admin', row.requestId, 'Suresh');
              await load();
            }}
            disabled={row.assignedTo === 'Suresh'}
          >
            Assign Service
          </button>
        )
      }
    ],
    []
  );

  return (
    <div className="dashboard-grid">
      <DataTable data={requests} columns={columns} title="Maintenance Control" subtitle="Admin assignment and request triage" />
    </div>
  );
}
