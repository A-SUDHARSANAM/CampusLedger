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
  logout: () => void;
  hasPermission: (action: PermissionAction) => boolean;
};

const STORAGE_KEY = 'campusledger_auth_state';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function loadStoredAuthState(): AuthState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { token: null, user: null };
  try {
    const parsed = JSON.parse(raw) as AuthState;
    return {
      token: parsed.token ?? null,
      user: parsed.user ?? null
    };
  } catch {
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => loadStoredAuthState());
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    if (state.token) {
      api.setToken(state.token);
    }
    setIsBootstrapping(false);
  }, [state.token]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const login = async (email: string, password: string, selectedRole?: Role) => {
    const { token, user } = await api.login(email, password, selectedRole);
    api.setToken(token);
    setState({ token, user });
    return user;
  };

  const logout = () => {
    api.setToken(null);
    setState({ token: null, user: null });
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user: state.user,
      token: state.token,
      role: state.user?.role ?? null,
      isAuthenticated: !!state.user && !!state.token,
      isBootstrapping,
      login,
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
