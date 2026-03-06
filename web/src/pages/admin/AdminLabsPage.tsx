import React, { useEffect, useMemo, useState } from 'react';
import { DataTable, type TableColumn } from '../../components/tables';
import { api } from '../../services/api';
import type { LabInfo } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';

interface Department { id: string; name: string; }

export function AdminLabsPage() {
  const { t } = useLanguage();
  const [labs, setLabs] = useState<LabInfo[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [form, setForm] = useState({ lab_name: '', department_id: '', location: '' });

  async function load() {
    const [labRows, depts] = await Promise.all([
      api.getLabs('admin'),
      api.getDepartments(),
    ]);
    setLabs(labRows);
    setDepartments(depts);
  }

  useEffect(() => { load(); }, []);

  function openModal() {
    setForm({ lab_name: '', department_id: departments[0]?.id ?? '', location: '' });
    setStatusMsg('');
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.lab_name.trim()) { setStatusMsg('Lab name is required.'); return; }
    if (!form.department_id) { setStatusMsg('Please select a department.'); return; }
    setSaving(true);
    try {
      await api.createLab('admin', form);
      setShowModal(false);
      setStatusMsg(t('labCreated', 'Lab created successfully.'));
      await load();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to create lab.');
    } finally {
      setSaving(false);
    }
  }

  const columns: TableColumn<LabInfo>[] = useMemo(
    () => [
      { key: 'name', header: t('labName', 'Lab Name') },
      { key: 'department', header: t('department', 'Department') },
      { key: 'assetCount', header: t('assetCount', 'Asset Count') },
      { key: 'incharge', header: t('incharge', 'Incharge') }
    ],
    [t]
  );

  return (
    <div className="dashboard-grid">
      <section className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h2>{t('labsTitle', 'Labs')}</h2>
          <p style={{ margin: 0, opacity: 0.7, fontSize: '0.875em' }}>{t('labsSubtitle', 'Lab directory and ownership overview')}</p>
        </div>
        <button className="btn primary-btn" type="button" onClick={openModal}>
          + {t('addLab', 'Add Lab')}
        </button>
      </section>

      {statusMsg && (
        <p style={{ padding: '4px 0', opacity: 0.75, fontSize: '0.875em' }}>{statusMsg}</p>
      )}

      <DataTable data={labs} columns={columns} title="" subtitle="" />

      {/* ── Add Lab Modal ──────────────────────────────────────────────────── */}
      {showModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="card"
            style={{ minWidth: 340, maxWidth: 480, width: '90%', padding: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>{t('addLab', 'Add New Lab')}</h3>
            {statusMsg && <p style={{ color: 'var(--color-danger, #c62828)', margin: '0 0 8px' }}>{statusMsg}</p>}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>{t('labName', 'Lab Name')} *</span>
                <input
                  className="form-input"
                  type="text"
                  value={form.lab_name}
                  onChange={(e) => setForm((f) => ({ ...f, lab_name: e.target.value }))}
                  placeholder="e.g. Advanced Robotics Lab"
                  required
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>{t('department', 'Department')} *</span>
                <select
                  className="form-input"
                  value={form.department_id}
                  onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
                  required
                >
                  <option value="">-- Select Department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>{t('location', 'Location')}</span>
                <input
                  className="form-input"
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Block A, Floor 2"
                />
              </label>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                <button type="button" className="btn secondary-btn" onClick={() => setShowModal(false)} disabled={saving}>
                  {t('cancel', 'Cancel')}
                </button>
                <button type="submit" className="btn primary-btn" disabled={saving}>
                  {saving ? t('saving', 'Saving…') : t('save', 'Save Lab')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
