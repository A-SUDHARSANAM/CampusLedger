import React, { createContext, useEffect, useMemo, useState } from 'react';
import { canPerform, type PermissionAction } from '../auth/permissions';
import { api } from '../services/api';
import type { AuthState, Role, User } from '../types/auth';

type AuthContextType = {
  user: User | null;
  token: string | null;
  role: Role | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string, selectedRole?: Role) => Promise<User>;
  loginWithToken: (token: string, refreshToken: string) => Promise<User>;
  logout: () => void;
  hasPermission: (action: PermissionAction) => boolean;
};

const STORAGE_KEY = 'campusledger_auth_state';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function loadStoredAuthState(): AuthState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { token: null, refreshToken: null, user: null };
  try {
    const parsed = JSON.parse(raw) as AuthState;
    return {
      token: parsed.token ?? null,
      refreshToken: parsed.refreshToken ?? null,
      user: parsed.user ?? null
    };
  } catch {
    return { token: null, refreshToken: null, user: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => loadStoredAuthState());
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    if (state.token) api.setToken(state.token);
    if (state.refreshToken) api.setRefreshToken(state.refreshToken);
    setIsBootstrapping(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const logout = () => {
    api.setToken(null);
    api.setRefreshToken(null);
    setState({ token: null, refreshToken: null, user: null });
  };

  // Auto-logout whenever any API call returns 401 and token refresh also fails
  useEffect(() => {
    api.onUnauthorized(logout);
  }, []);

  // Sync new tokens into React state whenever api.ts performs a reactive refresh
  useEffect(() => {
    api.onTokenRefreshed((newToken, newRefreshToken) => {
      setState(prev => ({ ...prev, token: newToken, refreshToken: newRefreshToken }));
    });
  }, []);

  // Proactively refresh the token every 8 minutes so it never expires mid-session
  useEffect(() => {
    const EIGHT_MINUTES = 8 * 60 * 1000;
    const id = setInterval(() => {
      if (state.token) api.proactiveRefresh();
    }, EIGHT_MINUTES);
    return () => clearInterval(id);
  }, [!!state.token]);

  const login = async (email: string, password: string, selectedRole?: Role) => {
    const { token, refreshToken: rToken, user } = await api.login(email, password, selectedRole);
    api.setToken(token);
    api.setRefreshToken(rToken);
    setState({ token, refreshToken: rToken, user });
    return user;
  };

  const loginWithToken = async (token: string, refreshToken: string) => {
    const { token: t, refreshToken: rt, user } = await api.loginWithToken(token, refreshToken);
    api.setToken(t);
    api.setRefreshToken(rt);
    setState({ token: t, refreshToken: rt, user });
    return user;
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user: state.user,
      token: state.token,
      role: state.user?.role ?? null,
      isAuthenticated: !!state.user && !!state.token,
      isBootstrapping,
      login,
      loginWithToken,
      logout,
      hasPermission: (action) => {
        if (!state.user) return false;
        return canPerform(state.user.role, action);
      }
    }),
    [state, isBootstrapping]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
