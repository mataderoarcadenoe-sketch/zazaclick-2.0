import React, { createContext, useState, useEffect, useContext } from 'react';
import api from './api';

interface User {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

interface Subscription {
  status: string;
  start_date: string;
  end_date: string;
  plan_name: string;
  max_instances: number;
}

interface AuthContextType {
  user: User | null;
  subscription: Subscription | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    const token = localStorage.getItem('saas_auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      if (response.data?.success) {
        setUser(response.data.user);
        setSubscription(response.data.subscription);
      } else {
        logout();
      }
    } catch (err) {
      console.error('[AuthContext] Error loading user profile:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.data?.success && response.data?.token) {
        localStorage.setItem('saas_auth_token', response.data.token);
        setUser(response.data.user);
        await loadUser();
        return { success: true };
      }
      return { success: false, error: response.data?.error || 'Error al iniciar sesión' };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'Error de conexión con el servidor' };
    }
  };

  const register = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/register', { email, password });
      if (response.data?.success && response.data?.token) {
        localStorage.setItem('saas_auth_token', response.data.token);
        setUser(response.data.user);
        await loadUser();
        return { success: true };
      }
      return { success: false, error: response.data?.error || 'Error en el registro' };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error || 'Error de conexión' };
    }
  };

  const logout = () => {
    localStorage.removeItem('saas_auth_token');
    setUser(null);
    setSubscription(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      subscription,
      isAuthenticated: !!user,
      loading,
      login,
      register,
      logout,
      refreshUser: loadUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
