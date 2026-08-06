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
