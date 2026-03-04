import React, { useEffect, useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { Asset } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

const LAB_ASSIGNMENTS = [
  { id: 'lab-cs-1', label: 'CS Lab 1' },
  { id: 'lab-mech', label: 'Mech Lab' },
  { id: 'lab-ece', label: 'ECE Lab' },
  { id: 'lab-chem', label: 'Chemistry Lab' }
];

export function AdminAssetsPage() {
  const { t } = useLanguage();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');

  async function loadAssets() {
    const rows = await api.getAssets('admin');
    setAssets(rows);
  }

  useEffect(() => {
    loadAssets().catch((err: Error) => setError(err.message));
  }, []);

  const filteredAssets = useMemo(
    () =>
      assets.filter((asset) => {
        const passQuery =
          !query ||
          asset.name.toLowerCase().includes(query.toLowerCase()) ||
          asset.assetCode.toLowerCase().includes(query.toLowerCase());
        const passCategory = category === 'all' || asset.category === category;
        const passStatus = status === 'all' || asset.status === status;
        return passQuery && passCategory && passStatus;
      }),
    [assets, category, query, status]
  );

  const categories = useMemo(() => Array.from(new Set(assets.map((item) => item.category))), [assets]);

  const columns: TableColumn<Asset>[] = useMemo(
    () => [
      { key: 'assetCode', header: t('assetCode', 'Asset Code') },
      { key: 'name', header: t('asset', 'Asset') },
      { key: 'category', header: t('category', 'Category') },
      { key: 'location', header: t('location', 'Location') },
      { key: 'status', header: t('status', 'Status') },
      { key: 'warranty', header: t('warranty', 'Warranty') },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn secondary-btn"
              type="button"
              onClick={async () => {
                await api.updateAsset('admin', row.id, { status: row.status === 'Damaged' ? 'Active' : 'Damaged' });
                await loadAssets();
              }}
            >
              {t('edit', 'Edit')}
            </button>
            <button
              className="btn secondary-btn"
              type="button"
              onClick={async () => {
                const current = LAB_ASSIGNMENTS.findIndex((lab) => lab.label === row.location);
                const next = LAB_ASSIGNMENTS[(current + 1) % LAB_ASSIGNMENTS.length];
                await api.assignAssetToLab('admin', row.id, next.id);
                await loadAssets();
              }}
            >
              {t('assignLab', 'Assign Lab')}
            </button>
            <button
              className="btn secondary-btn"
              type="button"
              onClick={async () => {
                await api.deleteAsset('admin', row.id);
                await loadAssets();
              }}
            >
              {t('delete', 'Delete')}
            </button>
          </div>
        )
      }
    ],
    [t]
  );

  function exportCsv() {
    const header = [t('assetCode', 'Asset Code'), t('name', 'Name'), t('category', 'Category'), t('location', 'Location'), t('status', 'Status'), t('warranty', 'Warranty')];
    const rows = filteredAssets.map((asset) => [asset.assetCode, asset.name, asset.category, asset.location, asset.status, asset.warranty]);
    const csv = [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'assets-export.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="dashboard-grid">
      <div className="page-intro page-intro-row">
        <div>
          <h2>{t('assetManagement', 'Asset Management')}</h2>
          <p>{t('viewManageLabAssets', 'View and manage your lab assets')}</p>
        </div>
        <button className="btn secondary-btn page-action-btn" type="button" onClick={exportCsv}>
          <Download size={15} /> {t('exportCsv', 'Export CSV')}
        </button>
      </div>

      <section className="card search-toolbar-card">
        <label className="filter-search">
          <Search size={16} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('searchByNameCode', 'Search by name or code...')} />
        </label>
        <select className="select slim-select" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">{t('allCategories', 'All Categories')}</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select className="select slim-select" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">{t('allStatus', 'All Status')}</option>
          <option value="Active">{t('active', 'Active')}</option>
          <option value="Damaged">{t('damaged', 'Damaged')}</option>
          <option value="Under Maintenance">{t('underMaintenance', 'Under Maintenance')}</option>
        </select>
      </section>

      {error ? (
        <div className="card">
          <h2>{t('error', 'Error')}</h2>
          <p>{error}</p>
        </div>
      ) : (
        <DataTable
          data={filteredAssets}
          columns={columns}
          title={t('assetRegister', 'Asset Register')}
          subtitle={t('adminAssetRegisterSubtitle', 'Admin can add, edit, delete, and assign lab ownership')}
          searchPlaceholder={t('searchAssets', 'Search assets...')}
        />
      )}
    </div>
  );
}
