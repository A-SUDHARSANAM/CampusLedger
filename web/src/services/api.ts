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
  LocationInfo,
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
import type { MapAsset } from '../components/digitalTwin/AssetNode';
import type { CampusData } from '../components/digitalTwin/CampusMap';
export type { MapAsset };

export interface BlockchainBlock {
  id: string;
  block_index: number;
  asset_id: string;
  asset_name: string;
  action: string;
  performed_by: string;
  block_hash: string;
  prev_hash: string;
  block_data: Record<string, unknown>;
  created_at: string;
}

// ── QR / RFID Tracking types ──────────────────────────────────────────────────
export interface AssetIdentifyResult {
  asset_id: string;
  asset_name: string;
  category_name: string;
  status: string;
  serial_number?: string;
  lab_name?: string;
  location_name?: string;
  condition_notes?: string;
  qr_code_b64?: string;
}

export interface VerificationLog {
  id: string;
  asset_id: string;
  asset_name: string;
  verified_by: string;
  location: string;
  scan_method: 'qr' | 'rfid' | 'manual';
  notes?: string;
  created_at: string;
}

export interface RfidTag {
  id: string;
  rfid_tag: string;
  asset_id?: string;
  asset_name: string;
  is_active: boolean;
  created_at: string;
}

export interface RfidMovement {
  id: string;
  rfid_tag: string;
  asset_id?: string;
  asset_name: string;
  from_location?: string;
  to_location: string;
  is_authorized: boolean;
  created_at: string;
}

export interface UsageSession {
  id: string;
  asset_id: string;
  asset_name: string;
  location: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  triggered_by: string;
  created_at: string;
}

// ── Configuration ─────────────────────────────────────────────────────────────
const BASE_URL = '/api/v1';
const TOKEN_STORAGE_KEY = 'campusledger_token';
const REFRESH_TOKEN_STORAGE_KEY = 'campusledger_refresh_token';
let authToken: string | null = localStorage.getItem(TOKEN_STORAGE_KEY);
let refreshToken: string | null = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);

/** Called whenever any backend request returns 401 and token refresh also fails. */
let _onUnauthorized: (() => void) | null = null;

// Prevent multiple concurrent refresh attempts
let _refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (!refreshToken) return false;
  if (_refreshPromise) return _refreshPromise;
  _refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      authToken = data.access_token;
      refreshToken = data.refresh_token;
      if (authToken) localStorage.setItem(TOKEN_STORAGE_KEY, authToken);
      if (refreshToken) localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();
  return _refreshPromise;
}

function handleUnauthorized(): never {
  _onUnauthorized?.();
  throw new Error('Session expired. Please log in again.');
}

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
    let res = await backendFetch(path);
    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        res = await backendFetch(path);
      } else {
        handleUnauthorized();
      }
    }
    if (res.status === 401) handleUnauthorized();
    if (res.ok) return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Session expired')) throw e;
    /* backend unavailable */
  }
  return null;
}

async function backendPost<T>(path: string, body: unknown): Promise<T | null> {
  try {
    let res = await backendFetch(path, { method: 'POST', body: JSON.stringify(body) });
    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        res = await backendFetch(path, { method: 'POST', body: JSON.stringify(body) });
      } else {
        handleUnauthorized();
      }
    }
    if (res.ok) return (await res.json()) as T;
  } catch { /* fallback */ }
  return null;
}

/** Like backendPost but throws a user-readable error on non-2xx responses. */
async function backendPostOrThrow<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await backendFetch(path, { method: 'POST', body: JSON.stringify(body) });
  } catch {
    throw new Error('Cannot reach the server. Make sure the backend is running on port 8000.');
  }
  if (res.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      try {
        res = await backendFetch(path, { method: 'POST', body: JSON.stringify(body) });
      } catch {
        throw new Error('Cannot reach the server. Make sure the backend is running on port 8000.');
      }
    } else {
      handleUnauthorized();
    }
  }
  if (res.status === 401) handleUnauthorized();
  const data = await res.json().catch(() => ({}));
  if (res.ok) return data as T;
  throw new Error(extractDetail(data, `Request failed (${res.status})`));
}

async function backendPut<T>(path: string, body: unknown = {}): Promise<T | null> {
  try {
    let res = await backendFetch(path, { method: 'PUT', body: JSON.stringify(body) });
    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        res = await backendFetch(path, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        handleUnauthorized();
      }
    }
    if (res.status === 401) handleUnauthorized();
    if (res.ok) return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Session expired')) throw e;
    /* fallback */
  }
  return null;
}

async function backendPatch<T>(path: string, body: unknown = {}): Promise<T | null> {
  try {
    let res = await backendFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        res = await backendFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        handleUnauthorized();
      }
    }
    if (res.status === 401) handleUnauthorized();
    if (res.ok) return (await res.json()) as T;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Session expired')) throw e;
    /* fallback */
  }
  return null;
}

async function backendDelete(path: string): Promise<boolean> {
  try {
    let res = await backendFetch(path, { method: 'DELETE' });
    if (res.status === 401) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        res = await backendFetch(path, { method: 'DELETE' });
      } else {
        handleUnauthorized();
      }
    }
    if (res.status === 401) handleUnauthorized();
    return res.ok;
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Session expired')) throw e;
    /* fallback */
  }
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
    // Display: prefer location_name, then lab_name, then raw location/lab_id
    location: String(raw.location_name ?? raw.lab_name ?? raw.location ?? raw.lab_id ?? ''),
    labId: String(raw.lab_id ?? ''),
    locationId: raw.location_id ? String(raw.location_id) : undefined,
    locationName: raw.location_name ? String(raw.location_name) : undefined,
    locationType: raw.location_type ? String(raw.location_type) : undefined,
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

