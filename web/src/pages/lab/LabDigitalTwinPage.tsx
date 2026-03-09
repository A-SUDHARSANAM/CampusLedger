import React from 'react';
import { LabDigitalTwin } from '../../components/digitalTwin/LabDigitalTwin';
import { useAuth } from '../../hooks/useAuth';

export function LabDigitalTwinPage() {
  const { user } = useAuth();
  return <LabDigitalTwin labId={(user as { labId?: string } | null)?.labId} />;
}
