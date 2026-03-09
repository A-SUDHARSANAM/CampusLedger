/**
 * Smart Campus Map — hierarchical navigation
 *
 * Levels:  Campus  →  Building  →  Lab (floor-plan)
 *
 * Components exported:
 *   SmartCampusMap   – top-level campus view (building cards)
 *   BuildingView     – labs inside one building
 *   CampusBreadcrumb – breadcrumb strip
 *   CampusFilters    – dept/building/search filter bar
 *
 * Types exported:
 *   BuildingSummary, LabSummary, CampusData (mirrors backend)
 */
import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  FlaskConical,
  LayoutGrid,
  Search,
} from 'lucide-react';
import './campusMap.css';

// ── Backend response types ────────────────────────────────────────────────────

export interface LabSummary {
  id: string;
  name: string;
  building: string;
  department: string;
  asset_total: number;
  active: number;
  maintenance: number;
  damaged: number;
}

export interface BuildingSummary {
  name: string;
  labs: LabSummary[];
  asset_total: number;
}

export interface CampusData {
  buildings: BuildingSummary[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function labHealthLevel(lab: LabSummary): 'good' | 'warning' | 'critical' | 'none' {
  if (lab.damaged > 0) return 'critical';
  if (lab.maintenance > 0) return 'warning';
  if (lab.active > 0) return 'good';
  return 'none';
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

export interface BreadcrumbSegment {
  label: string;
  onClick?: () => void;
}

export function CampusBreadcrumb({ segments }: { segments: BreadcrumbSegment[] }) {
  return (
    <nav className="cm-breadcrumb" aria-label="Campus navigation">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight className="cm-breadcrumb-sep" size={13} />}
            <button
              className={`cm-breadcrumb-item${isLast ? ' cm-breadcrumb-active' : ''}`}
              onClick={isLast ? undefined : seg.onClick}
              disabled={isLast}
            >
              {seg.label}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ── Building health bar ───────────────────────────────────────────────────────

function BuildingHealthBar({ building }: { building: BuildingSummary }) {
  const total = building.asset_total;
  if (total === 0) return <div className="cm-building-health"><div className="cm-health-seg cm-health-none" /></div>;

  const active     = building.labs.reduce((s, l) => s + l.active, 0);
  const maint      = building.labs.reduce((s, l) => s + l.maintenance, 0);
  const damaged    = building.labs.reduce((s, l) => s + l.damaged, 0);

  return (
    <div className="cm-building-health" title={`Active: ${active} · Maintenance: ${maint} · Damaged: ${damaged}`}>
      {active  > 0 && <div className="cm-health-seg cm-health-active"     style={{ flexGrow: active }} />}
      {maint   > 0 && <div className="cm-health-seg cm-health-maintenance" style={{ flexGrow: maint }} />}
      {damaged > 0 && <div className="cm-health-seg cm-health-damaged"    style={{ flexGrow: damaged }} />}
      {(active + maint + damaged) < total && (
        <div className="cm-health-seg cm-health-none" style={{ flexGrow: total - active - maint - damaged }} />
      )}
    </div>
  );
}

// ── Building card ─────────────────────────────────────────────────────────────

function BuildingCard({
  building,
  onClick,
}: {
  building: BuildingSummary;
  onClick: () => void;
}) {
  const criticalCount = building.labs.reduce((s, l) => s + l.damaged, 0);
  const maintCount    = building.labs.reduce((s, l) => s + l.maintenance, 0);

  return (
    <article className="cm-building-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}>
      <div className="cm-building-header">
        <div className="cm-building-icon">
          <Building2 size={20} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cm-building-name">{building.name}</div>
        </div>
        <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
      </div>

      <BuildingHealthBar building={building} />

      <div className="cm-building-stats">
        <span className="cm-stat-chip">
          <LayoutGrid size={12} />
          {building.labs.length} {building.labs.length === 1 ? 'Lab' : 'Labs'}
        </span>
        <span className="cm-stat-chip">
          {building.asset_total} Assets
        </span>
        {criticalCount > 0 && (
          <span className="cm-stat-chip" style={{ color: '#ef4444', borderColor: '#ef444433' }}>
            ⚠ {criticalCount} Critical
          </span>
        )}
        {maintCount > 0 && !criticalCount && (
          <span className="cm-stat-chip" style={{ color: '#f59e0b', borderColor: '#f59e0b33' }}>
            ⚠ {maintCount} Maintenance
          </span>
        )}
      </div>
    </article>
  );
}

// ── Lab card ──────────────────────────────────────────────────────────────────

function LabCard({
  lab,
  onClick,
}: {
  lab: LabSummary;
  onClick: () => void;
}) {
  const health = labHealthLevel(lab);
  return (
    <article
      className="cm-lab-card"
      data-health={health}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="cm-lab-header">
        <div className="cm-lab-icon">
          <FlaskConical size={16} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="cm-lab-name">{lab.name}</div>
          {lab.department && <div className="cm-lab-dept">{lab.department}</div>}
        </div>
        <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: 'auto' }} />
      </div>

      <div className="cm-lab-meta">
        <span className="cm-lab-asset-count">{lab.asset_total} assets</span>
      </div>

      <div className="cm-lab-status-row">
        {lab.active > 0 && (
          <span className="cm-status-badge active">
            <span className="cm-status-dot" />
            {lab.active} Active
          </span>
        )}
        {lab.maintenance > 0 && (
          <span className="cm-status-badge maintenance">
            <span className="cm-status-dot" />
            {lab.maintenance} Maintenance
          </span>
        )}
        {lab.damaged > 0 && (
          <span className="cm-status-badge damaged">
            <span className="cm-status-dot" />
            {lab.damaged} Critical
          </span>
        )}
        {lab.asset_total === 0 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No assets yet</span>
        )}
      </div>
    </article>
  );
}

// ── Campus filter bar ─────────────────────────────────────────────────────────

interface CampusFiltersProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  departments: string[];
  selectedDept: string;
  onDeptChange: (v: string) => void;
  buildings?: string[];
  selectedBuilding: string;
  onBuildingChange: (v: string) => void;
  onClear: () => void;
}

