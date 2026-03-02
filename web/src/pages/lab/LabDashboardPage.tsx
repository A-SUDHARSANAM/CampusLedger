import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';

type LabKpis = {
  myAssets: number;
  active: number;
  damaged: number;
  underMaintenance: number;
};

export function LabDashboardPage() {
  const [kpis, setKpis] = useState<LabKpis | null>(null);

  useEffect(() => {
    api.getLabKpis().then(setKpis);
  }, []);

  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>Lab Dashboard</h2>
        <p>Lab-specific asset and maintenance overview.</p>
      </div>
      <div className="metric-grid">
        {[
          { title: 'My Assets', value: kpis?.myAssets ?? 0 },
          { title: 'Active', value: kpis?.active ?? 0 },
          { title: 'Damaged', value: kpis?.damaged ?? 0 },
          { title: 'Under Maintenance', value: kpis?.underMaintenance ?? 0 }
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
