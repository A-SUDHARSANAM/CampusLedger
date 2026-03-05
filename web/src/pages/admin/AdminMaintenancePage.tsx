import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { MaintenanceRequest } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

export function AdminMaintenancePage() {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [staffInput, setStaffInput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  async function load() {
    const rows = await api.getMaintenanceRequests('admin');
    setRequests(rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAssign(requestId: string) {
    if (!staffInput.trim()) return;
    try {
      await api.assignMaintenanceRequest('admin', requestId, staffInput.trim());
      setStatusMsg(t('assigned', 'Assigned successfully.'));
      setAssigningId(null);
      setStaffInput('');
      await load();
    } catch {
      setStatusMsg(t('assignFailed', 'Assignment failed.'));
    }
  }

  const columns: TableColumn<MaintenanceRequest>[] = useMemo(
    () => [
      { key: 'requestId', header: t('requestId', 'Request ID') },
      { key: 'assetName', header: t('asset', 'Asset') },
      { key: 'labName', header: t('labsTitle', 'Lab') },
      { key: 'issue', header: t('issue', 'Issue') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'assignedTo', header: t('assignedTo', 'Assigned To'), render: (value) => String(value ?? t('unassigned', 'Unassigned')) },
      { key: 'priority', header: t('priority', 'Priority') },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) =>
          assigningId === row.id ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                className="btn secondary-btn"
                type="text"
                style={{ padding: '4px 8px', minWidth: 120 }}
                placeholder={t('staffIdOrName', 'Staff ID or name')}
                value={staffInput}
                onChange={(e) => setStaffInput(e.target.value)}
              />
              <button className="btn primary-btn mini-btn" type="button" onClick={() => handleAssign(row.id)}>
                {t('confirm', 'Confirm')}
              </button>
              <button className="btn secondary-btn mini-btn" type="button" onClick={() => setAssigningId(null)}>
                {t('cancel', 'Cancel')}
              </button>
            </div>
          ) : (
            <button
              className="btn secondary-btn"
              type="button"
              onClick={() => { setAssigningId(row.id); setStaffInput(''); }}
              disabled={row.status === 'Completed'}
            >
              {row.assignedTo ? t('reassign', 'Reassign') : t('assignService', 'Assign Service')}
            </button>
          )
      }
    ],
    [t, assigningId, staffInput]
  );

  return (
    <div className="dashboard-grid">
      {statusMsg && <p style={{ padding: '8px 0', opacity: 0.75, fontSize: '0.875em' }}>{statusMsg}</p>}
      <DataTable data={requests} columns={columns} title={t('maintenanceControl', 'Maintenance Control')} subtitle={t('maintenanceControlSubtitle', 'Admin assignment and request triage')} />
    </div>
  );
}

