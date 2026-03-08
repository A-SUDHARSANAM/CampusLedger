import React, { useEffect, useState } from 'react';
import { X, Wrench, UserCheck, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import type { MaintenanceRequest, UserRecord } from '../../types/domain';

// ── helpers ────────────────────────────────────────────────────────────────

const STATUS_TABS = ['All', 'Pending', 'Assigned', 'In Progress', 'Completed'] as const;
type TabLabel = typeof STATUS_TABS[number];

function statusClass(s: string) {
  const v = s.toLowerCase();
  if (v === 'completed') return 'maint-badge maint-badge-done';
  if (v === 'in progress' || v === 'in_progress') return 'maint-badge maint-badge-inprog';
  if (v === 'assigned') return 'maint-badge maint-badge-assigned';
  return 'maint-badge maint-badge-pending';
}

function priorityClass(p: string) {
  const v = p.toLowerCase();
  if (v === 'high' || v === 'critical') return 'maint-badge maint-badge-high';
  if (v === 'low') return 'maint-badge maint-badge-low';
  return 'maint-badge maint-badge-medium';
}

// ── component ──────────────────────────────────────────────────────────────

export function MaintenancePage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [requests, setRequests]         = useState<MaintenanceRequest[]>([]);
  const [serviceStaff, setServiceStaff] = useState<UserRecord[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [activeTab, setActiveTab]       = useState<TabLabel>('All');
  const [search, setSearch]             = useState('');

  // Assign modal state
  const [assignTarget, setAssignTarget]   = useState<MaintenanceRequest | null>(null);
  const [assigneeId, setAssigneeId]       = useState('');
  const [assignSaving, setAssignSaving]   = useState(false);
  const [assignError, setAssignError]     = useState('');

  async function refresh() {
    if (!role) return;
    try {
      const data = await api.getMaintenanceRequests(role, undefined);
      setRequests(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load requests.');
    }
  }

  useEffect(() => {
    setLoading(true);
    const tasks: Promise<unknown>[] = [refresh()];
    if (isAdmin) tasks.push(api.getServiceStaff().then(setServiceStaff));
    Promise.all(tasks).finally(() => setLoading(false));
  }, [role]);

  // ── filtering ──────────────────────────────────────────────────────────
  const filtered = requests.filter((r) => {
    if (activeTab !== 'All' && r.status.toLowerCase() !== activeTab.toLowerCase()) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.assetName.toLowerCase().includes(q) ||
        r.issue.toLowerCase().includes(q) ||
        r.requestId.toLowerCase().includes(q) ||
        (r.labName ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── counts per tab ─────────────────────────────────────────────────────
  const counts: Record<TabLabel, number> = {
    All: requests.length,
    Pending: requests.filter((r) => r.status.toLowerCase() === 'pending').length,
    Assigned: requests.filter((r) => r.status.toLowerCase() === 'assigned').length,
    'In Progress': requests.filter((r) => r.status.toLowerCase() === 'in progress').length,
    Completed: requests.filter((r) => r.status.toLowerCase() === 'completed').length,
  };

  // ── assign modal ───────────────────────────────────────────────────────
  function openAssign(req: MaintenanceRequest) {
    setAssignTarget(req);
    setAssigneeId(serviceStaff[0]?.id ?? '');
    setAssignError('');
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignTarget || !assigneeId) return;
    setAssignSaving(true);
    setAssignError('');
    try {
      await api.assignMaintenanceRequest('admin', assignTarget.id, assigneeId);
      setAssignTarget(null);
      await refresh();
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : 'Assignment failed.');
    } finally {
      setAssignSaving(false);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div className="dashboard-grid">
      {/* header */}
      <div className="card maint-ctrl-header">
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <Wrench size={20} /> Maintenance Control
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Admin assignment and request triage
          </p>
        </div>
      </div>

      {/* error banner */}
      {error && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* main card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* search */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-color)' }}>
          <input
            className="input"
            placeholder="Search records…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 400 }}
          />
        </div>

        {/* status tabs */}
        <div className="maint-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`maint-tab${activeTab === tab ? ' maint-tab-active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {counts[tab] > 0 && <span className="maint-tab-count">{counts[tab]}</span>}
            </button>
          ))}
        </div>

        {/* table */}
        {loading ? (
          <p style={{ padding: '24px 20px', color: 'var(--text-secondary)' }}>Loading…</p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: '24px 20px', color: 'var(--text-secondary)' }}>
            No {activeTab !== 'All' ? activeTab.toLowerCase() + ' ' : ''}maintenance requests found.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="maint-table">
              <thead>
                <tr>
                  <th>REQUEST ID</th>
                  <th>ASSET</th>
                  <th>LAB</th>
                  <th>ISSUE</th>
                  <th>STATUS</th>
                  <th>ASSIGNED TO</th>
                  <th>PRIORITY</th>
                  <th>DATE</th>
                  {isAdmin && <th>ACTIONS</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => (
                  <tr key={req.id}>
                    <td className="maint-mono">{req.requestId.slice(0, 8).toUpperCase()}</td>
                    <td>{req.assetName || '—'}</td>
                    <td>{req.labName || '—'}</td>
                    <td className="maint-issue-cell">{req.issue || '—'}</td>
                    <td><span className={statusClass(req.status)}>{req.status}</span></td>
                    <td>
                      {req.assignedTo
                        ? (serviceStaff.find((s) => s.id === req.assignedTo)?.name ?? 'Assigned')
                        : <span style={{ color: 'var(--text-tertiary)' }}>Unassigned</span>}
                    </td>
                    <td><span className={priorityClass(req.priority)}>{req.priority}</span></td>
                    <td className="maint-date">{req.createdAt ?? '—'}</td>
                    {isAdmin && (
                      <td>
                        {req.status.toLowerCase() !== 'completed' ? (
                          <button
                            className="btn secondary-btn maint-assign-btn"
                            type="button"
                            onClick={() => openAssign(req)}
                          >
                            <UserCheck size={13} />
                            {req.assignedTo ? 'Reassign' : 'Assign Service'}
                          </button>
                        ) : (
                          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>Completed</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Assign Modal ──────────────────────────────────────────── */}
      {assignTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setAssignTarget(null)}>
          <div className="modal-box" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><UserCheck size={16} style={{ marginRight: 6 }} /> Assign Service Staff</h3>
              <button className="modal-close-btn" type="button" onClick={() => setAssignTarget(null)}>
                <X size={16} />
              </button>
            </div>

            {/* issue summary */}
            <div className="maint-assign-summary">
              <div><span className="maint-assign-label">Asset</span> {assignTarget.assetName || '—'}</div>
              <div><span className="maint-assign-label">Lab</span> {assignTarget.labName || '—'}</div>
              <div><span className="maint-assign-label">Issue</span> {assignTarget.issue || '—'}</div>
              <div>
                <span className="maint-assign-label">Priority</span>
                <span className={priorityClass(assignTarget.priority)}>{assignTarget.priority}</span>
              </div>
            </div>

            <form onSubmit={handleAssign} className="modal-form">
              <label className="form-label">
                Service Staff *
                {serviceStaff.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '6px 0 0' }}>
                    No service staff found. Please add service staff users first.
                  </p>
                ) : (
                  <select
                    className="input"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    required
                  >
                    <option value="">— Select staff member —</option>
                    {serviceStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.email ? `(${s.email})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              {assignError && <p className="form-error">{assignError}</p>}

              <div className="modal-actions">
                <button type="button" className="btn secondary-btn" onClick={() => setAssignTarget(null)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn primary-btn"
                  disabled={assignSaving || serviceStaff.length === 0 || !assigneeId}
                >
                  {assignSaving ? 'Assigning…' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
