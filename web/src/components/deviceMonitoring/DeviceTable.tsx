import React, { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import type { DeviceHealth } from './types';

interface Props {
  devices: DeviceHealth[];
}

type SortKey = 'name' | 'cpu_usage' | 'temperature' | 'battery' | 'network_latency' | 'anomaly_score';

function barClass(value: number, warnAt: number, dangerAt: number): string {
  if (value >= dangerAt) return 'dh-offline';
  if (value >= warnAt)   return 'dh-warning';
  return 'dh-healthy';
}

function MetricCell({ value, max, warnAt, dangerAt, unit }: {
  value: number; max: number; warnAt: number; dangerAt: number; unit: string;
}) {
  const cls = barClass(value, warnAt, dangerAt);
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="dh-metric-cell">
      <div className="dh-bar-wrap">
        <div className={`dh-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="dh-metric-val">{value.toFixed(1)}{unit}</span>
    </div>
  );
}

export function DeviceTable({ devices }: Props) {
  const [sortKey, setSortKey]   = useState<SortKey>('name');
  const [sortAsc, setSortAsc]   = useState(true);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((p) => !p);
    else { setSortKey(key); setSortAsc(true); }
  }

  const sorted = [...devices].sort((a, b) => {
    const va = a[sortKey] as number | string;
    const vb = b[sortKey] as number | string;
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
    return sortAsc ? cmp : -cmp;
  });

  function thClass(key: SortKey) {
    return sortKey === key ? 'dh-sorted' : '';
  }

  function arrow(key: SortKey) {
    if (sortKey !== key) return <ArrowUpDown size={11} style={{ marginLeft: 3, opacity: 0.4 }} />;
    return <span style={{ marginLeft: 3, fontSize: '0.65rem' }}>{sortAsc ? '▲' : '▼'}</span>;
  }

  return (
    <div className="dh-table-wrapper">
      <table className="dh-table">
        <thead>
          <tr>
            <th className={thClass('name')} onClick={() => handleSort('name')}>Device {arrow('name')}</th>
            <th>Location</th>
            <th className={thClass('cpu_usage')} onClick={() => handleSort('cpu_usage')}>CPU {arrow('cpu_usage')}</th>
            <th className={thClass('temperature')} onClick={() => handleSort('temperature')}>Temp {arrow('temperature')}</th>
            <th className={thClass('battery')} onClick={() => handleSort('battery')}>Battery {arrow('battery')}</th>
            <th className={thClass('network_latency')} onClick={() => handleSort('network_latency')}>Latency {arrow('network_latency')}</th>
            <th className={thClass('anomaly_score')} onClick={() => handleSort('anomaly_score')}>Anomaly {arrow('anomaly_score')}</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr key={d.device_id}>
              <td>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{d.name}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{d.device_id}</div>
              </td>
              <td style={{ color: 'var(--text-secondary)' }}>{d.location}</td>
              <td><MetricCell value={d.cpu_usage}       max={100} warnAt={80} dangerAt={95} unit="%" /></td>
              <td><MetricCell value={d.temperature}     max={90}  warnAt={50} dangerAt={70} unit="°C" /></td>
              <td><MetricCell value={d.battery}         max={100} warnAt={30} dangerAt={15} unit="%" /></td>
              <td><MetricCell value={d.network_latency} max={200} warnAt={100} dangerAt={150} unit="ms" /></td>
              <td style={{ color: d.anomaly_score > 0.6 ? 'var(--danger)' : d.anomaly_score > 0.35 ? 'var(--warning)' : 'var(--text-secondary)', fontWeight: 600 }}>
                {(d.anomaly_score * 100).toFixed(0)}%
              </td>
              <td>
                <span className={`dh-badge dh-${d.status}`}>
                  <span className="dh-badge-dot" />
                  {d.status.charAt(0).toUpperCase() + d.status.slice(1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && <div className="dh-empty">No devices found.</div>}
    </div>
  );
}
