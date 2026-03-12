import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, BarChart2, Box, Brain, Camera, CheckCircle2, RefreshCw,
  TrendingUp, Users, Wrench, XCircle
} from 'lucide-react';
import { OCRScanner, type OCRResult } from '../../components/OCRScanner';
import { api } from '../../services/api';
import { useLanguage } from '../../context/LanguageContext';
import { DashBarChart, DashLineChart, DashPieChart } from '../../components/charts';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

/* ───────────────────────────────────────────
   Types
─────────────────────────────────────────── */
type ChartPoint = { label: string; value: number };

type AdminKpis = {
  totalAssets: number;
  activeAssets: number;
  damagedAssets: number;
  underMaintenance: number;
  cancelledAssets: number;
  pendingRequests: number;
  totalUsers: number;
  labs: number;
};

type DashData = {
  assets_by_location: ChartPoint[];
  asset_category_distribution: ChartPoint[];
  monthly_procurement_trend: ChartPoint[];
  maintenance_status_distribution: ChartPoint[];
  feedback_ratings_distribution: ChartPoint[];
};

type LocationAnalytics = {
  byType: ChartPoint[];
  byFacility: ChartPoint[];
  maintenanceByLocation: ChartPoint[];
};

type MlPreviewItem = {
  id: string;
  name: string;
  current_stock: number;
  predicted_demand: number;
  reorder_level: number;
  risk: 'safe' | 'low' | 'reorder';
  suggested_order: number;
};

/* ───────────────────────────────────────────
   Colour palette
─────────────────────────────────────────── */
const PALETTE = [
  '#4F6EF7', '#22C55E', '#F59E0B', '#EF4444',
  '#A78BFA', '#06B6D4', '#F97316', '#84CC16',
  '#EC4899', '#14B8A6',
];

/* ───────────────────────────────────────────
   Helper: short month label
─────────────────────────────────────────── */
function shortMonth(yyyymm: string) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const parts = yyyymm.split('-');
  if (parts.length === 2) {
    const idx = parseInt(parts[1], 10) - 1;
    return months[idx] ?? yyyymm;
  }
  return yyyymm;
}



/* ═══════════════════════════════════════════
   KPI Card
═══════════════════════════════════════════ */
function KpiCard({
  title, value, icon, color, delay: entryDelay, animate,
}: {
  title: string;
  value: number | string | null | undefined;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'violet' | 'rose' | 'cyan' | 'default';
  delay: number;
  animate: boolean;
}) {
  return (
    <article
      className={`metric-card ${color} touch-card entry-animate ${animate ? 'in' : ''}`}
      style={{ '--delay': `${entryDelay}ms` } as React.CSSProperties}
    >
      <div className="metric-top">
        <p className="metric-title">{title}</p>
        <span className="metric-icon">{icon}</span>
      </div>
      <p className="metric-value">{value ?? '—'}</p>
    </article>
  );
}

