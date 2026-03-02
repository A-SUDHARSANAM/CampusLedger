import React from 'react';

export function LabDashboard() {
  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>Lab Dashboard</h2>
        <p>Track lab-specific assets and raise maintenance requests for operational continuity.</p>
      </div>
      <div className="card">
        <h2>Lab Insights</h2>
        <p>View assignment status, service timelines, and equipment utilization in your lab.</p>
      </div>
    </div>
  );
}
