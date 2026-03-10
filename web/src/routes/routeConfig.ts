import type { ComponentType } from 'react';
import {
  LayoutDashboard,
  Boxes,
  Building2,
  Users,
  Wrench,
  FileText,
  ClipboardList,
  Settings,
  ShoppingCart,
  Receipt,
  Brain,
  Cpu,
  Activity,
  Link2,
  ScanLine,
  TrendingUp,
} from 'lucide-react';
import type { Role } from '../types/auth';

export const ROLE_HOME_ROUTE: Record<Role, string> = {
  admin: '/admin/dashboard',
  lab: '/lab/dashboard',
  service: '/service/dashboard',
  purchase_dept: '/purchase/dashboard'
};

export type SidebarItem = {
  label: string;
  to: string;
  icon: ComponentType<{ size?: number }>;
  group?: 'main' | 'system';
};

export const SIDEBAR_ITEMS: Record<Role, SidebarItem[]> = {
  admin: [
    { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard, group: 'main' },
    { label: 'Assets', to: '/admin/assets', icon: Boxes, group: 'main' },
    { label: 'Procurement', to: '/admin/procurement', icon: ShoppingCart, group: 'main' },
    { label: 'Labs', to: '/admin/labs', icon: Building2, group: 'main' },
    { label: 'Users', to: '/admin/users', icon: Users, group: 'main' },
    { label: 'Maintenance', to: '/admin/maintenance', icon: Wrench, group: 'main' },
    { label: 'Reports', to: '/admin/reports', icon: FileText, group: 'main' },
    { label: 'Inventory Intelligence', to: '/admin/inventory-intelligence', icon: Brain, group: 'main' },
    { label: 'Digital Twin', to: '/admin/digital-twin', icon: Activity, group: 'main' },
    { label: 'Device Monitoring', to: '/admin/device-monitoring', icon: Cpu, group: 'main' },
    { label: 'Blockchain Audit', to: '/admin/blockchain', icon: Link2, group: 'main' },
    { label: 'Asset Tracking', to: '/admin/asset-tracking', icon: ScanLine, group: 'main' },
    { label: 'Finance Forecast', to: '/admin/finance-forecast', icon: TrendingUp, group: 'main' },
    { label: 'Settings', to: '/admin/settings', icon: Settings, group: 'system' }
  ],
  lab: [
    { label: 'Dashboard', to: '/lab/dashboard', icon: LayoutDashboard, group: 'main' },
    { label: 'My Assets', to: '/lab/assets', icon: Boxes, group: 'main' },
    { label: 'Procurement', to: '/lab/procurement', icon: ShoppingCart, group: 'main' },
    { label: 'Maintenance Requests', to: '/lab/maintenance', icon: Wrench, group: 'main' },
    { label: 'Lab Digital Twin', to: '/lab/digital-twin', icon: Activity, group: 'main' },
    { label: 'Lab Device Monitor', to: '/lab/device-monitoring', icon: Cpu, group: 'main' },
    { label: 'Settings', to: '/lab/settings', icon: Settings, group: 'system' }
  ],
  service: [
    { label: 'Dashboard', to: '/service/dashboard', icon: LayoutDashboard, group: 'main' },
    { label: 'Assigned Tasks', to: '/service/tasks', icon: ClipboardList, group: 'main' },
    { label: 'Settings', to: '/service/settings', icon: Settings, group: 'system' }
  ],
  purchase_dept: [
    { label: 'Purchase Orders', to: '/purchase/dashboard', icon: Receipt, group: 'main' },
    { label: 'Smart Procurement', to: '/purchase/smart-procurement', icon: Cpu, group: 'main' },
    { label: 'Finance Forecast', to: '/purchase/finance-forecast', icon: TrendingUp, group: 'main' },
    { label: 'Settings', to: '/purchase/settings', icon: Settings, group: 'system' }
  ]
};
