
import { Bell, Search, Sun, Moon, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface TopbarProps {
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

export function Topbar({ isDarkMode, toggleDarkMode }: TopbarProps) {
    const { role, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getRoleDisplayName = (r: typeof role) => {
        switch (r) {
            case 'Admin': return 'System Administrator';
            case 'Lab Incharge': return 'Lab Management';
            case 'Service': return 'Service Terminal';
            default: return 'User';
        }
    };

    return (
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 transition-colors duration-200 shrink-0">

            {/* Global Search */}
            <div className="flex-1 max-w-xl">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg leading-5 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all sm:text-sm"
                        placeholder="Search assets, locations, users..."
                    />
                </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-4 ml-4">

                {/* Dark Mode Toggle */}
                <button
                    onClick={toggleDarkMode}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900"
                    aria-label="Toggle dark mode"
                >
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                {/* Notifications */}
                <button className="relative p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900">
                    <span className="absolute top-1.5 right-1.5 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
                    <Bell size={20} />
                </button>

                {/* Profile & Role */}
                <div className="flex items-center gap-2 border-l border-slate-200 dark:border-slate-800 pl-4">
                    <Link to="/profile" className="flex items-center gap-3 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group">
                        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white dark:ring-slate-800 group-hover:ring-blue-500 transition-all">
                            RK
                        </div>
                        <div className="hidden md:block text-left">
                            <p className="text-xs font-bold text-slate-900 dark:text-white leading-none">Dr. Rajesh Kumar</p>
                            <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-tight">{getRoleDisplayName(role)}</p>
                        </div>
                    </Link>

                    <button
                        onClick={handleLogout}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                        title="Logout Terminal"
                    >
                        <LogOut size={18} />
                    </button>
                </div>

            </div>
        </header>
    );
}
