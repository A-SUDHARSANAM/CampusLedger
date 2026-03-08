import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Star, User, Wrench } from 'lucide-react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { MaintenanceRequest } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

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
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [staffInput, setStaffInput] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Recommendation state
  const [recommendations, setRecommendations] = useState<StaffRec[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [selectedRec, setSelectedRec] = useState<StaffRec | null>(null);

  async function load() {
    const rows = await api.getMaintenanceRequests('admin');
    setRequests(rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function startAssigning(row: MaintenanceRequest) {
    setAssigningId(row.id);
    setStaffInput('');
    setSelectedRec(null);
    setRecommendations([]);
    setRecLoading(true);
    try {
      const recs = await api.getStaffRecommendations(
        row.issue,
        row.priority.toLowerCase(),
        row.assetName,
      );
      setRecommendations(recs);
    } catch {
      // silent — admin can still assign manually
    } finally {
      setRecLoading(false);
    }
  }

  function cancelAssigning() {
    setAssigningId(null);
    setStaffInput('');
    setSelectedRec(null);
    setRecommendations([]);
  }

  async function handleAssign(requestId: string) {
    const assignee = staffInput.trim();
    if (!assignee) return;
    try {
      await api.assignMaintenanceRequest('admin', requestId, assignee);
      setStatusMsg(t('assigned', 'Assigned successfully.'));
      cancelAssigning();
      await load();
    } catch {
      setStatusMsg(t('assignFailed', 'Assignment failed. Check the staff ID.'));
    }
  }

  function pickRec(rec: StaffRec) {
    setSelectedRec(rec);
    setStaffInput(rec.user_id);
  }

  const columns: TableColumn<MaintenanceRequest>[] = useMemo(
    () => [
      { key: 'requestId', header: t('requestId', 'Request ID') },
      { key: 'assetName', header: t('asset', 'Asset') },
      { key: 'labName', header: t('labsTitle', 'Lab') },
      { key: 'issue', header: t('issue', 'Issue') },
      { key: 'status', header: t('status', 'Status') },
      {
        key: 'assignedTo',
        header: t('assignedTo', 'Assigned To'),
        render: (value) => String(value ?? t('unassigned', 'Unassigned')),
      },
      { key: 'priority', header: t('priority', 'Priority') },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) =>
          assigningId === row.id ? (
            /* ── Assignment panel ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 320 }}>

              {/* Recommendations header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wrench size={13} style={{ opacity: 0.6 }} />
                <span style={{
                  fontSize: '0.75rem', fontWeight: 700, opacity: 0.65,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  {t('recommendedStaff', 'Recommended Staff')}
                </span>
                {recLoading && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', opacity: 0.5 }} />}
              </div>

              {/* Recommendation chips */}
              {recLoading && (
                <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.5 }}>
                  {t('analysing', 'Analysing issue…')}
                </p>
              )}

              {!recLoading && recommendations.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {recommendations.map((rec, idx) => {
                    const chosen = staffInput === rec.user_id;
                    return (
                      <button
                        key={rec.user_id}
                        type="button"
                        title={rec.reason}
                        onClick={() => pickRec(rec)}
                        style={{
                          fontSize: '0.8rem',
                          padding: '5px 11px',
                          borderRadius: 20,
                          border: `1.5px solid ${chosen ? '#4F6EF7' : '#d1d5db'}`,
                          background: chosen ? '#EEF2FF' : 'var(--card-bg, #fff)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          fontWeight: chosen ? 700 : 400,
                          color: 'inherit',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                      >
                        {idx === 0 && (
                          <Star size={11} fill="#F59E0B" color="#F59E0B" />
                        )}
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
                  {t('noStaffFound', 'No staff found. Enter an ID manually.')}
                </p>
              )}

              {/* Reason tooltip for selected chip */}
              {selectedRec && (
                <p style={{
                  margin: 0, fontSize: '0.77rem', opacity: 0.7,
                  padding: '4px 8px', borderRadius: 6,
                  background: 'var(--hover-bg, rgba(79,110,247,0.06))',
                  borderLeft: '3px solid #4F6EF7',
                }}>
                  <strong>{selectedRec.name}</strong>: {selectedRec.reason}
                </p>
              )}

              {/* Manual input + confirm/cancel */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  className="btn secondary-btn"
                  type="text"
                  style={{ padding: '5px 10px', minWidth: 130, fontFamily: 'inherit' }}
                  placeholder={t('staffIdOrName', 'Staff ID')}
                  value={staffInput}
                  onChange={(e) => {
                    setStaffInput(e.target.value);
                    setSelectedRec(null);
                  }}
                />
                <button
                  className="btn primary-btn mini-btn"
                  type="button"
                  disabled={!staffInput.trim()}
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
    [t, assigningId, staffInput, recommendations, recLoading, selectedRec],
  );

  return (
    <div className="dashboard-grid">
      {statusMsg && (
        <p style={{ padding: '8px 0', opacity: 0.75, fontSize: '0.875em' }}>{statusMsg}</p>
      )}
      <DataTable
        data={requests}
        columns={columns}
        title={t('maintenanceControl', 'Maintenance Control')}
        subtitle={t('maintenanceControlSubtitle', 'Admin assignment and request triage')}
      />
    </div>
  );
}

