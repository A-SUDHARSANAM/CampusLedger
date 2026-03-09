import React from 'react';
import type { DeviceHealth } from './types';

interface Props {
  devices: DeviceHealth[];
}

// ── Tiny SVG line chart ──────────────────────────────────────────────────────
function SparkLine({ values, color, height = 60 }: { values: number[]; color: string; height?: number }) {
  if (values.length < 2) return null;
  const W = 260;
  const H = height;
  const padL = 8; const padR = 8; const padT = 6; const padB = 6;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const mn = Math.min(...values);
  const mx = Math.max(...values) || 1;
  const xOf = (i: number) => padL + (i / (values.length - 1)) * innerW;
  const yOf = (v: number) => padT + (1 - (v - mn) / (mx - mn || 1)) * innerH;
  const pts = values.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
  const areaBottom = (padT + innerH).toFixed(1);
  const areaPath = `M${xOf(0).toFixed(1)},${areaBottom} L${values.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' L')} L${xOf(values.length - 1).toFixed(1)},${areaBottom} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ── Pie chart for status distribution ────────────────────────────────────────
function StatusPie({ devices }: { devices: DeviceHealth[] }) {
  const healthy = devices.filter((d) => d.status === 'healthy').length;
  const warning = devices.filter((d) => d.status === 'warning').length;
  const offline = devices.filter((d) => d.status === 'offline').length;
  const total = devices.length || 1;

  const slices = [
    { label: 'Healthy', count: healthy, color: '#22c55e' },
    { label: 'Warning', count: warning, color: '#f59e0b' },
    { label: 'Offline', count: offline, color: '#ef4444' },
  ].filter((s) => s.count > 0);

  const R = 50; const cx = 70; const cy = 70;
  let startAngle = -Math.PI / 2;

  function arcPath(pct: number, radius: number) {
    const endAngle = startAngle + pct * 2 * Math.PI;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const large = pct > 0.5 ? 1 : 0;
    const d = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${radius},${radius} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    startAngle = endAngle;
    return d;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg viewBox="0 0 140 140" style={{ width: 110, height: 110, flexShrink: 0 }}>
        {slices.map((s) => {
          const d = arcPath(s.count / total, R);
          return <path key={s.label} d={d} fill={s.color} stroke="var(--bg-surface)" strokeWidth="2" />;
        })}
        {/* centre hole */}
        <circle cx={cx} cy={cy} r={28} fill="var(--bg-surface)" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--text-primary)">{total}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize="8" fill="var(--text-muted)">devices</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginLeft: 'auto' }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeviceCharts({ devices }: Props) {
  // Aggregate averages per device as a simple dataset (sorted by cpu desc for top-N bar feel)
  const cpuValues = [...devices].sort((a, b) => b.cpu_usage - a.cpu_usage).map((d) => d.cpu_usage);
  const tempValues = [...devices].sort((a, b) => b.temperature - a.temperature).map((d) => d.temperature);

  return (
    <div className="dh-charts-row">
      {/* CPU distribution */}
      <div className="dh-chart-card">
        <p className="dh-chart-title">CPU Usage Distribution</p>
        {devices.length > 0 ? (
          <>
            <SparkLine values={cpuValues} color="#6366f1" height={72} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Avg: {(cpuValues.reduce((s, v) => s + v, 0) / (cpuValues.length || 1)).toFixed(1)}% — Peak: {Math.max(...cpuValues).toFixed(1)}%
            </p>
          </>
        ) : <p className="dh-empty">No data</p>}
      </div>

      {/* Temperature distribution */}
      <div className="dh-chart-card">
        <p className="dh-chart-title">Temperature Distribution</p>
        {devices.length > 0 ? (
          <>
            <SparkLine values={tempValues} color="#f97316" height={72} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Avg: {(tempValues.reduce((s, v) => s + v, 0) / (tempValues.length || 1)).toFixed(1)}°C — Peak: {Math.max(...tempValues).toFixed(1)}°C
            </p>
          </>
        ) : <p className="dh-empty">No data</p>}
      </div>

      {/* Status pie */}
      <div className="dh-chart-card">
        <p className="dh-chart-title">Status Distribution</p>
        {devices.length > 0 ? <StatusPie devices={devices} /> : <p className="dh-empty">No data</p>}
      </div>
    </div>
  );
}
