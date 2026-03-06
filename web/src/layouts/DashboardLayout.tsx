import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { SIDEBAR_ITEMS } from '../routes/routeConfig';
import { Bell, ChevronDown, ChevronLeft, ChevronRight, LogOut, Menu, Moon, Search, Settings as SettingsIcon, Sun, UserCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { api } from '../services/api';
import type { Notification } from '../types/domain';

function initials(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function roleBadge(role: string | null) {
  if (role === 'admin') return 'Administrator';
  if (role === 'lab') return 'Lab Incharge';
  if (role === 'purchase_dept') return 'Purchase Dept';
  return 'Service Staff';
}

export function DashboardLayout() {
  const { role, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [isPinned, setIsPinned] = useState(false);
  const [isSidebarHover, setIsSidebarHover] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Profile dropdown
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Search autocomplete
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const assetsCacheRef = useRef<string[] | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getNotifications().then(setNotifications).catch(() => {});
    api.getUnreadCount().then(setUnreadCount).catch(() => {});
  }, []);

  async function handleClearNotifications() {
    await api.markAllNotificationsRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  async function handleMarkRead(notifId: string) {
    await api.markNotificationRead(notifId).catch(() => {});
    setNotifications((prev) => prev.map((n) => n.id === notifId ? { ...n, is_read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  // Close profile dropdown when clicking outside
  useEffect(() => {
    if (!profileOpen) return;
    function handleOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [profileOpen]);

  // Close search suggestions when clicking outside
  useEffect(() => {
    if (!showSuggestions) return;
    function handleOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showSuggestions]);

  async function loadAssetsCache() {
    if (assetsCacheRef.current !== null || !role) return;
    const assets = await api.getAssets(role, (user as { labId?: string } | null)?.labId).catch(() => []);
    assetsCacheRef.current = assets.map((a) => a.name);
  }

  function computeSuggestions(value: string) {
    const trimmed = value.trim();
    if (!trimmed || !assetsCacheRef.current) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const lower = trimmed.toLowerCase();
    const matches = assetsCacheRef.current
      .filter((name) => name.toLowerCase().includes(lower))
      .slice(0, 8);
    setSearchSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    computeSuggestions(value);
  }

  async function handleSearchFocus() {
    await loadAssetsCache();
    computeSuggestions(searchQuery);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      return;
    }
    if (e.key === 'Enter' && searchQuery.trim()) {
      const assetsRoute = navItems.find((item) => item.label === 'Assets' || item.label === 'My Assets')?.to;
      if (assetsRoute) navigate(assetsRoute);
      setShowSuggestions(false);
    }
  }

  function handleSuggestionClick(name: string) {
    setSearchQuery(name);
    setShowSuggestions(false);
    const assetsRoute = navItems.find((item) => item.label === 'Assets' || item.label === 'My Assets')?.to;
    if (assetsRoute) navigate(assetsRoute);
  }

  const navItems = useMemo(() => (role ? SIDEBAR_ITEMS[role] : []), [role]);
  const isCollapsed = !isPinned && !isSidebarHover && !isMobileOpen;

  function navLabel(label: string) {
    return t(
      {
        Dashboard: 'dashboard',
        Assets: 'assets',
        Procurement: 'procurement',
        Labs: 'labs',
        Users: 'users',
        Maintenance: 'maintenance',
        Reports: 'reports',
        'My Assets': 'myAssets',
        'Maintenance Requests': 'maintenanceRequests',
        'Assigned Tasks': 'assignedTasks',
        'Purchase Orders': 'purchaseOrders',
        Settings: 'settings'
      }[label] ?? label,
      label
    );
  }

  const pageTitle = useMemo(() => {
    const match = navItems.find((item) => item.to === location.pathname);
    return navLabel(match?.label ?? 'Dashboard');
  }, [location.pathname, navItems, t, language]);

  return (
    <div className={`app-shell sleek-shell ${isCollapsed ? 'collapsed' : ''}`}>
      <button className="mobile-nav-toggle" type="button" aria-label="Toggle navigation menu" onClick={() => setIsMobileOpen((open) => !open)}>
        <Menu size={18} />
      </button>

      {isMobileOpen ? <button className="sidebar-overlay" type="button" aria-label="Close menu" onClick={() => setIsMobileOpen(false)} /> : null}

      <aside
        className={`sidebar pro-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}
        onMouseEnter={() => setIsSidebarHover(true)}
        onMouseLeave={() => setIsSidebarHover(false)}
      >
        <div className="sidebar-header brand-head">
          <div className="sidebar-brand">
            <span className="sidebar-mark" />
            <div>
              <h3 className="sidebar-title">CampusLedger</h3>
              <p className="sidebar-subtitle">Asset Manager</p>
            </div>
          </div>
          <button
            className="collapse-btn"
            type="button"
            aria-label={isPinned ? 'Unpin expanded sidebar' : 'Pin expanded sidebar'}
            onClick={() => setIsPinned((value) => !value)}
          >
            {isPinned ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        <div className="nav-list">
          <p className="nav-section-label">{t('modules', 'MODULES')}</p>
          {navItems
            .filter((item) => item.group !== 'system')
            .map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink key={item.to} className={`nav-link ${isActive ? 'active' : ''}`} to={item.to} onClick={() => setIsMobileOpen(false)}>
                  <span className="nav-tooltip">{navLabel(item.label)}</span>
                  <span className="nav-icon">
                    <Icon size={16} />
                  </span>
                  <span className="nav-label">{navLabel(item.label)}</span>
                </NavLink>
              );
            })}
        </div>

        <div className="nav-list system-nav-list">
          <p className="nav-section-label">{t('account', 'ACCOUNT')}</p>
          {navItems
            .filter((item) => item.group === 'system')
            .map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.to;
              return (
                <NavLink key={item.to} className={`nav-link ${isActive ? 'active' : ''}`} to={item.to} onClick={() => setIsMobileOpen(false)}>
                  <span className="nav-tooltip">{navLabel(item.label)}</span>
                  <span className="nav-icon">
                    <Icon size={16} />
                  </span>
                  <span className="nav-label">{navLabel(item.label)}</span>
                </NavLink>
              );
            })}
        </div>

        <button className="logout-link" type="button" onClick={logout}>
          <span className="nav-tooltip">{t('logout', 'Logout')}</span>
          <LogOut size={16} />
          <span>{t('logout', 'Logout')}</span>
        </button>
      </aside>

      <main className="content layout-content">
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-divider" style={{ display: 'none' }} />
            <h1>{pageTitle}</h1>
          </div>

          <div className="topbar-right">
            <div className="topbar-search-wrapper" ref={searchContainerRef}>
              <div className="topbar-search">
                <Search size={16} />
                <input
                  type="text"
                  placeholder={t('searchAssets', 'Search assets...')}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={handleSearchFocus}
                  onKeyDown={handleSearchKeyDown}
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    aria-label="Clear search"
                    onClick={() => { setSearchQuery(''); setShowSuggestions(false); }}
                  >×</button>
                )}
              </div>
              {showSuggestions && (
                <div className="search-suggestions" role="listbox">
                  {searchSuggestions.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="search-suggestion-item"
                      role="option"
                      aria-selected={false}
                      onClick={() => handleSuggestionClick(name)}
                    >
                      <Search size={13} className="suggestion-icon" />
                      <span>{name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <label className="language-switch">
              <span>{t('langLabel', 'Language')}</span>
              <select value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'ta' | 'hi')}>
                <option value="en">English</option>
                <option value="ta">Tamil</option>
                <option value="hi">Hindi</option>
              </select>
            </label>

            <button className="icon-btn" type="button" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="icon-btn bell-btn" type="button" aria-label="Notifications" onClick={() => setNotificationsOpen((open) => !open)}>
              <Bell size={16} />
              {unreadCount > 0 && <span className="notif-dot">{unreadCount}</span>}
            </button>
            {notificationsOpen ? (
              <div className="notif-panel">
                <div className="notif-panel-head">
                  <strong>{t('notifications', 'Notifications')}</strong>
                  <button className="btn secondary-btn mini-btn" type="button" onClick={handleClearNotifications}>
                    {t('markAllRead', 'Mark all read')}
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p className="notif-empty">{t('noNewNotifications', 'No new notifications.')}</p>
                ) : (
                  notifications.map((notif) => (
                    <div
                      className={`notif-item${notif.is_read ? ' notif-read' : ''}`}
                      key={notif.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => !notif.is_read && handleMarkRead(notif.id)}
                      onKeyDown={(e) => e.key === 'Enter' && !notif.is_read && handleMarkRead(notif.id)}
                    >
                      <strong>{notif.title}</strong>
                      <p style={{ margin: 0, fontSize: '0.8em', opacity: 0.8 }}>{notif.body}</p>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            <div className="profile-pill-wrapper" ref={profileRef}>
              <button
                type="button"
                className={`profile-pill${profileOpen ? ' open' : ''}`}
                onClick={() => setProfileOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={profileOpen}
              >
                <span className="avatar">{initials(user?.name)}</span>
                <div>
                  <p className="profile-name">{user?.name ?? 'Campus User'}</p>
                  <span className="profile-role">{roleBadge(role)}</span>
                </div>
                <ChevronDown size={16} className={`chevron-icon${profileOpen ? ' rotated' : ''}`} />
              </button>

              {profileOpen && (
                <div className="profile-dropdown" role="menu">
                  <div className="profile-dropdown-header">
                    <span className="avatar avatar-lg">{initials(user?.name)}</span>
                    <div>
                      <p className="profile-dropdown-name">{user?.name ?? 'Campus User'}</p>
                      <span className="profile-role">{roleBadge(role)}</span>
                    </div>
                  </div>
                  <div className="profile-dropdown-divider" />
                  {navItems.find((item) => item.label === 'Settings') && (
                    <button
                      type="button"
                      className="profile-dropdown-item"
                      role="menuitem"
                      onClick={() => {
                        const route = navItems.find((item) => item.label === 'Settings')?.to;
                        if (route) navigate(route);
                        setProfileOpen(false);
                      }}
                    >
                      <SettingsIcon size={14} />
                      <span>{t('settings', 'Settings')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="profile-dropdown-item danger"
                    role="menuitem"
                    onClick={() => { logout(); setProfileOpen(false); }}
                  >
                    <LogOut size={14} />
                    <span>{t('logout', 'Sign out')}</span>
                  </button>
                </div>
              )}
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
