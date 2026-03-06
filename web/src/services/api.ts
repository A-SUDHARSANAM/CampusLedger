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
  Notification,
  Priority,
  ProcurementCategory,
  ProcurementRequest,
  ProcurementStatus,
  UserRecord
} from '../types/domain';

// ── Configuration ─────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:8000/api/v1';
const TOKEN_STORAGE_KEY = 'campusledger_token';
let authToken: string | null = localStorage.getItem(TOKEN_STORAGE_KEY);

// ── Backend HTTP helpers ───────────────────────────────────────────────────────
async function backendFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers ?? {})
    }
  });
}

async function backendGet<T>(path: string): Promise<T | null> {
  try {
    const res = await backendFetch(path);
    if (res.ok) return (await res.json()) as T;
  } catch { /* backend unavailable */ }
  return null;
}

async function backendPost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await backendFetch(path, { method: 'POST', body: JSON.stringify(body) });
    if (res.ok) return (await res.json()) as T;
  } catch { /* fallback */ }
  return null;
}

/** Like backendPost but throws a user-readable error on non-2xx responses. */
async function backendPostOrThrow<T>(path: string, body: unknown): Promise<T> {
  const res = await backendFetch(path, { method: 'POST', body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data as T;
  throw new Error(extractDetail(data, `Request failed (${res.status})`));
}

async function backendPut<T>(path: string, body: unknown = {}): Promise<T | null> {
  try {
    const res = await backendFetch(path, { method: 'PUT', body: JSON.stringify(body) });
    if (res.ok) return (await res.json()) as T;
  } catch { /* fallback */ }
  return null;
}

async function backendPatch<T>(path: string, body: unknown = {}): Promise<T | null> {
  try {
    const res = await backendFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
    if (res.ok) return (await res.json()) as T;
  } catch { /* fallback */ }
  return null;
}

async function backendDelete(path: string): Promise<boolean> {
  try {
    const res = await backendFetch(path, { method: 'DELETE' });
    return res.ok;
  } catch { /* fallback */ }
  return false;
}

// ── Data adapters (backend shape → frontend shape) ────────────────────────────
function adaptAsset(raw: Record<string, unknown>): Asset {
  const statusMap: Record<string, AssetStatus> = {
    active: 'Active',
    damaged: 'Damaged',
    under_maintenance: 'Under Maintenance'
  };
  return {
    id: String(raw.id ?? ''),
    assetCode: String(raw.serial_number ?? raw.id ?? ''),
    name: String(raw.asset_name ?? ''),
    category: String(raw.category ?? ''),
    location: String(raw.lab_name ?? raw.location ?? raw.lab_id ?? ''),
    labId: String(raw.lab_id ?? ''),
    status: statusMap[String(raw.status ?? '').toLowerCase()] ?? 'Active',
    warranty: String(raw.warranty_expiry ?? ''),
    serialNumber: raw.serial_number ? String(raw.serial_number) : undefined,
    conditionRating: raw.condition_rating ? Number(raw.condition_rating) : undefined,
    qrCode: raw.qr_code ? String(raw.qr_code) : undefined,
    purchaseDate: raw.purchase_date ? String(raw.purchase_date) : undefined
  };
}

function adaptLab(raw: Record<string, unknown>): LabInfo {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.lab_name ?? ''),
    department: String(raw.department ?? ''),
    assetCount: Number(raw.asset_count ?? 0),
    incharge: String(raw.technician_id ?? raw.incharge ?? '')
  };
}

function adaptUser(raw: Record<string, unknown>): UserRecord {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? raw.email ?? ''),
    role: toAppRole(String(raw.role ?? '')),
    email: String(raw.email ?? ''),
    assignedLab: String(raw.lab_id ?? 'N/A'),
    is_approved: Boolean(raw.is_approved),
    status: (raw.status as 'pending' | 'approved' | 'suspended') ?? 'pending'
  };
}

