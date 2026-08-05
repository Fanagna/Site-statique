import { useState, useEffect, useCallback } from 'react';
import { apiLogin, fetchMe } from '../services/api';
import { AuthContext } from '../hooks/useAuth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = localStorage.getItem('arina_admin');
      if (!stored) {
        if (!cancelled) setLoading(false);
        return;
      }
      // On ne fait confiance à une session stockée QUE si le serveur l'accepte
      // encore (clé valide). Sinon on déconnecte (clé périmée / compte supprimé).
      const me = await fetchMe();
      if (cancelled) return;
      if (me && me.username) {
        setUser({ ...me });
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


