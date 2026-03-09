import React from 'react';
import { Monitor, CheckCircle, AlertTriangle, WifiOff } from 'lucide-react';
import type { DeviceHealth } from './types';

interface Props {
  devices: DeviceHealth[];
}

export function DeviceHealthCards({ devices }: Props) {
  const total   = devices.length;
  const healthy = devices.filter((d) => d.status === 'healthy').length;
  const warning = devices.filter((d) => d.status === 'warning').length;
  const offline = devices.filter((d) => d.status === 'offline').length;

  return (
    <div className="dh-kpi-row">
      <div className="dh-kpi-card dh-kpi-total">
        <span className="dh-kpi-label">
          <Monitor size={12} style={{ display: 'inline', marginRight: 4 }} />
          Total Devices
        </span>
        <span className="dh-kpi-value">{total}</span>
      </div>

      <div className="dh-kpi-card dh-kpi-healthy">
        <span className="dh-kpi-label">
          <CheckCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
          Healthy
        </span>
        <span className="dh-kpi-value">{healthy}</span>
      </div>

      <div className="dh-kpi-card dh-kpi-warning">
        <span className="dh-kpi-label">
          <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />
          Warning
        </span>
        <span className="dh-kpi-value">{warning}</span>
      </div>

      <div className="dh-kpi-card dh-kpi-offline">
        <span className="dh-kpi-label">
          <WifiOff size={12} style={{ display: 'inline', marginRight: 4 }} />
          Offline
        </span>
        <span className="dh-kpi-value">{offline}</span>
      </div>
    </div>
  );
}
