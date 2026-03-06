import React, { useEffect, useState } from 'react';
import { AlertTriangle, Box, CheckCircle2, RefreshCw, ShoppingCart, Users, Wrench } from 'lucide-react';
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

const CHART_COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#e11d48', '#a78bfa', '#06b6d4', '#f97316', '#84cc16'];

function DonutChart({ data, animate }: { data: ChartDatum[]; animate: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0 || data.length === 0) {
    return (
      <div className="donut-wrap">
        <div className={`donut-chart ${animate ? 'animate' : ''}`}><span>—</span></div>
        <div className="legend-list"><p style={{ opacity: 0.5, fontSize: 12 }}>No data yet</p></div>
      </div>
    );
  }

  let accumulated = 0;
  const segments = data.map((d, i) => {
    const pct = (d.value / total) * 100;
    const start = accumulated;
    accumulated += pct;
    return { ...d, start, end: accumulated, color: CHART_COLORS[i % CHART_COLORS.length], pct };
  });

  const conicGradient = segments.map((s) => `${s.color} ${s.start.toFixed(2)}% ${s.end.toFixed(2)}%`).join(', ');
  const largest = segments.reduce((a, b) => (b.pct > a.pct ? b : a));

  return (
    <div className="donut-wrap">
      <div
        className={`donut-chart ${animate ? 'animate' : ''}`}
        style={{ background: `conic-gradient(${conicGradient})` }}
      >
        <span>{Math.round(largest.pct)}%</span>
      </div>
      <div className="legend-list">
        {segments.map((s) => (
          <div key={s.label}>
            <span className="legend-dot" style={{ background: s.color }} />
            <span>{s.label}</span>
            <span style={{ marginLeft: 'auto' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const { t } = useLanguage();
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [categories, setCategories] = useState<ChartDatum[]>([]);
  const [locationBars, setLocationBars] = useState<ChartDatum[]>([]);
  const [procurementTrend, setProcurementTrend] = useState<ChartDatum[]>([]);
  const [animateCharts, setAnimateCharts] = useState(false);
  const [runningChecks, setRunningChecks] = useState(false);
  const [checksMsg, setChecksMsg] = useState('');

  async function loadData() {
    const [kpiData, dash] = await Promise.all([api.getAdminKpis(), api.getAnalyticsDashboard()]);
    setKpis(kpiData);
    if (dash) {
      setCategories(dash.asset_category_distribution ?? []);
      setLocationBars(dash.assets_by_location ?? []);
      setProcurementTrend(dash.monthly_procurement_trend ?? []);
    } else {
      const categoryData = await api.getAssetCategoryChart();
      setCategories(categoryData);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setAnimateCharts(false);
    const frame = window.requestAnimationFrame(() => setAnimateCharts(true));
    return () => window.cancelAnimationFrame(frame);
  }, [kpis]);

  const displayBars = locationBars.length > 0 ? locationBars : [
    { label: t('csLabs', 'CS Labs'), value: 80 },
    { label: t('electronicsLab', 'Electronics Lab'), value: 56 },
    { label: t('library', 'Library'), value: 85 },
    { label: t('classrooms', 'Classrooms'), value: 22 },
    { label: t('auditorium', 'Auditorium'), value: 52 }
  ];

  const maxBarValue = Math.max(...displayBars.map((b) => b.value), 1);

  async function handleRunChecks() {
    setRunningChecks(true);
    setChecksMsg('');
    try {
      await api.runChecks();
      setChecksMsg(t('checksComplete', 'Delivery & warranty checks completed.'));
      await loadData();
    } catch {
      setChecksMsg(t('checksFailed', 'Checks failed — backend may be offline.'));
    } finally {
      setRunningChecks(false);
    }
  }

  return (
    <div className="dashboard-grid">
      <div className={`page-intro entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '20ms' } as React.CSSProperties}>
        <h2>{t('adminDashboard', 'Admin Dashboard')}</h2>
        <p>{t('adminOverview', "Welcome back. Here's your complete campus overview.")}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <button className="btn secondary-btn" type="button" onClick={handleRunChecks} disabled={runningChecks}>
            <RefreshCw size={14} style={{ marginRight: 4 }} />
            {runningChecks ? t('running', 'Running...') : t('runChecks', 'Run Checks')}
          </button>
          {checksMsg && <span style={{ fontSize: '0.85em', opacity: 0.75 }}>{checksMsg}</span>}
        </div>
      </div>

      <div className="metric-grid metric-grid-five">
        <article className={`metric-card blue touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '70ms' } as React.CSSProperties}>
          <div className="metric-top">
            <p className="metric-title">{t('totalAssets', 'Total Assets')}</p>
            <span className="metric-icon"><Box size={16} /></span>
          </div>
          <p className="metric-value">{kpis?.totalAssets ?? '—'}</p>
        </article>
        <article className={`metric-card green touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '120ms' } as React.CSSProperties}>
          <div className="metric-top">
            <p className="metric-title">{t('activeAssets', 'Active Assets')}</p>
            <span className="metric-icon"><CheckCircle2 size={16} /></span>
          </div>
          <p className="metric-value">{kpis?.activeAssets ?? '—'}</p>
        </article>
        <article className={`metric-card amber touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '170ms' } as React.CSSProperties}>
          <div className="metric-top">
            <p className="metric-title">{t('damagedAssets', 'Damaged Assets')}</p>
            <span className="metric-icon"><AlertTriangle size={16} /></span>
          </div>
          <p className="metric-value">{kpis?.damagedAssets ?? '—'}</p>
        </article>
        <article className={`metric-card violet touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '220ms' } as React.CSSProperties}>
          <div className="metric-top">
            <p className="metric-title">{t('pendingRequests', 'Pending Requests')}</p>
            <span className="metric-icon"><ShoppingCart size={16} /></span>
          </div>
          <p className="metric-value">{kpis?.pendingRequests ?? '—'}</p>
        </article>
        <article className={`metric-card touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '270ms' } as React.CSSProperties}>
          <div className="metric-top">
            <p className="metric-title">{t('totalLabs', 'Total Labs')}</p>
            <span className="metric-icon"><Users size={16} /></span>
          </div>
          <p className="metric-value">{kpis?.labs ?? '—'}</p>
        </article>
      </div>

      <div className="chart-grid chart-grid-balanced">
        <section className={`dashboard-chart-card touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '320ms' } as React.CSSProperties}>
          <div className="chart-head">
            <h3>{t('assetsByLocation', 'Assets by Location')}</h3>
          </div>
          <div className="location-chart">
            {displayBars.map((bar, index) => (
              <div key={bar.label} className="location-bar-col touch-chart-part">
                <div className="location-bar-wrap">
                  <div
                    className="location-bar"
                    style={{
                      height: animateCharts ? `${(bar.value / maxBarValue) * 100}%` : '0%',
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
          <DonutChart data={categories} animate={animateCharts} />
        </section>
      </div>

      <section className={`dashboard-chart-card touch-card entry-animate ${animateCharts ? 'in' : ''}`} style={{ '--delay': '440ms' } as React.CSSProperties}>
        <div className="chart-head">
          <h3>{t('monthlyTrend', 'Monthly Procurement Trend (INR)')}</h3>
        </div>
        {procurementTrend.length > 0 ? (
          <div className="location-chart">
            {procurementTrend.map((bar, index) => {
              const maxVal = Math.max(...procurementTrend.map((b) => b.value), 1);
              return (
                <div key={bar.label} className="location-bar-col touch-chart-part">
                  <div className="location-bar-wrap">
                    <div
                      className="location-bar"
                      style={{ height: animateCharts ? `${(bar.value / maxVal) * 100}%` : '0%', transitionDelay: `${index * 60}ms` }}
                    />
                  </div>
                  <p style={{ fontSize: '0.7em' }}>{bar.label}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="table-empty">
            <p style={{ opacity: 0.6 }}>{t('trendPreparedDesc', 'Procurement trend data will appear once orders are placed.')}</p>
          </div>
        )}
      </section>
    </div>
  );
}
