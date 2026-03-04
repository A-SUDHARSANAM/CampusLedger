import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { MaintenanceRequest, MaintenanceStatus } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

function nextStatus(current: MaintenanceStatus): MaintenanceStatus {
  if (current === 'Pending') return 'In Progress';
  if (current === 'In Progress') return 'Completed';
  return 'Completed';
}

export function ServiceTasksPage() {
  const { t } = useLanguage();
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
      { key: 'requestId', header: t('requestId', 'Request ID') },
      { key: 'assetName', header: t('asset', 'Asset') },
      { key: 'labName', header: t('labsTitle', 'Lab') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'priority', header: t('priority', 'Priority') },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) =>
          row.status === 'Completed' ? (
            <span>{t('closed', 'Closed')}</span>
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
              {t('mark', 'Mark')} {t(nextStatus(row.status), nextStatus(row.status))}
            </button>
          )
      }
    ],
    [t]
  );

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>{t('assignedTasksTitle', 'Assigned Tasks')}</h2>
        <p>{t('assignedTasksDesc', 'Service staff can update maintenance status and add remarks only.')}</p>
      </div>
      <DataTable data={tasks} columns={columns} title={t('serviceTasksTitle', 'Service Tasks')} subtitle={t('serviceTasksDesc', 'Pending and active requests assigned to service staff')} />
    </div>
  );
}
