import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cpu, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { DeviceHealthCards } from './DeviceHealthCards';
import { DeviceTable } from './DeviceTable';
import { DeviceAlerts } from './DeviceAlerts';
import { DeviceCharts } from './DeviceCharts';
import './deviceMonitoring.css';

// Re-export shared types (api.ts imports them from here)
export type { DeviceAlert, DeviceHealth } from './types';
import type { DeviceHealth } from './types';

const POLL_INTERVAL_MS = 5000;

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function DeviceHealthDashboard() {
  const [devices, setDevices]   = useState<DeviceHealth[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [live, setLive]         = useState(true);
  const [search, setSearch]     = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lastRefresh, setLastRefresh]   = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const data = await api.getDeviceHealth();
      setDevices(data);
      setLastRefresh(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch device health data');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const filtered = devices.filter((d) => {
    const matchSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.location.toLowerCase().includes(search.toLowerCase()) ||
      d.device_id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="dh-page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          <Cpu size={20} />
          Electronics Device Health Monitor
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
            title={live ? 'Pause auto-refresh' : 'Resume auto-refresh'}
          >
            {live ? 'Live' : 'Paused'}
          </button>
          <button className="btn btn-sm btn-outline" onClick={fetchDevices} title="Refresh now">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="alert alert-danger" style={{ margin: 0 }}>
          {error}
        </div>
      )}

      {/* KPI cards */}
      {!loading && <DeviceHealthCards devices={devices} />}

      {/* Filter bar */}
      <div className="dh-filter-bar">
        <input
          className="input"
          placeholder="Search devices, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="healthy">Healthy</option>
          <option value="warning">Warning</option>
          <option value="offline">Offline</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="dh-loading">Loading device telemetry…</div>
      ) : (
        <DeviceTable devices={filtered} />
      )}

      {/* Alerts + Charts */}
      {!loading && (
        <>
          <DeviceAlerts devices={devices} />
          <DeviceCharts devices={devices} />
        </>
      )}
    </div>
  );
}
