import React, { createContext, useContext, useState } from 'react';

type Role = 'Admin' | 'Lab Incharge' | 'Service' | null;

interface AuthContextType {
    role: Role;
    login: (selectedRole: Role) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [role, setRole] = useState<Role>(null);

    const login = (selectedRole: Role) => {
        setRole(selectedRole);
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
