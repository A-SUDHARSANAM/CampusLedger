import React, { useState } from 'react';
import { Bell, Database, Shield } from 'lucide-react';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button className={`toggle-btn ${checked ? 'on' : ''}`} type="button" onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span />
    </button>
  );
}

export function Settings() {
  const [institutionName, setInstitutionName] = useState('CampusLedger University');
  const [adminEmail, setAdminEmail] = useState('admin@campus.edu');
  const [notifications, setNotifications] = useState({
    procurement: true,
    warranty: true,
    maintenance: true,
    weekly: false
  });
  const [security, setSecurity] = useState({
    mfa: false,
    timeout: true
  });
  const [status, setStatus] = useState('');

  function exportSettings() {
    const rows = [
      ['institutionName', institutionName],
      ['adminEmail', adminEmail],
      ['notifyProcurement', String(notifications.procurement)],
      ['notifyWarranty', String(notifications.warranty)],
      ['notifyMaintenance', String(notifications.maintenance)],
      ['notifyWeekly', String(notifications.weekly)],
      ['mfa', String(security.mfa)],
      ['sessionTimeout', String(security.timeout)]
    ];
    const csv = ['key,value', ...rows.map(([key, value]) => `${key},${value}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'campusledger-settings.csv';
    link.click();
    URL.revokeObjectURL(url);
    setStatus('Settings exported successfully.');
  }

  function resetSettings() {
    setInstitutionName('CampusLedger University');
    setAdminEmail('admin@campus.edu');
    setNotifications({
      procurement: true,
      warranty: true,
      maintenance: true,
      weekly: false
    });
    setSecurity({
      mfa: false,
      timeout: true
    });
    setStatus('Settings reset to defaults.');
  }

  function saveSettings() {
    const payload = {
      institutionName,
      adminEmail,
      notifications,
      security
    };
    localStorage.setItem('campusledger_settings', JSON.stringify(payload));
    setStatus('Settings saved.');
  }

  return (
    <div className="dashboard-grid settings-page">
      <div className="page-intro">
        <h2>Settings</h2>
        <p>Manage your system preferences</p>
      </div>

      <section className="card settings-card">
        <h3>General</h3>
        <div className="settings-grid-two">
          <label>
            <span>Institution Name</span>
            <input className="input compact-input" value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} />
          </label>
          <label>
            <span>Admin Email</span>
            <input className="input compact-input" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="card settings-card">
        <h3>
          <Bell size={14} /> Notifications
        </h3>
        <div className="toggle-row">
          <p>Email notifications for new procurement requests</p>
          <Toggle checked={notifications.procurement} onChange={(value) => setNotifications((prev) => ({ ...prev, procurement: value }))} />
        </div>
        <div className="toggle-row">
          <p>Warranty expiry alerts (30 days before)</p>
          <Toggle checked={notifications.warranty} onChange={(value) => setNotifications((prev) => ({ ...prev, warranty: value }))} />
        </div>
        <div className="toggle-row">
          <p>Maintenance status updates</p>
          <Toggle checked={notifications.maintenance} onChange={(value) => setNotifications((prev) => ({ ...prev, maintenance: value }))} />
        </div>
        <div className="toggle-row">
          <p>Weekly asset summary report</p>
          <Toggle checked={notifications.weekly} onChange={(value) => setNotifications((prev) => ({ ...prev, weekly: value }))} />
        </div>
      </section>

      <section className="card settings-card">
        <h3>
          <Shield size={14} /> Security
        </h3>
        <div className="toggle-row">
          <p>Two-factor authentication</p>
          <Toggle checked={security.mfa} onChange={(value) => setSecurity((prev) => ({ ...prev, mfa: value }))} />
        </div>
        <div className="toggle-row">
          <p>Session timeout (30 min)</p>
          <Toggle checked={security.timeout} onChange={(value) => setSecurity((prev) => ({ ...prev, timeout: value }))} />
        </div>
      </section>

      <section className="card settings-card">
        <h3>
          <Database size={14} /> Data
        </h3>
        <div className="settings-action-row">
          <div>
            <p>Export all data</p>
            <small>Download complete asset database as CSV</small>
          </div>
          <button className="btn secondary-btn mini-btn" type="button" onClick={exportSettings}>
            Export
          </button>
        </div>
        <div className="settings-action-row danger">
          <div>
            <p>Reset Demo Data</p>
            <small>Restore all data to default state</small>
          </div>
          <button className="btn danger-btn mini-btn" type="button" onClick={resetSettings}>
            Reset
          </button>
        </div>
      </section>

      <button className="btn primary-btn save-btn" type="button" onClick={saveSettings}>
        Save Changes
      </button>
      {status ? <p className="settings-status">{status}</p> : null}
    </div>
  );
}
