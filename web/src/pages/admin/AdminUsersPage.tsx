import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { UserRecord } from '../../types/domain';

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);

  useEffect(() => {
    api.getUsers('admin').then(setUsers);
  }, []);

  const columns: TableColumn<UserRecord>[] = useMemo(
    () => [
      { key: 'name', header: 'Name' },
      { key: 'role', header: 'Role (admin | lab | service)' },
      { key: 'email', header: 'Email' },
      { key: 'assignedLab', header: 'Assigned Lab' }
    ],
    []
  );

  return (
    <div className="dashboard-grid">
      <DataTable data={users} columns={columns} title="Users" subtitle="Role assignments and lab mapping" />
    </div>
  );
}
