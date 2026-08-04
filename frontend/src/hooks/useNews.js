import { useState, useEffect, useRef } from 'react';
import { fetchNews } from '../services/api';
import { allNews } from '../data/news';

const REFRESH_MS = 30 * 1000; // rechargement automatique toutes les 30s

/* Charge les actualités depuis la base (gérées par l'admin) et les maintient
   à jour en temps réel : polling + refetch au retour sur l'onglet.
   Repli sur les données statiques uniquement si l'API est indisponible. */
export default function useNews() {
  const [news, setNews] = useState(allNews);
  const [loading, setLoading] = useState(true);
  const [fromApi, setFromApi] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const n = await fetchNews();
      if (cancelled) return;
      if (n !== null) {
        const published = (Array.isArray(n) ? n : [])
          .filter((x) => (x.status || 'published') === 'published');
        setNews(published);
        setFromApi(true);
      }
      setLoading(false);
    };

    refresh();

    // Rechargement périodique : les changements admin apparaissent sans recharger la page
    timerRef.current = setInterval(refresh, REFRESH_MS);

    // Rechargement immédiat quand l'utilisateur revient sur l'onglet
    const onFocus = () => { refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return { news, loading, fromApi };
}
