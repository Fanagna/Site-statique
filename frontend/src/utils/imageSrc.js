/* ── Helpers d'images responsives (partagés par ResponsiveImage et le HeroSlider) ──
   Fonctions pures, sans composant — séparées pour un Fast Refresh fiable
   (react/only-export-components). */

export const DEFAULT_WIDTHS = [480, 640, 768, 1024, 1280, 1536, 1920];
export const DEFAULT_QUALITY = 82;

const isProdHost =
  typeof window !== 'undefined' &&
  !['localhost', '127.0.0.1'].includes(window.location.hostname) &&
  import.meta.env.PROD;

/* Seules les images statiques servies par le même domaine (/images/…) peuvent
   passer par l'optimiseur Vercel. */
export const canOptimize = (src) =>
  typeof src === 'string' &&
  src.startsWith('/') &&
  !src.startsWith('//') &&
  !src.startsWith('data:') &&
  isProdHost;

/* URL Vercel d'une largeur donnée (ou null si l'image n'est pas optimisable). */
export const optimizedSrc = (src, w, quality = DEFAULT_QUALITY) =>
  canOptimize(src) ? `/_vercel/image?url=${encodeURIComponent(src)}&w=${w}&q=${quality}` : null;

export const buildSrcSet = (src, widths, quality) =>
  widths.map((w) => `${optimizedSrc(src, w, quality)} ${w}w`).join(', ');

/* Version CSS (fond d'image, ex. héro) : image-set() multi-largeurs — le navigateur
   choisit la taille adaptée à l'écran. Repli : URL simple hors Vercel. */
export const buildImageSet = (src, widths = DEFAULT_WIDTHS, quality = DEFAULT_QUALITY) => {
  if (!canOptimize(src)) return `url(${src})`;
  const candidates = widths
    .map((w) => `url(/_vercel/image?url=${encodeURIComponent(src)}&w=${w}&q=${quality}) ${w}w`)
    .join(', ');
  return `image-set(${candidates})`;
};
