import { canPerform, type PermissionAction } from '../auth/permissions';
import type { Role, User } from '../types/auth';
import type {
  Asset,
  AssetStatus,
  LabInfo,
  MaintenanceHistoryEntry,
  MaintenanceRequest,
  MaintenanceStatus,
  Priority,
  UserRecord
} from '../types/domain';

const TOKEN_STORAGE_KEY = 'campusledger_token';
let authToken: string | null = localStorage.getItem(TOKEN_STORAGE_KEY);

const usersByRole: Record<Role, { email: string; password: string; name: string; labId?: string }> = {
  admin: { email: 'admin@campus.edu', password: 'admin123', name: 'System Admin' },
  lab: { email: 'lab@campus.edu', password: 'lab123', name: 'Lab Incharge', labId: 'lab-cs-1' },
  service: { email: 'service@campus.edu', password: 'service123', name: 'Service Staff' }
};

const labs: LabInfo[] = [
  { id: 'lab-cs-1', name: 'CS Lab 1', department: 'Computer Science', assetCount: 24, incharge: 'Anita Rao' },
  { id: 'lab-mech', name: 'Mech Lab', department: 'Mechanical', assetCount: 19, incharge: 'Ravi Nair' },
  { id: 'lab-ece', name: 'ECE Lab', department: 'Electronics', assetCount: 21, incharge: 'Sonia Das' },
  { id: 'lab-chem', name: 'Chemistry Lab', department: 'Chemistry', assetCount: 17, incharge: 'Harish Kumar' }
];

const users: UserRecord[] = [
  { id: 'u-admin-1', name: 'System Admin', role: 'admin', email: 'admin@campus.edu', assignedLab: 'All' },
  { id: 'u-lab-1', name: 'Anita Rao', role: 'lab', email: 'lab@campus.edu', assignedLab: 'CS Lab 1' },
  { id: 'u-service-1', name: 'Suresh', role: 'service', email: 'service@campus.edu', assignedLab: 'Central Service' }
];

let assets: Asset[] = [
  {
    id: 'asset-1',
    assetCode: 'LAB-PC-001',
    name: 'Dell OptiPlex 7090',
    category: 'Computer',
    location: 'CS Lab 1',
    labId: 'lab-cs-1',
    status: 'Active',
    warranty: '2026-06-15'
  },
  {
    id: 'asset-2',
    assetCode: 'LAB-EQ-010',
    name: '3D Printer',
    category: 'Lab Equipment',
    location: 'Mech Lab',
    labId: 'lab-mech',
    status: 'Active',
    warranty: '2027-01-01'
  },
  {
    id: 'asset-3',
    assetCode: 'LIB-PC-004',
    name: 'Lenovo ThinkCentre',
    category: 'Computer',
    location: 'Library',
    labId: 'lab-cs-1',
    status: 'Active',
    warranty: '2026-02-10'
  },
  {
    id: 'asset-4',
    assetCode: 'LAB-EQ-002',
    name: 'Digital Multimeter',
    category: 'Equipment',
    location: 'ECE Lab',
    labId: 'lab-ece',
    status: 'Damaged',
    warranty: '2025-08-20'
  }
];

let maintenanceRequests: MaintenanceRequest[] = [
  {
    id: 'maint-1',
    requestId: 'REQ-1001',
    assetId: 'asset-1',
    assetCode: 'LAB-PC-001',
    assetName: 'Dell OptiPlex 7090',
    labId: 'lab-cs-1',
    labName: 'CS Lab 1',
    status: 'Completed',
    assignedTo: 'Suresh',
    priority: 'High',
    issue: 'System not booting',
    history: [
      { id: 'h-1', date: '2026-03-01', updatedBy: 'Lab', status: 'Pending', remarks: 'System not booting' },
      { id: 'h-2', date: '2026-03-02', updatedBy: 'Admin', status: 'Assigned', remarks: 'Assigned to Suresh' },
      { id: 'h-3', date: '2026-03-02', updatedBy: 'Service', status: 'Completed', remarks: 'Replaced SMPS' }
    ]
  },
  {
    id: 'maint-2',
    requestId: 'REQ-1002',
    assetId: 'asset-4',
    assetCode: 'LAB-EQ-002',
    assetName: 'Digital Multimeter',
    labId: 'lab-ece',
    labName: 'ECE Lab',
    status: 'Pending',
    priority: 'Medium',
    issue: 'Display flickering intermittently',
    history: [{ id: 'h-4', date: '2026-03-02', updatedBy: 'Lab', status: 'Pending', remarks: 'Display flickering intermittently' }]
  }
];

