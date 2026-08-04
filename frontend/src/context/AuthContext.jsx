import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiLogin, validateAdminKey } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = localStorage.getItem('arina_admin');
      const key = localStorage.getItem('arina_admin_key');
      if (!stored || !key) {
        if (!cancelled) setLoading(false);
        return;
      }
      // On ne fait confiance à une session stockée QUE si le serveur
      // accepte encore la clé admin. Sinon on déconnecte (clé périmée).
      const valid = await validateAdminKey();
      if (cancelled) return;
      if (valid) {
        try {
          const parsed = JSON.parse(stored);
          setUser(parsed);
        } catch {
          localStorage.removeItem('arina_admin');
          localStorage.removeItem('arina_admin_key');
        }
      } else {
        localStorage.removeItem('arina_admin');
        localStorage.removeItem('arina_admin_key');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Connexion : l'API est la SEULE source de vérité (pas de mot de passe en dur ici).
  const login = async (username, password) => {
    const apiResult = await apiLogin(username, password);
    if (apiResult && apiResult.success) {
      const userData = { ...apiResult.user, loginAt: new Date().toISOString() };
      localStorage.setItem('arina_admin', JSON.stringify(userData));
      if (apiResult.token) localStorage.setItem('arina_admin_key', apiResult.token);
      setUser(userData);
      return { success: true };
    }
    return { success: false, error: apiResult?.error || 'Identifiants incorrects' };
  };

  const logout = useCallback(() => {
    localStorage.removeItem('arina_admin');
    localStorage.removeItem('arina_admin_key');
    setUser(null);
  }, []);

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