function adaptMaintenance(raw: Record<string, unknown>): MaintenanceRequest {
  const statusMap: Record<string, MaintenanceStatus> = {
    pending: 'Pending',
    assigned: 'Pending',
    in_progress: 'In Progress',
    completed: 'Completed'
  };
  const priorityMap: Record<string, Priority> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High'
  };
  return {
    id: String(raw.id ?? ''),
    requestId: String(raw.id ?? ''),
    assetId: String(raw.asset_id ?? ''),
    assetCode: String(raw.asset_id ?? ''),
    assetName: String(raw.asset_name ?? raw.asset_id ?? ''),
    labId: String(raw.lab_id ?? ''),
    labName: String(raw.lab_name ?? raw.lab_id ?? ''),
    status: statusMap[String(raw.status ?? '').toLowerCase()] ?? 'Pending',
    assignedTo: raw.assigned_to_id ? String(raw.assigned_to_id) : undefined,
    priority: priorityMap[String(raw.priority ?? '').toLowerCase()] ?? 'Medium',
    issue: String(raw.issue_description ?? ''),
    history: []
  };
}

function adaptProcurement(raw: Record<string, unknown>): ProcurementRequest {
  const statusMap: Record<string, ProcurementStatus> = {
    pending_review: 'Pending Admin Approval',
    approved: 'Approved by Admin',
    rejected: 'Rejected by Vendor',
    ordered: 'Sent to Vendor',
    payment_confirmed: 'Accepted by Vendor',
    delivered: 'Accepted by Vendor'
  };
  return {
    id: String(raw.id ?? ''),
    requestNo: String(raw.id ?? ''),
    requestedByLabId: String(raw.lab_id ?? ''),
    requestedByLabName: String(raw.lab_name ?? raw.lab_id ?? ''),
    category: 'Purchase',
    createdDate: String((raw.created_at as string | undefined)?.slice(0, 10) ?? ''),
    status: statusMap[String(raw.status ?? '')] ?? 'Pending Admin Approval',
    vendorName: raw.vendor_name ? String(raw.vendor_name) : undefined,
    notes: raw.notes ? String(raw.notes) : undefined,
    items: [{
      itemId: String(raw.id ?? ''),
      sku: String(raw.item_name ?? ''),
      productName: String(raw.item_name ?? ''),
      quantity: Number(raw.quantity ?? 1),
      unitCost: Number(raw.estimated_cost ?? 0),
      warrantyMonths: 12
    }]
  };
}

// ── Mock demo data (fallback when backend is unavailable) ─────────────────────
const usersByRole: Record<Role, { email: string; password: string; name: string; labId?: string }> = {
  admin: { email: 'admin@campus.edu', password: 'admin123', name: 'System Admin' },
  lab: { email: 'lab@campus.edu', password: 'lab123', name: 'Lab Incharge', labId: 'lab-cs-1' },
  service: { email: 'service@campus.edu', password: 'service123', name: 'Service Staff' },
  purchase_dept: { email: 'purchase@campus.edu', password: 'purchase123', name: 'Purchase Officer' }
};

const labs: LabInfo[] = [
  { id: 'lab-cs-1', name: 'CS Lab 1', department: 'Computer Science', assetCount: 24, incharge: 'Anita Rao' },
  { id: 'lab-mech', name: 'Mech Lab', department: 'Mechanical', assetCount: 19, incharge: 'Ravi Nair' },
  { id: 'lab-ece', name: 'ECE Lab', department: 'Electronics', assetCount: 21, incharge: 'Sonia Das' },
  { id: 'lab-chem', name: 'Chemistry Lab', department: 'Chemistry', assetCount: 17, incharge: 'Harish Kumar' }
];

const users: UserRecord[] = [
  { id: 'u-admin-1', name: 'System Admin', role: 'admin', email: 'admin@campus.edu', assignedLab: 'All', is_approved: true, status: 'approved' },
  { id: 'u-lab-1', name: 'Anita Rao', role: 'lab', email: 'lab@campus.edu', assignedLab: 'CS Lab 1', is_approved: true, status: 'approved' },
  { id: 'u-service-1', name: 'Suresh', role: 'service', email: 'service@campus.edu', assignedLab: 'Central Service', is_approved: true, status: 'approved' },
  { id: 'u-purchase-1', name: 'Purchase Officer', role: 'purchase_dept', email: 'purchase@campus.edu', assignedLab: 'Procurement', is_approved: false, status: 'pending' }
];

let assets: Asset[] = [
  { id: 'asset-1', assetCode: 'LAB-PC-001', name: 'Dell OptiPlex 7090', category: 'Computer', location: 'CS Lab 1', labId: 'lab-cs-1', status: 'Active', warranty: '2026-06-15' },
  { id: 'asset-2', assetCode: 'LAB-EQ-010', name: '3D Printer', category: 'Lab Equipment', location: 'Mech Lab', labId: 'lab-mech', status: 'Active', warranty: '2027-01-01' },
  { id: 'asset-3', assetCode: 'LIB-PC-004', name: 'Lenovo ThinkCentre', category: 'Computer', location: 'Library', labId: 'lab-cs-1', status: 'Active', warranty: '2026-02-10' },
  { id: 'asset-4', assetCode: 'LAB-EQ-002', name: 'Digital Multimeter', category: 'Equipment', location: 'ECE Lab', labId: 'lab-ece', status: 'Damaged', warranty: '2025-08-20' }
];

