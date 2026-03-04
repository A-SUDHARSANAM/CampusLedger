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
  | 'procurement:vendor_update';

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
  vendor: ['procurement:vendor_update']
};

export function canPerform(role: Role, action: PermissionAction): boolean {
  return rolePermissions[role].includes(action);
}
