import React from 'react';

export function AdminDashboard() {
  return (
    <div className="dashboard-grid">
      <div className="card">
        <h2>Admin Dashboard</h2>
        <p>Institution-wide overview for assets, labs, users, and maintenance operations.</p>
      </div>
      <div className="card">
        <h2>Admin Controls</h2>
        <p>Manage asset lifecycle, lab assignments, user access, and service coordination.</p>
      </div>
    </div>
  );
}
