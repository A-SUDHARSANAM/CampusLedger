import React, { createContext, useContext, useState } from 'react';

type Role = 'Admin' | 'Lab Incharge' | 'Service' | null;

interface AuthContextType {
    role: Role;
    userId: string | null;
    token: string | null;
    login: (selectedRole: Role, userId?: string, token?: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [role, setRole] = useState<Role>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);

    const login = (selectedRole: Role, uid?: string, tok?: string) => {
        setRole(selectedRole);
        setUserId(uid ?? null);
        setToken(tok ?? null);
    };

    const logout = () => {
        setRole(null);
        setUserId(null);
        setToken(null);
    };

    const isAuthenticated = !!role;

    return (
        <AuthContext.Provider value={{ role, userId, token, login, logout, isAuthenticated }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
