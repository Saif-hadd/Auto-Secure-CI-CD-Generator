import { createContext, useContext, useEffect, useState } from 'react';
import { ApiClient } from '../lib/api';
import type { User } from '../types/user';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (code: string, state: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void checkAuth();
  }, []);

  const checkAuth = async (): Promise<void> => {
    try {
      const { user } = await ApiClient.getCurrentUser();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (code: string, state: string): Promise<void> => {
    try {
      const { user } = await ApiClient.githubCallback(code, state);
      setUser(user);
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await ApiClient.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
