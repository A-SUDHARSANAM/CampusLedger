import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { LabDeviceMonitoring } from '../../components/deviceMonitoring/LabDeviceMonitoring';

export function LabDeviceMonitoringPage() {
  const { user } = useAuth();
  return <LabDeviceMonitoring labId={(user as { labId?: string } | null)?.labId} />;
}
