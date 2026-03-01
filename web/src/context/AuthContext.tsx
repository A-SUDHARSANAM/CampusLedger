import React, { createContext, useContext, useState } from 'react';

type Role = 'Admin' | 'Lab Incharge' | 'Service' | null;

interface AuthContextType {
    role: Role;
    login: (selectedRole: Role, email?: string, password?: string) => Promise<boolean | void>;
    register: (name: string, email: string, password: string, role: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [role, setRole] = useState<Role>(() => {
        const savedRole = localStorage.getItem('userRole');
        return (savedRole as Role) || null;
    });

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
                    localStorage.setItem('userRole', data.user.role);
                    localStorage.setItem('token', data.token);
                    return true;
                } else {
                    throw new Error(data.message || 'Authentication failed');
                }
            } else {
                setRole(selectedRole);
                if (selectedRole) {
                    localStorage.setItem('userRole', selectedRole);
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    const register = async (name: string, email: string, password: string, role: string) => {
        try {
            const response = await fetch('http://localhost:5000/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    };

    const logout = () => {
        setRole(null);
        localStorage.removeItem('userRole');
        localStorage.removeItem('token');
    };

    const isAuthenticated = !!role;

    return (
        <AuthContext.Provider value={{ role, login, register, logout, isAuthenticated }}>
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
