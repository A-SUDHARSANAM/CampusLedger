import React, { useState } from 'react';

// -- Shared MapAsset type (also exported for api.ts / LabLayoutMap) ----------
export interface MapAsset {
  id: string;
  name: string;
  type: string;
  status: string;
  x: number;         // px from left of canvas
  y: number;         // px from top of canvas
  flip?: boolean;    // true = bottom row of facing pair (rotates icon 180deg)
  lab: string;
  lab_id: string;
  department: string;
  asset_code: string;
  category: string;
}

// -- Helpers ------------------------------------------------------------------

export function categoryToType(category: string): string {
  const c = (category || '').toLowerCase();
  if (c.includes('computer') || c.includes('desktop') || /\bpc\b/.test(c)) return 'computer';
  if (c.includes('laptop') || c.includes('notebook')) return 'laptop';
  if (c.includes('printer')) return 'printer';
  if (c.includes('projector')) return 'projector';
  if (c.includes('server')) return 'server';
  if (c.includes('network') || c.includes('router') || c.includes('switch')) return 'network';
  if (c.includes('camera')) return 'camera';
  if (c.includes('tablet') || c.includes('ipad')) return 'tablet';
  if (c.includes('monitor') || c.includes('screen') || c.includes('display')) return 'monitor';
  if (c.includes('oscilloscope') || c.includes('electronics')) return 'oscilloscope';
  if (c.includes('scanner')) return 'scanner';
  if (c.includes('phone') || c.includes('mobile')) return 'phone';
  if (c.includes('workbench') || c.includes('furniture')) return 'workbench';
  if (c.includes('lab') || c.includes('flask') || c.includes('chem')) return 'lab';
  return 'equipment';
}

interface StatusColors {
  border: string;
  glow: string;
  bg: string;
  text: string;
  label: string;
}

export function getStatusColors(status: string): StatusColors {
  const s = status.toLowerCase().replace(/ /g, '_');
  if (s === 'active')
    return { border: '#22c55e', glow: 'rgba(34,197,94,0.35)',  bg: '#D4F1E0', text: '#16A34A', label: 'Active' };
  if (s === 'under_maintenance' || s === 'maintenance')
    return { border: '#f59e0b', glow: 'rgba(245,158,11,0.35)', bg: '#FEF3C7', text: '#B45309', label: 'Maintenance' };
  if (s === 'damaged' || s === 'critical')
    return { border: '#ef4444', glow: 'rgba(239,68,68,0.40)',  bg: '#FEF2F2', text: '#B91C1C', label: 'Damaged' };
  return { border: '#4F6EF7', glow: 'rgba(79,110,247,0.25)', bg: '#EEF1FF', text: '#3A58E8', label: status.replace(/_/g, ' ') };
}

// -- Realistic inline-SVG icons -----------------------------------------------

function ComputerIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="22" height="15" rx="2" stroke={color} strokeWidth="1.8" />
      <rect x="5" y="4" width="18" height="11" rx="1" fill={color} fillOpacity="0.2" />
      <line x1="5" y1="7"  x2="23" y2="7"  stroke={color} strokeWidth="0.5" strokeOpacity="0.3" />
      <line x1="5" y1="10" x2="23" y2="10" stroke={color} strokeWidth="0.5" strokeOpacity="0.3" />
      <line x1="5" y1="13" x2="23" y2="13" stroke={color} strokeWidth="0.5" strokeOpacity="0.3" />
      <rect x="12" y="17" width="4" height="3" fill={color} fillOpacity="0.6" />
      <rect x="9" y="20" width="10" height="2" rx="1" fill={color} fillOpacity="0.6" />
      {/* Keyboard */}
      <rect x="2" y="23" width="19" height="5.5" rx="1.2" stroke={color} strokeWidth="1.5" />
      <rect x="3.5" y="24.5" width="2.5" height="1.5" rx="0.4" fill={color} fillOpacity="0.45" />
      <rect x="7"   y="24.5" width="2.5" height="1.5" rx="0.4" fill={color} fillOpacity="0.45" />
      <rect x="10.5" y="24.5" width="2.5" height="1.5" rx="0.4" fill={color} fillOpacity="0.45" />
      <rect x="14"  y="24.5" width="2.5" height="1.5" rx="0.4" fill={color} fillOpacity="0.45" />
      <rect x="4"   y="27"   width="7"   height="1.2" rx="0.4" fill={color} fillOpacity="0.35" />
      {/* Mouse */}
      <ellipse cx="27" cy="26" rx="3" ry="3.8" stroke={color} strokeWidth="1.5" />
      <line x1="27" y1="22.5" x2="27" y2="25.8" stroke={color} strokeWidth="0.9" strokeOpacity="0.55" />
      <rect x="26" y="23" width="2" height="1.5" rx="0.6" fill={color} fillOpacity="0.4" />
    </svg>
  );
}

function LaptopIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="24" height="16" rx="2" stroke={color} strokeWidth="1.8" />
      <rect x="6" y="6" width="20" height="12" rx="1" fill={color} fillOpacity="0.2" />
      <line x1="6" y1="10" x2="26" y2="10" stroke={color} strokeWidth="0.5" strokeOpacity="0.3" />
      <line x1="6" y1="14" x2="26" y2="14" stroke={color} strokeWidth="0.5" strokeOpacity="0.3" />
      <rect x="1" y="20" width="30" height="5" rx="1.5" stroke={color} strokeWidth="1.5" />
      {[4, 8, 12, 16, 20].map((x) => (
        <rect key={x} x={x} y="21.5" width="3" height="2" rx="0.4" fill={color} fillOpacity="0.4" />
      ))}
      <rect x="12" y="24" width="8" height="1" rx="0.4" fill={color} fillOpacity="0.3" />
    </svg>
  );
}

function ServerIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      {[2, 8, 14, 20].map((y) => (
        <g key={y}>
          <rect x="2" y={y} width="28" height="5.5" rx="1" stroke={color} strokeWidth="1.5" />
          <rect x="4" y={y + 1.5} width="12" height="2.5" rx="0.5" fill={color} fillOpacity="0.22" />
          <circle cx="26" cy={y + 2.75} r="1.3" fill={color} />
          <rect x="18" y={y + 1} width="4" height="3.5" rx="0.5" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="0.7" />
        </g>
      ))}
      <rect x="2" y="27" width="28" height="3" rx="1" fill={color} fillOpacity="0.08" />
    </svg>
  );
}

function NetworkIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1" y="9" width="30" height="13" rx="2" stroke={color} strokeWidth="1.8" />
      {[3.5, 7, 10.5, 14, 17.5].map((x) => (
        <rect key={x} x={x} y="12.5" width="2.8" height="5" rx="0.5"
          stroke={color} strokeWidth="1" fill={color} fillOpacity="0.15" />
      ))}
      {[3.5, 7, 10.5, 14, 17.5].map((x) => (
        <circle key={x} cx={x + 1.4} cy="11.5" r="1" fill={color} fillOpacity="0.8" />
      ))}
      <rect x="23" y="12" width="6" height="5.5" rx="0.5"
        stroke={color} strokeWidth="1" fill={color} fillOpacity="0.12" />
      <path d="M24.5 8.5 L26 6 L27.5 8.5" stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <line x1="26" y1="6.5" x2="26" y2="11.8" stroke={color} strokeWidth="1.2" strokeOpacity="0.6" />
      <rect x="1.5" y="24" width="5" height="3" rx="0.5" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="0.8" />
    </svg>
  );
}

function OscilloscopeIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1" y="3" width="21" height="22" rx="2" stroke={color} strokeWidth="1.8" />
      <rect x="3" y="5" width="15" height="13" rx="1" fill={color} fillOpacity="0.12" />
      <line x1="10.5" y1="5" x2="10.5" y2="18" stroke={color} strokeWidth="0.5" strokeOpacity="0.25" />
      <line x1="3" y1="11.5" x2="18" y2="11.5" stroke={color} strokeWidth="0.5" strokeOpacity="0.25" />
      <path d="M4 11.5 L6 11.5 L7.5 7 L9.5 16 L11.5 7 L13.5 16 L15 11.5 L17 11.5"
        stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="26" cy="8"  r="3" stroke={color} strokeWidth="1.4" fill="none" />
      <circle cx="26" cy="8"  r="1" fill={color} fillOpacity="0.6" />
      <circle cx="26" cy="17" r="3" stroke={color} strokeWidth="1.4" fill="none" />
      <circle cx="26" cy="17" r="1" fill={color} fillOpacity="0.6" />
      <line x1="5"  y1="25" x2="5"  y2="29" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="18" y1="25" x2="18" y2="29" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ProjectorIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="10" width="20" height="12" rx="2" stroke={color} strokeWidth="1.8" />
      <circle cx="8.5" cy="16" r="4" stroke={color} strokeWidth="1.5" fill={color} fillOpacity="0.1" />
      <circle cx="8.5" cy="16" r="2" fill={color} fillOpacity="0.35" />
      <circle cx="7.5" cy="15" r="0.7" fill="white" fillOpacity="0.7" />
      {[13.5, 16, 18.5].map((x) => (
        <line key={x} x1={x} y1="12" x2={x} y2="20" stroke={color} strokeWidth="1" strokeOpacity="0.35" />
      ))}
      <path d="M23 12.5 L31 8" stroke={color} strokeWidth="1.2" strokeDasharray="2,2" strokeOpacity="0.45" />
      <path d="M23 19.5 L31 24" stroke={color} strokeWidth="1.2" strokeDasharray="2,2" strokeOpacity="0.45" />
      <line x1="13" y1="22" x2="13" y2="26" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="9" y="26" width="8" height="1.5" rx="0.75" fill={color} fillOpacity="0.5" />
    </svg>
  );
}

function MonitorIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1" y="2" width="30" height="21" rx="2" stroke={color} strokeWidth="1.8" />
      <rect x="3" y="4" width="26" height="17" rx="1" fill={color} fillOpacity="0.18" />
      <line x1="3" y1="9"  x2="29" y2="9"  stroke={color} strokeWidth="0.5" strokeOpacity="0.3" />
      <line x1="3" y1="14" x2="29" y2="14" stroke={color} strokeWidth="0.5" strokeOpacity="0.3" />
      <rect x="14" y="23" width="4" height="4" fill={color} fillOpacity="0.55" />
      <rect x="10" y="27" width="12" height="2" rx="1" fill={color} fillOpacity="0.55" />
    </svg>
  );
}

function EquipmentIcon({ color }: { color: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="26" height="20" rx="2" stroke={color} strokeWidth="1.8" />
      <rect x="5" y="6" width="12" height="8" rx="1" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1" />
      <circle cx="21" cy="9"  r="1.5" fill={color} fillOpacity="0.8" />
      <circle cx="25" cy="9"  r="1.5" fill={color} fillOpacity="0.5" />
      <circle cx="21" cy="14" r="1.5" fill={color} fillOpacity="0.3" />
      <circle cx="25" cy="14" r="1.5" fill={color} fillOpacity="0.7" />
      <circle cx="23" cy="19" r="2.5" stroke={color} strokeWidth="1.3" fill="none" />
      <circle cx="23" cy="19" r="1"   fill={color} fillOpacity="0.55" />
      {[6, 9.5, 13, 16.5, 20].map((x) => (
        <rect key={x} x={x} y="24" width="2" height="4" rx="0.5" fill={color} fillOpacity="0.45" />
      ))}
    </svg>
  );
}

export function getAssetIcon(type: string): (props: { color: string }) => React.ReactElement {
  switch (type) {
    case 'computer':     return ComputerIcon;
    case 'laptop':       return LaptopIcon;
    case 'server':       return ServerIcon;
    case 'network':      return NetworkIcon;
    case 'oscilloscope': return OscilloscopeIcon;
    case 'projector':    return ProjectorIcon;
    case 'monitor':      return MonitorIcon;
    default:             return EquipmentIcon;
  }
}

// ── AssetNode component ──────────────────────────────────────────────────────

interface Props {
  asset: MapAsset;
  selected: boolean;
  onSelect: (id: string | null) => void;
}

export function AssetNode({ asset, selected, onSelect }: Props) {
  const AssetIcon = getAssetIcon(asset.type);
  const colors = getStatusColors(asset.status);
  const isNearTop = asset.y < 60;   // flip tooltip below when near canvas top
  const isDamaged = asset.status.toLowerCase().replace(/ /g, '_') === 'damaged';

  // Facing icon: bottom row of each pair shows monitor facing toward the aisle
  const iconTransform = asset.flip
    ? (selected ? 'rotate(180deg) scale(1.1)' : 'rotate(180deg)')
    : (selected ? 'scale(1.1)' : undefined);

  const iconStyle: React.CSSProperties = {
    borderColor: colors.border,
    background: colors.bg,
    boxShadow: selected
      ? `0 0 0 3px ${colors.border}, 0 0 18px ${colors.glow}`
      : `0 0 10px ${colors.glow}, 0 0 0 1.5px ${colors.border}`,
    transform: iconTransform,
    transition: 'transform 0.18s ease, box-shadow 0.22s ease',
  };

  return (
    <div
      className={[
        'dtm-node',
        selected ? 'dtm-node-selected' : '',
        isDamaged ? 'dtm-status-damaged' : '',
        isNearTop ? 'dtm-flip-tooltip' : '',
      ].join(' ')}
      style={{ left: asset.x, top: asset.y }}
      onClick={(e) => { e.stopPropagation(); onSelect(selected ? null : asset.id); }}
      role="button"
      aria-label={`${asset.name} — ${colors.label}`}
    >
      <div className="dtm-node-icon" style={iconStyle}>
        <AssetIcon color={colors.border} />
      </div>
      <span className="dtm-node-label">{asset.name}</span>
      <span className="dtm-node-code">{asset.asset_code.slice(0, 10)}</span>

      {/* Tooltip (shown when selected) */}
      {selected && (
        <div className="dtm-tooltip" role="tooltip">
          <div className="dtm-tooltip-title">{asset.name}</div>
          <div className="dtm-tooltip-row">
            <span className="dtm-tooltip-key">ID</span>
            <span className="dtm-tooltip-val">{asset.asset_code}</span>
          </div>
          <div className="dtm-tooltip-row">
            <span className="dtm-tooltip-key">Status</span>
            <span className="dtm-tooltip-val" style={{ color: colors.text, fontWeight: 700 }}>
              {colors.label}
            </span>
          </div>
          {asset.category && (
            <div className="dtm-tooltip-row">
              <span className="dtm-tooltip-key">Category</span>
              <span className="dtm-tooltip-val">{asset.category}</span>
            </div>
          )}
          <div className="dtm-tooltip-row">
            <span className="dtm-tooltip-key">Lab</span>
            <span className="dtm-tooltip-val">{asset.lab || '—'}</span>
          </div>
          {asset.department && (
            <div className="dtm-tooltip-row">
              <span className="dtm-tooltip-key">Dept</span>
              <span className="dtm-tooltip-val">{asset.department}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
