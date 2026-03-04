import React, { useEffect, useState } from 'react';
import { AlertTriangle, Box, CheckCircle2, ShoppingCart, Users } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';

type AdminKpis = {
  totalAssets: number;
  activeAssets: number;
  damagedAssets: number;
  maintenanceRequests: number;
  pendingRequests: number;
  labs: number;
};

type ChartDatum = { label: string; value: number };

export function AdminDashboardPage() {
  const { t } = useLanguage();
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [categories, setCategories] = useState<ChartDatum[]>([]);
  const [animateCharts, setAnimateCharts] = useState(false);

  useEffect(() => {
    Promise.all([api.getAdminKpis(), api.getAssetCategoryChart()]).then(([kpiData, categoryData]) => {
      setKpis(kpiData);
      setCategories(categoryData);
    });
  }, []);

  useEffect(() => {
    setAnimateCharts(false);
    const frame = window.requestAnimationFrame(() => setAnimateCharts(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const locationBars = [
    { label: t('csLabs', 'CS Labs'), value: 80 },
    { label: t('electronicsLab', 'Electronics Lab'), value: 56 },
    { label: t('library', 'Library'), value: 85 },
    { label: t('classrooms', 'Classrooms'), value: 22 },
    { label: t('auditorium', 'Auditorium'), value: 52 },
    { label: t('gymnasium', 'Gymnasium'), value: 45 },
    { label: t('serverRoom', 'Server Room'), value: 67 },
    { label: t('admin', 'Admin'), value: 22 }
  ];

  return (
    <div className="dashboard-grid">
      <div className={`page-intro entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '20ms' } as React.CSSProperties}>
        <h2>{t('adminDashboard', 'Admin Dashboard')}</h2>
        <p>{t('adminOverview', "Welcome back. Here's your complete campus overview.")}</p>
      </div>

      <div className="metric-grid metric-grid-five">
        <article className={`metric-card touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '70ms' } as React.CSSProperties}>
          <div className="metric-top">
            <p className="metric-title">{t('totalAssets', 'Total Assets')}</p>
            <span className="metric-icon"><Box size={16} /></span>
          </div>
          <p className="metric-value">{kpis?.totalAssets ?? 0}</p>
          <p className="metric-delta positive">{t('fromLastMonth', '+12% from last month')}</p>
        </article>
        <article className={`metric-card touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '120ms' } as React.CSSProperties}>
          <div className="metric-top">
            <p className="metric-title">{t('activeAssets', 'Active Assets')}</p>
            <span className="metric-icon"><CheckCircle2 size={16} /></span>
          </div>
          <p className="metric-value">{kpis?.activeAssets ?? 0}</p>
        </article>
        <article className={`metric-card touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '170ms' } as React.CSSProperties}>
          <div className="metric-top">
            <p className="metric-title">{t('damagedAssets', 'Damaged Assets')}</p>
            <span className="metric-icon"><AlertTriangle size={16} /></span>
          </div>
          <p className="metric-value">{kpis?.damagedAssets ?? 0}</p>
        </article>
        <article className={`metric-card touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '220ms' } as React.CSSProperties}>
          <div className="metric-top">
            <p className="metric-title">{t('pendingRequests', 'Pending Requests')}</p>
            <span className="metric-icon"><ShoppingCart size={16} /></span>
          </div>
          <p className="metric-value">{kpis?.pendingRequests ?? 0}</p>
        </article>
        <article className={`metric-card touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '270ms' } as React.CSSProperties}>
          <div className="metric-top">
            <p className="metric-title">{t('totalUsers', 'Total Users')}</p>
            <span className="metric-icon"><Users size={16} /></span>
          </div>
          <p className="metric-value">7</p>
        </article>
      </div>

      <div className="chart-grid chart-grid-balanced">
        <section className={`dashboard-chart-card touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '320ms' } as React.CSSProperties}>
          <div className="chart-head">
            <h3>{t('assetsByLocation', 'Assets by Location')}</h3>
          </div>
          <div className="location-chart">
            {locationBars.map((bar, index) => (
              <div key={bar.label} className="location-bar-col touch-chart-part">
                <div className="location-bar-wrap">
                  <div
                    className="location-bar"
                    style={{
                      height: animateCharts ? `${bar.value}%` : '0%',
                      transitionDelay: `${index * 60}ms`
                    }}
                  />
                </div>
                <p>{bar.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`dashboard-chart-card touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '380ms' } as React.CSSProperties}>
          <div className="chart-head">
            <h3>{t('categoryDistribution', 'Asset Category Distribution')}</h3>
          </div>
          <div className="donut-wrap">
            <div className={`donut-chart ${animateCharts ? 'animate' : ''}`}>
              <span>100%</span>
            </div>
            <div className="legend-list">
              {categories.map((item) => (
                <div key={item.label}>
                  <span>{t(item.label, item.label)}</span>
                  <span style={{ marginLeft: 'auto' }}>{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className={`dashboard-chart-card touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '440ms' } as React.CSSProperties}>
        <div className="chart-head">
          <h3>{t('monthlyTrend', 'Monthly Procurement Trend (INR)')}</h3>
        </div>
        <div className="table-empty">
          <h4>{t('trendPrepared', 'Trend data prepared')}</h4>
          <p>{t('trendPreparedDesc', 'Connect backend procurement analytics to render this chart with live values.')}</p>
        </div>
      </section>
    </div>
  );
}
