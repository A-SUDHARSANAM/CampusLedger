import type { Role } from './auth';

export type AssetStatus = 'Active' | 'Damaged' | 'Under Maintenance';
export type MaintenanceStatus = 'Pending' | 'In Progress' | 'Completed';
export type Priority = 'Low' | 'Medium' | 'High';

export type Asset = {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  location: string;
  labId: string;
  status: AssetStatus;
  warranty: string;
};

export type LabInfo = {
  id: string;
  name: string;
  department: string;
  assetCount: number;
  incharge: string;
};

export type UserRecord = {
  id: string;
  name: string;
  role: Role;
  email: string;
  assignedLab: string;
};

export type MaintenanceHistoryEntry = {
  id: string;
  date: string;
  updatedBy: 'Lab' | 'Admin' | 'Service';
  status: MaintenanceStatus | 'Assigned';
  remarks: string;
};

export type MaintenanceRequest = {
  id: string;
  requestId: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  labId: string;
  labName: string;
  status: MaintenanceStatus;
  assignedTo?: string;
  priority: Priority;
  issue: string;
  history: MaintenanceHistoryEntry[];
};
