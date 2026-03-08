import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../hooks/useAuth';

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

  useEffect(() => {
    api.getLabKpis().then(setKpis);
  }, []);

  const fetchQueries = (techId: string) => {
    setLoadingQueries(true);
    api
      .getTechnicianStudentQueries(techId)
      .then((data) => setQueries(data as unknown as StudentQuery[]))
      .finally(() => setLoadingQueries(false));
  };

  useEffect(() => {
    if (user?.id) fetchQueries(user.id);
  }, [user?.id]);

  const refreshQueries = () => {
    if (user?.id) fetchQueries(user.id);
  };

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
    </div>
  );
}
