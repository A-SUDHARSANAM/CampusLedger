import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { UserRecord } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

export function AdminUsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserRecord[]>([]);

  useEffect(() => {
    api.getUsers('admin').then(setUsers);
  }, []);

  const columns: TableColumn<UserRecord>[] = useMemo(
    () => [
      { key: 'name', header: t('name', 'Name') },
      { key: 'role', header: t('role', 'Role') },
      { key: 'email', header: t('email', 'Email') },
      { key: 'assignedLab', header: t('assignedLab', 'Assigned Lab') }
    ],
    [t]
  );

  return (
    <div className="dashboard-grid">
      <DataTable data={users} columns={columns} title={t('usersTitle', 'Users')} subtitle={t('usersSubtitle', 'Role assignments and lab mapping')} />
    </div>
  );
}
