/**
 * Smart Campus Map — Demo Mode
 *
 * Provides mock campus data and demo components so the Digital Twin feature
 * is fully navigable even when no backend data is seeded:
 *
 *   DEMO_CAMPUS          – CampusData with 4 buildings and 10 labs
 *   getDemoLabAssets     – Generates MapAsset[] for any demo lab
 *   ArchitecturePanel    – Tech-stack diagram + workflow guide + "Try Demo" CTA
 *   DemoBanner           – Persistent demo-mode indicator strip
 *   WorkflowStepper      – 4-step progress: Campus → Building → Lab → Assets
 *   DemoLabView          – Floor-plan view populated with demo assets
 */
import React from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Database,
  FlaskConical,
  Map as MapIcon,
  Server,
  Wifi,
  X,
} from 'lucide-react';
import type { CampusData, LabSummary } from './CampusMap';
import type { MapAsset } from './AssetNode';
import { getAssetIcon, getStatusColors } from './AssetNode';
import { LabLayoutMap, MapLegend, getGridPos } from './LabLayoutMap';
import './campusMap.css';

/* ═══════════════════════════════════════════════════════════
   DEMO CAMPUS DATA
═══════════════════════════════════════════════════════════ */

export const DEMO_CAMPUS: CampusData = {
  buildings: [
    {
      name: 'Technology Block',
      asset_total: 70,
      labs: [
        { id: 'demo-tech-cs',  name: 'Computer Lab',   building: 'Technology Block', department: 'Computer Science', asset_total: 35, active: 32, maintenance: 2, damaged: 1 },
        { id: 'demo-tech-ai',  name: 'AI Lab',         building: 'Technology Block', department: 'Computer Science', asset_total: 20, active: 18, maintenance: 2, damaged: 0 },
        { id: 'demo-tech-net', name: 'Networking Lab', building: 'Technology Block', department: 'Computer Science', asset_total: 15, active: 12, maintenance: 3, damaged: 0 },
      ],
    },
    {
      name: 'Electronics Block',
      asset_total: 30,
      labs: [
        { id: 'demo-elec-osc', name: 'Electronics Lab',      building: 'Electronics Block', department: 'Electronics', asset_total: 18, active: 16, maintenance: 1, damaged: 1 },
        { id: 'demo-elec-emb', name: 'Embedded Systems Lab', building: 'Electronics Block', department: 'Electronics', asset_total: 12, active: 10, maintenance: 2, damaged: 0 },
      ],
    },
    {
      name: 'Mechanical Block',
      asset_total: 35,
      labs: [
        { id: 'demo-mech-cad', name: 'CAD Lab',      building: 'Mechanical Block', department: 'Mechanical Engineering', asset_total: 25, active: 23, maintenance: 2, damaged: 0 },
        { id: 'demo-mech-rob', name: 'Robotics Lab', building: 'Mechanical Block', department: 'Mechanical Engineering', asset_total: 10, active: 8,  maintenance: 0, damaged: 2 },
      ],
    },
    {
      name: 'Common Facilities',
      asset_total: 14,
      labs: [
        { id: 'demo-fac-sem', name: 'Seminar Hall', building: 'Common Facilities', department: 'Administration', asset_total: 4,  active: 4, maintenance: 0, damaged: 0 },
        { id: 'demo-fac-aud', name: 'Auditorium',  building: 'Common Facilities', department: 'Administration', asset_total: 4,  active: 3, maintenance: 1, damaged: 0 },
        { id: 'demo-fac-srv', name: 'Server Room', building: 'Common Facilities', department: 'IT',             asset_total: 6,  active: 5, maintenance: 1, damaged: 0 },
      ],
    },
  ],
};

/* ═══════════════════════════════════════════════════════════
   DEMO ASSET GENERATOR
═══════════════════════════════════════════════════════════ */

