import { createContext, useContext, useState, useEffect } from 'react';
import { apiLogin } from '../services/api';

const AuthContext = createContext(null);

const ADMIN_CREDENTIALS = { username: 'admin', password: 'arina2024' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('arina_admin');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.username === ADMIN_CREDENTIALS.username) {
          setUser(parsed);
        }
      } catch { localStorage.removeItem('arina_admin'); }
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    // Try API first
    const apiResult = await apiLogin(username, password);
    if (apiResult && apiResult.success) {
      const userData = { ...apiResult.user, loginAt: new Date().toISOString() };
      localStorage.setItem('arina_admin', JSON.stringify(userData));
      setUser(userData);
      return { success: true };
    }

    // Fallback to hardcoded
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      const userData = { username, role: 'admin', loginAt: new Date().toISOString() };
      localStorage.setItem('arina_admin', JSON.stringify(userData));
      setUser(userData);
      return { success: true };
    }

    return { success: false, error: 'Identifiants incorrects' };
  };

  const logout = () => {
    localStorage.removeItem('arina_admin');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
