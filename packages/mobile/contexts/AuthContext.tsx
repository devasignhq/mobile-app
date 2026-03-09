import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AuthUser {
    id: string;
    username: string;
    avatarUrl: string;
}

interface AuthContextType {
    user: AuthUser | null;
    token: string | null;
    isAuthenticated: boolean;
    login: (token: string, refreshToken: string, user: AuthUser) => void;
    logout: () => Promise<void>;
    getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEYS = {
    TOKEN: 'auth_token',
    REFRESH_TOKEN: 'auth_refresh_token',
    USER: 'auth_user',
} as const;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEYS.USER);
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    const [token, setToken] = useState<string | null>(
        () => localStorage.getItem(STORAGE_KEYS.TOKEN)
    );

    const isAuthenticated = !!token && !!user;

    const login = useCallback((newToken: string, refreshToken: string, newUser: AuthUser) => {
        localStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
        localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
        // Keep legacy flag for any code that still checks it
        localStorage.setItem('isAuthenticated', 'true');
        setToken(newToken);
        setUser(newUser);
    }, []);

    const logout = useCallback(async () => {
        const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

        // Best-effort server-side logout
        if (refreshToken) {
            try {
                await fetch('/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken }),
                });
            } catch (err) {
                console.error('Logout request failed:', err);
            }
        }

        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        localStorage.removeItem('isAuthenticated');
        setToken(null);
        setUser(null);
    }, []);

    const getAuthHeaders = useCallback((): Record<string, string> => {
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
    }, [token]);

    // Sync across tabs
    useEffect(() => {
        const handleStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEYS.TOKEN) {
                setToken(e.newValue);
            }
            if (e.key === STORAGE_KEYS.USER) {
                try {
                    setUser(e.newValue ? JSON.parse(e.newValue) : null);
                } catch {
                    setUser(null);
                }
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, isAuthenticated, login, logout, getAuthHeaders }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return ctx;
};
