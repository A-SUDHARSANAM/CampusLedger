import React, { useEffect, useMemo, useState } from 'react';
import { DataList, DataTable, type ListItem, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import type { MaintenanceRequest, MaintenanceStatus } from '../../types/domain';

function toTimelineItems(requests: MaintenanceRequest[]): ListItem[] {
  return requests.flatMap((request) =>
    request.history.map((entry) => ({
      id: `${request.id}-${entry.id}`,
      title: `${request.assetName}: ${entry.status.replace('_', ' ')}`,
      subtitle: entry.note,
      meta: new Date(entry.at).toLocaleString(),
      status: entry.status === 'completed' ? 'active' : entry.status === 'in_progress' ? 'pending' : 'critical'
    }))
  );
}

export function MaintenancePage() {
  const { role, user, hasPermission } = useAuth();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    if (!role) return;
    const result = await api.getMaintenanceRequests(role, user?.labId);
    setRequests(result);
  }

  useEffect(() => {
    refresh().catch((err: Error) => setError(err.message));
  }, [role, user?.labId]);

  const columns: TableColumn<MaintenanceRequest>[] = useMemo(
    () => [
      { key: 'assetName', header: 'Asset' },
      { key: 'summary', header: 'Issue' },
      { key: 'status', header: 'Status' },
      { key: 'assignedTo', header: 'Assigned To', render: (value) => String(value ?? 'Unassigned') },
      {
        key: 'id',
        header: 'Actions',
        render: (_, row) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {role === 'admin' && hasPermission('maintenance:assign') ? (
              <button
                className="btn secondary-btn"
                type="button"
                onClick={async () => {
                  await api.assignMaintenanceRequest('admin', row.id, 'service-tech-01');
                  await refresh();
                }}
              >
                Assign
              </button>
            ) : null}
            {role === 'service' && hasPermission('maintenance:update_status') ? (
              <>
                <button
                  className="btn secondary-btn"
                  type="button"
                  onClick={async () => {
                    await api.updateMaintenanceStatus('service', row.id, 'in_progress', 'Moved to in progress');
                    await refresh();
                  }}
                >
                  In Progress
                </button>
                <button
                  className="btn secondary-btn"
                  type="button"
                  onClick={async () => {
                    await api.updateMaintenanceStatus('service', row.id, 'completed', 'Service completed');
                    await refresh();
                  }}
                >
                  Completed
                </button>
              </>
            ) : null}
            {role === 'lab' && hasPermission('maintenance:raise') ? (
              <span>{'Awaiting admin assignment'}</span>
            ) : null}
          </div>
        )
      }
    ],
    [hasPermission, role]
  );

  const timeline = toTimelineItems(requests);

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>Maintenance Workflow</h2>
        <p>Lab raises request, admin assigns service staff, service updates status timeline.</p>
        {role === 'lab' && hasPermission('maintenance:raise') ? (
          <button
            className="btn primary-btn"
            style={{ marginTop: 12, width: 260 }}
            type="button"
            onClick={async () => {
              await api.raiseMaintenanceRequest('lab', {
                assetId: 'asset-001',
                summary: 'Lab-submitted maintenance request',
                labId: user?.labId ?? 'lab-chemistry'
              });
              await refresh();
            }}
          >
            Raise Maintenance Request
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="card">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <DataTable
            data={requests}
            columns={columns}
            title="Maintenance Requests"
            subtitle="Role-based request processing"
            emptyTitle="No maintenance requests"
            emptyDescription="Requests will appear here when raised by lab teams."
          />
          <DataList
            items={timeline}
            title="Maintenance History Timeline"
            subtitle="Status transition audit trail"
            emptyTitle="No status history"
            emptyDescription="History is generated as requests move through the workflow."
          />
        </>
      )}
    </div>
  );
}
