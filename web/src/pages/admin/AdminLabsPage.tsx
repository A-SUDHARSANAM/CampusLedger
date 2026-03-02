import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { LabInfo } from '../../types/domain';

export function AdminLabsPage() {
  const [labs, setLabs] = useState<LabInfo[]>([]);

  useEffect(() => {
    api.getLabs('admin').then(setLabs);
  }, []);

  const columns: TableColumn<LabInfo>[] = useMemo(
    () => [
      { key: 'name', header: 'Lab Name' },
      { key: 'department', header: 'Department' },
      { key: 'assetCount', header: 'Asset Count' },
      { key: 'incharge', header: 'Incharge' }
    ],
    []
  );

  return (
    <div className="dashboard-grid">
      <DataTable data={labs} columns={columns} title="Labs" subtitle="Lab directory and ownership overview" />
    </div>
  );
}