function adaptCatalogItem(raw: Record<string, unknown>): ElectronicsCatalogItem {
  return {
    id: String(raw.id ?? ''),
    sku: String(raw.sku ?? raw.id ?? ''),
    name: String(raw.name ?? raw.item_name ?? ''),
    category: String(raw.category ?? ''),
    unitCost: Number(raw.unit_cost ?? raw.unitCost ?? 0),
    warrantyMonths: Number(raw.warranty_months ?? raw.warrantyMonths ?? 12),
    inStock: Number(raw.in_stock ?? raw.quantity ?? 0),
  };
}

function adaptBorrowRecord(raw: Record<string, unknown>): BorrowRecord {
  const statusMap: Record<string, BorrowStatus> = {
    borrowed: 'Borrowed',
    returned: 'Returned',
    late_return: 'Late Return',
    damaged: 'Damaged',
  };
  const rawItems = Array.isArray(raw.items) ? raw.items as Record<string, unknown>[] : [];
  return {
    id: String(raw.id ?? ''),
    borrowId: String(raw.borrow_id ?? raw.bill_no ?? raw.id ?? ''),
    billNo: String(raw.bill_no ?? ''),
    invoiceNo: String(raw.invoice_no ?? ''),
    labId: String(raw.lab_id ?? ''),
    studentName: String(raw.student_name ?? ''),
    projectName: String(raw.project_name ?? ''),
    createdDate: String((raw.created_date ?? raw.created_at ?? '').toString().slice(0, 10)),
    dueDate: String(raw.due_date ?? ''),
    returnedDate: raw.returned_date ? String(raw.returned_date) : undefined,
    status: statusMap[String(raw.status ?? '').toLowerCase()] ?? 'Borrowed',
    issueUpdates: Array.isArray(raw.issue_updates) ? (raw.issue_updates as string[]) : ['Issued by lab technician'],
    fineAmount: Number(raw.fine_amount ?? 0),
    items: rawItems.map((item) => ({
      itemId: String(item.stock_id ?? item.itemId ?? ''),
      sku: String(item.sku ?? ''),
      productName: String(item.product_name ?? item.productName ?? ''),
      quantity: Number(item.quantity ?? 1),
      unitCost: Number(item.unit_cost ?? item.unitCost ?? 0),
      warrantyMonths: Number(item.warranty_months ?? item.warrantyMonths ?? 12),
    })),
  };
}

function adaptUser(raw: Record<string, unknown>): UserRecord {
  return {
    id: String(raw.id ?? ''),
    name: String(raw.full_name ?? raw.name ?? raw.email ?? ''),
    role: toAppRole(String(raw.role ?? '')),
    email: String(raw.email ?? ''),
    assignedLab: String(raw.lab_id ?? 'N/A'),
    department: raw.department_name ? String(raw.department_name) : undefined,
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
    issue: String(raw.description ?? raw.issue_description ?? ''),
    issueType: raw.issue_type ? String(raw.issue_type) : 'service_request',
    createdAt: raw.created_at ? String(raw.created_at).slice(0, 10) : undefined,
    qrCode: raw.qr_code ? String(raw.qr_code) : undefined,
    history: []
  };
}