const electronicsCatalog: ElectronicsCatalogItem[] = [
  { id: 'el-1', sku: 'ELEC-KIT-001', name: 'Arduino Uno R3', category: 'Microcontroller', unitCost: 1200, warrantyMonths: 12, inStock: 40 },
  { id: 'el-2', sku: 'ELEC-SNS-002', name: 'Ultrasonic Sensor HC-SR04', category: 'Sensor', unitCost: 180, warrantyMonths: 6, inStock: 150 },
  { id: 'el-3', sku: 'ELEC-DRV-003', name: 'L298N Motor Driver', category: 'Motor Driver', unitCost: 320, warrantyMonths: 6, inStock: 70 },
  { id: 'el-4', sku: 'ELEC-RPI-004', name: 'Raspberry Pi 5', category: 'Embedded Board', unitCost: 7600, warrantyMonths: 12, inStock: 15 }
];

let maintenanceRequests: MaintenanceRequest[] = [
  {
    id: 'maint-1', requestId: 'REQ-1001', assetId: 'asset-1', assetCode: 'LAB-PC-001', assetName: 'Dell OptiPlex 7090',
    labId: 'lab-cs-1', labName: 'CS Lab 1', status: 'Completed', assignedTo: 'Suresh', priority: 'High',
    issue: 'System not booting',
    history: [
      { id: 'h-1', date: '2026-03-01', updatedBy: 'Lab', status: 'Pending', remarks: 'System not booting' },
      { id: 'h-2', date: '2026-03-02', updatedBy: 'Admin', status: 'Assigned', remarks: 'Assigned to Suresh' },
      { id: 'h-3', date: '2026-03-02', updatedBy: 'Service', status: 'Completed', remarks: 'Replaced SMPS' }
    ]
  },
  {
    id: 'maint-2', requestId: 'REQ-1002', assetId: 'asset-4', assetCode: 'LAB-EQ-002', assetName: 'Digital Multimeter',
    labId: 'lab-ece', labName: 'ECE Lab', status: 'Pending', priority: 'Medium',
    issue: 'Display flickering intermittently',
    history: [{ id: 'h-4', date: '2026-03-02', updatedBy: 'Lab', status: 'Pending', remarks: 'Display flickering intermittently' }]
  }
];

let borrowRecords: BorrowRecord[] = [
  {
    id: 'br-1', borrowId: 'BOR-3001', billNo: 'BILL-2026-001', invoiceNo: 'INV-2026-001',
    labId: 'lab-cs-1', studentName: 'Akhil Sharma', projectName: 'Smart Irrigation System',
    createdDate: '2026-03-01', dueDate: '2026-03-06', status: 'Borrowed', issueUpdates: ['Issued by lab assistant'], fineAmount: 0,
    items: [{ itemId: 'el-1', sku: 'ELEC-KIT-001', productName: 'Arduino Uno R3', quantity: 1, unitCost: 1200, warrantyMonths: 12 }]
  }
];

let procurementRequests: ProcurementRequest[] = [
  {
    id: 'pr-1', requestNo: 'PR-5001', requestedByLabId: 'lab-cs-1', requestedByLabName: 'CS Lab 1',
    category: 'Purchase', createdDate: '2026-03-02', status: 'Pending Admin Approval',
    notes: 'Need for AI/ML embedded lab kits.',
    items: [{ itemId: 'el-4', sku: 'ELEC-RPI-004', productName: 'Raspberry Pi 5', quantity: 3, unitCost: 7600, warrantyMonths: 12 }]
  }
];

const adminKpis = { totalAssets: 124, activeAssets: 108, damagedAssets: 6, maintenanceRequests: 10, pendingRequests: 4, labs: 12 };
const labKpis = { myAssets: 24, active: 20, damaged: 2, underMaintenance: 2 };
const serviceKpis = { assignedTasks: 6, pending: 3, inProgress: 2, completed: 1 };

