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
  const [remarkInputs, setRemarkInputs] = useState<Record<string, string>>({});

  async function load() {
    const rows = await api.getMaintenanceRequests('service');
    setTasks(rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleStatusUpdate(row: MaintenanceRequest) {
    const status = nextStatus(row.status);
    const remarks = remarkInputs[row.id]?.trim()
      || (status === 'In Progress' ? 'Technician started diagnostics' : 'Issue resolved and verified');
    await api.updateMaintenanceStatus('service', row.requestId, status, remarks);
    setRemarkInputs((prev) => { const next = { ...prev }; delete next[row.id]; return next; });
    await load();
  }

  const columns: TableColumn<MaintenanceRequest>[] = useMemo(
    () => [
      { key: 'requestId', header: t('requestId', 'Request ID') },
      { key: 'assetName', header: t('asset', 'Asset') },
      { key: 'labName', header: t('labsTitle', 'Lab') },
      { key: 'issue', header: t('issue', 'Issue'), render: (v) => (
        <span title={String(v)} style={{ maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {String(v ?? '-')}
        </span>
      )},
      { key: 'priority', header: t('priority', 'Priority') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'createdAt', header: t('reportedOn', 'Reported On'), render: (v) => String(v ?? '-') },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) =>
          row.status === 'Completed' ? (
            <span style={{ opacity: 0.5, fontSize: '0.875em' }}>{t('closed', 'Closed')}</span>
          ) : (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                className="btn secondary-btn"
                type="text"
                style={{ padding: '4px 8px', minWidth: 160 }}
                placeholder={t('remarksPlaceholder', 'Add remarks (optional)')}
                value={remarkInputs[row.id] ?? ''}
                onChange={(e) => setRemarkInputs((prev) => ({ ...prev, [row.id]: e.target.value }))}
              />
              <button
                className="btn primary-btn mini-btn"
                type="button"
                onClick={() => handleStatusUpdate(row)}
              >
                {t('mark', 'Mark')} {t(nextStatus(row.status), nextStatus(row.status))}
              </button>
            </div>
          )
      }
    ],
    [t, remarkInputs]
  );

  const pending = tasks.filter((r) => r.status === 'Pending').length;
  const inProgress = tasks.filter((r) => r.status === 'In Progress').length;
  const completed = tasks.filter((r) => r.status === 'Completed').length;

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>{t('assignedTasksTitle', 'Assigned Tasks')}</h2>
        <p>{t('assignedTasksDesc', 'Update maintenance status and add remarks for each assigned request.')}</p>
      </div>
      <section className="metric-grid">
        <article className="metric-card">
          <p className="metric-title">{t('pending', 'Pending')}</p>
          <p className="metric-value">{pending}</p>
        </article>
        <article className="metric-card">
          <p className="metric-title">{t('inProgress', 'In Progress')}</p>
          <p className="metric-value">{inProgress}</p>
        </article>
        <article className="metric-card">
          <p className="metric-title">{t('completed', 'Completed')}</p>
          <p className="metric-value">{completed}</p>
        </article>
      </section>
      <DataTable data={tasks} columns={columns} title={t('serviceTasksTitle', 'Service Tasks')} subtitle={t('serviceTasksDesc', 'Pending and active requests assigned to you by admin')} />
    </div>
  );
}

