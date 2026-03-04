import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

type LabKpis = {
  myAssets: number;
  active: number;
  damaged: number;
  underMaintenance: number;
};

export function LabDashboardPage() {
  const { t } = useLanguage();
  const [kpis, setKpis] = useState<LabKpis | null>(null);

  useEffect(() => {
    api.getLabKpis().then(setKpis);
  }, []);

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>{t('labDashboard', 'Lab Dashboard')}</h2>
        <p>{t('labOverview', 'Lab-specific asset and maintenance overview.')}</p>
      </div>
      <div className="metric-grid">
        {[
          { title: t('myAssets', 'My Assets'), value: kpis?.myAssets ?? 0 },
          { title: t('active', 'Active'), value: kpis?.active ?? 0 },
          { title: t('damaged', 'Damaged'), value: kpis?.damaged ?? 0 },
          { title: t('underMaintenance', 'Under Maintenance'), value: kpis?.underMaintenance ?? 0 }
        ].map((item) => (
          <article key={item.title} className="metric-card">
            <p className="metric-title">{item.title}</p>
            <p className="metric-value">{item.value}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
