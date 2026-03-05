import type { Role } from '../types/auth';

export type PermissionAction =
  | 'asset:create'
  | 'asset:edit'
  | 'asset:delete'
  | 'asset:assign_lab'
  | 'asset:view_lab_only'
  | 'maintenance:raise'
  | 'maintenance:assign'
  | 'maintenance:update_status'
  | 'borrow:create'
  | 'borrow:return'
  | 'borrow:view'
  | 'procurement:create'
  | 'procurement:approve'
  | 'procurement:send_to_vendor'
  | 'procurement:place_order'
  | 'procurement:confirm_payment'
  | 'procurement:upload_invoice'
  | 'procurement:scan_invoice';

const rolePermissions: Record<Role, PermissionAction[]> = {
  admin: [
    'asset:create',
    'asset:edit',
    'asset:delete',
    'asset:assign_lab',
    'maintenance:assign',
    'borrow:view',
    'procurement:approve',
    'procurement:send_to_vendor'
  ],
  lab: ['asset:view_lab_only', 'maintenance:raise', 'borrow:create', 'borrow:return', 'borrow:view', 'procurement:create'],
  service: ['maintenance:update_status'],
  purchase_dept: [
    'procurement:approve',
    'procurement:place_order',
    'procurement:confirm_payment',
    'procurement:upload_invoice',
    'procurement:scan_invoice',
    'borrow:view'
  ]
};

export function canPerform(role: Role, action: PermissionAction): boolean {
  return rolePermissions[role].includes(action);
}