const adminKpis = {
  totalAssets: 124,
  activeAssets: 108,
  damagedAssets: 6,
  maintenanceRequests: 10,
  pendingRequests: 4,
  labs: 12
};

const labKpis = {
  myAssets: 24,
  active: 20,
  damaged: 2,
  underMaintenance: 2
};

const serviceKpis = {
  assignedTasks: 6,
  pending: 3,
  inProgress: 2,
  completed: 1
};

function delay<T>(value: T, ms = 160): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function assertPermission(role: Role, action: PermissionAction) {
  if (!canPerform(role, action)) {
    throw new Error(`Permission denied for action: ${action}`);
  }
}

function toAppRole(rawRole: string): Role {
  const value = rawRole.toLowerCase();
  if (value.includes('admin')) return 'admin';
  if (value.includes('lab')) return 'lab';
  return 'service';
}

function nextMaintenanceHistoryEntry(updatedBy: MaintenanceHistoryEntry['updatedBy'], status: MaintenanceHistoryEntry['status'], remarks: string): MaintenanceHistoryEntry {
  return {
    id: `h-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString().slice(0, 10),
    updatedBy,
    status,
    remarks
  };
}

function findLabName(labId: string): string {
  return labs.find((lab) => lab.id === labId)?.name ?? labId;
}

function canTransition(current: MaintenanceStatus, next: MaintenanceStatus): boolean {
  if (current === 'Pending' && next === 'In Progress') return true;
  if (current === 'In Progress' && next === 'Completed') return true;
  return current === next;
}

export const api = {
  getToken() {
    return authToken;
  },

  setToken(token: string | null) {
    authToken = token;
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  },

  async login(email: string, password: string, selectedRole?: Role): Promise<{ token: string; user: User }> {
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (response.ok) {
        const role = toAppRole(data.user.role);
        const user: User = {
          id: data.user.id ?? `user-${role}`,
          name: data.user.name ?? usersByRole[role].name,
          email: data.user.email ?? email,
          role,
          labId: role === 'lab' ? usersByRole.lab.labId : undefined
        };
        return { token: data.token, user };
      }
    } catch {
      // Use local demo auth fallback.
    }

    const matchedRole = (selectedRole ?? (Object.keys(usersByRole) as Role[]).find((role) => usersByRole[role].email === email)) as Role | undefined;
    if (!matchedRole) {
      throw new Error('Invalid credentials.');
    }
    const profile = usersByRole[matchedRole];
    if (profile.email !== email || profile.password !== password) {
      throw new Error('Invalid credentials.');
    }

    return delay({
      token: `demo-jwt-${matchedRole}`,
      user: {
        id: `user-${matchedRole}`,
        name: profile.name,
        email: profile.email,
        role: matchedRole,
        labId: profile.labId
      }
    });
  },

  async getAdminKpis() {
    return delay(adminKpis);
  },

  async getLabKpis() {
    return delay(labKpis);
  },

  async getServiceKpis() {
    return delay(serviceKpis);
  },

  async getAssetCategoryChart() {
    return delay([
      { label: 'Computer', value: 62 },
      { label: 'Lab Equipment', value: 38 },
      { label: 'Network', value: 24 }
    ]);
  },

  async getMaintenanceOverviewChart() {
    return delay([
      { label: 'Pending', value: 4 },
      { label: 'In Progress', value: 3 },
      { label: 'Completed', value: 3 }
    ]);
  },

  async getAssets(role: Role, labId?: string): Promise<Asset[]> {
    if (role === 'lab') {
      assertPermission(role, 'asset:view_lab_only');
      return delay(assets.filter((asset) => asset.labId === labId));
    }
    return delay([...assets]);
  },

  async createAsset(role: Role, payload: Omit<Asset, 'id'>): Promise<Asset> {
    assertPermission(role, 'asset:create');
    const created: Asset = { id: `asset-${Math.random().toString(36).slice(2, 8)}`, ...payload };
    assets = [created, ...assets];
    return delay(created);
  },

  async updateAsset(role: Role, assetId: string, changes: Partial<Omit<Asset, 'id'>>): Promise<Asset> {
    assertPermission(role, 'asset:edit');
    const index = assets.findIndex((asset) => asset.id === assetId);
    if (index < 0) throw new Error('Asset not found');
    assets[index] = { ...assets[index], ...changes };
    return delay(assets[index]);
  },

  async deleteAsset(role: Role, assetId: string): Promise<void> {
    assertPermission(role, 'asset:delete');
    assets = assets.filter((asset) => asset.id !== assetId);
    return delay(undefined);
  },

  async assignAssetToLab(role: Role, assetId: string, labId: string): Promise<Asset> {
    assertPermission(role, 'asset:assign_lab');
    const targetLab = labs.find((lab) => lab.id === labId);
    if (!targetLab) throw new Error('Lab not found');
    return this.updateAsset(role, assetId, {
      labId: targetLab.id,
      location: targetLab.name
    });
  },

  async getLabs(role: Role): Promise<LabInfo[]> {
    if (role !== 'admin') {
      throw new Error('Only admin can access labs.');
    }
    return delay([...labs]);
  },

  async getUsers(role: Role): Promise<UserRecord[]> {
    if (role !== 'admin') {
      throw new Error('Only admin can access users.');
    }
    return delay([...users]);
  },

  async getMaintenanceRequests(role: Role, labId?: string): Promise<MaintenanceRequest[]> {
    if (role === 'lab') {
      return delay(maintenanceRequests.filter((request) => request.labId === labId));
    }
    if (role === 'service') {
      return delay(maintenanceRequests.filter((request) => request.assignedTo));
    }
    return delay([...maintenanceRequests]);
  },

  async raiseMaintenanceRequest(
    role: Role,
    payload: { assetId: string; labId: string; issue: string; priority: Priority }
  ): Promise<MaintenanceRequest> {
    assertPermission(role, 'maintenance:raise');
    const asset = assets.find((entry) => entry.id === payload.assetId && entry.labId === payload.labId);
    if (!asset) throw new Error('Asset not found for this lab.');

    const created: MaintenanceRequest = {
      id: `maint-${Math.random().toString(36).slice(2, 8)}`,
      requestId: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      assetId: asset.id,
      assetCode: asset.assetCode,
      assetName: asset.name,
      labId: payload.labId,
      labName: findLabName(payload.labId),
      status: 'Pending',
      priority: payload.priority,
      issue: payload.issue,
      history: [nextMaintenanceHistoryEntry('Lab', 'Pending', payload.issue)]
    };
    maintenanceRequests = [created, ...maintenanceRequests];
    return delay(created);
  },

  async assignMaintenanceRequest(role: Role, requestId: string, assignee: string): Promise<MaintenanceRequest> {
    assertPermission(role, 'maintenance:assign');
    const index = maintenanceRequests.findIndex((request) => request.requestId === requestId);
    if (index < 0) throw new Error('Maintenance request not found.');
    const current = maintenanceRequests[index];
    const updated: MaintenanceRequest = {
      ...current,
      assignedTo: assignee,
      status: 'In Progress',
      history: [...current.history, nextMaintenanceHistoryEntry('Admin', 'Assigned', `Assigned to ${assignee}`)]
    };
    maintenanceRequests[index] = updated;
    return delay(updated);
  },

  async updateMaintenanceStatus(role: Role, requestId: string, status: MaintenanceStatus, remarks: string): Promise<MaintenanceRequest> {
    assertPermission(role, 'maintenance:update_status');
    const index = maintenanceRequests.findIndex((request) => request.requestId === requestId);
    if (index < 0) throw new Error('Maintenance request not found.');
    const current = maintenanceRequests[index];
    if (!canTransition(current.status, status)) {
      throw new Error(`Invalid status transition from ${current.status} to ${status}.`);
    }
    const updated: MaintenanceRequest = {
      ...current,
      status,
      history: [...current.history, nextMaintenanceHistoryEntry('Service', status, remarks)]
    };
    maintenanceRequests[index] = updated;

    const nextAssetStatus: AssetStatus = status === 'Completed' ? 'Active' : 'Under Maintenance';
    assets = assets.map((asset) => (asset.id === updated.assetId ? { ...asset, status: nextAssetStatus } : asset));
    return delay(updated);
  }
};
