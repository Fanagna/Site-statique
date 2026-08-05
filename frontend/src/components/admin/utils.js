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

/* Palette stable par donateur (index du donateur dans la liste triée)
   — tons professionnels harmonisés avec l'identité ARINA */
const PALETTE = ['#7A2C3E', '#B97E2B', '#2E7D32', '#2563EB', '#7C3AED', '#0D9488', '#A94438', '#9CA3AF'];
const donorIndex = (donors, name) => {
  const idx = (donors || []).findIndex((d) => String(d.name).toLowerCase() === String(name || '').toLowerCase());
  return idx === -1 ? (donors || []).length : idx;
};
export const donorColor = (donors, name) => PALETTE[donorIndex(donors, name) % PALETTE.length];
