import React, { useCallback, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { AssetNode, getStatusColors } from './AssetNode';
import type { MapAsset } from './AssetNode';
import type { Asset } from '../../types/domain';
import { categoryToType } from './AssetNode';
import './digitalTwinMap.css';

// ── Lab floor-plan layout constants (shared with DemoMode) ──────────────────
export const LAB_COLS    = 8;    // seats per row
export const SLOT_W      = 100;  // px width per column slot
export const STATION_H   = 90;   // px height per station row
export const AISLE_H     = 52;   // px gap between facing row-pairs
export const SIDE_PAD    = 20;   // px left/right canvas padding
export const TOP_PAD     = 36;   // px top/bottom canvas padding

/** Pixel position + facing flag for the asset at index `i` in a lab.
 *  Rows are grouped into facing pairs: 8 seats top + 8 seats bottom sharing a
 *  centre desk, then an aisle, then the next pair — like a real teaching lab. */
export function getGridPos(i: number) {
  const globalRow = Math.floor(i / LAB_COLS);
  const col       = i % LAB_COLS;
  const pairIdx   = Math.floor(globalRow / 2);
  const rowInPair = globalRow % 2;          // 0 = top of pair, 1 = bottom
  const x = SIDE_PAD + col * SLOT_W + SLOT_W / 2;
  const y = TOP_PAD + pairIdx * (2 * STATION_H + AISLE_H) + rowInPair * STATION_H + STATION_H / 2;
  return { x, y, flip: rowInPair === 1 };
}

/** Canvas pixel dimensions for a lab with `assetCount` assets. */
export function getCanvasSize(assetCount: number) {
  const totalRows = Math.ceil(Math.max(assetCount, 1) / LAB_COLS);
  const numPairs  = Math.ceil(totalRows / 2);
  const width  = LAB_COLS * SLOT_W + SIDE_PAD * 2;
  const height = TOP_PAD * 2 + numPairs * (2 * STATION_H + AISLE_H) - AISLE_H;
  return { width, height, numPairs, totalRows };
}

// ── Client-side conversion from Asset → MapAsset ─────────────────────────────
export function assetToMapAsset(asset: Asset, indexInLab: number): MapAsset {
  const { x, y, flip } = getGridPos(indexInLab);
  return {
    id: asset.id,
    name: asset.name,
    type: categoryToType(asset.category),
    status: asset.status.toLowerCase().replace(/ /g, '_'),
    x, y, flip,
    lab: asset.location,
    lab_id: asset.labId,
    department: '',
    asset_code: asset.assetCode || asset.serialNumber || asset.id.slice(0, 8),
    category: asset.category,
  };
}

// ── Floor-plan SVG decorations ────────────────────────────────────────────────
// Now uses absolute pixel viewBox matching the dynamic canvas dimensions,
// and draws realistic classroom desk / aisle markings.

interface FloorPlanSVGProps {
  canvasW: number;
  canvasH: number;
  numPairs: number;
  labName?: string;
}

function FloorPlanSVG({ canvasW, canvasH, numPairs }: FloorPlanSVGProps) {
  const tableLeft  = SIDE_PAD - 8;
  const tableRight = SIDE_PAD + LAB_COLS * SLOT_W + 8;

  return (
    <svg
      className="dtm-svg-bg"
      viewBox={`0 0 ${canvasW} ${canvasH}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {/* Room boundary */}
      <rect x="1" y="1" width={canvasW - 2} height={canvasH - 2}
        fill="none" stroke="currentColor" strokeWidth="1"
        strokeDasharray="8,5" opacity="0.18" />

      {/* Column seat dividers */}
      {Array.from({ length: LAB_COLS - 1 }, (_, c) => {
        const x = SIDE_PAD + (c + 1) * SLOT_W;
        return (
          <line key={c}
            x1={x} y1={TOP_PAD - 12} x2={x} y2={canvasH - TOP_PAD + 12}
            stroke="currentColor" strokeWidth="0.6" strokeDasharray="3,6" opacity="0.1" />
        );
      })}

      {/* Facing pair groups: shared desk + aisle */}
      {Array.from({ length: numPairs }, (_, pairIdx) => {
        const pairTopY    = TOP_PAD + pairIdx * (2 * STATION_H + AISLE_H);
        const deskCenterY = pairTopY + STATION_H;
        const aisleTopY   = pairTopY + 2 * STATION_H;
        return (
          <g key={pairIdx}>
            {/* Shared desk surface between the two facing rows */}
            <rect
              x={tableLeft} y={deskCenterY - 12}
              width={tableRight - tableLeft} height={24}
              rx="3" fill="currentColor" opacity="0.04" />
            {/* Desk edge lines */}
            <line x1={tableLeft} y1={deskCenterY - 12} x2={tableRight} y2={deskCenterY - 12}
              stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
            <line x1={tableLeft} y1={deskCenterY + 12} x2={tableRight} y2={deskCenterY + 12}
              stroke="currentColor" strokeWidth="1.5" opacity="0.2" />

            {/* Aisle band between pairs */}
            {pairIdx < numPairs - 1 && (
              <>
                <rect x={tableLeft} y={aisleTopY}
                  width={tableRight - tableLeft} height={AISLE_H}
                  fill="currentColor" opacity="0.015" />
                <text
                  x={SIDE_PAD + LAB_COLS * SLOT_W / 2} y={aisleTopY + AISLE_H / 2 + 4}
                  textAnchor="middle" fontSize="9" letterSpacing="2"
                  fill="currentColor" opacity="0.25">AISLE</text>
              </>
            )}
          </g>
        );
      })}

      {/* Entrance marker at bottom */}
      <rect x={canvasW / 2 - 40} y={canvasH - 20} width="80" height="16" rx="3"
        fill="currentColor" opacity="0.07" />
      <text x={canvasW / 2} y={canvasH - 8} textAnchor="middle" fontSize="8"
        letterSpacing="2" fill="currentColor" opacity="0.3">ENTRANCE</text>
    </svg>
  );
}

// ── Legend bar ────────────────────────────────────────────────────────────────

export function MapLegend() {
  const items = [
    { status: 'active',            label: 'Active / Healthy' },
    { status: 'under_maintenance', label: 'Maintenance Required' },
    { status: 'damaged',           label: 'Critical / Damaged' },
  ];
  return (
    <div className="dtm-legend">
      {items.map(({ status, label }) => {
        const c = getStatusColors(status);
        return (
          <div key={status} className="dtm-legend-item">
            <span
              className="dtm-legend-dot"
              style={{ background: c.border, boxShadow: `0 0 5px ${c.glow}` }}
            />
            {label}
          </div>
        );
      })}
    </div>
  );
}

// ── LabLayoutMap (single lab) ─────────────────────────────────────────────────

interface LabLayoutMapProps {
  assets: MapAsset[];
  labName?: string;
  compact?: boolean;
}

export function LabLayoutMap({ assets, labName, compact = false }: LabLayoutMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const { width: canvasW, height: canvasH, numPairs } = getCanvasSize(assets.length);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current) setSelectedId(null);
  }, []);

  return (
    <div className="dtm-canvas-outer">
      <div
        className={`dtm-canvas${compact ? ' dtm-canvas-compact' : ''}`}
        ref={canvasRef}
        onClick={handleCanvasClick}
        style={{ width: canvasW, height: canvasH }}
      >
        <FloorPlanSVG canvasW={canvasW} canvasH={canvasH} numPairs={numPairs} labName={labName} />

        {labName && (
          <div className="dtm-lab-badge">
            <MapPin size={10} style={{ display: 'inline', marginRight: 3 }} />
            {labName}
          </div>
        )}

        {assets.map((asset) => (
          <AssetNode
            key={asset.id}
            asset={asset}
            selected={selectedId === asset.id}
            onSelect={setSelectedId}
          />
        ))}

        {assets.length === 0 && (
          <div className="dtm-canvas-empty">
            No assets in this lab
          </div>
        )}
      </div>
    </div>
  );
}

// ── MultiLabMap (admin all-labs view) ─────────────────────────────────────────

interface MultiLabMapProps {
  assets: MapAsset[];
  filterLabId?: string;
}

export function MultiLabMap({ assets, filterLabId }: MultiLabMapProps) {
  // Group by lab
  const labMap = new Map<string, { name: string; dept: string; assets: MapAsset[] }>();
  assets.forEach((a) => {
    if (!labMap.has(a.lab_id)) {
      labMap.set(a.lab_id, { name: a.lab, dept: a.department, assets: [] });
    }
    labMap.get(a.lab_id)!.assets.push(a);
  });

  const labs = Array.from(labMap.entries()).sort((a, b) =>
    (a[1].name || '').localeCompare(b[1].name || ''),
  );

  if (filterLabId) {
    const lab = labMap.get(filterLabId);
    if (!lab) return <p style={{ color: 'var(--text-muted)', padding: 16 }}>No assets for selected lab.</p>;
    return <LabLayoutMap assets={lab.assets} labName={lab.name} />;
  }

  if (labs.length === 0) {
    return <p style={{ color: 'var(--text-muted)', padding: 16 }}>No assets to display.</p>;
  }

  return (
    <div className="dtm-labs-grid">
      {labs.map(([lid, lab]) => (
        <div key={lid}>
          <div className="dtm-lab-section-header">
            <div>
              <span className="dtm-lab-title">{lab.name || 'Unknown Lab'}</span>
              {lab.dept && (
                <span className="dtm-lab-dept" style={{ marginLeft: 8 }}> · {lab.dept}</span>
              )}
            </div>
            <span className="dtm-asset-count-pill">{lab.assets.length} assets</span>
          </div>
          <LabLayoutMap assets={lab.assets} compact />
        </div>
      ))}
    </div>
  );
}
