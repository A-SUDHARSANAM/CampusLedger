import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Link as LinkIcon, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import type { MaintenanceRequest } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

const PRIORITY_COLOR: Record<string, string> = {
  Critical: '#DC2626', High: '#EF4444', Medium: '#F59E0B', Low: '#22C55E',
};

const STATUS_COLOR: Record<string, string> = {
  Pending: '#F59E0B', 'In Progress': '#4F6EF7', Completed: '#22C55E',
};

function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLOR[priority] ?? '#6B7280';
  return (
    <span style={{
      fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px',
      borderRadius: 12, background: `${color}18`, color, letterSpacing: '0.04em',
    }}>
      {priority}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? '#6B7280';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color }}>{status}</span>
    </span>
  );
}

export function ServiceDashboardPage() {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(() => {
    api.getMaintenanceRequests('service')
      .then(setTasks)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useAutoRefresh(fetchTasks);

  const pending    = tasks.filter((r) => r.status === 'Pending').length;
  const inProgress = tasks.filter((r) => r.status === 'In Progress').length;
  const completed  = tasks.filter((r) => r.status === 'Completed').length;
  // Show only active (non-completed) tasks on the dashboard; completed are on Tasks page
  const activeTasks = tasks.filter((r) => r.status !== 'Completed');

  const kpiCards = [
    { label: t('assignedTasks', 'Assigned Tasks'), value: tasks.length,  color: '#4F6EF7', icon: <Wrench size={18} /> },
    { label: t('pending',       'Pending'),         value: pending,       color: '#F59E0B', icon: <Clock size={18} /> },
    { label: t('inProgress',    'In Progress'),     value: inProgress,    color: '#4F6EF7', icon: <AlertTriangle size={18} /> },
    { label: t('completed',     'Completed'),       value: completed,     color: '#22C55E', icon: <CheckCircle2 size={18} /> },
  ];

  return (
    <div className="dashboard-grid">
      {/* Header */}
      <div className="page-intro">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Wrench size={20} style={{ color: '#4F6EF7' }} />
          <h2 style={{ margin: 0 }}>{t('serviceDashboard', 'Service Dashboard')}</h2>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '0.88rem', opacity: 0.65 }}>
          {t('serviceOverview', 'Your assigned maintenance workload and real-time progress.')}
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
        {kpiCards.map((k) => (
          <article
            key={k.label}
            className="metric-card touch-card"
            style={{ borderTop: `3px solid ${k.color}` }}
          >
            <div className="metric-top">
              <p className="metric-title">{k.label}</p>
              <span style={{ color: k.color, opacity: 0.7 }}>{k.icon}</span>
            </div>
            <p className="metric-value" style={{ color: k.color }}>{k.value}</p>
          </article>
        ))}
      </div>

      {/* Active tasks section */}
      <section className="card">
        <div className="chart-head" style={{ marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0 }}>{t('myActiveTasks', 'My Active Tasks')}</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.82rem', opacity: 0.6 }}>
              {t('activeTaksDesc', 'Tasks assigned to you that are still open')}
            </p>
          </div>
          <Link
            to="/service/tasks"
            style={{ fontSize: '0.83rem', color: '#4F6EF7', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontWeight: 600 }}
          >
            <LinkIcon size={13} /> {t('viewAll', 'View All')}
          </Link>
        </div>

        {loading && (
          <p style={{ opacity: 0.5, fontSize: '0.88rem' }}>{t('loading', 'Loading…')}</p>
        )}

        {!loading && activeTasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '28px 0', opacity: 0.45 }}>
            <CheckCircle2 size={36} style={{ margin: '0 auto 8px', display: 'block' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>{t('noActiveTasks', 'No active tasks')}</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.83rem' }}>
              {t('noActiveTasksDesc', 'All clear! New assignments will appear here.')}
            </p>
          </div>
        )}

        {!loading && activeTasks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeTasks.map((task) => (
              <div
                key={task.id}
                className="touch-card"
                style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--border-color, #e5e7eb)',
                  borderLeft: `4px solid ${STATUS_COLOR[task.status] ?? '#6B7280'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 6 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{task.assetName || '—'}</span>
                    <span style={{ fontSize: '0.78rem', opacity: 0.55 }}>
                      {task.requestId} · {task.labName || '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <PriorityBadge priority={task.priority} />
                    <StatusDot status={task.status} />
                  </div>
                </div>

                {/* Issue description */}
                <p style={{
                  margin: 0, fontSize: '0.85rem', opacity: 0.75,
                  borderLeft: '2px solid var(--border-color, #e5e7eb)',
                  paddingLeft: 8,
                }}>
                  {task.issue || '—'}
                </p>

                {/* Footer: reported date + action link */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                  {task.createdAt && (
                    <span style={{ fontSize: '0.76rem', opacity: 0.45 }}>
                      {t('reported', 'Reported')}: {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  )}
                  <Link
                    to="/service/tasks"
                    style={{ fontSize: '0.8rem', color: '#4F6EF7', fontWeight: 600, textDecoration: 'none' }}
                  >
                    {t('updateStatus', 'Update Status')} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
