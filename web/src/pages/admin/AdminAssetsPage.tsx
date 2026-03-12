import React, { useEffect, useMemo, useState } from 'react';
import { Download, Plus, QrCode, Search, X } from 'lucide-react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { Asset, LocationInfo } from '../../types/domain';
import type { LabInfo } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

const ASSET_STATUSES = ['Active', 'Under Maintenance', 'Damaged'] as const;

function formatCategoryName(name: string) {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const EMPTY_FORM = {
  name: '',
  assetCode: '',
  category: '',
  labId: '',
  locationId: '',
  status: 'Active' as Asset['status'],
  warranty: '',
  purchaseDate: ''
};

function StatusBadge({ status }: { status: Asset['status'] }) {
  const cls = status === 'Active' ? 'asset-badge active' : status === 'Damaged' ? 'asset-badge damaged' : 'asset-badge maintenance';
  return <span className={cls}>{status}</span>;
}

export function AdminAssetsPage() {
  const { t } = useLanguage();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [labList, setLabList] = useState<LabInfo[]>([]);
  const [categoryList, setCategoryList] = useState<{ id: string; category_name: string }[]>([]);
  const [departmentsList, setDepartmentsList] = useState<{ id: string; name: string }[]>([]);
  const [locationsList, setLocationsList] = useState<LocationInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [department, setDepartment] = useState('all');

  // QR modal
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  async function openQrModal(asset: Asset) {
    setQrAsset(asset);
    setQrCode(null);
    setQrLoading(true);
    try {
      const result = await api.getAssetQrCode(asset.id);
      setQrCode(result?.qr_code_b64 ?? null);
    } catch {
      setQrCode(null);
    } finally {
      setQrLoading(false);
    }
  }

  function downloadQr() {
    if (!qrCode || !qrAsset) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${qrCode}`;
    link.download = `qr-${qrAsset.assetCode || qrAsset.id}.png`;
    link.click();
  }

  // Add-asset modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadAssets() {
    const rows = await api.getAssets('admin');
    setAssets(rows);
  }

  useEffect(() => {
    loadAssets().catch((err: Error) => setError(err.message));
    api.getLabs('admin').then(setLabList).catch(() => {});
    api.getAssetCategories().then(setCategoryList).catch(() => {});
    api.getDepartments().then(setDepartmentsList).catch(() => {});
    api.getLocations().then(setLocationsList).catch(() => {});
  }, []);

  useAutoRefresh(() => loadAssets().catch(() => {}));

  function openAddModal() {
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setShowModal(true);
    // Reload all dropdown data fresh every time the modal opens
    api.getAssetCategories().then(setCategoryList).catch(() => {});
    api.getLocations().then(setLocationsList).catch(() => {});
    api.getLabs('admin').then(setLabList).catch(() => {});
  }

  function closeModal() {
    setShowModal(false);
    setFormError(null);
  }

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleAddAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('Asset name is required.'); return; }
    if (!form.category.trim()) { setFormError('Category is required.'); return; }
    setFormError(null);
    setSaving(true);
    try {
      const lab = labList.find((l) => l.id === form.labId);
      await api.createAsset('admin', {
        assetCode: form.assetCode.trim() || '',
        name: form.name.trim(),
        category: form.category.trim(),
        location: lab?.name ?? '',
        labId: form.labId || '',
        locationId: form.locationId || undefined,
        status: form.status,
        warranty: form.warranty,
        purchaseDate: form.purchaseDate || undefined
      });
      await loadAssets();
      closeModal();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save asset.');
    } finally {
      setSaving(false);
    }
  }

  // Build a quick labId → department lookup for filtering
  const labDeptMap = useMemo(
    () => Object.fromEntries(labList.map((l) => [l.id, l.department])),
    [labList]
  );

  const filteredAssets = useMemo(
    () =>
      assets.filter((asset) => {
        const passQuery =
          !query ||
          asset.name.toLowerCase().includes(query.toLowerCase()) ||
          (asset.assetCode && asset.assetCode.toLowerCase().includes(query.toLowerCase()));
        const passCategory = category === 'all' || asset.category === category;
        const passStatus = status === 'all' || asset.status === status;
        const passDepartment =
          department === 'all' || labDeptMap[asset.labId] === department;
        return passQuery && passCategory && passStatus && passDepartment;
      }),
    [assets, category, query, status, department, labDeptMap]
  );

  const columns: TableColumn<Asset>[] = useMemo(
    () => [
      { key: 'assetCode', header: t('assetCode', 'Serial / Code'), render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12, opacity: v ? 1 : 0.4 }}>{String(v || '—')}</span> },
      { key: 'name', header: t('asset', 'Asset Name') },
      { key: 'category', header: t('category', 'Category') },
      { key: 'location', header: t('location', 'Location'), render: (v) => <span style={{ opacity: v ? 1 : 0.4 }}>{String(v || '—')}</span> },
      { key: 'status', header: t('status', 'Status'), render: (v) => <StatusBadge status={v as Asset['status']} /> },
      { key: 'warranty', header: t('warranty', 'Warranty'), render: (v) => <span style={{ fontSize: 12, opacity: v ? 1 : 0.4 }}>{String(v || '—')}</span> },
      {
        key: 'id',
        header: t('actions', 'Actions'),
        render: (_, row) => (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              className="btn secondary-btn"
              style={{ fontSize: 12, padding: '4px 10px' }}
              type="button"
              onClick={async () => {
                const nextStatus = row.status === 'Active' ? 'Damaged' : row.status === 'Damaged' ? 'Under Maintenance' : 'Active';
                await api.updateAsset('admin', row.id, { status: nextStatus });
                await loadAssets();
              }}
            >
              {t('toggleStatus', 'Status')}
            </button>
            <button
              className="btn secondary-btn"
              style={{ fontSize: 12, padding: '4px 10px' }}
              type="button"
              onClick={async () => {
                const labs = labList.length > 0 ? labList : [];
                if (labs.length === 0) return;
                const current = labs.findIndex((lab) => lab.name === row.location);
                const next = labs[(current + 1) % labs.length];
                await api.assignAssetToLab('admin', row.id, next.id);
                await loadAssets();
              }}
            >
              {t('assignLab', 'Assign Lab')}
            </button>
            <button
              className="btn secondary-btn"
              style={{ fontSize: 12, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
              type="button"
              title="View / Download QR Code"
              onClick={() => openQrModal(row)}
            >
              <QrCode size={13} /> QR
            </button>
            <button
              className="btn danger-btn"
              style={{ fontSize: 12, padding: '4px 10px' }}
              type="button"
              onClick={async () => {
                if (!window.confirm(`Delete "${row.name}"?`)) return;
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
    [t, labList]
  );

  function exportCsv() {
    const header = ['Serial/Code', 'Asset Name', 'Category', 'Location', 'Status', 'Warranty'];
    const rows = filteredAssets.map((a) => [a.assetCode, a.name, a.category, a.location, a.status, a.warranty]);
    const csv = [header.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'assets-export.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  // KPI counts from current filtered list (or all assets)
  const kpiTotal = assets.length;
  const kpiActive = assets.filter((a) => a.status === 'Active').length;
  const kpiDamaged = assets.filter((a) => a.status === 'Damaged').length;
  const kpiMaint = assets.filter((a) => a.status === 'Under Maintenance').length;

  return (
    <div className="dashboard-grid">
      <div className="page-intro page-intro-row">
        <div>
          <h2>{t('assetManagement', 'Asset Management')}</h2>
          <p>{t('viewManageLabAssets', 'View and manage all campus assets')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn primary-btn page-action-btn" type="button" onClick={openAddModal}>
            <Plus size={15} /> {t('addAsset', 'Add Asset')}
          </button>
          <button className="btn secondary-btn page-action-btn" type="button" onClick={exportCsv}>
            <Download size={15} /> {t('exportCsv', 'Export CSV')}
          </button>
        </div>
      </div>

      {/* Live mini-KPIs */}
      <div className="asset-kpi-row">
        <div className="asset-kpi-card">
          <span className="asset-kpi-num">{kpiTotal}</span>
          <span className="asset-kpi-label">Total</span>
        </div>
        <div className="asset-kpi-card active">
          <span className="asset-kpi-num">{kpiActive}</span>
          <span className="asset-kpi-label">Active</span>
        </div>
        <div className="asset-kpi-card damaged">
          <span className="asset-kpi-num">{kpiDamaged}</span>
          <span className="asset-kpi-label">Damaged</span>
        </div>
        <div className="asset-kpi-card maintenance">
          <span className="asset-kpi-num">{kpiMaint}</span>
          <span className="asset-kpi-label">Under Maintenance</span>
        </div>
      </div>

      <section className="card search-toolbar-card">
        <label className="filter-search">
          <Search size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('searchByNameCode', 'Search by name or serial...')} />
        </label>
        <select className="select slim-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">{t('allCategories', 'All Categories')}</option>
          {categoryList.map((c) => <option key={c.id} value={c.category_name}>{formatCategoryName(c.category_name)}</option>)}
        </select>
        <select className="select slim-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">{t('allStatus', 'All Status')}</option>
          <option value="Active">Active</option>
          <option value="Damaged">Damaged</option>
          <option value="Under Maintenance">Under Maintenance</option>
        </select>
        <select className="select slim-select" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="all">{t('allDepartments', 'All Departments')}</option>
          {departmentsList.map((d) => (
            <option key={d.id} value={d.name}>{d.name}</option>
          ))}
        </select>
      </section>

      {error ? (
        <div className="card"><h2>Error</h2><p>{error}</p></div>
      ) : (
        <DataTable
          data={filteredAssets}
          columns={columns}
          title={t('assetRegister', 'Asset Register')}
          subtitle={`${filteredAssets.length} of ${kpiTotal} assets`}
          searchPlaceholder={t('searchAssets', 'Search assets...')}
        />
      )}

      {/* ── QR Code Modal ─────────────────────────────────────────────── */}
      {qrAsset && (
        <div className="modal-backdrop" onClick={() => setQrAsset(null)}>
          <div className="modal-box" style={{ maxWidth: 380, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ margin: 0 }}>{qrAsset.name}</h3>
                {qrAsset.assetCode && (
                  <span style={{ fontFamily: 'monospace', fontSize: 12, opacity: 0.6 }}>{qrAsset.assetCode}</span>
                )}
              </div>
              <button type="button" onClick={() => setQrAsset(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: 'var(--bg-page, #0f172a)', borderRadius: 12, padding: '1.5rem', marginBottom: 14, minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {qrLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span style={{ fontSize: 13, opacity: 0.5 }}>Generating QR…</span>
                </div>
              )}
              {!qrLoading && qrCode && (
                <img
                  src={`data:image/png;base64,${qrCode}`}
                  alt={`QR code for ${qrAsset.name}`}
                  style={{ width: 180, height: 180, imageRendering: 'pixelated' }}
                />
              )}
              {!qrLoading && !qrCode && (
                <span style={{ fontSize: 13, opacity: 0.5 }}>QR code unavailable</span>
              )}
            </div>

            <p style={{ fontSize: 12, opacity: 0.55, margin: '0 0 16px' }}>
              Scan with any phone camera to view asset details — no login required.
            </p>

            <div className="modal-actions" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn secondary-btn" onClick={() => setQrAsset(null)}>Close</button>
              {qrCode && (
                <button type="button" className="btn primary-btn" onClick={downloadQr}>
                  <Download size={14} style={{ marginRight: 4 }} /> Download PNG
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Asset Modal ──────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3>{t('addAsset', 'Add New Asset')}</h3>
              <button type="button" onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            <p className="modal-sub">Asset ID is automatically assigned by the database.</p>

            <form onSubmit={handleAddAsset}>
              <div className="form-grid">
                <div className="form-field full-col">
                  <label>Asset Name<span className="required-star">*</span></label>
                  <input className="input" placeholder="e.g. Dell OptiPlex 7090" value={form.name} onChange={(e) => setField('name', e.target.value)} required />
                </div>

                <div className="form-field">
                  <label>Category<span className="required-star">*</span></label>
                  <input
                    className="input"
                    list="category-suggestions"
                    placeholder="e.g. Computer, Furniture, Lab Equipment"
                    value={form.category}
                    onChange={(e) => setField('category', e.target.value)}
                    required
                  />
                  <datalist id="category-suggestions">
                    {categoryList.map((c) => (
                      <option key={c.id} value={c.category_name}>{formatCategoryName(c.category_name)}</option>
                    ))}
                  </datalist>
                </div>

                <div className="form-field">
                  <label>Status<span className="required-star">*</span></label>
                  <select className="select" value={form.status} onChange={(e) => setField('status', e.target.value)}>
                    {ASSET_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="form-field">
                  <label>Location <span style={{ fontSize: 11, opacity: 0.6 }}>(Academic / Non-Academic)</span></label>
                  <select
                    className="select"
                    value={form.locationId}
                    onChange={(e) => {
                      setField('locationId', e.target.value);
                      // Auto-link lab: if this location has a dedicated lab, pre-select it
                      const loc = locationsList.find((l) => l.id === e.target.value);
                      if (loc?.lab_id) setField('labId', loc.lab_id);
                      else setField('labId', '');
                    }}
                  >
                    <option value="">— Select Location —</option>
                    {(['academic', 'non_academic'] as const).map((type) => {
                      const group = locationsList.filter((l) => l.type === type);
                      if (!group.length) return null;
                      return (
                        <optgroup key={type} label={type === 'academic' ? '📚 Academic' : '🏢 Non-Academic'}>
                          {group.map((loc) => (
                            <option key={loc.id} value={loc.id}>{loc.name}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                </div>

                <div className="form-field">
                  <label>
                    Lab
                    {(() => {
                      // When a location is selected, show how many labs are linked
                      const selectedLoc = locationsList.find((l) => l.id === form.locationId);
                      const labsForLoc = selectedLoc?.lab_id
                        ? labList.filter((lb) => lb.id === selectedLoc.lab_id)
                        : labList;
                      return (
                        <span style={{ fontSize: 11, opacity: 0.55, marginLeft: 6 }}>
                          {selectedLoc
                            ? `${labsForLoc.length} available for this location`
                            : `${labList.length} labs total`}
                        </span>
                      );
                    })()}
                  </label>
                  <select
                    className="select"
                    value={form.labId}
                    onChange={(e) => setField('labId', e.target.value)}
                  >
                    <option value="">— Select Lab —</option>
                    {(() => {
                      const selectedLoc = locationsList.find((l) => l.id === form.locationId);
                      const labsToShow = selectedLoc?.lab_id
                        ? labList.filter((lb) => lb.id === selectedLoc.lab_id)
                        : labList;
                      return labsToShow.map((lab) => (
                        <option key={lab.id} value={lab.id}>
                          {lab.name}{lab.department ? ` (${lab.department})` : ''}
                        </option>
                      ));
                    })()}
                  </select>
                </div>

                <div className="form-field">
                  <label>Asset Code / Serial No</label>
                  <input className="input" placeholder="e.g. LAB-PC-001" value={form.assetCode} onChange={(e) => setField('assetCode', e.target.value)} />
                </div>

                <div className="form-field">
                  <label>Warranty Expiry</label>
                  <input className="input" type="date" value={form.warranty} onChange={(e) => setField('warranty', e.target.value)} />
                </div>

                <div className="form-field">
                  <label>Purchase Date</label>
                  <input className="input" type="date" value={form.purchaseDate} onChange={(e) => setField('purchaseDate', e.target.value)} />
                </div>
              </div>

              {formError && <p style={{ marginTop: 14, color: 'var(--danger)', fontSize: 13 }}>{formError}</p>}

              <div className="modal-actions">
                <button type="button" className="btn secondary-btn" onClick={closeModal} disabled={saving}>Cancel</button>
                <button type="submit" className="btn primary-btn" disabled={saving}>{saving ? 'Saving…' : 'Add Asset'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
