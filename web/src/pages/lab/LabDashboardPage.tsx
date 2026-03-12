import React, { useCallback, useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { Activity, TrendingDown, TrendingUp, MapPin, AlertTriangle } from 'lucide-react';
import { api, AssetUtilizationItem } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

type LabKpis = {
  myAssets: number;
  active: number;
  damaged: number;
  underMaintenance: number;
};

type StudentQuery = {
  id: string;
  student_name: string;
  student_id: string;
  asset_name?: string;
  issue_description: string;
  priority: string;
  created_at: string;
  status: string;
};

export function LabDashboardPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [kpis, setKpis] = useState<LabKpis | null>(null);
  const [queries, setQueries] = useState<StudentQuery[]>([]);
  const [loadingQueries, setLoadingQueries] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [utilization, setUtilization] = useState<{ month: string; items: AssetUtilizationItem[] } | null>(null);

  useEffect(() => {
    api.getLabKpis().then(setKpis);
    api.getAssetUtilization(user?.labId).then(setUtilization);
  }, [user?.labId]);

  useAutoRefresh(() => {
    api.getLabKpis().then(setKpis);
    api.getAssetUtilization(user?.labId).then(setUtilization);
  });

  const fetchQueries = useCallback((techId: string) => {
    setLoadingQueries(true);
    api
      .getTechnicianStudentQueries(techId)
      .then((data) => setQueries(data as unknown as StudentQuery[]))
      .finally(() => setLoadingQueries(false));
  }, []);

  useEffect(() => {
    if (user?.id) fetchQueries(user.id);
  }, [user?.id, fetchQueries]);

  const refreshQueries = () => {
    if (user?.id) fetchQueries(user.id);
  };

  useAutoRefresh(() => { if (user?.id) fetchQueries(user.id); });

  const handleReview = async (queryId: string, decision: 'valid' | 'invalid') => {
    setActionLoading(queryId + decision);
    setActionError(null);
    try {
      await api.reviewStudentQuery(queryId, decision);
      refreshQueries();
    } catch {
      setActionError('Action failed. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleConvert = async (queryId: string) => {
    setActionLoading(queryId + 'convert');
    setActionError(null);
    try {
      await api.convertQueryToMaintenance(queryId);
      refreshQueries();
    } catch {
      setActionError('Failed to create maintenance request.');
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status: string) => {
    const cls = status === 'reviewed' ? 'sq-badge-reviewed'
      : status === 'rejected' ? 'sq-badge-rejected'
      : 'sq-badge-pending';
    return <span className={`sq-badge ${cls}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };

  const priorityBadge = (priority: string) => {
    const p = priority.toLowerCase();
    const cls = p === 'high' ? 'sq-badge-high' : p === 'low' ? 'sq-badge-low' : 'sq-badge-medium';
    return <span className={`sq-badge ${cls}`}>{priority}</span>;
  };

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>{t('labDashboard', 'Lab Dashboard')}</h2>
        <p>{t('labOverview', 'Lab-specific asset and maintenance overview.')}</p>
      </div>
      <div className="metric-grid">
        {[
          { title: t('myAssets', 'My Assets'), value: kpis?.myAssets ?? 0 },
          { title: t('active', 'Active'), value: kpis?.active ?? 0 },
          { title: t('damaged', 'Damaged'), value: kpis?.damaged ?? 0 },
          { title: t('underMaintenance', 'Under Maintenance'), value: kpis?.underMaintenance ?? 0 }
        ].map((item) => (
          <article key={item.title} className="metric-card">
            <p className="metric-title">{item.title}</p>
            <p className="metric-value">{item.value}</p>
          </article>
        ))}
      </div>

      {/* Student Reported Issues */}
      <div className="card sq-section">
        <div className="sq-header">
          <h2 className="sq-title">Student Reported Issues</h2>
          <button className="sq-refresh-btn" onClick={refreshQueries} disabled={loadingQueries}>
            {loadingQueries ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        {actionError && <p className="sq-error">{actionError}</p>}
        {loadingQueries ? (
          <p className="sq-loading">Loading…</p>
        ) : queries.length === 0 ? (
          <p className="sq-empty">No student-reported issues assigned to you.</p>
        ) : (
          <div className="sq-table-wrapper">
            <table className="sq-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Student ID</th>
                  <th>Asset</th>
                  <th>Issue Description</th>
                  <th>Priority</th>
                  <th>Reported Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queries.map((q) => (
                  <tr key={q.id}>
                    <td>{q.student_name}</td>
                    <td className="sq-mono">{q.student_id}</td>
                    <td>{q.asset_name ?? '—'}</td>
                    <td className="sq-desc">{q.issue_description}</td>
                    <td>{priorityBadge(q.priority)}</td>
                    <td className="sq-date">{new Date(q.created_at).toLocaleDateString()}</td>
                    <td>{statusBadge(q.status)}</td>
                    <td className="sq-actions">
                      {q.status === 'pending' && (
                        <>
                          <button
                            className="sq-btn sq-btn-valid"
                            disabled={!!actionLoading}
                            onClick={() => handleReview(q.id, 'valid')}
                          >
                            {actionLoading === q.id + 'valid' ? '…' : 'Mark Valid'}
                          </button>
                          <button
                            className="sq-btn sq-btn-invalid"
                            disabled={!!actionLoading}
                            onClick={() => handleReview(q.id, 'invalid')}
                          >
                            {actionLoading === q.id + 'invalid' ? '…' : 'Mark Invalid'}
                          </button>
                        </>
                      )}
                      {q.status === 'reviewed' && (
                        <button
                          className="sq-btn sq-btn-convert"
                          disabled={!!actionLoading}
                          onClick={() => handleConvert(q.id)}
                        >
                          {actionLoading === q.id + 'convert' ? '…' : 'Create Maintenance Request'}
                        </button>
                      )}
                      {(q.status === 'rejected' || q.status === 'converted') && (
                        <span className="sq-no-action">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Asset Utilization Intelligence */}
      {utilization && <AssetUtilizationSection data={utilization} />}
    </div>
  );
}

// ── Asset Utilization Intelligence panel ─────────────────────────────────────

function statusCls(s: AssetUtilizationItem['status']) {
  if (s === 'high_usage') return 'high-usage';
  if (s === 'underused')  return 'underused';
  return 'optimal';
}

function StatusIcon({ status }: { status: AssetUtilizationItem['status'] }) {
  if (status === 'high_usage') return <TrendingUp size={11} />;
  if (status === 'underused')  return <TrendingDown size={11} />;
  return <Activity size={11} />;
}

function StatusLabel({ status }: { status: AssetUtilizationItem['status'] }) {
  if (status === 'high_usage') return <>High Usage</>;
  if (status === 'underused')  return <>Underused</>;
  return <>Optimal</>;
}

function AssetUtilizationSection({ data }: { data: { month: string; items: AssetUtilizationItem[] } }) {
  const items = data.items;
  const optimal   = items.filter((i) => i.status === 'normal').length;
  const underused = items.filter((i) => i.status === 'underused').length;
  const highUsage = items.filter((i) => i.status === 'high_usage').length;

  const chartData = items.map((i) => ({
    name: i.asset_name.length > 16 ? i.asset_name.slice(0, 14) + '…' : i.asset_name,
    hours: i.monthly_usage,
    fill: i.status === 'high_usage' ? '#EF4444' : i.status === 'underused' ? '#F59E0B' : '#4F6EF7',
  }));

  return (
    <div className="card util-section">
      <div className="util-section-header">
        <Activity size={20} color="var(--accent-primary, #4F6EF7)" />
        <h3>Asset Utilization Intelligence</h3>
        <span className="util-month-tag">{data.month}</span>
      </div>

      {/* KPI strip */}
      <div className="util-kpi-strip">
        <div className="util-kpi-tile optimal">
          <span className="util-kpi-label">Optimal</span>
          <span className="util-kpi-value">{optimal}</span>
        </div>
        <div className="util-kpi-tile underused">
          <span className="util-kpi-label">Underused</span>
          <span className="util-kpi-value">{underused}</span>
        </div>
        <div className="util-kpi-tile high-usage">
          <span className="util-kpi-label">High Usage</span>
          <span className="util-kpi-value">{highUsage}</span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="util-chart-wrapper">
        <p className="util-chart-title">Monthly Usage Hours per Asset</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e5e7eb)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
              label={{ value: 'hrs', angle: -90, position: 'insideLeft', offset: 10, style: { fontSize: 10, fill: 'var(--text-secondary)' } }}
            />
            <Tooltip
              formatter={(v) => [`${v} hrs`, 'Usage']}
              contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Asset cards */}
      <div className="util-cards-grid">
        {items.map((item) => {
          const cls = statusCls(item.status);
          return (
            <div key={item.asset_id} className={`util-card ${cls}`}>
              <div className="util-card-header">
                <span className="util-card-name">{item.asset_name}</span>
                <span className={`util-badge ${cls}`}>
                  <StatusIcon status={item.status} />
                  <StatusLabel status={item.status} />
                </span>
              </div>
              <div className="util-card-usage">
                {item.monthly_usage}<span>hrs / month</span>
              </div>
              {item.recommendation && (
                <div className="util-card-rec">
                  {item.status === 'underused'
                    ? <MapPin size={12} color="var(--warning, #F59E0B)" />
                    : <AlertTriangle size={12} color="var(--danger, #EF4444)" />}
                  {item.recommendation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
