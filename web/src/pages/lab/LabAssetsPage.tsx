import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import type { Asset } from '../../types/domain';

export function LabAssetsPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    if (!user?.labId) return;
    api.getAssets('lab', user.labId).then(setAssets);
  }, [user?.labId]);

  const columns: TableColumn<Asset>[] = useMemo(
    () => [
      { key: 'assetCode', header: 'Asset Code' },
      { key: 'name', header: 'Name' },
      { key: 'category', header: 'Category' },
      { key: 'location', header: 'Location' },
      { key: 'status', header: 'Status' },
      { key: 'warranty', header: 'Warranty' }
    ],
    []
  );

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>My Assets</h2>
        <p>You can view assets assigned to your lab and raise maintenance requests.</p>
      </div>
      <DataTable data={assets} columns={columns} title="Lab Assets" subtitle="Read-only view for lab incharge" />
    </div>
  );
}
