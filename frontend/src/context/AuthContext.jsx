import { useState, useEffect, useCallback } from 'react';
import { apiLogin, fetchMe } from '../services/api';
import { AuthContext } from '../hooks/useAuth';
import { safeGet, safeSet, safeRemove, pruneOversizedCaches } from '../utils/storage';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = safeGet('arina_admin');
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
        safeRemove('arina_admin');
        safeRemove('arina_admin_key');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Connexion : l'API est la SEULE source de vérité (pas de mot de passe en dur ici).
  const login = async (username, password) => {
    const apiResult = await apiLogin(username, password);
    if (apiResult && apiResult.success) {
      // Purge les caches volumineux (ex. ancien arina_news plein d'images base64) :
      // sinon le localStorage plein ferait échouer l'écriture de la clé de session
      // ci-dessous et la nouvelle session ne survivrait pas au refresh.
      pruneOversizedCaches();
      const userData = { ...apiResult.user, loginAt: new Date().toISOString() };
      safeSet('arina_admin', JSON.stringify(userData));
      if (apiResult.token) safeSet('arina_admin_key', apiResult.token);
      setUser(userData);
      return { success: true };
    }
    return { success: false, error: apiResult?.error || 'Identifiants incorrects' };
  };

  const logout = useCallback(() => {
    safeRemove('arina_admin');
    safeRemove('arina_admin_key');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}