// getGridPos from LabLayoutMap provides the 8-per-row paired-facing-row
// layout automatically. getGridPos(i) returns { x, y, flip }.

type Slot = { type: string; category: string; prefix: string; statuses: string[] };
interface DemoSpec { labName: string; dept: string; slots: Slot[] }
const a = (n: number, s: string) => Array<string>(n).fill(s);

const DEMO_SPECS: Record<string, DemoSpec> = {
  'demo-tech-cs': {
    labName: 'Computer Lab', dept: 'Computer Science',
    slots: [{ type: 'computer', category: 'Computer', prefix: 'PC', statuses: [...a(32, 'active'), 'under_maintenance', 'under_maintenance', 'damaged'] }],
  },
  'demo-tech-ai': {
    labName: 'AI Lab', dept: 'Computer Science',
    slots: [{ type: 'server', category: 'GPU Workstation', prefix: 'GPU', statuses: [...a(18, 'active'), 'under_maintenance', 'under_maintenance'] }],
  },
  'demo-tech-net': {
    labName: 'Networking Lab', dept: 'Computer Science',
    slots: [{ type: 'network', category: 'Network Device', prefix: 'NET', statuses: [...a(12, 'active'), 'under_maintenance', 'under_maintenance', 'under_maintenance'] }],
  },
  'demo-elec-osc': {
    labName: 'Electronics Lab', dept: 'Electronics',
    slots: [{ type: 'oscilloscope', category: 'Oscilloscope', prefix: 'OSC', statuses: [...a(16, 'active'), 'under_maintenance', 'damaged'] }],
  },
  'demo-elec-emb': {
    labName: 'Embedded Systems Lab', dept: 'Electronics',
    slots: [{ type: 'equipment', category: 'Microcontroller Kit', prefix: 'MCU', statuses: [...a(10, 'active'), 'under_maintenance', 'under_maintenance'] }],
  },
  'demo-mech-cad': {
    labName: 'CAD Lab', dept: 'Mechanical Engineering',
    slots: [{ type: 'computer', category: 'CAD Workstation', prefix: 'WS', statuses: [...a(23, 'active'), 'under_maintenance', 'under_maintenance'] }],
  },
  'demo-mech-rob': {
    labName: 'Robotics Lab', dept: 'Mechanical Engineering',
    slots: [{ type: 'equipment', category: 'Robot', prefix: 'BOT', statuses: [...a(8, 'active'), 'damaged', 'damaged'] }],
  },
  'demo-fac-sem': {
    labName: 'Seminar Hall', dept: 'Administration',
    slots: [
      { type: 'projector', category: 'Projector',     prefix: 'PROJ', statuses: ['active', 'active'] },
      { type: 'monitor',   category: 'Display Screen', prefix: 'DISP', statuses: ['active', 'active'] },
    ],
  },
  'demo-fac-aud': {
    labName: 'Auditorium', dept: 'Administration',
    slots: [{ type: 'equipment', category: 'Speaker System', prefix: 'SPK', statuses: ['active', 'active', 'active', 'under_maintenance'] }],
  },
  'demo-fac-srv': {
    labName: 'Server Room', dept: 'IT',
    slots: [{ type: 'server', category: 'Server', prefix: 'SRV', statuses: [...a(5, 'active'), 'under_maintenance'] }],
  },
};