/* ═══════════════════════════════════════════
   Chart Card wrapper
═══════════════════════════════════════════ */
function ChartCard({
  title, subtitle, children, delay: entryDelay, animate, className = '',
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay: number;
  animate: boolean;
  className?: string;
}) {
  return (
    <section
      className={`dashboard-chart-card touch-card entry-animate ${animate ? 'in' : ''} ${className}`}
      style={{ '--delay': `${entryDelay}ms` } as React.CSSProperties}
    >
      <div className="chart-head">
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

/* ═══════════════════════════════════════════
   Main page
═══════════════════════════════════════════ */
export function AdminDashboardPage() {
  const { t } = useLanguage();

  const navigate = useNavigate();
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [dash, setDash] = useState<DashData | null>(null);
  const [locationAnalytics, setLocationAnalytics] = useState<LocationAnalytics | null>(null);
  const [mlPreview, setMlPreview] = useState<MlPreviewItem[]>([]);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [animate, setAnimate] = useState(false);
  const [runningChecks, setRunningChecks] = useState(false);
  const [checksMsg, setChecksMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  // OCR save-to-asset modal state
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [ocrCategoryList, setOcrCategoryList] = useState<{ id: string; category_name: string }[]>([]);
  const [ocrLabList, setOcrLabList] = useState<{ id: string; name: string; department?: string }[]>([]);
  const [ocrForm, setOcrForm] = useState({ name: '', category: '', serialNumber: '', model: '', purchaseDate: '', labId: '', status: 'Active' });
  const [ocrSaving, setOcrSaving] = useState(false);
  const [ocrSaveError, setOcrSaveError] = useState('');
  const [ocrSaveSuccess, setOcrSaveSuccess] = useState(false);

  async function handleOcrResult(res: OCRResult) {
    setOcrResult(res);
    const f = res.detected_fields;
    setOcrForm({
      name: f.asset_name ?? '',
      category: '',
      serialNumber: f.serial_number ?? '',
      model: f.model ?? '',
      purchaseDate: f.purchase_date ?? '',
      labId: '',
      status: 'Active',
    });
    setOcrSaveError('');
    setOcrSaveSuccess(false);
    // Lazily load dropdowns
    const [cats, labs] = await Promise.all([
      api.getAssetCategories().catch(() => [] as { id: string; category_name: string }[]),
      api.getLabs('admin').catch(() => [] as { id: string; name: string; department?: string }[]),
    ]);
    setOcrCategoryList(cats);
    setOcrLabList(labs);
    setShowOcrModal(true);
  }

  async function handleOcrSave(e: React.FormEvent) {
    e.preventDefault();
    if (!ocrForm.name.trim()) { setOcrSaveError('Asset name is required.'); return; }
    if (!ocrForm.category.trim()) { setOcrSaveError('Category is required.'); return; }
    setOcrSaveError('');
    setOcrSaving(true);
    try {
      const lab = ocrLabList.find((l) => l.id === ocrForm.labId);
      await api.createAsset('admin', {
        name: ocrForm.name.trim(),
        assetCode: ocrForm.serialNumber.trim(),
        category: ocrForm.category.trim(),
        location: lab?.name ?? '',
        labId: ocrForm.labId || '',
        locationId: undefined,
        status: ocrForm.status as 'Active' | 'Under Maintenance' | 'Damaged',
        warranty: '',
        purchaseDate: ocrForm.purchaseDate || undefined,
      });
      setOcrSaveSuccess(true);
      setTimeout(() => {
        setShowOcrModal(false);
        navigate('/admin/assets');
      }, 1000);
    } catch (err: unknown) {
      setOcrSaveError(err instanceof Error ? err.message : 'Failed to save asset.');
    } finally {
      setOcrSaving(false);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [dashData, locData] = await Promise.all([
        api.getAnalyticsDashboard(),
        api.getLocationAnalytics(),
      ]);
      if (dashData) {
        const k = dashData.asset_kpis;
        setKpis({
          totalAssets: k.total_assets,
          activeAssets: k.active_assets,
          damagedAssets: k.damaged_assets,
          underMaintenance: k.under_maintenance,
          cancelledAssets: k.cancelled_assets,
          pendingRequests: k.pending_maintenance,
          totalUsers: k.total_users,
          labs: k.labs_count,
        });
        setDash({
          assets_by_location: dashData.assets_by_location ?? [],
          asset_category_distribution: dashData.asset_category_distribution ?? [],
          monthly_procurement_trend: dashData.monthly_procurement_trend ?? [],
          maintenance_status_distribution: dashData.maintenance_status_distribution ?? [],
          feedback_ratings_distribution: dashData.feedback_ratings_distribution ?? [],
        });
      }
      if (locData) setLocationAnalytics(locData);
      // Load top-3 ML predictions for dashboard teaser (fire-and-forget)
      api.getInventoryItems().then(async (items) => {
        if (!items.length) return;
        const nextMonth = new Date().getMonth() + 2;
        const slice = items.slice(0, 5);
        const results: MlPreviewItem[] = [];
        for (const item of slice) {
          const pred = await api.predictDemand(nextMonth, item.id, item.current_stock);
          if (pred) {
            const risk: MlPreviewItem['risk'] =
              item.current_stock >= pred.reorder_level ? 'safe'
              : item.current_stock >= pred.reorder_level * 0.5 ? 'low'
              : 'reorder';
            results.push({
              ...item,
              ...pred,
              risk,
              suggested_order: Math.max(0, pred.predicted_demand - item.current_stock),
            });
          }
        }
        setMlPreview(results.slice(0, 3));
      }).catch(() => { /* preview is non-critical */ });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadData();
  }, []);

  useAutoRefresh(loadData);

  useEffect(() => {
    if (!loading) {
      const id = window.requestAnimationFrame(() => setAnimate(true));
      return () => window.cancelAnimationFrame(id);
    }
  }, [loading]);

  async function handleRunChecks() {
    setRunningChecks(true);
    setChecksMsg('');
    try {
      await api.runChecks();
      setChecksMsg(t('checksComplete', 'Checks completed.'));
      await loadData();
    } catch {
      setChecksMsg(t('checksFailed', 'Checks failed — backend may be offline.'));
    } finally {
      setRunningChecks(false);
    }
  }

  const kpiCards: Array<{
    title: string;
    value: number | undefined;
    icon: React.ReactNode;
    color: 'blue' | 'green' | 'amber' | 'violet' | 'rose' | 'cyan' | 'default';
  }> = [
    { title: t('totalAssets', 'Total Assets'), value: kpis?.totalAssets, icon: <Box size={16} />, color: 'blue' },
    { title: t('activeAssets', 'Active Assets'), value: kpis?.activeAssets, icon: <CheckCircle2 size={16} />, color: 'green' },
    { title: t('damagedAssets', 'Damaged Assets'), value: kpis?.damagedAssets, icon: <AlertTriangle size={16} />, color: 'amber' },
    { title: t('underMaintenance', 'Under Maintenance'), value: kpis?.underMaintenance, icon: <Wrench size={16} />, color: 'violet' },
    { title: t('totalUsers', 'Total Users'), value: kpis?.totalUsers, icon: <Users size={16} />, color: 'cyan' },
    { title: t('cancelledAssets', 'Cancelled Assets'), value: kpis?.cancelledAssets, icon: <XCircle size={16} />, color: 'rose' },
    { title: t('pendingMaintenance', 'Pending Maintenance'), value: kpis?.pendingRequests, icon: <TrendingUp size={16} />, color: 'default' },
  ];

  return (
    <div className="dashboard-grid">

      {/* ── Page intro ───────────────────────── */}
      <div
        className={`page-intro entry-animate ${animate ? 'in' : ''}`}
        style={{ '--delay': '20ms' } as React.CSSProperties}
      >
        <h2>{t('adminDashboard', 'Admin Dashboard')}</h2>
        <p>{t('adminOverview', "Welcome back. Here's your complete campus overview.")}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <button
            className="btn secondary-btn"
            type="button"
            onClick={handleRunChecks}
            disabled={runningChecks}
          >
            <RefreshCw size={14} style={{ marginRight: 4 }} />
            {runningChecks ? t('running', 'Running...') : t('runChecks', 'Run Checks')}
          </button>
          {checksMsg && <span style={{ fontSize: '0.85em', opacity: 0.75 }}>{checksMsg}</span>}
        </div>
      </div>

      {/* ── KPI grid (7 cards) ───────────────── */}
      <div className="metric-grid kpi-grid-seven">
        {kpiCards.map((kpi, i) => (
          <KpiCard
            key={kpi.title}
            title={kpi.title}
            value={kpi.value}
            icon={kpi.icon}
            color={kpi.color}
            delay={70 + i * 55}
            animate={animate}
          />
        ))}
      </div>

      {/* ── Row 1: Assets by Lab (bar) + Category (pie) ── */}
      <div className="chart-grid chart-grid-6-4">
        <ChartCard
          title={t('assetsByLab', 'Assets by Lab Location')}
          subtitle={t('excludesNetworking', 'Excludes networking category')}
          delay={420} animate={animate}
        >
          <DashBarChart data={dash?.assets_by_location ?? []} multiColor />
        </ChartCard>

        <ChartCard
          title={t('categoryDistribution', 'Asset Category Distribution')}
          subtitle={t('excludesNetworking', 'Excludes networking category')}
          delay={480} animate={animate}
        >
          <DashPieChart data={dash?.asset_category_distribution ?? []} />
        </ChartCard>
      </div>

      {/* ── Row 2: Procurement trend (line) ────── */}
      <ChartCard
        title={t('monthlyProcurement', 'Monthly Procurement Trend')}
        subtitle={t('last12Months', 'Order count — last 12 months')}
        delay={540} animate={animate}
      >
        <DashLineChart
          data={(dash?.monthly_procurement_trend ?? []).map((d) => ({
            label: shortMonth(d.label),
            value: d.value,
          }))}
        />
      </ChartCard>

      {/* ── Row 3: Maintenance donut + Feedback ratings ── */}
      <div className="chart-grid chart-grid-balanced">
        <ChartCard
          title={t('maintenanceStatus', 'Maintenance Status Distribution')}
          delay={600} animate={animate}
        >
          <DashPieChart data={dash?.maintenance_status_distribution ?? []} donut />
        </ChartCard>

        <ChartCard
          title={t('feedbackRatings', 'Feedback Ratings Distribution')}
          subtitle={t('ratingScale', 'Rating scale 1–5')}
          delay={660} animate={animate}
        >
          <DashBarChart data={dash?.feedback_ratings_distribution ?? []} color="#F59E0B" />
        </ChartCard>
      </div>

      {/* ── Row 4: Location Analytics ─────────── */}
      <div
        className={`page-intro entry-animate ${animate ? 'in' : ''}`}
        style={{ '--delay': '700ms', marginTop: 8 } as React.CSSProperties}
      >
        <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{t('locationAnalytics', 'Location Analytics')}</h3>
        <p style={{ margin: '2px 0 0', fontSize: '0.85rem', opacity: 0.65 }}>
          {t('locationAnalyticsDesc', 'Asset distribution and maintenance across academic and non-academic facilities')}
        </p>
      </div>

      <div className="chart-grid chart-grid-balanced">
        <ChartCard
          title={t('assetsByLocationType', 'Assets by Location Type')}
          subtitle={t('academicVsNonAcademic', 'Academic vs Non-Academic')}
          delay={720} animate={animate}
        >
          <DashPieChart data={locationAnalytics?.byType ?? []} donut />
        </ChartCard>

        <ChartCard
          title={t('maintenanceByLocation', 'Maintenance by Location')}
          subtitle={t('requestsPerFacility', 'Requests per facility')}
          delay={780} animate={animate}
        >
          <DashBarChart data={locationAnalytics?.maintenanceByLocation ?? []} multiColor />
        </ChartCard>
      </div>

      <ChartCard
        title={t('assetsByFacility', 'Assets by Facility')}
        subtitle={t('allLocations', 'All locations — academic + non-academic')}
        delay={840} animate={animate}
      >
        <DashBarChart data={locationAnalytics?.byFacility ?? []} multiColor />
      </ChartCard>

      {/* ── Row 5: Inventory Intelligence (ML) Preview ── */}
      <div
        className={`page-intro entry-animate ${animate ? 'in' : ''}`}
        style={{ '--delay': '880ms', marginTop: 8 } as React.CSSProperties}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Brain size={20} style={{ color: '#4F6EF7' }} />
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{t('inventoryIntelligencePreview', 'Inventory Intelligence (ML)')}</h3>
          </div>
          <Link
            to="/admin/inventory-intelligence"
            style={{ fontSize: '0.83rem', color: '#4F6EF7', textDecoration: 'none', fontWeight: 600 }}
          >
            {t('viewAll', 'View All →')}
          </Link>
        </div>
        <p style={{ margin: '2px 0 0', fontSize: '0.85rem', opacity: 0.65 }}>
          {t('inventoryIntelligencePreviewDesc', 'Top items by ML demand prediction — reorder alerts for coming month')}
        </p>
      </div>

      {mlPreview.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {mlPreview.map((item, i) => {
            const borderColor =
              item.risk === 'safe' ? '#22C55E' : item.risk === 'low' ? '#F59E0B' : '#EF4444';
            const riskLabel =
              item.risk === 'safe' ? '✓ Safe' : item.risk === 'low' ? '⚠ Low Stock' : '✗ Reorder';
            const riskColor = borderColor;
            return (
              <article
                key={item.id}
                className={`card touch-card entry-animate ${animate ? 'in' : ''}`}
                style={{
                  '--delay': `${920 + i * 60}ms`,
                  borderLeft: `4px solid ${borderColor}`,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                } as React.CSSProperties}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.93rem' }}>{item.name}</p>
                  <span style={{ color: riskColor, fontWeight: 600, fontSize: '0.8rem' }}>{riskLabel}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.82rem' }}>
                  <div>
                    <span style={{ opacity: 0.6 }}>Current Stock</span>
                    <p style={{ margin: 0, fontWeight: 600 }}>{item.current_stock}</p>
                  </div>
                  <div>
                    <span style={{ opacity: 0.6 }}>Predicted Demand</span>
                    <p style={{ margin: 0, fontWeight: 600, color: '#4F6EF7' }}>{item.predicted_demand}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div
          className={`card entry-animate ${animate ? 'in' : ''}`}
          style={{ '--delay': '920ms', padding: '18px 20px', opacity: 0.55, display: 'flex', alignItems: 'center', gap: 10 } as React.CSSProperties}
        >
          <Brain size={18} />
          <span style={{ fontSize: '0.88rem' }}>
            {t('mlPreviewLoading', 'ML predictions loading… visit ')}{' '}
            <Link to="/admin/inventory-intelligence" style={{ color: '#4F6EF7' }}>
              {t('inventoryIntelligence', 'Inventory Intelligence')}
            </Link>{' '}
            {t('forFullReport', 'for the full report.')}
          </span>
        </div>
      )}

      {/* ── OCR Asset Label Scanner ────────────── */}
      <div
        className={`page-intro entry-animate ${animate ? 'in' : ''}`}
        style={{ '--delay': '960ms', marginTop: 8 } as React.CSSProperties}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Camera size={20} style={{ color: '#4F6EF7' }} />
          <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{t('ocrAssetScanner', 'Asset Label Scanner (OCR)')}</h3>
        </div>
        <p style={{ margin: '2px 0 0', fontSize: '0.85rem', opacity: 0.65 }}>
          {t('ocrAdminDesc', 'Scan asset labels or invoices to quickly extract asset details.')}
        </p>
      </div>

      <OCRScanner
        title={t('scanAssetLabel', 'Scan Asset Label')}
        description={t('ocrAdminHint', 'Upload a photo of an asset label, invoice, or printed sheet to extract name, serial number, and model.')}
        displayFields={['asset_name', 'serial_number', 'model', 'price', 'purchase_date']}
        onResult={handleOcrResult}
      />

      {/* OCR Save-to-Asset Modal */}
      {showOcrModal && (
        <div className="modal-overlay" onClick={() => !ocrSaving && setShowOcrModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Save Scanned Asset</h3>
              <button className="modal-close-btn" onClick={() => setShowOcrModal(false)} disabled={ocrSaving}>×</button>
            </div>
            {ocrSaveSuccess ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--success, #22c55e)', fontSize: 15 }}>
                ✓ Asset saved! Redirecting to assets page…
              </div>
            ) : (
              <form onSubmit={handleOcrSave}>
                <div className="modal-body">
                  <p style={{ margin: '0 0 16px', fontSize: 13, opacity: 0.65 }}>
                    Review the details extracted from your invoice, then click Save.
                  </p>
                  <div className="form-grid">
                    <div className="form-field">
                      <label>Asset Name <span className="required-star">*</span></label>
                      <input className="input" value={ocrForm.name} onChange={(e) => setOcrForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Dell Monitor 27&quot;" />
                    </div>
                    <div className="form-field">
                      <label>Category <span className="required-star">*</span></label>
                      <input className="input" list="ocr-cat-list" value={ocrForm.category} onChange={(e) => setOcrForm((p) => ({ ...p, category: e.target.value }))} placeholder="e.g. Electronics" />
                      <datalist id="ocr-cat-list">
                        {ocrCategoryList.map((c) => <option key={c.id} value={c.category_name} />)}
                      </datalist>
                    </div>
                    <div className="form-field">
                      <label>Serial / Asset Code</label>
                      <input className="input" value={ocrForm.serialNumber} onChange={(e) => setOcrForm((p) => ({ ...p, serialNumber: e.target.value }))} placeholder="e.g. SN-12345" />
                    </div>
                    <div className="form-field">
                      <label>Model</label>
                      <input className="input" value={ocrForm.model} onChange={(e) => setOcrForm((p) => ({ ...p, model: e.target.value }))} placeholder="e.g. P2723D" />
                    </div>
                    <div className="form-field">
                      <label>Purchase Date</label>
                      <input className="input" type="date" value={ocrForm.purchaseDate} onChange={(e) => setOcrForm((p) => ({ ...p, purchaseDate: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label>Status</label>
                      <select className="select" value={ocrForm.status} onChange={(e) => setOcrForm((p) => ({ ...p, status: e.target.value }))}>
                        <option>Active</option>
                        <option>Under Maintenance</option>
                        <option>Damaged</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Lab (optional)</label>
                      <select className="select" value={ocrForm.labId} onChange={(e) => setOcrForm((p) => ({ ...p, labId: e.target.value }))}>
                        <option value="">— None —</option>
                        {ocrLabList.map((l) => <option key={l.id} value={l.id}>{l.name}{l.department ? ` (${l.department})` : ''}</option>)}
                      </select>
                    </div>
                  </div>
                  {ocrSaveError && <p style={{ marginTop: 12, color: 'var(--danger)', fontSize: 13 }}>{ocrSaveError}</p>}
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn secondary-btn" onClick={() => setShowOcrModal(false)} disabled={ocrSaving}>Cancel</button>
                  <button type="submit" className="btn primary-btn" disabled={ocrSaving}>{ocrSaving ? 'Saving…' : 'Save to Assets'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

