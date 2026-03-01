
import { NavLink } from 'react-router-dom';
import {
    BarChart3,
    Package,
    PlusCircle,
    ShoppingCart,
    Wrench,
    MapPin,
    FileText,
    Users,
    Settings,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
}

const navItems = [
    { icon: BarChart3, label: 'Dashboard', path: '/', roles: ['Admin', 'Lab Incharge', 'Service'] },
    { icon: Package, label: 'Asset Management', path: '/assets', roles: ['Admin', 'Lab Incharge', 'Service'] },
    { icon: PlusCircle, label: 'Add Asset', path: '/assets/new', roles: ['Admin', 'Lab Incharge'] },
    { icon: ShoppingCart, label: 'Procurement', path: '/procurement', roles: ['Admin', 'Lab Incharge'] },
    { icon: Wrench, label: 'Maintenance', path: '/maintenance', roles: ['Admin', 'Lab Incharge', 'Service'] },
    { icon: MapPin, label: 'Locations', path: '/locations', roles: ['Admin', 'Service'] },
    { icon: FileText, label: 'Reports', path: '/reports', roles: ['Admin', 'Lab Incharge'] },
    { icon: Users, label: 'Users & Roles', path: '/users', roles: ['Admin'] },
    { icon: Settings, label: 'Settings', path: '/settings', roles: ['Admin'] },
];

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
    const { role } = useAuth();

    const filteredNavItems = navItems.filter(item =>
        !item.roles || (role && item.roles.includes(role))
    );

    return (
        <div className={`bg-slate-900 border-r border-slate-800 text-slate-300 transition-all duration-300 flex flex-col ${collapsed ? 'w-20' : 'w-64'}`}>
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
                {!collapsed && (
                    <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-blue-200 bg-clip-text text-transparent truncate flex-1">
                        CampusLedger
                    </span>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={`p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors ${collapsed ? 'mx-auto' : 'ml-2'}`}
                    title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>

            <nav className="flex-1 py-4 px-3 space-y-1">
                {filteredNavItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => `
              flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 group
              ${isActive
                                ? 'bg-blue-600/10 text-blue-400 font-medium'
                                : 'hover:bg-slate-800/50 hover:text-slate-100'}
              ${collapsed ? 'justify-center' : ''}
            `}
                        title={collapsed ? item.label : undefined}
                    >
                        <item.icon
                            size={20}
                            className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${!collapsed && 'mr-3'}`}
                        />
                        {!collapsed && (
                            <span className="truncate">{item.label}</span>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-600 flex shrink-0 items-center justify-center font-bold text-sm text-white">
                    {role ? role[0] : 'U'}
                </div>
                {!collapsed && (
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">Dr. Rajesh Kumar</p>
                        <p className="text-[10px] text-slate-500 truncate uppercase font-bold tracking-tighter">{role || 'User'}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