// ── Utilities ─────────────────────────────────────────────────────────────────
function delay<T>(value: T, ms = 160): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function assertPermission(role: Role, action: PermissionAction) {
  if (!canPerform(role, action)) throw new Error(`Permission denied for action: ${action}`);
}

function toAppRole(rawRole: string): Role {
  const value = rawRole.toLowerCase();
  if (value.includes('admin')) return 'admin';
  if (value.includes('lab')) return 'lab';
  if (value.includes('service')) return 'service';
  if (value.includes('purchase')) return 'purchase_dept';
  return 'service';
}

/**
 * Extract a human-readable message from a FastAPI error response.
 * Pydantic validation errors send `detail` as an array of objects;
 * other errors send it as a plain string.
 */
function extractDetail(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const detail = (data as Record<string, unknown>).detail;
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as Record<string, unknown>;
    const msg = String(first.msg ?? first.message ?? '');
    const loc = Array.isArray(first.loc) ? (first.loc as string[]).slice(1).join(' → ') : '';
    return loc ? `${loc}: ${msg}` : msg;
  }
  return fallback;
}

/** Map frontend Role → backend role_name stored in the DB */
function toBackendRole(role: Role): string {
  const map: Record<Role, string> = {
    admin: 'admin',
    lab: 'lab_technician',
    service: 'service_staff',
    purchase_dept: 'purchase_dept'
  };
  return map[role];
}

function nextMaintenanceHistoryEntry(updatedBy: MaintenanceHistoryEntry['updatedBy'], status: MaintenanceHistoryEntry['status'], remarks: string): MaintenanceHistoryEntry {
  return { id: `h-${Math.random().toString(36).slice(2, 8)}`, date: new Date().toISOString().slice(0, 10), updatedBy, status, remarks };
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
  return lateDays * 75 + (damage ? 500 : 0);
}

