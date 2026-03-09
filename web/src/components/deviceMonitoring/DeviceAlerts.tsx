import React from 'react';
import { Bell } from 'lucide-react';
import type { DeviceHealth, DeviceAlert } from './types';

interface Props {
  devices: DeviceHealth[];
}

type AlertWithDevice = DeviceAlert & { deviceName: string; deviceId: string };

function sevIcon(sev: string) {
  if (sev === 'critical') return '🔴';
  if (sev === 'warning')  return '🟡';
  return 'ℹ️';
}

export function DeviceAlerts({ devices }: Props) {
  const alerts: AlertWithDevice[] = [];
  devices.forEach((d) => {
    d.alerts.forEach((a: DeviceAlert) => {
      alerts.push({ ...a, deviceName: d.name, deviceId: d.device_id });
    });
  });

  // Sort: critical first, then warning, then info; by anomaly_score desc within each tier
  const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => {
    const diff = (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
    return diff !== 0 ? diff : b.anomaly_score - a.anomaly_score;
  });

  return (
    <div className="dh-alert-panel">
      <div className="dh-alert-panel-header">
        <span className="dh-alert-panel-title">
          <Bell size={14} />
          Active Alerts
          {alerts.length > 0 && <span className="dh-alert-count">{alerts.length}</span>}
        </span>
      </div>

      {alerts.length === 0 ? (
        <p className="dh-alert-empty">✅ No alerts — all devices operating normally.</p>
      ) : (
        <ul className="dh-alert-list">
          {alerts.map((a, i) => (
            <li key={i} className="dh-alert-item">
              <span className={`dh-alert-icon dh-sev-${a.severity}`}>{sevIcon(a.severity)}</span>
              <div className="dh-alert-body">
                <div className="dh-alert-device">{a.deviceName}</div>
                <div className="dh-alert-msg">{a.message}</div>
              </div>
              <span className="dh-alert-score">
                Score: {(a.anomaly_score * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
