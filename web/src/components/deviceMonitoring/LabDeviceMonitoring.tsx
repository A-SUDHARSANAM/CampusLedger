import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cpu, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { DeviceAlerts } from './DeviceAlerts';
import type { DeviceHealth } from './DeviceHealthDashboard';
import './deviceMonitoring.css';

const POLL_INTERVAL_MS = 5000;

interface Props {
  labId?: string;
}

function barClass(value: number, warnAt: number, dangerAt: number): string {
  if (value >= dangerAt) return 'dh-offline';
  if (value >= warnAt)   return 'dh-warning';
  return 'dh-healthy';
}

function MiniBar({ value, max, warnAt, dangerAt, unit }: {
  value: number; max: number; warnAt: number; dangerAt: number; unit: string;
}) {
  const cls = barClass(value, warnAt, dangerAt);
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="dh-device-metric">
      <div className="dh-bar-wrap" style={{ width: 64 }}>
        <div className={`dh-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: 42 }}>
        {value.toFixed(1)}{unit}
      </span>
    </div>
  );
}

function DeviceCard({ device }: { device: DeviceHealth }) {
  return (
    <article className={`dh-device-card dh-${device.status}`} title={device.name}>
      <div className="dh-device-card-header">
        <p className="dh-device-name">{device.name}</p>
        <span className={`dh-badge dh-${device.status}`}>
          <span className="dh-badge-dot" />
          {device.status.charAt(0).toUpperCase() + device.status.slice(1)}
        </span>
      </div>
      <div className="dh-device-meta">
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
          {device.location} · {device.device_id}
        </div>
        <div className="dh-device-metric">
          <span className="dh-device-metric-label">CPU</span>
          <MiniBar value={device.cpu_usage} max={100} warnAt={80} dangerAt={95} unit="%" />
        </div>
        <div className="dh-device-metric">
          <span className="dh-device-metric-label">Temp</span>
          <MiniBar value={device.temperature} max={90} warnAt={50} dangerAt={70} unit="°C" />
        </div>
        <div className="dh-device-metric">
          <span className="dh-device-metric-label">Bat</span>
          <MiniBar value={device.battery} max={100} warnAt={30} dangerAt={15} unit="%" />
        </div>
        <div className="dh-device-metric">
          <span className="dh-device-metric-label">Net</span>
          <MiniBar value={device.network_latency} max={200} warnAt={100} dangerAt={150} unit="ms" />
        </div>
        <p className="dh-anomaly-score">
          Anomaly: {(device.anomaly_score * 100).toFixed(0)}% · Updated {new Date(device.last_seen).toLocaleTimeString()}
        </p>
      </div>
    </article>
  );
}

export function LabDeviceMonitoring({ labId }: Props) {
  const [devices, setDevices]   = useState<DeviceHealth[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [live, setLive]         = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const data = await api.getDeviceHealth(labId);
      setDevices(data);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch device health data');
    } finally {
      setLoading(false);
    }
  }, [labId]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (live) {
      intervalRef.current = setInterval(fetchDevices, POLL_INTERVAL_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [live, fetchDevices]);

  const healthy = devices.filter((d) => d.status === 'healthy').length;
  const warning = devices.filter((d) => d.status === 'warning').length;
  const offline = devices.filter((d) => d.status === 'offline').length;

  return (
    <div className="dh-page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          <Cpu size={20} />
          Lab Device Monitoring
          <span className={`dh-pulse ${live ? 'dh-live' : ''}`} title={live ? 'Live polling' : 'Paused'} />
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {lastRefresh && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Last: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            className={`btn btn-sm ${live ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setLive((p) => !p)}
          >
            {live ? 'Live' : 'Paused'}
          </button>
          <button className="btn btn-sm btn-outline" onClick={fetchDevices}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && <div className="alert alert-danger" style={{ margin: 0 }}>{error}</div>}

      {/* Quick stat row */}
      {!loading && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Total',   count: devices.length, color: 'var(--accent-primary)' },
            { label: 'Healthy', count: healthy, color: 'var(--success)' },
            { label: 'Warning', count: warning, color: 'var(--warning)' },
            { label: 'Offline', count: offline, color: 'var(--danger)' },
          ].map((s) => (
            <div key={s.label} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'var(--bg-muted)', border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)', padding: '7px 14px', fontSize: '0.82rem',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{s.count}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Device cards */}
      {loading ? (
        <div className="dh-loading">Loading lab device telemetry…</div>
      ) : (
        <div className="dh-device-grid">
          {devices.map((d) => <DeviceCard key={d.device_id} device={d} />)}
          {devices.length === 0 && <p className="dh-empty">No devices found for this lab.</p>}
        </div>
      )}

      {/* Alerts */}
      {!loading && <DeviceAlerts devices={devices} />}
    </div>
  );
}
