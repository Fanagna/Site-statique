/* Helpers partagés de l'espace admin — fonctions pures, sans composant.
   Séparés des composants pour garder un Fast Refresh fiable (react/only-export-components). */

export const formatMGA = (n) => (n || 0).toLocaleString('fr-FR') + ' Ar';
export const today = () => new Date().toISOString().split('T')[0];
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(diff)) return '';
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Date(dateStr).toLocaleDateString('fr-FR');
};

/* ── Cache localStorage SÛR : ne plante JAMAIS la page ──
   Le cache local n'est qu'un secours hors-ligne. Deux dangers réels :
   - JSON corrompu (écriture interrompue par un quota dépassé) → JSON.parse jetait
     une exception pendant le chargement de l'admin (« Une erreur est survenue
     lors du chargement »).
   - Quota dépassé : les images uploadées deviennent des data: URLs base64
     (jusqu'à ~2,7 Mo chacune) ; empilées dans le cache, elles dépassent les
     ~5 Mo du quota localStorage → QuotaExceededError.
   readCache lit + parse sans exception. writeCache écrit sans exception et, si
   le quota est dépassé, réessaie SANS les images (data: URLs) — puis abandonne
   silencieusement : les images reviennent de l'API au prochain chargement. */
export const readCache = (key, fallback = null) => {
  try {
    const s = localStorage.getItem(key);
    if (!s) return fallback;
    const parsed = JSON.parse(s);
    return parsed == null ? fallback : parsed;
  } catch {
    return fallback;
  }
};

export const writeCache = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    try {
      // Quota dépassé : on réessaie sans les images base64 (données les plus lourdes)
      localStorage.setItem(key, JSON.stringify(stripDataUrls(value)));
    } catch {
      /* cache optionnel : on ne plante jamais la page */
    }
  }
};

/* ── Nettoyage automatique des caches (au chargement de l'admin) ──
   Les caches ne sont qu'un secours hors-ligne : s'ils sont corrompus ou trop
   volumineux, ils font planter la page (JSON.parse / QuotaExceededError) pour
   zéro bénéfice. cleanupCaches() les purge sans jamais lever d'exception :
   - JSON corrompu ou valeur inattendue (non-tableau) → clé supprimée ;
   - cache trop volumineux (images base64 empilées) → réécrit sans les images ;
   - budget total dépassé (quota ~5 Mo partagé par toutes les clés) → les images
     sont retirées de tous les caches pour repasser sous la limite. */
const CACHE_KEYS = [
  'arina_news', 'arina_benefs', 'arina_finances', 'arina_donors',
  'arina_contacts', 'arina_volunteers', 'arina_testimonials', 'arina_donations',
];

// Seuil par clé : au-delà, un cache est jugé trop volumineux (~3 Mo, typique des
// images uploadées) et on retire ses data: URLs.
const MAX_CACHE_CHARS = 3 * 1024 * 1024;

// Budget total de tous les caches : on reste sous le quota localStorage (~5 Mo).
const MAX_TOTAL_CACHE_CHARS = 4.5 * 1024 * 1024;

const stripDataUrls = (v) => JSON.parse(JSON.stringify(v), (k, val) =>
  typeof val === 'string' && val.startsWith('data:') ? '' : val
);

export function cleanupCaches() {
  try {
    const entries = [];
    let total = 0;
    for (const key of CACHE_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      total += raw.length;
      let parsed;
      try { parsed = JSON.parse(raw); } catch { localStorage.removeItem(key); continue; }
      if (!Array.isArray(parsed)) { localStorage.removeItem(key); continue; }
      entries.push({ key, raw, parsed });
    }
    for (const e of entries) {
      // Trop volumineux pour une clé OU budget global dépassé → retrait des images
      if (e.raw.length > MAX_CACHE_CHARS || total > MAX_TOTAL_CACHE_CHARS) {
        try {
          const light = JSON.stringify(stripDataUrls(e.parsed));
          if (light.length < e.raw.length) {
            localStorage.setItem(e.key, light);
            total -= e.raw.length - light.length;
          }
        } catch { /* on garde tel quel si la réécriture échoue */ }
      }
    }
  } catch { /* jamais bloquant */ }
}

/* ── Optimisation d'image à l'upload (rendu net comme sur les grands sites) ──
   Les photos brutes (téléphone, appareil) sont souvent énormes (4000×3000 px) et
   lourdes. Affichées dans les cartes du site, le navigateur doit les déformer et
   les flouter ; et stockées en base64 en base, elles gonflent la base. optimizeImage :
   - REDIMENSIONNE l'image à maxDim (jamais d'agrandissement → toujours net) ;
   - réencode en WebP (qualité élevée, ~2× plus léger que JPEG) avec repli JPEG ;
   - ne lève JAMAIS d'exception : renvoie la data: URL optimisée, ou null. */
export const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error('read'));
  reader.readAsDataURL(file);
});

export async function optimizeImage(file, { maxDim = 1920, quality = 0.9 } = {}) {
  try {
    if (!file || !/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) return null;
    // GIF animé : le canvas n'en garderait qu'une image figée — on le conserve intact
    if (file.type === 'image/gif') return await readFileAsDataURL(file);
    const dataUrl = await readFileAsDataURL(file);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode'));
      el.src = dataUrl;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    let out = canvas.toDataURL('image/webp', quality);
    if (out.startsWith('data:image/webp')) return out;
    // WebP non supporté : on garde le format d'origine (PNG conserve la transparence)
    if (file.type === 'image/png') return canvas.toDataURL('image/png');
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return null;
  }
}

/* Palette stable par donateur (index du donateur dans la liste triée)
   — tons professionnels harmonisés avec l'identité ARINA */
const PALETTE = ['#7A2C3E', '#B97E2B', '#2E7D32', '#2563EB', '#7C3AED', '#0D9488', '#A94438', '#9CA3AF'];
const donorIndex = (donors, name) => {
  const idx = (donors || []).findIndex((d) => String(d.name).toLowerCase() === String(name || '').toLowerCase());
  return idx === -1 ? (donors || []).length : idx;
};
export const donorColor = (donors, name) => PALETTE[donorIndex(donors, name) % PALETTE.length];