export function getDemoLabAssets(labId: string): MapAsset[] {
  const spec = DEMO_SPECS[labId];
  if (!spec) return [];
  const result: MapAsset[] = [];
  let idx = 0;
  for (const slot of spec.slots) {
    slot.statuses.forEach((status, i) => {
      const { x, y, flip } = getGridPos(idx++);
      result.push({
        id: `${labId}-${slot.prefix}-${i + 1}`,
        name: `${slot.prefix}_${String(i + 1).padStart(3, '0')}`,
        type: slot.type,
        status,
        x, y, flip,
        lab: spec.labName,
        lab_id: labId,
        department: spec.dept,
        asset_code: `${slot.prefix}${String(i + 1).padStart(3, '0')}`,
        category: slot.category,
      });
    });
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════
   ARCHITECTURE PANEL
═══════════════════════════════════════════════════════════ */

const ARCH_NODES = [
  { Icon: Wifi,     label: 'IoT / RFID',   desc: 'Sensor Layer',    color: '#22c55e' },
  { Icon: Server,   label: 'FastAPI',       desc: 'REST Backend',    color: '#4F6EF7' },
  { Icon: Database, label: 'Supabase',      desc: 'PostgreSQL DB',   color: '#f59e0b' },
  { Icon: Activity, label: 'React',         desc: 'Web Frontend',    color: '#7c5ac9' },
  { Icon: MapIcon,  label: 'Digital Twin',  desc: 'Live Campus Map', color: '#ef4444' },
];

const WORKFLOW_STEPS = [
  { n: 1, title: 'Browse Campus',   desc: 'View all buildings with live health summaries.' },
  { n: 2, title: 'Select Building', desc: 'Click a building card to see its labs.' },
  { n: 3, title: 'Open a Lab',      desc: 'Navigate into a lab to view its floor plan.' },
  { n: 4, title: 'Inspect Assets',  desc: 'Click any asset icon for detailed status info.' },
];

export function ArchitecturePanel({ onTryDemo }: { onTryDemo: () => void }) {
  return (
    <div className="arch-panel card">
      <div className="arch-panel-header">
        <h3 className="arch-panel-title">How the Digital Twin Works</h3>
        <p className="arch-panel-subtitle">
          Real-time campus infrastructure visualization — connect your backend to display live data.
        </p>
      </div>

      {/* Tech-stack flow */}
      <div className="arch-flow-wrap">
        <div className="arch-flow" role="list">
          {ARCH_NODES.map((node, i) => (
            <React.Fragment key={node.label}>
              <div className="arch-node" role="listitem">
                <div
                  className="arch-node-icon"
                  style={{ background: `${node.color}18`, border: `1.5px solid ${node.color}44`, color: node.color }}
                >
                  <node.Icon size={22} />
                </div>
                <div className="arch-node-label">{node.label}</div>
                <div className="arch-node-desc">{node.desc}</div>
              </div>
              {i < ARCH_NODES.length - 1 && (
                <div className="arch-arrow" aria-hidden="true">
                  <ArrowRight size={13} />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Workflow steps */}
      <div className="arch-steps">
        {WORKFLOW_STEPS.map((step) => (
          <div key={step.n} className="arch-step">
            <div className="arch-step-num">{step.n}</div>
            <div>
              <div className="arch-step-title">{step.title}</div>
              <div className="arch-step-desc">{step.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
        <button
          className="btn primary-btn"
          type="button"
          onClick={onTryDemo}
          style={{ display: 'flex', alignItems: 'center', gap: 7 }}
        >
          <FlaskConical size={15} />
          Try Demo Workflow
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DEMO BANNER
═══════════════════════════════════════════════════════════ */

export function DemoBanner({ onExit }: { onExit: () => void }) {
  return (
    <div className="demo-banner">
      <FlaskConical size={14} />
      <span>Demo Mode — exploring mock campus data</span>
      <button className="demo-banner-exit" type="button" onClick={onExit}>
        <X size={13} />
        Exit Demo
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   WORKFLOW STEPPER
═══════════════════════════════════════════════════════════ */

const STEPS = [
  { key: 'campus',   label: 'Campus' },
  { key: 'building', label: 'Building' },
  { key: 'lab',      label: 'Lab' },
  { key: 'assets',   label: 'Assets' },
] as const;

type StepLevel = 'campus' | 'building' | 'lab';

export function WorkflowStepper({ level }: { level: StepLevel }) {
  const activeIdx = level === 'campus' ? 0 : level === 'building' ? 1 : 2;
  return (
    <div className="workflow-stepper" aria-label="Navigation progress">
      {STEPS.map((step, i) => {
        const isCompleted = i < activeIdx;
        const isActive    = i === activeIdx;
        const cls = isCompleted ? 'step-completed' : isActive ? 'step-active' : 'step-upcoming';
        return (
          <React.Fragment key={step.key}>
            <div className={`workflow-step ${cls}`}>
              <div className="workflow-step-num">
                {isCompleted ? <CheckCircle2 size={13} /> : i + 1}
              </div>
              <span className="workflow-step-label">{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`workflow-connector${isCompleted ? ' completed' : ''}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DEMO LAB VIEW (floor-plan at lab level during demo)
═══════════════════════════════════════════════════════════ */

function DemoStatBar({ lab }: { lab: LabSummary }) {
  return (
    <div className="dt-stat-bar">
      <div className="dt-stat">
        <span className="dt-status-dot" style={{ background: '#22c55e' }} />
        <span className="dt-stat-count">{lab.active}</span>
        <span className="dt-stat-label">Active</span>
      </div>
      {lab.maintenance > 0 && (
        <div className="dt-stat">
          <span className="dt-status-dot" style={{ background: '#f59e0b' }} />
          <span className="dt-stat-count">{lab.maintenance}</span>
          <span className="dt-stat-label">Maintenance</span>
        </div>
      )}
      {lab.damaged > 0 && (
        <div className="dt-stat">
          <span className="dt-status-dot" style={{ background: '#ef4444' }} />
          <span className="dt-stat-count">{lab.damaged}</span>
          <span className="dt-stat-label">Damaged</span>
        </div>
      )}
      <div className="dt-stat" style={{ marginLeft: 'auto' }}>
        <span className="dt-stat-count">{lab.asset_total}</span>
        <span className="dt-stat-label">Total</span>
      </div>
    </div>
  );
}

function demoStatusClass(status: string): string {
  const s = status.toLowerCase().replace(/ /g, '_');
  if (s === 'active')            return 'dt-active';
  if (s === 'damaged')           return 'dt-damaged';
  if (s === 'under_maintenance') return 'dt-maintenance';
  return 'dt-new';
}

function DemoAssetCard({ asset }: { asset: MapAsset }) {
  const colors = getStatusColors(asset.status);
  const AssetIcon = getAssetIcon(asset.type);
  const sc = demoStatusClass(asset.status);
  return (
    <article className={`dt-card ${sc}`} title={asset.name}>
      <div className="dt-card-header">
        <p className="dt-card-name">{asset.name}</p>
        <span className={`dt-status ${sc}`}>
          <span className="dt-status-dot" />
          {colors.label}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
        <AssetIcon color={colors.border} />
      </div>
      <div className="dt-meta">
        <div className="dt-meta-row">
          <span className="dt-meta-label">ID</span>
          <span className="dt-meta-value">{asset.asset_code}</span>
        </div>
        <div className="dt-meta-row">
          <span className="dt-meta-label">Type</span>
          <span className="dt-meta-value">{asset.category}</span>
        </div>
      </div>
    </article>
  );
}

export function DemoLabView({ lab, viewMode = 'map' }: { lab: LabSummary; viewMode?: 'grid' | 'map' }) {
  const assets = getDemoLabAssets(lab.id);
  return (
    <>
      <DemoStatBar lab={lab} />
      {viewMode === 'map' ? (
        <>
          <MapLegend />
          <LabLayoutMap assets={assets} labName={lab.name} />
        </>
      ) : (
        <div className="dt-grid">
          {assets.map((a) => <DemoAssetCard key={a.id} asset={a} />)}
        </div>
      )}
      <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
        {assets.length} demo assets · {viewMode === 'map' ? 'click any icon to see details' : 'showing grid view'}
      </p>
    </>
  );
}