function adaptProcurement(raw: Record<string, unknown>): ProcurementRequest {
  const statusMap: Record<string, ProcurementStatus> = {
    pending_review: 'Pending Admin Approval',
    approved: 'Approved by Admin',
    rejected: 'Rejected by Purchase Dept',
    ordered: 'Sent to Purchase Dept',
    payment_confirmed: 'Accepted by Purchase Dept',
    delivered: 'Accepted by Purchase Dept'
  };
  return {
    id: String(raw.id ?? ''),
    requestNo: String(raw.id ?? ''),
    requestedByLabId: String(raw.lab_id ?? ''),
    requestedByLabName: String(raw.lab_name ?? raw.lab_id ?? ''),
    category: 'Purchase',
    createdDate: String((raw.created_at as string | undefined)?.slice(0, 10) ?? ''),
    status: statusMap[String(raw.status ?? '')] ?? 'Pending Admin Approval',
    purchaseDepartmentName: raw.purchase_department_name ? String(raw.purchase_department_name) : undefined,
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

  setRefreshToken(token: string | null) {
    refreshToken = token;
    if (token) localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  },

  /** Register a callback to be invoked when any request returns 401 (session expired). */
  onUnauthorized(cb: () => void) { _onUnauthorized = cb; },

  // ── Auth ─────────────────────────────────────────────────────────────────
  async login(email: string, password: string, _selectedRole?: Role): Promise<{ token: string; refreshToken: string; user: User }> {
    const res = await backendFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(extractDetail(data, 'Invalid email or password.'));
    const role = toAppRole(data.user?.role ?? '');
    return {
      token: data.access_token,
      refreshToken: data.refresh_token,
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
    type Summary = {
      total_assets: number; active_assets: number; damaged_assets: number;
      under_maintenance: number; cancelled_assets: number;
      pending_maintenance: number; total_users: number; labs_count: number;
    };
    const data = await backendGet<Summary>('/analytics/summary');
    if (data) {
      return {
        totalAssets: data.total_assets, activeAssets: data.active_assets,
        damagedAssets: data.damaged_assets, underMaintenance: data.under_maintenance,
        cancelledAssets: data.cancelled_assets, pendingRequests: data.pending_maintenance,
        totalUsers: data.total_users, labs: data.labs_count
      };
    }
    return { totalAssets: 0, activeAssets: 0, damagedAssets: 0, underMaintenance: 0, cancelledAssets: 0, pendingRequests: 0, totalUsers: 0, labs: 0 };
  },

  async getLabKpis() { return delay(labKpis); },

  async getServiceKpis() {
    // Derive live from real maintenance data so the service dashboard is always accurate
    const tasks = await this.getMaintenanceRequests('service');
    if (tasks.length > 0) {
      return {
        assignedTasks: tasks.length,
        pending:    tasks.filter((r) => r.status === 'Pending').length,
        inProgress: tasks.filter((r) => r.status === 'In Progress').length,
        completed:  tasks.filter((r) => r.status === 'Completed').length,
      };
    }
    return delay(serviceKpis);
  },

  async getAnalyticsDashboard() {
    type ChartPoint = { label: string; value: number };
    type Dashboard = {
      asset_kpis: {
        total_assets: number; active_assets: number; damaged_assets: number;
        under_maintenance: number; cancelled_assets: number;
        pending_maintenance: number; total_users: number; labs_count: number;
      };
      assets_by_location: ChartPoint[];
      asset_category_distribution: ChartPoint[];
      monthly_procurement_trend: ChartPoint[];
      maintenance_status_distribution: ChartPoint[];
      feedback_ratings_distribution: ChartPoint[];
      maintenance_frequency: ChartPoint[];
      feedback_analysis: ChartPoint[];
      financial_status_prediction: ChartPoint[];
    };
    const data = await backendGet<Dashboard>('/analytics/dashboard');
    return data ?? null;
  },

  async getAssetCategoryChart() {
    const dash = await this.getAnalyticsDashboard();
    if (dash?.asset_category_distribution?.length) return dash.asset_category_distribution;
    return delay([{ label: 'Computer', value: 62 }, { label: 'Lab Equipment', value: 38 }]);
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
    if (role === 'lab') return delay(labId ? assets.filter((a) => a.labId === labId) : [...assets]);
    return delay([...assets]);
  },

  async getAssetCategories(): Promise<{ id: string; category_name: string }[]> {
    const data = await backendGet<{ id: string; category_name: string }[]>('/assets/categories');
    return data ?? [];
  },

  async createAsset(role: Role, payload: Omit<Asset, 'id'>): Promise<Asset> {
    assertPermission(role, 'asset:create');
    // Only send lab_id / location_id if they are real UUIDs (not mock fallbacks like 'lab-cs-1')
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const labId = payload.labId && UUID_RE.test(payload.labId) ? payload.labId : undefined;
    const locationId = payload.locationId && UUID_RE.test(payload.locationId) ? payload.locationId : undefined;
    const body: Record<string, unknown> = {
      asset_name: payload.name,
      category: payload.category,
      lab_id: labId,
      location_id: locationId,
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
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const body: Record<string, unknown> = {};
    if (changes.name) body.asset_name = changes.name;
    if (changes.status) body.status = changes.status.toLowerCase().replace(' ', '_');
    if (changes.labId && UUID_RE.test(changes.labId)) body.lab_id = changes.labId;
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
    if (data && data.length > 0) return data.map(adaptLab);
    // Seed fallback so the dropdown always has options even when the backend
    // or DB is unreachable. IDs are non-UUID — fine for display only.
    return labs.map((l) => ({ ...l }));
  },

  async getDepartments(): Promise<{ id: string; name: string }[]> {
    const data = await backendGet<{ id: string; department_name: string }[]>('/labs/departments');
    return (data ?? []).map((d) => ({ id: d.id, name: d.department_name }));
  },

  async getLocations(): Promise<LocationInfo[]> {
    const data = await backendGet<LocationInfo[]>('/locations');
    if (data && data.length > 0) return data;
    // Seed fallback — covers common campus locations (academic + non-academic)
    // so the Add-Asset dropdown is never blank when the backend/DB is offline.
    return [
      { id: 'loc-academic-cs',   name: 'CS Lab Block',                 type: 'academic' },
      { id: 'loc-academic-sci',  name: 'Science & Engineering Block',  type: 'academic' },
      { id: 'loc-academic-lib',  name: 'Main Library',                 type: 'academic' },
      { id: 'loc-academic-lec',  name: 'Lecture Hall Complex',         type: 'academic' },
      { id: 'loc-academic-res',  name: 'Research Centre',              type: 'academic' },
      { id: 'loc-nonacad-admin', name: 'Administrative Office',        type: 'non_academic' },
      { id: 'loc-nonacad-cafe',  name: 'Student Cafeteria',            type: 'non_academic' },
      { id: 'loc-nonacad-sport', name: 'Sports Facility',              type: 'non_academic' },
      { id: 'loc-nonacad-work',  name: 'Workshop & Maintenance Block', type: 'non_academic' },
      { id: 'loc-nonacad-host',  name: 'Hostel Complex',               type: 'non_academic' },
    ];
  },

  async getLocationAssets(locationId: string): Promise<{ id: string; name: string; assetCode?: string }[]> {
    const data = await backendGet<{ id: string; asset_name: string; status: string; serial_number?: string }[]>(
      `/locations/${locationId}/assets`
    );
    if (!data) return [];
    return data.map((a) => ({ id: a.id, name: a.asset_name, assetCode: a.serial_number }));
  },

  async getLocationAnalytics(): Promise<{
    byType: { label: string; value: number }[];
    byFacility: { label: string; value: number }[];
    maintenanceByLocation: { label: string; value: number }[];
  }> {
    const [byType, byFacility, byLoc] = await Promise.all([
      backendGet<{ label: string; value: number }[]>('/analytics/assets-by-location-type'),
      backendGet<{ label: string; value: number }[]>('/analytics/assets-by-facility'),
      backendGet<{ label: string; value: number }[]>('/analytics/maintenance-by-location'),
    ]);
    return {
      byType: byType ?? [],
      byFacility: byFacility ?? [],
      maintenanceByLocation: byLoc ?? [],
    };
  },

  async createLab(role: Role, payload: { lab_name: string; department_id: string; location: string }): Promise<LabInfo> {
    if (role !== 'admin') throw new Error('Permission denied.');
    const data = await backendPost<Record<string, unknown>>('/labs', payload);
    if (data) return adaptLab(data);
    const created: LabInfo = { id: `lab-${Math.random().toString(36).slice(2, 8)}`, name: payload.lab_name, department: '', assetCount: 0, incharge: '' };
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

  async getServiceStaff(): Promise<UserRecord[]> {
    const data = await backendGet<Record<string, unknown>[]>('/users?role=service_staff');
    if (data) return data.map(adaptUser);
    return delay(users.filter((u) => u.role === 'service'));
  },

  async getStaffRecommendations(
    issue: string,
    priority: string,
    assetType?: string,
  ): Promise<Array<{
    user_id: string;
    name: string;
    email: string;
    completed_count: number;
    active_count: number;
    matched_keywords: string[];
    score: number;
    reason: string;
  }>> {
    const params = new URLSearchParams({ issue, priority });
    if (assetType) params.set('asset_type', assetType);
    type StaffRec = {
      user_id: string; name: string; email: string;
      completed_count: number; active_count: number;
      matched_keywords: string[]; score: number; reason: string;
    };
    const data = await backendGet<StaffRec[]>(`/maintenance/staff-recommendations?${params.toString()}`);
    if (data && data.length > 0) return data;
    // Fallback: return all service staff with neutral score
    const allStaff = await this.getServiceStaff();
    return allStaff.map((s, i) => ({
      user_id: s.id,
      name: s.name,
      email: s.email,
      completed_count: 0,
      active_count: 0,
      matched_keywords: [],
      score: allStaff.length - i,
      reason: 'Available service staff',
    }));
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

  async raiseMaintenanceRequest(role: Role, payload: { assetId: string; labId: string; issue: string; priority: Priority; issueType?: string }): Promise<MaintenanceRequest> {
    assertPermission(role, 'maintenance:raise');
    const body = { asset_id: payload.assetId, description: payload.issue, priority: payload.priority.toLowerCase(), issue_type: payload.issueType ?? 'service_request' };
    const data = await backendPostOrThrow<Record<string, unknown>>('/maintenance/report', body);
    return adaptMaintenance(data);
  },

  async assignMaintenanceRequest(role: Role, requestId: string, assignee: string): Promise<MaintenanceRequest> {
    assertPermission(role, 'maintenance:assign');
    const data = await backendPut<Record<string, unknown>>(`/maintenance/${requestId}/assign`, { assigned_to_id: assignee });
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
    const body = status === 'Completed' ? {} : { notes: remarks };
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

  /** Fetch the QR code for an assigned maintenance request (admin only). */
  async getMaintenanceQR(requestId: string): Promise<{ request_id: string; qr_base64: string } | null> {
    return backendGet<{ request_id: string; qr_base64: string }>(`/maintenance/${requestId}/qr`);
  },

  /**
   * Submit a QR scan result to mark a maintenance request as completed.
   * Called by the service staff after scanning the QR code on-site.
   */
  async scanMaintenanceQR(
    issueId: string,
    assetId: string,
    staffId: string,
  ): Promise<{ message: string; request_id: string }> {
    return backendPostOrThrow<{ message: string; request_id: string }>('/qr/scan', {
      issue_id: issueId,
      asset_id: assetId,
      staff_id: staffId,
    });
  },

  // ── Procurement / Purchase ────────────────────────────────────────────────
  async getProcurementRequests(role: Role, labId?: string): Promise<ProcurementRequest[]> {
    const params = role === 'lab' && labId ? `?lab_id=${labId}` : '';
    const data = await backendGet<Record<string, unknown>[]>(`/purchase/orders${params}`);
    if (data) return data.map(adaptProcurement);
    if (role === 'lab') return delay(procurementRequests.filter((r) => r.requestedByLabId === labId));
    if (role === 'purchase_dept') return delay(procurementRequests.filter((r) => r.status === 'Approved by Admin' || r.status === 'Sent to Purchase Dept'));
    return delay([...procurementRequests]);
  },

  async createProcurementRequest(role: Role, payload: { requestedByLabId: string; category: ProcurementCategory; notes?: string; items: BorrowItem[] }): Promise<ProcurementRequest> {
    assertPermission(role, 'procurement:create');
    if (payload.items.length === 0) throw new Error('At least one item is required.');
    // Submit one backend purchase_request row per cart item so every item is
    // individually visible to the admin.  All rows share the same notes / lab.
    const created: ProcurementRequest[] = [];
    for (const item of payload.items) {
      const body = {
        item_name:      item.productName,
        quantity:       item.quantity,
        estimated_cost: item.unitCost,
        notes:          payload.notes,
        lab_id:         payload.requestedByLabId,
      };
      const data = await backendPostOrThrow<Record<string, unknown>>('/purchase/request', body);
      created.push(adaptProcurement(data));
    }
    return created[0];
  },

  async approveProcurementRequest(role: Role, requestId: string): Promise<ProcurementRequest> {
    assertPermission(role, 'procurement:approve');
    const body = { approved: true, notes: 'Approved by admin' };
    const data = await backendPut<Record<string, unknown>>(`/purchase/${requestId}/admin-approve`, body);
    if (data) return adaptProcurement(data);
    const index = procurementRequests.findIndex((r) => r.requestNo === requestId || r.id === requestId);
    if (index < 0) throw new Error('Procurement request not found.');
    procurementRequests[index] = { ...procurementRequests[index], status: 'Approved by Admin' };
    return delay(procurementRequests[index]);
  },

  async rejectProcurementRequest(role: Role, requestId: string, remarks: string): Promise<ProcurementRequest> {
    assertPermission(role, 'procurement:approve');
    const body = { approved: false, notes: remarks };
    const data = await backendPut<Record<string, unknown>>(`/purchase/${requestId}/admin-approve`, body);
    if (data) return adaptProcurement(data);
    const index = procurementRequests.findIndex((r) => r.requestNo === requestId || r.id === requestId);
    if (index < 0) throw new Error('Procurement request not found.');
    procurementRequests[index] = { ...procurementRequests[index], status: 'Rejected by Purchase Dept' };
    return delay(procurementRequests[index]);
  },

  async sendProcurementToPurchaseDept(role: Role, requestId: string, purchaseDepartmentName: string): Promise<ProcurementRequest> {
    assertPermission(role, 'procurement:send_to_purchase_dept');
    const body = { request_id: requestId, purchase_department_name: purchaseDepartmentName, expected_delivery_date: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) };
    const data = await backendPost<Record<string, unknown>>('/purchase/order', body);
    if (data) return adaptProcurement(data);
    const index = procurementRequests.findIndex((r) => r.requestNo === requestId || r.id === requestId);
    if (index < 0) throw new Error('Procurement request not found.');
    procurementRequests[index] = { ...procurementRequests[index], status: 'Sent to Purchase Dept', purchaseDepartmentName };
    return delay(procurementRequests[index]);
  },

  async confirmPayment(requestId: string): Promise<ProcurementRequest> {
    const data = await backendPost<Record<string, unknown>>(`/purchase/${requestId}/confirm-payment`, {});
    if (data) return adaptProcurement(data);
    const index = procurementRequests.findIndex((r) => r.requestNo === requestId || r.id === requestId);
    if (index < 0) throw new Error('Request not found.');
    procurementRequests[index] = { ...procurementRequests[index], status: 'Accepted by Purchase Dept' };
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

  async ocrScan(file: File): Promise<{ text: string; detected_fields: { asset_name?: string; serial_number?: string; model?: string; quantity?: number; price?: number; purchase_department?: string; purchase_date?: string }; message?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/ocr/scan`, {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      body: formData
    });
    if (res.ok) return res.json();
    const errBody = await res.json().catch(() => null);
    const detail = errBody?.detail ?? `OCR request failed (HTTP ${res.status})`;
    throw new Error(detail);
  },

  async rfidScan(tagId: string): Promise<{ id: string; name: string; status: string; serial_number?: string; location?: string } | null> {
    const data = await backendPost<{ id: string; name: string; status: string; serial_number?: string; location?: string }>(
      '/digital-twin/rfid/scan',
      { tag_id: tagId }
    );
    return data ?? null;
  },

  async purchaseDeptUpdateProcurement(role: Role, requestId: string, decision: Extract<ProcurementStatus, 'Accepted by Purchase Dept' | 'Rejected by Purchase Dept'>): Promise<ProcurementRequest> {
    if (decision === 'Accepted by Purchase Dept') {
      const data = await backendPost<Record<string, unknown>>(`/purchase/${requestId}/confirm-payment`, {});
      if (data) return adaptProcurement(data);
    }
    const index = procurementRequests.findIndex((r) => r.requestNo === requestId || r.id === requestId);
    if (index < 0) throw new Error('Procurement request not found.');
    procurementRequests[index] = { ...procurementRequests[index], status: decision };
    return delay(procurementRequests[index]);
  },

  // ── Notifications ─────────────────────────────────────────────────────────
  async getNotifications(): Promise<Notification[]> {
    type RawNotif = { id: string; user_id: string; message: string; status: string; created_at: string };
    const data = await backendGet<RawNotif[]>('/notifications');
    if (!data) return [];
    return data.map((n) => ({
      id: n.id,
      user_id: n.user_id,
      title: n.message,
      body: '',
      is_read: n.status === 'read',
      created_at: n.created_at,
    }));
  },

  async getUnreadCount(): Promise<number> {
    type CountResponse = { unread_count: number };
    const data = await backendGet<CountResponse>('/notifications/unread-count');
    return data?.unread_count ?? 0;
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

  // ── Electronics Catalog ──────────────────────────────────────────────────
  async getElectronicsCatalog(labId?: string): Promise<ElectronicsCatalogItem[]> {
    const params = labId ? `?lab_id=${labId}` : '';
    const data = await backendGet<Record<string, unknown>[]>(`/borrow/catalog${params}`);
    if (data && data.length > 0) return data.map(adaptCatalogItem);
    // Fallback to mock when backend catalog is empty or unavailable
    return delay([...electronicsCatalog]);
  },

  // ── Borrow Records ────────────────────────────────────────────────────────
  async getBorrowRecords(role: Role, labId?: string): Promise<BorrowRecord[]> {
    assertPermission(role, 'borrow:view');
    const params = role === 'lab' && labId ? `?lab_id=${labId}` : '';
    const data = await backendGet<Record<string, unknown>[]>(`/borrow/records${params}`);
    if (data) return data.map(adaptBorrowRecord);
    if (role === 'lab') return delay(borrowRecords.filter((r) => r.labId === labId));
    return delay([...borrowRecords]);
  },

  async createBorrowRequest(role: Role, payload: { labId: string; studentName: string; projectName: string; dueDate: string; items: BorrowItem[] }): Promise<BorrowRecord> {
    assertPermission(role, 'borrow:create');
    if (payload.items.length === 0) throw new Error('At least one item is required.');
    const body = {
      lab_id: payload.labId,
      student_name: payload.studentName,
      project_name: payload.projectName,
      due_date: payload.dueDate,
      items: payload.items.map((item) => ({
        stock_id: item.itemId || null,
        sku: item.sku,
        product_name: item.productName,
        quantity: item.quantity,
        unit_cost: item.unitCost,
        warranty_months: item.warrantyMonths,
      })),
    };
    const data = await backendPost<Record<string, unknown>>('/borrow/records', body);
    if (data) return adaptBorrowRecord(data);
    // Mock fallback
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
    // borrowId here could be the DB UUID (id) or the human-readable BOR-xxxx
    // Try to find the real UUID from current records
    const allRecords = await this.getBorrowRecords(role);
    const record = allRecords.find((r) => r.borrowId === borrowId || r.id === borrowId);
    const realId = record?.id ?? borrowId;
    const returnedDate = payload.returnedDate ?? new Date().toISOString().slice(0, 10);
    const body = { damaged: payload.damaged, remark: payload.remark, returned_date: returnedDate };
    const data = await backendPut<Record<string, unknown>>(`/borrow/records/${realId}/return`, body);
    if (data) return adaptBorrowRecord(data);
    // Mock fallback
    const index = borrowRecords.findIndex((r) => r.borrowId === borrowId || r.id === borrowId);
    if (index < 0) throw new Error('Borrow record not found.');
    const current = borrowRecords[index];
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
  },

  // ── Student Queries (public — no auth required) ───────────────────────────

  async getTopHelpfulStudents(): Promise<{ student_name: string; student_id: string; points: number }[]> {
    const data = await backendGet<{ student_name: string; student_id: string; points: number }[]>(
      '/analytics/top-helpful-students'
    );
    return data ?? [];
  },

  async getPublicLabs(): Promise<{ id: string; lab_name: string }[]> {
    const data = await backendGet<{ id: string; lab_name: string }[]>('/student-queries/public/labs');
    return data ?? [];
  },

  async getPublicAssets(labId: string): Promise<{ id: string; asset_name: string }[]> {
    const data = await backendGet<{ id: string; asset_name: string }[]>(
      `/student-queries/public/assets?lab_id=${encodeURIComponent(labId)}`
    );
    return data ?? [];
  },

  async submitStudentQuery(body: {
    student_name: string;
    student_id: string;
    department: string;
    lab_id: string;
    asset_id?: string;
    issue_description: string;
    priority: string;
  }): Promise<void> {
    await backendPostOrThrow('/student-queries/', body);
  },

  async getTechnicianStudentQueries(technicianId: string): Promise<Record<string, unknown>[]> {
    const data = await backendGet<Record<string, unknown>[]>(
      `/technician/student-queries/${encodeURIComponent(technicianId)}`
    );
    return data ?? [];
  },

  async reviewStudentQuery(queryId: string, decision: 'valid' | 'invalid'): Promise<void> {
    await backendPut(`/student-queries/${encodeURIComponent(queryId)}/review`, { decision });
  },

  async convertQueryToMaintenance(queryId: string): Promise<void> {
    await backendPostOrThrow(`/student-queries/${encodeURIComponent(queryId)}/convert-to-maintenance`, {});
  },

  // ── ML Inventory Demand Prediction ───────────────────────────────────────
  //
  // Per-item base demand (annual average) derived from the seed training data
  // that was used to fit the RandomForest model in ml/seed_and_train.py.
  // These match the model output closely for all 12 months.
  //
  // Seasonal factors (index 0 = January) capture the quarter-end peaks
  // observed in the seed data.
  async predictDemand(
    month: number,
    itemId: string,
    currentStock: number,
  ): Promise<{ predicted_demand: number; reorder_level: number; reorder_alert: boolean }> {
    const SAFETY_STOCK = 10;

    // -- Try backend first (returns real RandomForest predictions when server is up) --
    const data = await backendGet<{ predicted_demand: number; reorder_level: number; reorder_alert: boolean }>(
      `/predict-demand?month=${month}&item_id=${encodeURIComponent(itemId)}&current_stock=${currentStock}`
    );
    if (data) return data;

    // -- Local fallback: approximate the trained model using per-item averages
    //    + the seasonal pattern extracted from the seed training data.
    //    Seasonal factors tuned so April (idx 3, factor 0.97) matches the
    //    model's actual April predictions to within <5%.
    const BASE: Record<string, number> = {
      '1': 27.5,  // HDMI Cable
      '2': 13.5,  // Keyboard
      '3': 12.5,  // Mouse
      '4':  7.0,  // Network Switch
      '5':  4.0,  // Projector Bulb
      '6': 10.5,  // USB Hub
    };
    const SEASONAL = [0.78, 0.91, 1.05, 0.97, 0.82, 1.15, 1.08, 0.96, 1.23, 1.35, 1.46, 1.62];
    const base = BASE[itemId] ?? (12 + ((parseInt(itemId, 10) || 1) % 8) * 3);
    const factor = SEASONAL[(month - 1) % 12];
    const predicted_demand = Math.round(base * factor * 10) / 10;
    const reorder_level = predicted_demand + SAFETY_STOCK;
    const reorder_alert = currentStock < reorder_level;
    return { predicted_demand, reorder_level, reorder_alert };
  },

  async getInventoryItems(): Promise<{ id: string; name: string; current_stock: number }[]> {
    const data = await backendGet<Record<string, unknown>[]>('/assets/categories');
    if (data && data.length > 0) {
      return data.map((item) => ({
        id: String(item.id ?? ''),
        name: String(item.name ?? item.category_name ?? ''),
        current_stock: Number(item.current_stock ?? item.quantity ?? item.total_quantity ?? 10),
      }));
    }
    // Fallback: derive from assets count by category
    const assets = await backendGet<Record<string, unknown>[]>('/assets');
    if (assets && assets.length > 0) {
      const map = new Map<string, { id: string; name: string; count: number }>();
      for (const a of assets) {
        const catId = String(a.category_id ?? a.category ?? a.id ?? '');
        const catName = String(a.category ?? a.asset_type ?? a.type ?? 'Unknown');
        if (!map.has(catId)) map.set(catId, { id: catId, name: catName, count: 0 });
        map.get(catId)!.count += 1;
      }
      return Array.from(map.values()).map((e) => ({ id: e.id, name: e.name, current_stock: e.count }));
    }
    // ── Demo / seed fallback ─────────────────────────────────────────────────
    // These 6 items match the seed training data in migration 005 so the ML
    // model always returns real predictions, even before the DB migration runs.
    // Stock values are chosen to show all three risk levels in the UI:
    //   HDMI Cable & Network Switch  → Reorder Required  (stock < reorder_level * 0.5)
    //   Mouse & USB Hub              → Low Stock         (stock in [reorder_level*0.5, reorder_level))
    //   Keyboard & Projector Bulb    → Safe              (stock >= reorder_level)
    return [
      { id: '1', name: 'HDMI Cable',      current_stock: 15 },  // Reorder
      { id: '2', name: 'Keyboard',         current_stock: 30 },  // Safe
      { id: '3', name: 'Mouse',            current_stock: 14 },  // Low
      { id: '4', name: 'Network Switch',   current_stock: 5  },  // Reorder
      { id: '5', name: 'Projector Bulb',   current_stock: 20 },  // Safe
      { id: '6', name: 'USB Hub',          current_stock: 12 },  // Low
    ];
  },

  // ------------------------------------------------------------------
  // Bulk predictions — calls the single /inventory/predictions endpoint
  // which does everything server-side (categories + stock counts + ML).
  // Falls back to the two-step local approach when the backend is down.
  // ------------------------------------------------------------------
  async getInventoryPredictions(month?: number): Promise<Array<{
    id: string;
    name: string;
    current_stock: number;
    predicted_demand: number;
    reorder_level: number;
    reorder_alert: boolean;
    suggested_order: number;
    risk: 'safe' | 'low' | 'reorder';
  }>> {
    const nextMonth = month ?? (new Date().getMonth() + 2);

    type BulkRow = {
      item_id: number;
      item_name: string;
      current_stock: number;
      predicted_demand: number;
      reorder_level: number;
      reorder_alert: boolean;
      suggested_order: number;
    };

    const data = await backendGet<BulkRow[]>(
      `/inventory/predictions${month ? `?month=${month}` : ''}`,
    );

    if (data && data.length > 0) {
      return data.map((row) => {
        const risk: 'safe' | 'low' | 'reorder' =
          row.current_stock >= row.reorder_level
            ? 'safe'
            : row.current_stock >= row.reorder_level * 0.5
            ? 'low'
            : 'reorder';
        return {
          id: String(row.item_id),
          name: row.item_name,
          current_stock: row.current_stock,
          predicted_demand: row.predicted_demand,
          reorder_level: row.reorder_level,
          reorder_alert: row.reorder_alert,
          suggested_order: row.suggested_order,
          risk,
        };
      });
    }

    // Local fallback — use seed items + per-item seasonal approximation
    const items = await this.getInventoryItems();
    const predictions = await Promise.all(
      items.slice(0, 20).map(async (item) => {
        const pred = await this.predictDemand(nextMonth, item.id, item.current_stock);
        const risk: 'safe' | 'low' | 'reorder' =
          item.current_stock >= pred.reorder_level
            ? 'safe'
            : item.current_stock >= pred.reorder_level * 0.5
            ? 'low'
            : 'reorder';
        return {
          id: item.id,
          name: item.name,
          current_stock: item.current_stock,
          ...pred,
          suggested_order: Math.max(0, Math.ceil(pred.reorder_level) - item.current_stock),
          risk,
        };
      }),
    );
    return predictions;
  },

  async generatePurchaseRequestML(itemId: string, itemName: string, quantity: number): Promise<void> {
    await backendPostOrThrow('/purchase/request', {
      item_name: itemName,
      quantity,
      notes: 'Auto-generated from ML demand prediction',
    });
  },

  async triggerReorderAlert(item: {
    item_id: string;
    item_name: string;
    current_stock: number;
    suggested_order: number;
    reorder_level: number;
  }): Promise<{ ok: boolean; message: string }> {
    const data = await backendPostOrThrow<{ ok: boolean; message: string }>(
      '/inventory/reorder-alert',
      item,
    );
    return data ?? { ok: true, message: 'Alert sent.' };
  },

  // ── Device Health Monitoring ──────────────────────────────────────────────
  async getDeviceHealth(labId?: string): Promise<import('../components/deviceMonitoring/DeviceHealthDashboard').DeviceHealth[]> {
    const path = labId ? `/device-health/lab/${labId}` : '/device-health';
    const data = await backendGet<import('../components/deviceMonitoring/DeviceHealthDashboard').DeviceHealth[]>(path);
    return data ?? [];
  },

  // ── Digital Twin Map ─────────────────────────────────────────────────────
  async getDigitalTwinAssets(params?: { labId?: string; department?: string; asset_type?: string }): Promise<MapAsset[]> {
    const qs = new URLSearchParams();
    if (params?.labId)      qs.set('lab_id',    params.labId);
    if (params?.department) qs.set('department', params.department);
    if (params?.asset_type) qs.set('asset_type', params.asset_type);
    const path = `/digital-twin/assets${qs.toString() ? `?${qs}` : ''}`;
    const data = await backendGet<MapAsset[]>(path);
    return data ?? [];
  },

  async getCampus(): Promise<CampusData> {
    const data = await backendGet<CampusData>('/digital-twin/campus');
    return data ?? { buildings: [] };
  },

  // ── Blockchain Audit Trail ────────────────────────────────────────────────
  async getBlockchainLedger(params?: {
    limit?: number;
    offset?: number;
    action?: string;
  }): Promise<BlockchainBlock[]> {
    const qs = new URLSearchParams();
    if (params?.limit  != null) qs.set('limit',  String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    if (params?.action)         qs.set('action', params.action);
    const path = `/blockchain/ledger${qs.toString() ? `?${qs}` : ''}`;
    const data = await backendGet<BlockchainBlock[]>(path);
    return data ?? [];
  },

  async getBlockchainAssetHistory(assetId: string): Promise<BlockchainBlock[]> {
    const data = await backendGet<BlockchainBlock[]>(`/blockchain/asset/${assetId}`);
    return data ?? [];
  },

  async verifyBlockchain(): Promise<{ intact: boolean; total_blocks: number; first_broken_index: number | null; message: string }> {
    const data = await backendGet<{ intact: boolean; total_blocks: number; first_broken_index: number | null; message: string }>('/blockchain/verify');
    return data ?? { intact: false, total_blocks: 0, first_broken_index: null, message: 'Verification failed.' };
  },

  // ── QR Tracking ──────────────────────────────────────────────────────────
  async identifyAsset(assetId: string): Promise<AssetIdentifyResult | null> {
    return backendGet<AssetIdentifyResult>(`/qr-track/asset/${assetId}`);
  },

  async getAssetQrCode(assetId: string): Promise<{ asset_id: string; qr_code_b64: string } | null> {
    return backendGet<{ asset_id: string; qr_code_b64: string }>(`/qr-track/asset/${assetId}/code`);
  },

  async verifyAsset(payload: { asset_id: string; verified_by: string; location: string; scan_method: string; notes?: string }): Promise<VerificationLog | null> {
    return backendPost<VerificationLog>('/qr-track/verify', payload);
  },

  async getVerificationLogs(params?: { asset_id?: string; limit?: number }): Promise<VerificationLog[]> {
    const qs = new URLSearchParams();
    if (params?.asset_id) qs.set('asset_id', params.asset_id);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    const path = `/qr-track/verifications${qs.toString() ? `?${qs}` : ''}`;
    const data = await backendGet<VerificationLog[]>(path);
    return data ?? [];
  },

  // ── RFID Tracking ─────────────────────────────────────────────────────────
  async rfidScan(payload: { rfid_tag: string; reader_location: string; reader_id?: string }): Promise<RfidMovement> {
    return backendPostOrThrow<RfidMovement>('/rfid/scan', payload);
  },

  async getRfidMovements(params?: { asset_id?: string; unauthorized_only?: boolean; limit?: number }): Promise<RfidMovement[]> {
    const qs = new URLSearchParams();
    if (params?.asset_id) qs.set('asset_id', params.asset_id);
    if (params?.unauthorized_only) qs.set('unauthorized_only', 'true');
    if (params?.limit != null) qs.set('limit', String(params.limit));
    const path = `/rfid/movements${qs.toString() ? `?${qs}` : ''}`;
    const data = await backendGet<RfidMovement[]>(path);
    return data ?? [];
  },

  async getRfidAlerts(): Promise<RfidMovement[]> {
    const data = await backendGet<RfidMovement[]>('/rfid/alerts');
    return data ?? [];
  },

  async getRfidTags(): Promise<RfidTag[]> {
    const data = await backendGet<RfidTag[]>('/rfid/tags');
    return data ?? [];
  },

  async registerRfidTag(payload: { rfid_tag: string; asset_id: string; asset_name?: string }): Promise<RfidTag> {
    return backendPostOrThrow<RfidTag>('/rfid/tags', payload);
  },

  async getUsageSessions(params?: { asset_id?: string; limit?: number }): Promise<UsageSession[]> {
    const qs = new URLSearchParams();
    if (params?.asset_id) qs.set('asset_id', params.asset_id);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    const path = `/rfid/usage${qs.toString() ? `?${qs}` : ''}`;
    const data = await backendGet<UsageSession[]>(path);
    return data ?? [];
  },

  async startUsageSession(payload: { asset_id: string; location: string; triggered_by?: string }): Promise<UsageSession | null> {
    return backendPost<UsageSession>('/rfid/usage/start', payload);
  },

  async endUsageSession(usageLogId: string): Promise<UsageSession | null> {
    return backendPost<UsageSession>('/rfid/usage/end', { usage_log_id: usageLogId });
  },
};
