import { useState, useEffect } from 'react';
import { fetchNews } from '../services/api';
import { allNews } from '../data/news';

/* Charge les actualités depuis la base (gérées par l'admin).
   Repli sur les données statiques uniquement si l'API est indisponible. */
export default function useNews() {
  const [news, setNews] = useState(allNews);
  const [loading, setLoading] = useState(true);
  const [fromApi, setFromApi] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const n = await fetchNews();
      if (cancelled) return;
      if (n !== null) {
        const published = (Array.isArray(n) ? n : [])
          .filter((x) => (x.status || 'published') === 'published');
        setNews(published);
        setFromApi(true);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { news, loading, fromApi };
}