export function CampusFilters({
  searchQuery,
  onSearchChange,
  departments,
  selectedDept,
  onDeptChange,
  buildings,
  selectedBuilding,
  onBuildingChange,
  onClear,
}: CampusFiltersProps) {
  const hasFilters = searchQuery || selectedDept || selectedBuilding;
  return (
    <section className="card cm-filter-bar">
      <div style={{ position: 'relative', flex: '1 1 180px' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input
          className="input"
          type="text"
          placeholder="Search labs or buildings…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{ paddingLeft: 32 }}
        />
      </div>
      {departments.length > 0 && (
        <select className="input" value={selectedDept} onChange={(e) => onDeptChange(e.target.value)}
          style={{ flex: '1 1 160px' }}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      )}
      {buildings && buildings.length > 0 && (
        <select className="input" value={selectedBuilding} onChange={(e) => onBuildingChange(e.target.value)}
          style={{ flex: '1 1 160px' }}>
          <option value="">All Buildings</option>
          {buildings.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      )}
      {hasFilters && (
        <button className="btn secondary-btn" type="button" style={{ flexShrink: 0 }} onClick={onClear}>
          Clear
        </button>
      )}
    </section>
  );
}

// ── Building view (labs inside one building) ──────────────────────────────────

interface BuildingViewProps {
  building: BuildingSummary;
  onBack: () => void;
  onSelectLab: (lab: LabSummary) => void;
}

export function BuildingView({ building, onBack, onSelectLab }: BuildingViewProps) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const departments = useMemo(
    () => Array.from(new Set(building.labs.map((l) => l.department).filter(Boolean))).sort(),
    [building],
  );

  const filteredLabs = useMemo(() => {
    let src = building.labs;
    if (deptFilter) src = src.filter((l) => l.department === deptFilter);
    if (search) {
      const q = search.toLowerCase();
      src = src.filter((l) => l.name.toLowerCase().includes(q) || l.department.toLowerCase().includes(q));
    }
    return src;
  }, [building.labs, deptFilter, search]);

  return (
    <>
      {/* Section title + back */}
      <div className="cm-section-title">
        <button className="cm-back-btn" onClick={onBack}>
          <ArrowLeft size={14} />
          Campus
        </button>
        <span className="cm-level-tag">
          <Building2 size={11} />
          {building.name}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 'auto' }}>
          {building.labs.length} labs · {building.asset_total} assets
        </span>
      </div>

      {/* Filters */}
      {(departments.length > 1 || building.labs.length > 5) && (
        <section className="card cm-filter-bar" style={{ marginBottom: 0 }}>
          <div style={{ position: 'relative', flex: '1 1 180px' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input className="input" type="text" placeholder="Search labs…" value={search}
              onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
          {departments.length > 1 && (
            <select className="input" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
              style={{ flex: '1 1 160px' }}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          {(search || deptFilter) && (
            <button className="btn secondary-btn" type="button"
              onClick={() => { setSearch(''); setDeptFilter(''); }}>
              Clear
            </button>
          )}
        </section>
      )}

      {/* Lab cards */}
      <div className="cm-card-grid">
        {filteredLabs.length === 0 ? (
          <div className="cm-empty">No labs match the current filters.</div>
        ) : (
          filteredLabs.map((lab) => (
            <LabCard key={lab.id} lab={lab} onClick={() => onSelectLab(lab)} />
          ))
        )}
      </div>
    </>
  );
}

// ── SmartCampusMap (top-level campus view) ────────────────────────────────────

interface SmartCampusMapProps {
  data: CampusData;
  onSelectBuilding: (building: BuildingSummary) => void;
}

export function SmartCampusMap({ data, onSelectBuilding }: SmartCampusMapProps) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  const departments = useMemo(
    () =>
      Array.from(
        new Set(data.buildings.flatMap((b) => b.labs.map((l) => l.department)).filter(Boolean)),
      ).sort(),
    [data],
  );

  const filteredBuildings = useMemo(() => {
    let src = data.buildings;
    if (search) {
      const q = search.toLowerCase();
      src = src.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.labs.some((l) => l.name.toLowerCase().includes(q)),
      );
    }
    if (deptFilter) {
      src = src.filter((b) => b.labs.some((l) => l.department === deptFilter));
    }
    return src;
  }, [data.buildings, search, deptFilter]);

  const totalAssets = data.buildings.reduce((s, b) => s + b.asset_total, 0);
  const totalLabs   = data.buildings.reduce((s, b) => s + b.labs.length, 0);

  return (
    <>
      {/* Campus stats strip */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '2px 0 4px' }}>
        <span className="cm-stat-chip"><Building2 size={12} /> {data.buildings.length} Buildings</span>
        <span className="cm-stat-chip"><FlaskConical size={12} /> {totalLabs} Labs</span>
        <span className="cm-stat-chip"><LayoutGrid size={12} /> {totalAssets} Assets</span>
        <span className="cm-level-tag" style={{ marginLeft: 'auto' }}>Campus View</span>
      </div>

      {/* Filters */}
      <CampusFilters
        searchQuery={search}
        onSearchChange={setSearch}
        departments={departments}
        selectedDept={deptFilter}
        onDeptChange={setDeptFilter}
        selectedBuilding=""
        onBuildingChange={() => {}}
        onClear={() => { setSearch(''); setDeptFilter(''); }}
      />

      {/* Building cards */}
      <div className="cm-card-grid">
        {filteredBuildings.length === 0 ? (
          <div className="cm-empty">No buildings match the current filters.</div>
        ) : (
          filteredBuildings.map((b) => (
            <BuildingCard key={b.name} building={b} onClick={() => onSelectBuilding(b)} />
          ))
        )}
      </div>
    </>
  );
}
