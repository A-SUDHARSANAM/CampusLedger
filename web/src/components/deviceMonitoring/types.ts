export interface DeviceAlert {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  anomaly_score: number;
}

export interface DeviceHealth {
  device_id: string;
  name: string;
  location: string;
  lab_id?: string | null;
  cpu_usage: number;
  temperature: number;
  battery: number;
  network_latency: number;
  anomaly_score: number;
  status: 'healthy' | 'warning' | 'offline';
  last_seen: string;
  alerts: DeviceAlert[];
}
