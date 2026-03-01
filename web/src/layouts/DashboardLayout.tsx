import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';

export function DashboardLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
        return false;
    });

    useEffect(() => {
        const root = window.document.documentElement;
        if (isDarkMode) {
            root.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            root.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
            <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <Topbar isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />

                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
