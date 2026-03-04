import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

type ServiceKpis = {
  assignedTasks: number;
  pending: number;
  inProgress: number;
  completed: number;
};

export function ServiceDashboardPage() {
  const { t } = useLanguage();
  const [kpis, setKpis] = useState<ServiceKpis | null>(null);

  useEffect(() => {
    api.getServiceKpis().then(setKpis);
  }, []);

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>{t('serviceDashboard', 'Service Dashboard')}</h2>
        <p>{t('serviceOverview', 'Assigned maintenance workload and completion tracking.')}</p>
      </div>

      <div className="metric-grid">
        {[
          { title: t('assignedTasks', 'Assigned Tasks'), value: kpis?.assignedTasks ?? 0 },
          { title: t('pendingRequests', 'Pending'), value: kpis?.pending ?? 0 },
          { title: t('inProgress', 'In Progress'), value: kpis?.inProgress ?? 0 },
          { title: t('completed', 'Completed'), value: kpis?.completed ?? 0 }
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
