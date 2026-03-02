import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { MaintenanceRequest, MaintenanceStatus } from '../../types/domain';

function nextStatus(current: MaintenanceStatus): MaintenanceStatus {
  if (current === 'Pending') return 'In Progress';
  if (current === 'In Progress') return 'Completed';
  return 'Completed';
}

export function ServiceTasksPage() {
  const [tasks, setTasks] = useState<MaintenanceRequest[]>([]);

  async function load() {
    const rows = await api.getMaintenanceRequests('service');
    setTasks(rows);
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
      { key: 'priority', header: 'Priority' },
      {
        key: 'id',
        header: 'Actions',
        render: (_, row) =>
          row.status === 'Completed' ? (
            <span>Closed</span>
          ) : (
            <button
              className="btn secondary-btn"
              type="button"
              onClick={async () => {
                const status = nextStatus(row.status);
                const remarks = status === 'In Progress' ? 'Technician started diagnostics' : 'Issue resolved and verified';
                await api.updateMaintenanceStatus('service', row.requestId, status, remarks);
                await load();
              }}
            >
              Mark {nextStatus(row.status)}
            </button>
          )
      }
    ],
    []
  );

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>Assigned Tasks</h2>
        <p>Service staff can update maintenance status and add remarks only.</p>
      </div>
      <DataTable data={tasks} columns={columns} title="Service Tasks" subtitle="Pending and active requests assigned to service staff" />
    </div>
  );
}
