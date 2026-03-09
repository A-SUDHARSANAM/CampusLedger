import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Building2, FlaskConical, LayoutGrid, Map as MapIcon, RefreshCw, Wifi } from 'lucide-react';
import { api } from '../../services/api';
import type { Asset } from '../../types/domain';
import type { DeviceHealth } from '../deviceMonitoring/DeviceHealthDashboard';
import type { MapAsset } from './AssetNode';
import { categoryToType } from './AssetNode';
import { MultiLabMap, MapLegend, assetToMapAsset } from './LabLayoutMap';
import type { BuildingSummary, CampusData, LabSummary } from './CampusMap';
import { BuildingView, CampusBreadcrumb, SmartCampusMap } from './CampusMap';
import { ArchitecturePanel, DemoBanner, DemoLabView, DEMO_CAMPUS, WorkflowStepper } from './DemoMode';
import './digitalTwin.css';
import './digitalTwinMap.css';
import './campusMap.css';

const POLL_INTERVAL_MS = 5000;

type StatusClass = 'dt-active' | 'dt-new' | 'dt-damaged' | 'dt-maintenance' | 'dt-unknown';

function statusClass(status: string): StatusClass {
  const s = status.toLowerCase().replace(/ /g, '_');
  if (s === 'active')           return 'dt-active';
  if (s === 'damaged')          return 'dt-damaged';
  if (s === 'under_maintenance') return 'dt-maintenance';
  return 'dt-new';
}

function statusLabel(status: string): string {
  const s = status.toLowerCase().replace(/ /g, '_');
  if (s === 'active')           return 'Active';
  if (s === 'damaged')          return 'Damaged';
  if (s === 'under_maintenance') return 'Maintenance';
  return status;
}

// â”€â”€ Asset card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function AssetCard({ asset, deviceHealth }: { asset: Asset; deviceHealth?: DeviceHealth }) {
  const sc = statusClass(asset.status);
  const healthBorder =
    deviceHealth?.status === 'offline' ? '#ef4444' :
    deviceHealth?.status === 'warning' ? '#f59e0b' :
    undefined;
  return (
    <article
      className={`dt-card ${sc}`}
      title={asset.name}
      style={healthBorder ? { borderColor: healthBorder, boxShadow: `0 0 0 2px ${healthBorder}33` } : undefined}
    >
      <div className="dt-card-header">
        <p className="dt-card-name">{asset.name}</p>
        <span className={`dt-status ${sc}`}>
          <span className="dt-status-dot" />
          {statusLabel(asset.status)}
        </span>
      </div>
      <div className="dt-meta">
        <div className="dt-meta-row">
          <span className="dt-meta-label">ID</span>
          <span className="dt-meta-value">{asset.assetCode || asset.id.slice(0, 8)}</span>
        </div>
        {asset.location && (
          <div className="dt-meta-row">
            <span className="dt-meta-label">Loc</span>
            <span className="dt-meta-value">{asset.location}</span>
          </div>
        )}
        {asset.category && (
          <div className="dt-meta-row">
            <span className="dt-meta-label">Cat</span>
            <span className="dt-meta-value">{asset.category}</span>
          </div>
        )}
      </div>
      {deviceHealth && (
        <div style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
          <span
            style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: deviceHealth.status === 'offline' ? '#ef4444' : deviceHealth.status === 'warning' ? '#f59e0b' : '#22c55e',
            }}
          />
          <span style={{ color: 'var(--text-muted)' }}>
            CPU {deviceHealth.cpu_usage.toFixed(0)}% Â· {deviceHealth.temperature.toFixed(0)}Â°C
          </span>
        </div>
      )}
    </article>
  );
}

// â”€â”€ Summary stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatBar({ assets }: { assets: Asset[] }) {
  const counts = assets.reduce(
    (acc, a) => {
      const s = a.status.toLowerCase().replace(/ /g, '_');
      if (s === 'active') acc.active++;
      else if (s === 'damaged') acc.damaged++;
      else if (s === 'under_maintenance') acc.maintenance++;
      else acc.other++;
      return acc;
    },
    { active: 0, damaged: 0, maintenance: 0, other: 0 },
  );
  return (
    <div className="dt-stat-bar">
      <div className="dt-stat">
        <span className="dt-status-dot" style={{ background: 'var(--success)' }} />
        <span className="dt-stat-count">{counts.active}</span>
        <span className="dt-stat-label">Active</span>
      </div>
      <div className="dt-stat">
        <span className="dt-status-dot" style={{ background: 'var(--danger)' }} />
        <span className="dt-stat-count">{counts.damaged}</span>
        <span className="dt-stat-label">Damaged</span>
      </div>
      <div className="dt-stat">
        <span className="dt-status-dot" style={{ background: 'var(--accent-primary)' }} />
        <span className="dt-stat-count">{counts.maintenance}</span>
        <span className="dt-stat-label">Under Maintenance</span>
      </div>
      <div className="dt-stat">
        <span className="dt-status-dot" style={{ background: 'var(--warning)' }} />
        <span className="dt-stat-count">{counts.other}</span>
        <span className="dt-stat-label">Other</span>
      </div>
      <div className="dt-stat" style={{ marginLeft: 'auto' }}>
        <span className="dt-stat-count">{assets.length}</span>
        <span className="dt-stat-label">Total</span>
      </div>
    </div>
  );
}

