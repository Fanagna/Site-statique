import { createContext, useContext } from 'react';

/* Contexte d'authentification — isolé dans un fichier sans composant
   (le provider vit dans ../context/AuthContext.jsx) pour un Fast Refresh fiable. */
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
