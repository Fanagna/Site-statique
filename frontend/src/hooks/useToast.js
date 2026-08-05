import { useState, useRef, useCallback } from 'react';

/* Notification toast partagé de l'espace admin.
   showToast(message, 'success' | 'error') — confirme qu'une sauvegarde a
   bien atteint la base de données, ou signale clairement un échec.
   Disparaît automatiquement après ~5 secondes. */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type, key: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 5200);
  }, []);
  const closeToast = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);
  return { toast, showToast, closeToast };
}
