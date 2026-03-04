import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { MaintenanceRequest } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

export function AdminMaintenancePage() {
  const { t } = useLanguage();
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
      { key: 'requestId', header: t('requestId', 'Request ID') },
      { key: 'assetName', header: t('asset', 'Asset') },
      { key: 'labName', header: t('labsTitle', 'Lab') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'assignedTo', header: t('assignedTo', 'Assigned To'), render: (value) => String(value ?? t('unassigned', 'Unassigned')) },
      { key: 'priority', header: t('priority', 'Priority') },
      {
        key: 'id',
        header: t('actions', 'Actions'),
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
            {t('assignService', 'Assign Service')}
          </button>
        )
      }
    ],
    [t]
  );

  return (
    <div className="dashboard-grid">
      <DataTable data={requests} columns={columns} title={t('maintenanceControl', 'Maintenance Control')} subtitle={t('maintenanceControlSubtitle', 'Admin assignment and request triage')} />
    </div>
  );
}
