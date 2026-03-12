import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Star, User, Wrench } from 'lucide-react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { MaintenanceRequest } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

// ── Priority helpers ─────────────────────────────────────────────────────────
const PRIORITY_WEIGHT: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const PRIORITY_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  Critical: { bg: 'rgba(239,68,68,.13)', text: '#dc2626', border: 'rgba(239,68,68,.4)' },
  High: { bg: 'rgba(249,115,22,.13)', text: '#ea580c', border: 'rgba(249,115,22,.4)' },
  Medium: { bg: 'rgba(234,179,8,.13)', text: '#ca8a04', border: 'rgba(234,179,8,.4)' },
  Low: { bg: 'rgba(34,197,94,.13)', text: '#16a34a', border: 'rgba(34,197,94,.4)' },
};

function PriorityBadge({ priority }: { priority: string }) {
  const c = PRIORITY_COLOR[priority] ?? PRIORITY_COLOR.Medium;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      {(priority === 'Critical' || priority === 'High') && <AlertTriangle size={10} />}
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    'Pending': { bg: 'rgba(234,179,8,.13)', text: '#ca8a04' },
    'In Progress': { bg: 'rgba(59,130,246,.13)', text: '#2563eb' },
    'Completed': { bg: 'rgba(34,197,94,.13)', text: '#16a34a' },
  };
  const c = colors[status] ?? { bg: 'rgba(148,163,184,.13)', text: '#64748b' };
  return (
    <span style={{
      display: 'inline-block', padding: '3px 9px', borderRadius: 20,
      fontSize: 11, fontWeight: 700, background: c.bg, color: c.text,
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

type StaffRec = {
  user_id: string;
  name: string;
  email: string;
  completed_count: number;
  active_count: number;
  matched_keywords: string[];
  score: number;
  reason: string;
};

export function AdminMaintenancePage() {
  const { t } = useLanguage();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const [assigningId, setAssigningId] = useState<string | null>(null);
  // staffInputId = UUID of the selected staff; staffInputName = human-readable name shown in the field
  const [staffInputId, setStaffInputId] = useState('');
  const [staffInputName, setStaffInputName] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const [recommendations, setRecommendations] = useState<StaffRec[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [selectedRec, setSelectedRec] = useState<StaffRec | null>(null);

  async function load() {
    const rows = await api.getMaintenanceRequests('admin');
    setRequests(rows);
  }

  useEffect(() => { load(); }, []);
  useAutoRefresh(load);

  async function startAssigning(row: MaintenanceRequest) {
    setAssigningId(row.id);
    setStaffInputId('');
    setStaffInputName('');
    setSelectedRec(null);
    setRecommendations([]);
    setRecLoading(true);
    try {
      const recs = await api.getStaffRecommendations(row.issue, row.priority.toLowerCase(), row.assetName);
      setRecommendations(recs);
    } catch {
      // silent — admin can still assign via chips
    } finally {
      setRecLoading(false);
    }
  }

  function cancelAssigning() {
    setAssigningId(null);
    setStaffInputId('');
    setStaffInputName('');
    setSelectedRec(null);
    setRecommendations([]);
  }

  async function handleAssign(requestId: string) {
    const assigneeId = staffInputId.trim();
    if (!assigneeId) {
      setStatusMsg(t('selectStaffFirst', 'Please select a staff member from the recommendations.'));
      return;
    }
    try {
      await api.assignMaintenanceRequest('admin', requestId, assigneeId);
      setStatusMsg(t('assigned', '✓ Task assigned successfully.'));
      cancelAssigning();
      await load();
    } catch (err: unknown) {
      setStatusMsg(t('assignFailed', `Assignment failed: ${err instanceof Error ? err.message : 'Unknown error'}`));
    }
  }

  function pickRec(rec: StaffRec) {
    setSelectedRec(rec);
    setStaffInputId(rec.user_id);
    setStaffInputName(rec.name);
  }

  // ── Sorted + filtered list ───────────────────────────────────────────────
  const sortedFiltered = useMemo(() => {
    let list = [...requests];
    if (filterPriority !== 'all') list = list.filter((r) => r.priority.toLowerCase() === filterPriority);
    if (filterStatus !== 'all') list = list.filter((r) => r.status.toLowerCase().replace(/ /g, '_') === filterStatus);
    list.sort((a, b) => (PRIORITY_WEIGHT[b.priority] ?? 0) - (PRIORITY_WEIGHT[a.priority] ?? 0));
    return list;
  }, [requests, filterPriority, filterStatus]);

  const kpiPending = requests.filter((r) => r.status === 'Pending').length;
  const kpiProgress = requests.filter((r) => r.status === 'In Progress').length;
  const kpiDone = requests.filter((r) => r.status === 'Completed').length;

  const columns: TableColumn<MaintenanceRequest>[] = useMemo(
    () => [
      {
        key: 'priority',
        header: t('priority', 'Priority'),
        render: (v) => <PriorityBadge priority={String(v)} />,
      },
      {
        key: 'assetName',
        header: t('asset', 'Asset'),
        render: (v, row) => (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{String(v)}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, opacity: 0.5 }}>{row.requestId.slice(0, 8)}</span>
          </div>
        ),
      },
      { key: 'labName', header: t('labsTitle', 'Lab') },
      { key: 'issue', header: t('issue', 'Issue'), render: (v) => <span style={{ fontSize: 12 }}>{String(v)}</span> },
      {
        key: 'status',
        header: t('status', 'Status'),
        render: (v) => <StatusBadge status={String(v)} />,
      },
      {
        key: 'assignedTo',
        header: t('assignedTo', 'Assigned To'),
        render: (v) => v
          ? <span style={{ fontSize: 12, fontWeight: 600, color: '#3b82f6' }}>{String(v)}</span>
          : <span style={{ opacity: 0.4, fontSize: 12 }}>—</span>,
      },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) =>
          assigningId === row.id ? (
            /* ── Assignment panel ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 300 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wrench size={13} style={{ opacity: 0.6 }} />
                <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('recommendedStaff', 'Recommended Staff')}
                </span>
                {recLoading && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', opacity: 0.5 }} />}
              </div>

              {recLoading && <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.5 }}>{t('analysing', 'Analysing issue…')}</p>}

              {!recLoading && recommendations.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {recommendations.map((rec, idx) => {
                    const chosen = staffInputId === rec.user_id;
                    return (
                      <button
                        key={rec.user_id}
                        type="button"
                        title={rec.reason}
                        onClick={() => pickRec(rec)}
                        style={{
                          fontSize: '0.8rem', padding: '5px 11px', borderRadius: 20,
                          border: `1.5px solid ${chosen ? '#4F6EF7' : '#d1d5db'}`,
                          background: chosen ? '#EEF2FF' : 'var(--card-bg, #fff)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                          fontWeight: chosen ? 700 : 400, color: chosen ? '#4F6EF7' : 'inherit',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                      >
                        {idx === 0 && <Star size={11} fill="#F59E0B" color="#F59E0B" />}
                        <User size={11} style={{ opacity: 0.5 }} />
                        {rec.name}
                        {rec.active_count === 0 && (
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
                        )}
                        {chosen && <CheckCircle2 size={11} color="#4F6EF7" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {!recLoading && recommendations.length === 0 && (
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.5 }}>
                  {t('noStaffFound', 'No staff recommendations available.')}
                </p>
              )}

              {selectedRec && (
                <p style={{
                  margin: 0, fontSize: '0.77rem', opacity: 0.75,
                  padding: '4px 8px', borderRadius: 6,
                  background: 'var(--hover-bg, rgba(79,110,247,0.06))',
                  borderLeft: '3px solid #4F6EF7',
                }}>
                  <strong>{selectedRec.name}</strong>: {selectedRec.reason}
                </p>
              )}

              {/* Selected staff display + confirm/cancel */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {staffInputName && (
                  <span style={{
                    padding: '5px 11px', borderRadius: 20, fontSize: '0.8rem',
                    background: 'var(--accent-subtle, #EEF2FF)', color: '#4F6EF7',
                    fontWeight: 600, border: '1.5px solid #4F6EF7',
                  }}>
                    {staffInputName}
                  </span>
                )}
                <button
                  className="btn primary-btn mini-btn"
                  type="button"
                  disabled={!staffInputId.trim()}
                  onClick={() => handleAssign(row.id)}
                >
                  {t('confirm', 'Confirm')}
                </button>
                <button
                  className="btn secondary-btn mini-btn"
                  type="button"
                  onClick={cancelAssigning}
                >
                  {t('cancel', 'Cancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              className="btn secondary-btn"
              type="button"
              onClick={() => startAssigning(row)}
              disabled={row.status === 'Completed'}
            >
              <RefreshCw size={13} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
              {row.assignedTo ? t('reassign', 'Reassign') : t('assignService', 'Assign Service')}
            </button>
          ),
      },
    ],
    [t, assigningId, staffInputId, staffInputName, recommendations, recLoading, selectedRec],
  );

  return (
    <div className="dashboard-grid">
      {/* KPI strips */}
      <section className="metric-grid" style={{ marginBottom: 8 }}>
        <article className="metric-card">
          <p className="metric-title">{t('pending', 'Pending')}</p>
          <p className="metric-value">{kpiPending}</p>
        </article>
        <article className="metric-card">
          <p className="metric-title">{t('inProgress', 'In Progress')}</p>
          <p className="metric-value">{kpiProgress}</p>
        </article>
        <article className="metric-card">
          <p className="metric-title">{t('completed', 'Completed')}</p>
          <p className="metric-value">{kpiDone}</p>
        </article>
      </section>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setFilterPriority(p)}
            className={`btn ${filterPriority === p ? 'primary-btn' : 'secondary-btn'} mini-btn`}
            style={{ textTransform: 'capitalize' }}
          >
            {p === 'all' ? 'All Priorities' : p}
          </button>
        ))}
        <span style={{ opacity: 0.3, alignSelf: 'center' }}>|</span>
        {(['all', 'pending', 'in_progress', 'completed'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilterStatus(s)}
            className={`btn ${filterStatus === s ? 'primary-btn' : 'secondary-btn'} mini-btn`}
            style={{ textTransform: 'capitalize' }}
          >
            {s === 'all' ? 'All Status' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {statusMsg && (
        <p style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--accent-subtle, #EEF2FF)', color: '#4F6EF7', fontSize: '0.875em', fontWeight: 600 }}>
          {statusMsg}
        </p>
      )}

      <DataTable
        data={sortedFiltered}
        columns={columns}
        title={t('maintenanceControl', 'Maintenance Control')}
        subtitle={t('maintenanceControlSubtitle', 'Click "Assign Service" on any row and pick a staff member from the recommendations')}
      />
    </div>
  );
}
