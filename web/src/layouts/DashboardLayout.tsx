import React, { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { SIDEBAR_ITEMS } from '../routes/routeConfig';
import { Bell, ChevronDown, ChevronLeft, ChevronRight, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';

function initials(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function roleBadge(role: string | null) {
  if (role === 'admin') return 'Administrator';
  if (role === 'lab') return 'Lab Incharge';
  return 'Service Staff';
}

export function DashboardLayout() {
  const { role, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([
    '3 assets are nearing warranty expiry.',
    '2 maintenance tasks were completed.',
    'New procurement request submitted.'
  ]);

  const navItems = useMemo(() => (role ? SIDEBAR_ITEMS[role] : []), [role]);
  const pageTitle = useMemo(() => {
    const match = navItems.find((item) => item.to === location.pathname);
    return match?.label ?? 'Dashboard';
  }, [location.pathname, navItems]);

  return (
    <div className={`app-shell sleek-shell ${isCollapsed ? 'collapsed' : ''}`}>
      <button className="mobile-nav-toggle" type="button" aria-label="Toggle navigation menu" onClick={() => setIsMobileOpen((open) => !open)}>
        <Menu size={18} />
      </button>

      {isMobileOpen ? <button className="sidebar-overlay" type="button" aria-label="Close menu" onClick={() => setIsMobileOpen(false)} /> : null}

      <aside className={`sidebar dark-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header brand-head">
          <div>
            <h3 className="sidebar-title">CampusLedger</h3>
            <p className="sidebar-subtitle">Asset Manager</p>
          </div>
          <button
            className="collapse-btn"
            type="button"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className="nav-list">
          <p className="nav-section-label">MAIN MENU</p>
          {navItems
            .filter((item) => item.group !== 'system')
            .map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink key={item.to} className={`nav-link ${isActive ? 'active' : ''}`} to={item.to} onClick={() => setIsMobileOpen(false)}>
                  <span className="nav-icon">
                    <Icon size={16} />
                  </span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              );
            })}
        </div>

        <div className="nav-list system-nav-list">
          <p className="nav-section-label">SYSTEM</p>
          {navItems
            .filter((item) => item.group === 'system')
            .map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink key={item.to} className={`nav-link ${isActive ? 'active' : ''}`} to={item.to} onClick={() => setIsMobileOpen(false)}>
                  <span className="nav-icon">
                    <Icon size={16} />
                  </span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              );
            })}
        </div>

        <button className="logout-link" type="button" onClick={logout}>
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </aside>

      <main className="content layout-content">
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-divider" />
            <h1>{pageTitle}</h1>
          </div>

          <div className="topbar-right">
            <label className="topbar-search">
              <Search size={16} />
              <input type="text" placeholder="Search assets..." />
            </label>

            <button className="icon-btn" type="button" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="icon-btn bell-btn" type="button" aria-label="Notifications" onClick={() => setNotificationsOpen((open) => !open)}>
              <Bell size={16} />
              <span className="notif-dot">{notifications.length}</span>
            </button>
            {notificationsOpen ? (
              <div className="notif-panel">
                <div className="notif-panel-head">
                  <strong>Notifications</strong>
                  <button className="btn secondary-btn mini-btn" type="button" onClick={() => setNotifications([])}>
                    Clear
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="notif-empty">No new notifications.</p>
                ) : (
                  notifications.map((message, index) => (
                    <div className="notif-item" key={`${index}-${message}`}>
                      {message}
                    </div>
                  ))
                )}
              </div>
            ) : null}

            <div className="profile-pill">
              <span className="avatar">{initials(user?.name)}</span>
              <div>
                <p className="profile-name">{user?.name ?? 'Campus User'}</p>
                <span className="profile-role">{roleBadge(role)}</span>
              </div>
              <ChevronDown size={16} />
            </div>
          </div>
        </header>

        <div className="page-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
