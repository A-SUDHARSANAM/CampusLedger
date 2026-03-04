import React, { useState } from 'react';
import { Bell, Database, Shield } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button className={`toggle-btn ${checked ? 'on' : ''}`} type="button" onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span />
    </button>
  );
}

export function Settings() {
  const { t } = useLanguage();
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
    setStatus(t('settingsExported', 'Settings exported successfully.'));
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
    setStatus(t('settingsReset', 'Settings reset to defaults.'));
  }

  function saveSettings() {
    const payload = {
      institutionName,
      adminEmail,
      notifications,
      security
    };
    localStorage.setItem('campusledger_settings', JSON.stringify(payload));
    setStatus(t('settingsSaved', 'Settings saved.'));
  }

  return (
    <div className="dashboard-grid settings-page">
      <div className="page-intro">
        <h2>{t('settingsTitle', 'Settings')}</h2>
        <p>{t('settingsDesc', 'Manage your system preferences')}</p>
      </div>

      <section className="card settings-card">
        <h3>{t('general', 'General')}</h3>
        <div className="settings-grid-two">
          <label>
            <span>{t('institutionName', 'Institution Name')}</span>
            <input className="input compact-input" value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} />
          </label>
          <label>
            <span>{t('adminEmail', 'Admin Email')}</span>
            <input className="input compact-input" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="card settings-card">
        <h3>
          <Bell size={14} /> {t('notificationsTitle', 'Notifications')}
        </h3>
        <div className="toggle-row">
          <p>{t('notifProcurement', 'Email notifications for new procurement requests')}</p>
          <Toggle checked={notifications.procurement} onChange={(value) => setNotifications((prev) => ({ ...prev, procurement: value }))} />
        </div>
        <div className="toggle-row">
          <p>{t('notifWarranty', 'Warranty expiry alerts (30 days before)')}</p>
          <Toggle checked={notifications.warranty} onChange={(value) => setNotifications((prev) => ({ ...prev, warranty: value }))} />
        </div>
        <div className="toggle-row">
          <p>{t('notifMaintenance', 'Maintenance status updates')}</p>
          <Toggle checked={notifications.maintenance} onChange={(value) => setNotifications((prev) => ({ ...prev, maintenance: value }))} />
        </div>
        <div className="toggle-row">
          <p>{t('notifWeekly', 'Weekly asset summary report')}</p>
          <Toggle checked={notifications.weekly} onChange={(value) => setNotifications((prev) => ({ ...prev, weekly: value }))} />
        </div>
      </section>

      <section className="card settings-card">
        <h3>
          <Shield size={14} /> {t('security', 'Security')}
        </h3>
        <div className="toggle-row">
          <p>{t('twoFactor', 'Two-factor authentication')}</p>
          <Toggle checked={security.mfa} onChange={(value) => setSecurity((prev) => ({ ...prev, mfa: value }))} />
        </div>
        <div className="toggle-row">
          <p>{t('sessionTimeout', 'Session timeout (30 min)')}</p>
          <Toggle checked={security.timeout} onChange={(value) => setSecurity((prev) => ({ ...prev, timeout: value }))} />
        </div>
      </section>

      <section className="card settings-card">
        <h3>
          <Database size={14} /> {t('data', 'Data')}
        </h3>
        <div className="settings-action-row">
          <div>
            <p>{t('exportAllData', 'Export all data')}</p>
            <small>{t('exportAllDataDesc', 'Download complete asset database as CSV')}</small>
          </div>
          <button className="btn secondary-btn mini-btn" type="button" onClick={exportSettings}>
            {t('export', 'Export')}
          </button>
        </div>
        <div className="settings-action-row danger">
          <div>
            <p>{t('resetDemoData', 'Reset Demo Data')}</p>
            <small>{t('resetDemoDataDesc', 'Restore all data to default state')}</small>
          </div>
          <button className="btn danger-btn mini-btn" type="button" onClick={resetSettings}>
            {t('reset', 'Reset')}
          </button>
        </div>
      </section>

      <button className="btn primary-btn save-btn" type="button" onClick={saveSettings}>
        {t('saveChanges', 'Save Changes')}
      </button>
      {status ? <p className="settings-status">{status}</p> : null}
    </div>
  );
}
