import type { Role } from '../types/auth';

export type PermissionAction =
  | 'asset:create'
  | 'asset:edit'
  | 'asset:delete'
  | 'asset:assign_lab'
  | 'asset:view_lab_only'
  | 'maintenance:raise'
  | 'maintenance:assign'
  | 'maintenance:update_status';

const rolePermissions: Record<Role, PermissionAction[]> = {
  admin: [
    'asset:create',
    'asset:edit',
    'asset:delete',
    'asset:assign_lab',
    'maintenance:assign'
  ],
  lab: ['asset:view_lab_only', 'maintenance:raise'],
  service: ['maintenance:update_status']
};

export function canPerform(role: Role, action: PermissionAction): boolean {
  return rolePermissions[role].includes(action);
}
