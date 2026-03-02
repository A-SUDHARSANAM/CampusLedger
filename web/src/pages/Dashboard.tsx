import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Database, Package, Wrench } from 'lucide-react';

type MetricCardProps = {
  title: string;
  value: string;
  delta: string;
  tone: 'blue' | 'green' | 'amber' | 'violet';
  icon: React.ReactNode;
};

export function MetricCard({ title, value, delta, tone, icon }: MetricCardProps) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-top">
        <p className="metric-title">{title}</p>
        <span className="metric-icon">{icon}</span>
      </div>
      <p className="metric-value">{value}</p>
      <p className="metric-delta">{delta}</p>
    </article>
  );
}

export function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <article className="dashboard-chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {children}
    </article>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="dashboard-grid">
      <div className="metric-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="metric-card skeleton-card" key={index}>
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-line medium" />
            <div className="skeleton skeleton-line short" />
          </div>
        ))}
      </div>
      <div className="chart-grid">
        <div className="dashboard-chart-card skeleton-card">
          <div className="skeleton skeleton-line medium" />
          <div className="skeleton skeleton-chart" />
        </div>
        <div className="dashboard-chart-card skeleton-card">
          <div className="skeleton skeleton-line medium" />
          <div className="skeleton skeleton-chart" />
        </div>
      </div>
    </div>
  );
}

export function Dashboard() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="dashboard-grid">
      <section className="metric-grid">
        <MetricCard title="Total Assets" value="1,248" delta="+3.8% this month" tone="blue" icon={<Package size={16} />} />
        <MetricCard title="Operational" value="1,112" delta="89.1% health score" tone="green" icon={<CheckCircle2 size={16} />} />
        <MetricCard title="Maintenance Due" value="47" delta="12 overdue today" tone="amber" icon={<Wrench size={16} />} />
        <MetricCard title="Critical Alerts" value="6" delta="2 high severity" tone="violet" icon={<AlertTriangle size={16} />} />
      </section>

      <section className="chart-grid">
        <ChartCard title="Asset Activity Trend" subtitle="Last 7 days">
          <div className="line-chart-wrap">
            <svg viewBox="0 0 360 140" className="line-chart" role="img" aria-label="Asset activity trend chart">
              <path d="M10 120 L10 20 L350 20" className="chart-axis" />
              <polyline points="20,110 70,88 120,94 170,66 220,72 270,48 320,58" className="chart-line" />
              <polyline points="20,110 70,88 120,94 170,66 220,72 270,48 320,58 320,120 20,120" className="chart-area" />
            </svg>
            <div className="chart-footer">Average utilization: 82%</div>
          </div>
        </ChartCard>

        <ChartCard title="Asset Distribution" subtitle="By lifecycle status">
          <div className="donut-wrap">
            <div className="donut-chart" aria-label="Asset distribution donut chart" role="img">
              <span>100%</span>
            </div>
            <div className="legend-list">
              <div><span className="dot blue" /> Active 72%</div>
              <div><span className="dot green" /> In Service 18%</div>
              <div><span className="dot amber" /> Retired 10%</div>
            </div>
          </div>
        </ChartCard>
      </section>

      <section className="dashboard-table-card">
        <div className="chart-head">
          <h3>Recent System Events</h3>
          <p>Latest campus operations log</p>
        </div>
        <div className="event-list">
          <div className="event-row">
            <span className="event-icon"><Database size={15} /></span>
            <span>Microscope M-219 assigned to Chemistry Lab</span>
            <span className="event-time">2m ago</span>
          </div>
          <div className="event-row">
            <span className="event-icon"><Wrench size={15} /></span>
            <span>Preventive maintenance scheduled for HVAC Unit A3</span>
            <span className="event-time">18m ago</span>
          </div>
          <div className="event-row">
            <span className="event-icon"><Activity size={15} /></span>
            <span>Inventory audit completed for North Storage Block</span>
            <span className="event-time">41m ago</span>
          </div>
        </div>
      </section>
    </div>
  );
}
