import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import type { Asset } from '../../types/domain';

export function AssetsPage() {
  const { role, user, hasPermission } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!role) return;
    api
      .getAssets(role, user?.labId)
      .then(setAssets)
      .catch((err: Error) => setError(err.message));
  }, [role, user?.labId]);

  const canCreate = role ? hasPermission('asset:create') : false;
  const canEdit = role ? hasPermission('asset:edit') : false;
  const canDelete = role ? hasPermission('asset:delete') : false;
  const canAssign = role ? hasPermission('asset:assign_lab') : false;
  const canRaiseMaintenance = role ? hasPermission('maintenance:raise') : false;

  const columns: TableColumn<Asset>[] = useMemo(
    () => [
      { key: 'name', header: 'Asset' },
      { key: 'category', header: 'Category' },
      { key: 'labId', header: 'Lab' },
      { key: 'status', header: 'Status' },
      {
        key: 'id',
        header: 'Actions',
        render: (_, row) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {canEdit ? (
              <button
                className="btn secondary-btn"
                type="button"
                onClick={async () => {
                  await api.updateAsset(role!, row.id, { status: 'Active' });
                  setAssets(await api.getAssets(role!, user?.labId));
                  setInfo('Asset updated.');
                }}
              >
                Edit
              </button>
            ) : null}
            {canAssign ? (
              <button
                className="btn secondary-btn"
                type="button"
                onClick={async () => {
                  await api.assignAssetToLab(role!, row.id, 'lab-chemistry');
                  setAssets(await api.getAssets(role!, user?.labId));
                }}
              >
                Assign Lab
              </button>
            ) : null}
            {canDelete ? (
              <button
                className="btn secondary-btn"
                type="button"
                onClick={async () => {
                  await api.deleteAsset(role!, row.id);
                  setAssets(await api.getAssets(role!, user?.labId));
                }}
              >
                Delete
              </button>
            ) : null}
            {canRaiseMaintenance ? (
              <button
                className="btn secondary-btn"
                type="button"
                onClick={async () => {
                  if (!user?.labId) return;
                  await api.raiseMaintenanceRequest('lab', {
                    assetId: row.id,
                    labId: user.labId,
                    issue: `Maintenance raised for ${row.name}`,
                    priority: 'Medium'
                  });
                  setInfo('Maintenance request raised.');
                }}
              >
                Raise Maintenance
              </button>
            ) : null}
            {!canEdit && !canDelete && !canAssign && !canRaiseMaintenance ? <span>{'--'}</span> : null}
          </div>
        )
      }
    ],
    [canAssign, canDelete, canEdit, canRaiseMaintenance, role, user?.labId]
  );

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>{role === 'lab' ? 'My Assets' : 'Assets'}</h2>
        <p>
          {canCreate ? 'You can create, edit, delete, and assign assets.' : null}
          {role === 'lab' ? ' You can only view assets assigned to your lab and raise maintenance requests.' : null}
          {role === 'service' ? ' You can view assets for service context only.' : null}
        </p>
        {canCreate ? (
          <button
            className="btn primary-btn"
            style={{ marginTop: 12, width: 180 }}
            type="button"
            onClick={async () => {
              await api.createAsset('admin', {
                assetCode: `ASSET-${Math.floor(1000 + Math.random() * 9000)}`,
                name: 'New Asset',
                category: 'Computer',
                location: 'CS Lab 1',
                labId: 'lab-cs-1',
                status: 'Active',
                warranty: '2027-12-31'
              });
              setAssets(await api.getAssets(role!, user?.labId));
              setInfo('Asset created.');
            }}
          >
            Add Asset
          </button>
        ) : null}
        {info ? <p style={{ marginTop: 8 }}>{info}</p> : null}
      </div>
      {error ? (
        <div className="card">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      ) : (
        <DataTable data={assets} columns={columns} title={role === 'lab' ? 'Lab Assets' : 'All Assets'} subtitle="Asset register with role-based actions" />
      )}
    </div>
  );
}
