import { canPerform, type PermissionAction } from '../auth/permissions';
import type { Role, User } from '../types/auth';
import type {
  Asset,
  AssetStatus,
  BorrowItem,
  BorrowRecord,
  BorrowStatus,
  ElectronicsCatalogItem,
  LabInfo,
  MaintenanceHistoryEntry,
  MaintenanceRequest,
  MaintenanceStatus,
  Priority,
  ProcurementCategory,
  ProcurementRequest,
  ProcurementStatus,
  UserRecord
} from '../types/domain';

const TOKEN_STORAGE_KEY = 'campusledger_token';
let authToken: string | null = localStorage.getItem(TOKEN_STORAGE_KEY);

const usersByRole: Record<Role, { email: string; password: string; name: string; labId?: string }> = {
  admin: { email: 'admin@campus.edu', password: 'admin123', name: 'System Admin' },
  lab: { email: 'lab@campus.edu', password: 'lab123', name: 'Lab Incharge', labId: 'lab-cs-1' },
  service: { email: 'service@campus.edu', password: 'service123', name: 'Service Staff' },
  vendor: { email: 'vendor@campus.edu', password: 'vendor123', name: 'Vendor Partner' }
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
  { id: 'u-service-1', name: 'Suresh', role: 'service', email: 'service@campus.edu', assignedLab: 'Central Service' },
  { id: 'u-vendor-1', name: 'Vendor Partner', role: 'vendor', email: 'vendor@campus.edu', assignedLab: 'External Vendor' }
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

const electronicsCatalog: ElectronicsCatalogItem[] = [
  { id: 'el-1', sku: 'ELEC-KIT-001', name: 'Arduino Uno R3', category: 'Microcontroller', unitCost: 1200, warrantyMonths: 12, inStock: 40 },
  { id: 'el-2', sku: 'ELEC-SNS-002', name: 'Ultrasonic Sensor HC-SR04', category: 'Sensor', unitCost: 180, warrantyMonths: 6, inStock: 150 },
  { id: 'el-3', sku: 'ELEC-DRV-003', name: 'L298N Motor Driver', category: 'Motor Driver', unitCost: 320, warrantyMonths: 6, inStock: 70 },
  { id: 'el-4', sku: 'ELEC-RPI-004', name: 'Raspberry Pi 5', category: 'Embedded Board', unitCost: 7600, warrantyMonths: 12, inStock: 15 }
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

let borrowRecords: BorrowRecord[] = [
  {
    id: 'br-1',
    borrowId: 'BOR-3001',
    billNo: 'BILL-2026-001',
    invoiceNo: 'INV-2026-001',
    labId: 'lab-cs-1',
    studentName: 'Akhil Sharma',
    projectName: 'Smart Irrigation System',
    createdDate: '2026-03-01',
    dueDate: '2026-03-06',
    status: 'Borrowed',
    issueUpdates: ['Issued by lab assistant', 'Project verification completed'],
    fineAmount: 0,
    items: [
      {
        itemId: 'el-1',
        sku: 'ELEC-KIT-001',
        productName: 'Arduino Uno R3',
        quantity: 1,
        unitCost: 1200,
        warrantyMonths: 12
      }
    ]
  }
];

let procurementRequests: ProcurementRequest[] = [
  {
    id: 'pr-1',
    requestNo: 'PR-5001',
    requestedByLabId: 'lab-cs-1',
    requestedByLabName: 'CS Lab 1',
    category: 'Purchase',
    createdDate: '2026-03-02',
    status: 'Pending Admin Approval',
    items: [
      {
        itemId: 'el-4',
        sku: 'ELEC-RPI-004',
        productName: 'Raspberry Pi 5',
        quantity: 3,
        unitCost: 7600,
        warrantyMonths: 12
      }
    ],
    notes: 'Need for AI/ML embedded lab kits.'
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
  if (value.includes('vendor')) return 'vendor';
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

function totalAmount(items: BorrowItem[]) {
  return items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
}

function nextBorrowStatus(current: BorrowStatus, damage: boolean, late: boolean): BorrowStatus {
  if (damage) return 'Damaged';
  if (late) return 'Late Return';
  if (current === 'Borrowed') return 'Returned';
  return current;
}

function calculateFine(dueDate: string, returnedDate: string, damage: boolean): number {
  const due = new Date(dueDate);
  const returned = new Date(returnedDate);
  const lateDays = Math.max(0, Math.floor((returned.getTime() - due.getTime()) / (24 * 60 * 60 * 1000)));
  const lateFine = lateDays * 75;
  const damageFine = damage ? 500 : 0;
  return lateFine + damageFine;
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
  },

  async getElectronicsCatalog() {
    return delay([...electronicsCatalog]);
  },

  async getBorrowRecords(role: Role, labId?: string): Promise<BorrowRecord[]> {
    assertPermission(role, 'borrow:view');
    if (role === 'lab') {
      return delay(borrowRecords.filter((record) => record.labId === labId));
    }
    return delay([...borrowRecords]);
  },

  async createBorrowRequest(
    role: Role,
    payload: { labId: string; studentName: string; projectName: string; dueDate: string; items: BorrowItem[] }
  ): Promise<BorrowRecord> {
    assertPermission(role, 'borrow:create');
    if (payload.items.length === 0) throw new Error('At least one item is required.');
    const createdDate = new Date().toISOString().slice(0, 10);
    const sequence = 3000 + borrowRecords.length + 1;
    const created: BorrowRecord = {
      id: `br-${Math.random().toString(36).slice(2, 8)}`,
      borrowId: `BOR-${sequence}`,
      billNo: `BILL-2026-${String(sequence - 3000).padStart(3, '0')}`,
      invoiceNo: `INV-2026-${String(sequence - 3000).padStart(3, '0')}`,
      labId: payload.labId,
      studentName: payload.studentName,
      projectName: payload.projectName,
      createdDate,
      dueDate: payload.dueDate,
      status: 'Borrowed',
      issueUpdates: ['Issued and logged by lab assistant'],
      fineAmount: 0,
      items: payload.items
    };
    borrowRecords = [created, ...borrowRecords];
    return delay(created);
  },

  async returnBorrowItem(
    role: Role,
    borrowId: string,
    payload: { damaged: boolean; remark: string; returnedDate?: string }
  ): Promise<BorrowRecord> {
    assertPermission(role, 'borrow:return');
    const index = borrowRecords.findIndex((record) => record.borrowId === borrowId);
    if (index < 0) throw new Error('Borrow record not found.');
    const current = borrowRecords[index];
    const returnedDate = payload.returnedDate ?? new Date().toISOString().slice(0, 10);
    const late = new Date(returnedDate).getTime() > new Date(current.dueDate).getTime();
    const nextStatus = nextBorrowStatus(current.status, payload.damaged, late);
    const fineAmount = calculateFine(current.dueDate, returnedDate, payload.damaged);
    const updated: BorrowRecord = {
      ...current,
      status: nextStatus,
      returnedDate,
      fineAmount,
      issueUpdates: [...current.issueUpdates, payload.remark]
    };
    borrowRecords[index] = updated;
    return delay(updated);
  },

  async getProcurementRequests(role: Role, labId?: string): Promise<ProcurementRequest[]> {
    if (role === 'lab') {
      return delay(procurementRequests.filter((request) => request.requestedByLabId === labId));
    }
    if (role === 'vendor') {
      return delay(procurementRequests.filter((request) => request.status === 'Sent to Vendor' || request.status === 'Accepted by Vendor'));
    }
    return delay([...procurementRequests]);
  },

  async createProcurementRequest(
    role: Role,
    payload: { requestedByLabId: string; category: ProcurementCategory; notes?: string; items: BorrowItem[] }
  ): Promise<ProcurementRequest> {
    assertPermission(role, 'procurement:create');
    if (payload.items.length === 0) throw new Error('At least one item is required.');
    const sequence = 5000 + procurementRequests.length + 1;
    const created: ProcurementRequest = {
      id: `pr-${Math.random().toString(36).slice(2, 8)}`,
      requestNo: `PR-${sequence}`,
      requestedByLabId: payload.requestedByLabId,
      requestedByLabName: findLabName(payload.requestedByLabId),
      category: payload.category,
      createdDate: new Date().toISOString().slice(0, 10),
      status: 'Pending Admin Approval',
      notes: payload.notes,
      items: payload.items
    };
    procurementRequests = [created, ...procurementRequests];
    return delay(created);
  },

  async approveProcurementRequest(role: Role, requestNo: string): Promise<ProcurementRequest> {
    assertPermission(role, 'procurement:approve');
    const index = procurementRequests.findIndex((request) => request.requestNo === requestNo);
    if (index < 0) throw new Error('Procurement request not found.');
    procurementRequests[index] = { ...procurementRequests[index], status: 'Approved by Admin' };
    return delay(procurementRequests[index]);
  },

  async sendProcurementToVendor(role: Role, requestNo: string, vendorName: string): Promise<ProcurementRequest> {
    assertPermission(role, 'procurement:send_to_vendor');
    const index = procurementRequests.findIndex((request) => request.requestNo === requestNo);
    if (index < 0) throw new Error('Procurement request not found.');
    procurementRequests[index] = { ...procurementRequests[index], status: 'Sent to Vendor', vendorName };
    return delay(procurementRequests[index]);
  },

  async vendorUpdateProcurement(
    role: Role,
    requestNo: string,
    decision: Extract<ProcurementStatus, 'Accepted by Vendor' | 'Rejected by Vendor'>
  ): Promise<ProcurementRequest> {
    assertPermission(role, 'procurement:vendor_update');
    const index = procurementRequests.findIndex((request) => request.requestNo === requestNo);
    if (index < 0) throw new Error('Procurement request not found.');
    procurementRequests[index] = { ...procurementRequests[index], status: decision };
    return delay(procurementRequests[index]);
  },

  async getBorrowSummary(role: Role, labId?: string) {
    const rows = await this.getBorrowRecords(role, labId);
    return delay({
      totalBorrowed: rows.length,
      pendingReturns: rows.filter((row) => row.status === 'Borrowed').length,
      penaltyCollected: rows.reduce((sum, row) => sum + row.fineAmount, 0),
      issuedValue: rows.reduce((sum, row) => sum + totalAmount(row.items), 0)
    });
  }
};
