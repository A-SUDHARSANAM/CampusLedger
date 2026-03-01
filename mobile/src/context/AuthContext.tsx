import React, { createContext, useContext, useState } from 'react';

type Role = 'Admin' | 'Lab Incharge' | 'Service' | null;

interface AuthContextType {
    role: Role;
    login: (selectedRole: Role, email?: string, password?: string) => Promise<boolean | void>;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [role, setRole] = useState<Role>(null);

    const login = async (selectedRole: Role, email?: string, password?: string) => {
        try {
            if (email && password) {
                const response = await fetch('http://localhost:5000/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const data = await response.json();

                if (response.ok) {
                    setRole(data.user.role);
                    return true;
                } else {
                    throw new Error(data.message || 'Authentication failed');
                }
            } else {
                setRole(selectedRole);
            }
        } catch (error) {
            console.error('Mobile Auth Error:', error);
            throw error;
        }
    };

    const logout = () => {
        setRole(null);
    };

    const isAuthenticated = !!role;

    return (
        <AuthContext.Provider value={{ role, login, logout, isAuthenticated }}>
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
