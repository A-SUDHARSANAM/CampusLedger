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
  // Extended backend fields
  serialNumber?: string;
  conditionRating?: number;
  qrCode?: string;
  purchaseDate?: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
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
  department?: string;
  is_approved?: boolean;
  status?: 'pending' | 'approved' | 'suspended';
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
  assignedTo?: string;      // UUID of assigned service_staff user
  assignedToName?: string;  // resolved display name
  priority: Priority;
  issue: string;
  createdAt?: string;
  history: MaintenanceHistoryEntry[];
};

export type BorrowStatus = 'Borrowed' | 'Returned' | 'Late Return' | 'Damaged';
export type ProcurementCategory = 'Purchase' | 'Service';
export type ProcurementStatus =
  | 'Pending Admin Approval'
  | 'Approved by Admin'
  | 'Sent to Vendor'
  | 'Accepted by Vendor'
  | 'Rejected by Vendor'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'ordered'
  | 'payment_confirmed'
  | 'delivered';

export type ElectronicsCatalogItem = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unitCost: number;
  warrantyMonths: number;
  inStock: number;
};

export type BorrowItem = {
  itemId: string;
  sku: string;
  productName: string;
  quantity: number;
  unitCost: number;
  warrantyMonths: number;
};

export type BorrowRecord = {
  id: string;
  borrowId: string;
  billNo: string;
  invoiceNo: string;
  labId: string;
  studentName: string;
  projectName: string;
  createdDate: string;
  dueDate: string;
  returnedDate?: string;
  status: BorrowStatus;
  issueUpdates: string[];
  fineAmount: number;
  items: BorrowItem[];
};

export type ProcurementRequest = {
  id: string;
  requestNo: string;
  requestedByLabId: string;
  requestedByLabName: string;
  category: ProcurementCategory;
  createdDate: string;
  status: ProcurementStatus;
  vendorName?: string;
  notes?: string;
  items: BorrowItem[];
};
