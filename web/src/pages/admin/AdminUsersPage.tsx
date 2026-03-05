import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { UserRecord } from '../../types/domain';
import type { Role } from '../../types/auth';
import { useLanguage } from '../../context/LanguageContext';

const ROLE_OPTIONS: Role[] = ['admin', 'lab', 'service', 'purchase_dept'];

export function AdminUsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [statusMsg, setStatusMsg] = useState('');

  async function load() {
    const rows = await api.getUsers('admin');
    setUsers(rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(userId: string) {
    try {
      await api.approveUser(userId);
      setStatusMsg(t('userApproved', 'User approved.'));
      await load();
    } catch {
      setStatusMsg(t('approveFailed', 'Approval failed.'));
    }
  }

  async function handleRoleChange(userId: string, role: Role) {
    try {
      await api.updateUserRole(userId, role);
      setStatusMsg(t('roleUpdated', 'Role updated.'));
      await load();
    } catch {
      setStatusMsg(t('roleFailed', 'Role update failed.'));
    }
  }

  async function handleDelete(userId: string) {
    if (!window.confirm(t('confirmDelete', 'Delete this user?'))) return;
    try {
      await api.deleteUser(userId);
      setStatusMsg(t('userDeleted', 'User deleted.'));
      await load();
    } catch {
      setStatusMsg(t('deleteFailed', 'Delete failed.'));
    }
  }

  const columns: TableColumn<UserRecord>[] = useMemo(
    () => [
      { key: 'name', header: t('name', 'Name') },
      { key: 'email', header: t('email', 'Email') },
      {
        key: 'role',
        header: t('role', 'Role'),
        render: (_, row) => (
          <select
            className="btn secondary-btn mini-btn"
            value={row.role}
            onChange={(e) => handleRoleChange(row.id, e.target.value as Role)}
            style={{ padding: '2px 6px', cursor: 'pointer' }}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        )
      },
      { key: 'assignedLab', header: t('assignedLab', 'Assigned Lab') },
      {
        key: 'status',
        header: t('status', 'Status'),
        render: (_, row) => (
          <span style={{ color: row.is_approved ? 'var(--color-success, green)' : 'var(--color-warning, orange)', fontWeight: 600 }}>
            {row.is_approved ? t('approved', 'Approved') : t('pending', 'Pending')}
          </span>
        )
      },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) => (
          <div style={{ display: 'flex', gap: 6 }}>
            {!row.is_approved && (
              <button className="btn primary-btn mini-btn" type="button" onClick={() => handleApprove(row.id)}>
                {t('approve', 'Approve')}
              </button>
            )}
            <button className="btn danger-btn mini-btn" type="button" onClick={() => handleDelete(row.id)}>
              {t('delete', 'Delete')}
            </button>
          </div>
        )
      }
    ],
    [t, users]
  );

  return (
    <div className="dashboard-grid">
      {statusMsg && <p style={{ padding: '8px 0', opacity: 0.75, fontSize: '0.875em' }}>{statusMsg}</p>}
      <DataTable data={users} columns={columns} title={t('usersTitle', 'Users')} subtitle={t('usersSubtitle', 'Role assignments, approvals and lab mapping')} />
    </div>
  );
}