// ── API object ────────────────────────────────────────────────────────────────
export const api = {
  getToken() { return authToken; },

  setToken(token: string | null) {
    authToken = token;
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  },

  // ── Auth ─────────────────────────────────────────────────────────────────
  async login(email: string, password: string, _selectedRole?: Role): Promise<{ token: string; user: User }> {
    const res = await backendFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractDetail(data, 'Invalid email or password.'));
    const role = toAppRole(data.user?.role ?? '');
    return {
      token: data.access_token,
      user: { id: data.user.id, name: data.user.name ?? email, email: data.user.email ?? email, role, labId: data.user.lab_id }
    };
  },

  async register(email: string, password: string, fullName: string, role: Role, deptName: string): Promise<void> {
    const res = await backendFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name: fullName, role: toBackendRole(role), dept_name: deptName })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(extractDetail(data, 'Registration failed. Please try again.'));
    }
  },

  // ── Analytics ─────────────────────────────────────────────────────────────
  async getAdminKpis() {
    type Summary = { total_assets: number; active_assets: number; damaged_assets: number; under_maintenance: number; pending_maintenance: number; labs_count: number };
    const data = await backendGet<Summary>('/analytics/summary');
    if (data) {
      return { totalAssets: data.total_assets, activeAssets: data.active_assets, damagedAssets: data.damaged_assets, maintenanceRequests: data.under_maintenance, pendingRequests: data.pending_maintenance, labs: data.labs_count };
    }
    return delay(adminKpis);
  },

  async getLabKpis() { return delay(labKpis); },
  async getServiceKpis() { return delay(serviceKpis); },

  async getAnalyticsDashboard() {
    type Dashboard = { kpis: Record<string, number>; assets_by_location: { label: string; value: number }[]; asset_category_distribution: { label: string; value: number }[]; monthly_procurement_trend: { label: string; value: number }[]; maintenance_frequency?: Record<string, unknown>; financial_status_prediction?: Record<string, unknown> };
    const data = await backendGet<Dashboard>('/analytics/dashboard');
    return data ?? null;
  },

  async getAssetCategoryChart() {
    const dash = await this.getAnalyticsDashboard();
    if (dash?.asset_category_distribution?.length) return dash.asset_category_distribution;
    return delay([{ label: 'Computer', value: 62 }, { label: 'Lab Equipment', value: 38 }, { label: 'Network', value: 24 }]);
  },

  async getMaintenanceOverviewChart() {
    return delay([{ label: 'Pending', value: 4 }, { label: 'In Progress', value: 3 }, { label: 'Completed', value: 3 }]);
  },

  async runChecks() {
    await backendPost('/analytics/run-checks', {});
  },

  // ── Assets ────────────────────────────────────────────────────────────────
  async getAssets(role: Role, labId?: string): Promise<Asset[]> {
    const params = role === 'lab' && labId ? `?lab_id=${labId}` : '';
    const data = await backendGet<Record<string, unknown>[]>(`/assets/${params}`);
    if (data) return data.map(adaptAsset);
    if (role === 'lab') return delay(assets.filter((a) => a.labId === labId));
    return delay([...assets]);
  },

  async getAssetCategories(): Promise<{ id: string; category_name: string }[]> {
    const data = await backendGet<{ id: string; category_name: string }[]>('/assets/categories');
    return data ?? [];
  },

  async createAsset(role: Role, payload: Omit<Asset, 'id'>): Promise<Asset> {
    assertPermission(role, 'asset:create');
    const body: Record<string, unknown> = {
      asset_name: payload.name,
      category: payload.category,
      lab_id: payload.labId || undefined,
      serial_number: payload.assetCode || undefined,
      warranty_expiry: payload.warranty || undefined,
      purchase_date: payload.purchaseDate || undefined,
      status: payload.status.toLowerCase().replace(/ /g, '_')
    };
    const data = await backendPostOrThrow<Record<string, unknown>>('/assets/', body);
    return adaptAsset(data);
  },

  async updateAsset(role: Role, assetId: string, changes: Partial<Omit<Asset, 'id'>>): Promise<Asset> {
    assertPermission(role, 'asset:edit');
    const body: Record<string, unknown> = {};
    if (changes.name) body.asset_name = changes.name;
    if (changes.status) body.status = changes.status.toLowerCase().replace(' ', '_');
    if (changes.labId) body.lab_id = changes.labId;
    if (changes.conditionRating !== undefined) body.condition_rating = changes.conditionRating;
    const data = await backendPut<Record<string, unknown>>(`/assets/${assetId}`, body);
    if (data) return adaptAsset(data);
    const index = assets.findIndex((a) => a.id === assetId);
    if (index < 0) throw new Error('Asset not found');
    assets[index] = { ...assets[index], ...changes };
    return delay(assets[index]);
  },

  async deleteAsset(role: Role, assetId: string): Promise<void> {
    assertPermission(role, 'asset:delete');
    const ok = await backendDelete(`/assets/${assetId}`);
    if (ok) return;
    assets = assets.filter((a) => a.id !== assetId);
    return delay(undefined);
  },

  async assignAssetToLab(role: Role, assetId: string, labId: string): Promise<Asset> {
    assertPermission(role, 'asset:assign_lab');
    const targetLab = labs.find((l) => l.id === labId);
    if (!targetLab) throw new Error('Lab not found');
    return this.updateAsset(role, assetId, { labId: targetLab.id, location: targetLab.name });
  },

  // ── Labs ──────────────────────────────────────────────────────────────────
  async getLabs(role: Role): Promise<LabInfo[]> {
    if (role !== 'admin') throw new Error('Only admin can access labs.');
    const data = await backendGet<Record<string, unknown>[]>('/labs');
    if (data) return data.map(adaptLab);
    return delay([...labs]);
  },

  async createLab(role: Role, payload: { lab_name: string; department: string; location: string }): Promise<LabInfo> {
    if (role !== 'admin') throw new Error('Permission denied.');
    const data = await backendPost<Record<string, unknown>>('/labs', payload);
    if (data) return adaptLab(data);
    const created: LabInfo = { id: `lab-${Math.random().toString(36).slice(2, 8)}`, name: payload.lab_name, department: payload.department, assetCount: 0, incharge: '' };
    labs.push(created);
    return delay(created);
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  async getUsers(role: Role): Promise<UserRecord[]> {
    if (role !== 'admin') throw new Error('Only admin can access users.');
    const data = await backendGet<Record<string, unknown>[]>('/users');
    if (data) return data.map(adaptUser);
    return delay([...users]);
  },

  async approveUser(userId: string): Promise<void> {
    await backendPut(`/users/${userId}/approve`);
    const idx = users.findIndex((u) => u.id === userId);
    if (idx >= 0) { users[idx] = { ...users[idx], is_approved: true, status: 'approved' }; }
  },

  async updateUserRole(userId: string, role: Role): Promise<void> {
    const backendRole = role === 'lab' ? 'lab_technician' : role === 'service' ? 'service_staff' : role === 'purchase_dept' ? 'purchase_dept' : 'admin';
    await backendPut(`/users/${userId}/role`, { role: backendRole });
    const idx = users.findIndex((u) => u.id === userId);
    if (idx >= 0) { users[idx] = { ...users[idx], role }; }
  },

  async deleteUser(userId: string): Promise<void> {
    await backendDelete(`/users/${userId}`);
    users.splice(users.findIndex((u) => u.id === userId), 1);
  },

  // ── Maintenance ───────────────────────────────────────────────────────────
  async getMaintenanceRequests(role: Role, labId?: string): Promise<MaintenanceRequest[]> {
    const data = await backendGet<Record<string, unknown>[]>('/maintenance');
    if (data) return data.map(adaptMaintenance);
    if (role === 'lab') return delay(maintenanceRequests.filter((r) => r.labId === labId));
    if (role === 'service') return delay(maintenanceRequests.filter((r) => r.assignedTo));
    return delay([...maintenanceRequests]);
  },

  async raiseMaintenanceRequest(role: Role, payload: { assetId: string; labId: string; issue: string; priority: Priority }): Promise<MaintenanceRequest> {
    assertPermission(role, 'maintenance:raise');
    const body = { asset_id: payload.assetId, issue_description: payload.issue, priority: payload.priority.toLowerCase() };
    const data = await backendPost<Record<string, unknown>>('/maintenance/report', body);
    if (data) return adaptMaintenance(data);
    const asset = assets.find((a) => a.id === payload.assetId && a.labId === payload.labId);
    if (!asset) throw new Error('Asset not found for this lab.');
    const created: MaintenanceRequest = {
      id: `maint-${Math.random().toString(36).slice(2, 8)}`, requestId: `REQ-${Math.floor(1000 + Math.random() * 9000)}`,
      assetId: asset.id, assetCode: asset.assetCode, assetName: asset.name,
      labId: payload.labId, labName: findLabName(payload.labId),
      status: 'Pending', priority: payload.priority, issue: payload.issue,
      history: [nextMaintenanceHistoryEntry('Lab', 'Pending', payload.issue)]
    };
    maintenanceRequests = [created, ...maintenanceRequests];
    return delay(created);
  },

  async assignMaintenanceRequest(role: Role, requestId: string, assignee: string): Promise<MaintenanceRequest> {
    assertPermission(role, 'maintenance:assign');
    const data = await backendPut<Record<string, unknown>>(`/maintenance/${requestId}/assign`, { staff_id: assignee });
    if (data) return adaptMaintenance(data);
    const index = maintenanceRequests.findIndex((r) => r.requestId === requestId || r.id === requestId);
    if (index < 0) throw new Error('Maintenance request not found.');
    const current = maintenanceRequests[index];
    const updated: MaintenanceRequest = {
      ...current, assignedTo: assignee, status: 'In Progress',
      history: [...current.history, nextMaintenanceHistoryEntry('Admin', 'Assigned', `Assigned to ${assignee}`)]
    };
    maintenanceRequests[index] = updated;
    return delay(updated);
  },

  async updateMaintenanceStatus(role: Role, requestId: string, status: MaintenanceStatus, remarks: string): Promise<MaintenanceRequest> {
    assertPermission(role, 'maintenance:update_status');
    const endpoint = status === 'Completed' ? `/maintenance/${requestId}/complete` : `/maintenance/${requestId}/progress`;
    const body = { remarks, status: status === 'In Progress' ? 'in_progress' : 'completed' };
    const data = await backendPut<Record<string, unknown>>(endpoint, body);
    if (data) return adaptMaintenance(data);
    const index = maintenanceRequests.findIndex((r) => r.requestId === requestId || r.id === requestId);
    if (index < 0) throw new Error('Maintenance request not found.');
    const current = maintenanceRequests[index];
    if (!canTransition(current.status, status)) throw new Error(`Invalid status transition from ${current.status} to ${status}.`);
    const updated: MaintenanceRequest = {
      ...current, status,
      history: [...current.history, nextMaintenanceHistoryEntry('Service', status, remarks)]
    };
    maintenanceRequests[index] = updated;
    assets = assets.map((a) => (a.id === updated.assetId ? { ...a, status: status === 'Completed' ? 'Active' : 'Under Maintenance' } : a));
    return delay(updated);
  },

  // ── Procurement / Purchase ────────────────────────────────────────────────
  async getProcurementRequests(role: Role, labId?: string): Promise<ProcurementRequest[]> {
    const params = role === 'lab' && labId ? `?lab_id=${labId}` : '';
    const data = await backendGet<Record<string, unknown>[]>(`/purchase/orders${params}`);
    if (data) return data.map(adaptProcurement);
    if (role === 'lab') return delay(procurementRequests.filter((r) => r.requestedByLabId === labId));
    if (role === 'purchase_dept') return delay(procurementRequests.filter((r) => r.status === 'Approved by Admin' || r.status === 'Sent to Vendor'));
    return delay([...procurementRequests]);
  },

  async createProcurementRequest(role: Role, payload: { requestedByLabId: string; category: ProcurementCategory; notes?: string; items: BorrowItem[] }): Promise<ProcurementRequest> {
    assertPermission(role, 'procurement:create');
    if (payload.items.length === 0) throw new Error('At least one item is required.');
    const firstItem = payload.items[0];
    const body = { lab_id: payload.requestedByLabId, item_name: firstItem.productName, quantity: firstItem.quantity, estimated_cost: firstItem.unitCost, notes: payload.notes };
    const data = await backendPost<Record<string, unknown>>('/purchase/request', body);
    if (data) return adaptProcurement(data);
    const sequence = 5000 + procurementRequests.length + 1;
    const created: ProcurementRequest = {
      id: `pr-${Math.random().toString(36).slice(2, 8)}`, requestNo: `PR-${sequence}`,
      requestedByLabId: payload.requestedByLabId, requestedByLabName: findLabName(payload.requestedByLabId),
      category: payload.category, createdDate: new Date().toISOString().slice(0, 10),
      status: 'Pending Admin Approval', notes: payload.notes, items: payload.items
    };
    procurementRequests = [created, ...procurementRequests];
    return delay(created);
  },

  async approveProcurementRequest(role: Role, requestId: string): Promise<ProcurementRequest> {
    assertPermission(role, 'procurement:approve');
    const body = { decision: 'approved', remarks: 'Approved by admin' };
    const data = await backendPut<Record<string, unknown>>(`/purchase/${requestId}/admin-approve`, body);
    if (data) return adaptProcurement(data);
    const index = procurementRequests.findIndex((r) => r.requestNo === requestId || r.id === requestId);
    if (index < 0) throw new Error('Procurement request not found.');
    procurementRequests[index] = { ...procurementRequests[index], status: 'Approved by Admin' };
    return delay(procurementRequests[index]);
  },

  async rejectProcurementRequest(role: Role, requestId: string, remarks: string): Promise<ProcurementRequest> {
    assertPermission(role, 'procurement:approve');
    const body = { decision: 'rejected', remarks };
    const data = await backendPut<Record<string, unknown>>(`/purchase/${requestId}/admin-approve`, body);
    if (data) return adaptProcurement(data);
    const index = procurementRequests.findIndex((r) => r.requestNo === requestId || r.id === requestId);
    if (index < 0) throw new Error('Procurement request not found.');
    procurementRequests[index] = { ...procurementRequests[index], status: 'Rejected by Vendor' };
    return delay(procurementRequests[index]);
  },

  async sendProcurementToVendor(role: Role, requestId: string, vendorName: string): Promise<ProcurementRequest> {
    assertPermission(role, 'procurement:send_to_vendor');
    const body = { vendor_name: vendorName, expected_delivery: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) };
    const data = await backendPost<Record<string, unknown>>('/purchase/order', body);
    if (data) return adaptProcurement(data);
    const index = procurementRequests.findIndex((r) => r.requestNo === requestId || r.id === requestId);
    if (index < 0) throw new Error('Procurement request not found.');
    procurementRequests[index] = { ...procurementRequests[index], status: 'Sent to Vendor', vendorName };
    return delay(procurementRequests[index]);
  },

  async confirmPayment(requestId: string): Promise<ProcurementRequest> {
    const data = await backendPost<Record<string, unknown>>(`/purchase/${requestId}/confirm-payment`, {});
    if (data) return adaptProcurement(data);
    const index = procurementRequests.findIndex((r) => r.requestNo === requestId || r.id === requestId);
    if (index < 0) throw new Error('Request not found.');
    procurementRequests[index] = { ...procurementRequests[index], status: 'Accepted by Vendor' };
    return delay(procurementRequests[index]);
  },

  async uploadInvoice(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${BASE_URL}/purchase/upload-invoice`, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: formData
      });
      if (res.ok) return res.json() as Promise<{ url: string }>;
    } catch { /* fallback */ }
    return { url: '' };
  },

  async scanInvoice(file: File): Promise<Record<string, unknown>> {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${BASE_URL}/purchase/scan-invoice`, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: formData
      });
      if (res.ok) return res.json() as Promise<Record<string, unknown>>;
    } catch { /* fallback */ }
    return {};
  },

  async vendorUpdateProcurement(role: Role, requestId: string, decision: Extract<ProcurementStatus, 'Accepted by Vendor' | 'Rejected by Vendor'>): Promise<ProcurementRequest> {
    const index = procurementRequests.findIndex((r) => r.requestNo === requestId || r.id === requestId);
    if (index < 0) throw new Error('Procurement request not found.');
    procurementRequests[index] = { ...procurementRequests[index], status: decision };
    return delay(procurementRequests[index]);
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  async getNotifications(): Promise<Notification[]> {
    const data = await backendGet<Notification[]>('/notifications');
    return data ?? [];
  },

  async getUnreadCount(): Promise<number> {
    type CountResponse = { count: number };
    const data = await backendGet<CountResponse>('/notifications/unread-count');
    return data?.count ?? 0;
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    await backendPatch(`/notifications/${notificationId}/read`);
  },

  async markAllNotificationsRead(): Promise<void> {
    await backendPost('/notifications/mark-all-read', {});
  },

  async deleteNotification(notificationId: string): Promise<void> {
    await backendDelete(`/notifications/${notificationId}`);
  },

  // ── Electronics Catalog (mock only) ──────────────────────────────────────
  async getElectronicsCatalog() { return delay([...electronicsCatalog]); },

  // ── Borrow Records (mock only) ────────────────────────────────────────────
  async getBorrowRecords(role: Role, labId?: string): Promise<BorrowRecord[]> {
    assertPermission(role, 'borrow:view');
    if (role === 'lab') return delay(borrowRecords.filter((r) => r.labId === labId));
    return delay([...borrowRecords]);
  },

  async createBorrowRequest(role: Role, payload: { labId: string; studentName: string; projectName: string; dueDate: string; items: BorrowItem[] }): Promise<BorrowRecord> {
    assertPermission(role, 'borrow:create');
    if (payload.items.length === 0) throw new Error('At least one item is required.');
    const seq = 3000 + borrowRecords.length + 1;
    const created: BorrowRecord = {
      id: `br-${Math.random().toString(36).slice(2, 8)}`, borrowId: `BOR-${seq}`,
      billNo: `BILL-2026-${String(seq - 3000).padStart(3, '0')}`, invoiceNo: `INV-2026-${String(seq - 3000).padStart(3, '0')}`,
      labId: payload.labId, studentName: payload.studentName, projectName: payload.projectName,
      createdDate: new Date().toISOString().slice(0, 10), dueDate: payload.dueDate,
      status: 'Borrowed', issueUpdates: ['Issued and logged by lab assistant'], fineAmount: 0, items: payload.items
    };
    borrowRecords = [created, ...borrowRecords];
    return delay(created);
  },

  async returnBorrowItem(role: Role, borrowId: string, payload: { damaged: boolean; remark: string; returnedDate?: string }): Promise<BorrowRecord> {
    assertPermission(role, 'borrow:return');
    const index = borrowRecords.findIndex((r) => r.borrowId === borrowId);
    if (index < 0) throw new Error('Borrow record not found.');
    const current = borrowRecords[index];
    const returnedDate = payload.returnedDate ?? new Date().toISOString().slice(0, 10);
    const late = new Date(returnedDate).getTime() > new Date(current.dueDate).getTime();
    const updated: BorrowRecord = {
      ...current, status: nextBorrowStatus(current.status, payload.damaged, late),
      returnedDate, fineAmount: calculateFine(current.dueDate, returnedDate, payload.damaged),
      issueUpdates: [...current.issueUpdates, payload.remark]
    };
    borrowRecords[index] = updated;
    return delay(updated);
  },

  async getBorrowSummary(role: Role, labId?: string) {
    const rows = await this.getBorrowRecords(role, labId);
    return delay({ totalBorrowed: rows.length, pendingReturns: rows.filter((r) => r.status === 'Borrowed').length, penaltyCollected: rows.reduce((s, r) => s + r.fineAmount, 0), issuedValue: rows.reduce((s, r) => s + totalAmount(r.items), 0) });
  }
};