// â”€â”€ Main component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function DigitalTwinDashboard() {
  // â”€â”€ Asset data (polled live) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [deviceHealthMap, setDeviceHealthMap] = useState<Map<string, DeviceHealth>>(new Map());

  // â”€â”€ Campus hierarchy data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [campusData, setCampusData] = useState<CampusData>({ buildings: [] });
  const [campusLoading, setCampusLoading] = useState(true);
  const [campusError, setCampusError] = useState('');

  // â”€â”€ Navigation state (Campus â†’ Building â†’ Lab) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [viewLevel, setViewLevel] = useState<'campus' | 'building' | 'lab'>('campus');
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingSummary | null>(null);
  const [selectedLab, setSelectedLab] = useState<LabSummary | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // â”€â”€ Lab view mode (Grid / Map) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [mapTypeFilter, setMapTypeFilter] = useState('');

  // â”€â”€ Lab-level filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  // â”€â”€ RFID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [rfidTag, setRfidTag] = useState('');
  const [rfidResult, setRfidResult] = useState<{ id: string; name: string; status: string; serial_number?: string; location?: string } | null>(null);
  const [rfidError, setRfidError] = useState('');
  const [rfidLoading, setRfidLoading] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // â”€â”€ Data fetching â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchCampus = useCallback(async () => {
    try {
      const data = await api.getCampus();
      setCampusData(data);
      setCampusError('');
    } catch {
      setCampusError('Failed to load campus data.');
    } finally {
      setCampusLoading(false);
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      const data = await api.getAssets('admin');
      setAssets(data);
      setLastUpdated(new Date());
      setError('');
    } catch {
      setError('Failed to load assets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampus();
    fetchAssets();

    const fetchHealth = () => {
      api.getDeviceHealth().then((devices) => {
        const map = new Map<string, DeviceHealth>();
        devices.forEach((dh) => map.set(dh.device_id.toLowerCase(), dh));
        setDeviceHealthMap(map);
      }).catch(() => {});
    };
    fetchHealth();

    pollRef.current = setInterval(() => { fetchAssets(); fetchHealth(); }, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchAssets, fetchCampus]);

  // â”€â”€ Navigation handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function handleSelectBuilding(building: BuildingSummary) {
    setSelectedBuilding(building);
    setViewLevel('building');
  }

  function handleSelectLab(lab: LabSummary) {
    setSelectedLab(lab);
    setViewLevel('lab');
    // Reset lab-level filters when entering a new lab
    setFilterStatus('');
    setFilterSearch('');
    setFilterCategory('');
    setMapTypeFilter('');
    setViewMode('grid');
  }

  function goToCampus() {
    setViewLevel('campus');
    setSelectedBuilding(null);
    setSelectedLab(null);
  }

  function goToBuilding() {
    setViewLevel('building');
    setSelectedLab(null);
  }

  function startDemo() {
    setIsDemoMode(true);
    setViewLevel('campus');
    setSelectedBuilding(null);
    setSelectedLab(null);
  }

  function exitDemo() {
    setIsDemoMode(false);
    setViewLevel('campus');
    setSelectedBuilding(null);
    setSelectedLab(null);
  }

  function handleRefresh() {
    if (viewLevel === 'campus') {
      setCampusLoading(true);
      fetchCampus();
    } else {
      fetchAssets();
    }
  }

  // â”€â”€ Breadcrumb segments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const breadcrumbs = useMemo(() => {
    const segs = [{ label: 'Campus', onClick: viewLevel !== 'campus' ? goToCampus : undefined }];
    if (selectedBuilding) segs.push({ label: selectedBuilding.name, onClick: viewLevel === 'lab' ? goToBuilding : undefined });
    if (selectedLab)      segs.push({ label: selectedLab.name, onClick: undefined });
    return segs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewLevel, selectedBuilding, selectedLab]);

  // â”€â”€ Assets filtered to selected lab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const labAssets = useMemo(() => {
    if (!selectedLab) return assets;
    return assets.filter((a) => a.labId === selectedLab.id);
  }, [assets, selectedLab]);

  const uniqueCategories = useMemo(
    () => Array.from(new Set(labAssets.map((a) => a.category).filter(Boolean))),
    [labAssets],
  );

  // Apply text/category/status filters within the lab
  const displayed = labAssets.filter((a) => {
    if (filterStatus) {
      const s = a.status.toLowerCase().replace(/ /g, '_');
      if (filterStatus !== s) return false;
    }
    if (filterCategory && a.category.toLowerCase() !== filterCategory.toLowerCase()) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.assetCode.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // MapAsset list (for map view within a lab)
  const mapAssets = useMemo((): MapAsset[] => {
    let src = displayed;
    if (mapTypeFilter) src = src.filter((a) => categoryToType(a.category) === mapTypeFilter);
    return src.map((a, i) => assetToMapAsset(a, i));
  }, [displayed, mapTypeFilter]);

  // â”€â”€ RFID â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleRfidScan() {
    if (!rfidTag.trim()) return;
    setRfidLoading(true);
    setRfidError('');
    setRfidResult(null);
    try {
      const result = await api.rfidScan(rfidTag.trim());
      if (result) setRfidResult(result);
      else setRfidError('No asset found for this tag.');
    } catch {
      setRfidError('RFID lookup failed.');
    } finally {
      setRfidLoading(false);
    }
  }

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="dashboard-grid">

      {/* â”€â”€ Page header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="page-intro">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <Activity size={20} style={{ color: 'var(--accent-primary)' }} />
              Smart Campus Map
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.65 }}>
              {viewLevel === 'campus'  && 'Click a building to explore its labs and assets.'}
              {viewLevel === 'building' && `Labs in ${selectedBuilding?.name ?? 'Building'} â€” click a lab to view assets.`}
              {viewLevel === 'lab'     && `${selectedLab?.name ?? 'Lab'} Â· Live asset status. Updates every 5 seconds.`}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {lastUpdated && viewLevel === 'lab' && (
              <span className="dt-live-badge">
                <span className="dt-live-dot" />
                LIVE
              </span>
            )}
            {/* Grid â†” Map toggle â€” only in lab view */}
            {viewLevel === 'lab' && (
              <div className="dtm-view-toggle">
                <button
                  className={`dtm-view-btn${viewMode === 'grid' ? ' dtm-active' : ''}`}
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                >
                  <LayoutGrid size={13} /> Grid
                </button>
                <button
                  className={`dtm-view-btn${viewMode === 'map' ? ' dtm-active' : ''}`}
                  onClick={() => setViewMode('map')}
                  title="Floor-plan map view"
                >
                  <MapIcon size={13} /> Map
                </button>
              </div>
            )}
            {!isDemoMode && (
              <button
                className="btn secondary-btn"
                type="button"
                onClick={startDemo}
                style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <FlaskConical size={14} />
                Demo
              </button>
            )}
            <button
              className="btn secondary-btn"
              type="button"
              onClick={handleRefresh}
              disabled={loading || campusLoading}
              style={{ padding: '7px 12px' }}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* â”€â”€ Breadcrumb â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isDemoMode && <DemoBanner onExit={exitDemo} />}
      {isDemoMode && <WorkflowStepper level={viewLevel} />}
      {viewLevel !== 'campus' && <CampusBreadcrumb segments={breadcrumbs} />}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          CAMPUS LEVEL â€” Building cards
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {viewLevel === 'campus' && (
        campusLoading && !isDemoMode ? (
          <p style={{ opacity: 0.55, fontSize: '0.875rem' }}>Loading campus map…</p>
        ) : campusError && !isDemoMode ? (
          <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{campusError}</p>
        ) : (
          <>
            {!isDemoMode && campusData.buildings.length === 0 && (
              <ArchitecturePanel onTryDemo={startDemo} />
            )}
            {(isDemoMode || campusData.buildings.length > 0) && (
              <SmartCampusMap
                data={isDemoMode ? DEMO_CAMPUS : campusData}
                onSelectBuilding={handleSelectBuilding}
              />
            )}
          </>
        )
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          BUILDING LEVEL â€” Lab cards
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {viewLevel === 'building' && selectedBuilding && (
        <BuildingView
          building={selectedBuilding}
          onBack={goToCampus}
          onSelectLab={handleSelectLab}
        />
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          LAB LEVEL â€” Asset grid / floor-plan
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {viewLevel === 'lab' && selectedLab && (
        <>
          {isDemoMode ? (
            <DemoLabView lab={selectedLab} viewMode={viewMode} />
          ) : (
          <>
          {/* RFID scan panel */}
          <section className="card">
            <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wifi size={15} />
              RFID Tag Lookup
            </h3>
            <div className="dt-rfid-panel">
              <input
                className="input"
                style={{ flex: '1 1 200px', maxWidth: 280 }}
                type="text"
                placeholder="Enter RFID / barcode tagâ€¦"
                value={rfidTag}
                onChange={(e) => setRfidTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRfidScan()}
              />
              <button
                className="btn primary-btn"
                type="button"
                onClick={handleRfidScan}
                disabled={rfidLoading || !rfidTag.trim()}
                style={{ marginTop: 0, width: 'auto' }}
              >
                {rfidLoading ? 'Scanningâ€¦' : 'Scan'}
              </button>
            </div>
            {rfidError  && <p style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--danger)' }}>{rfidError}</p>}
            {rfidResult && (
              <div className="dt-rfid-result">
                <strong>{rfidResult.name}</strong>
                <span>Status: {rfidResult.status}</span>
                {rfidResult.serial_number && <span>S/N: {rfidResult.serial_number}</span>}
                {rfidResult.location && <span>Location: {rfidResult.location}</span>}
              </div>
            )}
          </section>

          {/* Stats bar scoped to this lab */}
          {!loading && <StatBar assets={labAssets} />}

          {/* Map-mode controls */}
          {viewMode === 'map' && (
            <>
              <MapLegend />
              <section className="card dtm-map-filters">
                <select className="input" value={mapTypeFilter} onChange={(e) => setMapTypeFilter(e.target.value)}
                  style={{ flex: '1 1 160px' }}>
                  <option value="">All Asset Types</option>
                  {['computer','laptop','printer','projector','server','oscilloscope','network','camera','tablet','monitor','scanner','equipment'].map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
                <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                  style={{ flex: '1 1 140px' }}>
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="damaged">Damaged</option>
                  <option value="under_maintenance">Under Maintenance</option>
                </select>
                {(mapTypeFilter || filterStatus) && (
                  <button className="btn secondary-btn" type="button" style={{ flexShrink: 0 }}
                    onClick={() => { setMapTypeFilter(''); setFilterStatus(''); }}>
                    Clear
                  </button>
                )}
              </section>
            </>
          )}

          {/* Grid-mode filters */}
          {viewMode === 'grid' && (
            <section className="card dt-filter-bar">
              <input className="input" type="text" placeholder="Search assetsâ€¦" value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)} style={{ flex: '1 1 180px', minWidth: 140 }} />
              <select className="input" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                style={{ flex: '1 1 160px', minWidth: 140 }}>
                <option value="">All Categories</option>
                {uniqueCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                style={{ flex: '1 1 140px', minWidth: 120 }}>
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="damaged">Damaged</option>
                <option value="under_maintenance">Under Maintenance</option>
              </select>
              {(filterCategory || filterStatus || filterSearch) && (
                <button className="btn secondary-btn" type="button" style={{ flexShrink: 0 }}
                  onClick={() => { setFilterCategory(''); setFilterStatus(''); setFilterSearch(''); }}>
                  Clear
                </button>
              )}
            </section>
          )}

          {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>}

          {loading ? (
            <p style={{ opacity: 0.55, fontSize: '0.875rem' }}>Loading assetsâ€¦</p>
          ) : viewMode === 'grid' ? (
            <div className="dt-grid">
              {displayed.length === 0 ? (
                <div className="dt-empty">No assets match the current filters.</div>
              ) : (
                displayed.map((asset) => {
                  const healthKey = (asset.assetCode || asset.serialNumber || '').toLowerCase();
                  const dh = deviceHealthMap.get(healthKey);
                  return <AssetCard key={asset.id} asset={asset} deviceHealth={dh} />;
                })
              )}
            </div>
          ) : (
            <MultiLabMap assets={mapAssets} />
          )}

          {lastUpdated && (
            <p style={{ fontSize: '0.75rem', opacity: 0.45, margin: 0 }}>
              Last updated: {lastUpdated.toLocaleTimeString()}
              {' Â· '}{displayed.length} of {labAssets.length} assets shown
            </p>
          )}          </>
          )}        </>
      )}

    </div>
  );
}
