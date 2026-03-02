import React, { useEffect, useMemo, useState } from 'react';
import { QrCode, ScanLine, Wrench } from 'lucide-react';
import { DataList, DataTable, type ListItem, type TableColumn } from '../../components/tables';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';
import type { Asset, MaintenanceRequest, Priority } from '../../types/domain';

export function LabMaintenancePage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [statusMessage, setStatusMessage] = useState('');

  async function loadData() {
    if (!user?.labId) return;
    const [assetRows, maintenanceRows] = await Promise.all([api.getAssets('lab', user.labId), api.getMaintenanceRequests('lab', user.labId)]);
    setAssets(assetRows);
    setRequests(maintenanceRows);
  }

  useEffect(() => {
    loadData();
  }, [user?.labId]);

  const historyItems: ListItem[] = useMemo(
    () =>
      requests.flatMap((request) =>
        request.history.map((entry) => ({
          id: `${request.requestId}-${entry.id}`,
          title: `${request.requestId} - ${entry.status}`,
          subtitle: entry.remarks,
          meta: `${entry.date} | ${entry.updatedBy}`,
          status: entry.status === 'Completed' ? 'active' : entry.status === 'In Progress' ? 'pending' : 'critical'
        }))
      ),
    [requests]
  );

  const columns: TableColumn<MaintenanceRequest>[] = useMemo(
    () => [
      { key: 'assetCode', header: 'Asset Code' },
      { key: 'assetName', header: 'Asset' },
      { key: 'issue', header: 'Issue' },
      { key: 'labName', header: 'Reported By' },
      { key: 'status', header: 'Status' },
      { key: 'priority', header: 'Priority' }
    ],
    []
  );

  async function raiseRequest(issue: string) {
    if (!user?.labId || assets.length === 0) {
      setStatusMessage('No lab assets available to raise a request.');
      return;
    }
    const targetAsset = assets[0];
    await api.raiseMaintenanceRequest('lab', {
      assetId: targetAsset.id,
      labId: user.labId,
      issue,
      priority: 'Medium' as Priority
    });
    await loadData();
    setStatusMessage('Maintenance request created.');
  }

  return (
    <div className="dashboard-grid">
      <div className="page-intro page-intro-row">
        <div>
          <h2>Maintenance</h2>
          <p>View and raise maintenance requests</p>
        </div>
        <button
          className="btn primary-btn page-action-primary"
          type="button"
          onClick={() => raiseRequest('System reported by quick scan')}
        >
          <Wrench size={15} /> Report Issue
        </button>
      </div>

      <section className="card quick-scan-card">
        <h3>
          <ScanLine size={16} /> Quick Scan
        </h3>
        <div className="scanner-panel">
          <div className="scanner-icon">
            <QrCode size={30} />
          </div>
          <h4>Scan Asset QR Code</h4>
          <p>Point your device camera at the asset&apos;s QR code to quickly log a maintenance issue.</p>
          <button className="btn secondary-btn scanner-btn" type="button" onClick={() => raiseRequest('Issue captured using QR quick scan')}>
            <ScanLine size={14} /> Open Scanner
          </button>
        </div>
      </section>
      {statusMessage ? <p className="settings-status">{statusMessage}</p> : null}

      <DataTable data={requests} columns={columns} title="Maintenance Log" subtitle="Lab request history and current statuses" />
      <DataList items={historyItems} title="Maintenance History" subtitle="Status timeline for all requests" />
    </div>
  );
}
