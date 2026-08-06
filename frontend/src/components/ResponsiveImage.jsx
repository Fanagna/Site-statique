/* ── Image responsive à la façon des grands sites ──
   Génère les attributs srcset/sizes pour que le navigateur télécharge UNIQUEMENT
   la taille dont il a besoin (mobile, tablette, desktop, retina), via l'endpoint
   d'optimisation d'images de Vercel (/_vercel/image?url=...&w=...&q=...).

   Dégradations propres :
   - image uploadée en base64 (data: URL)  → <img> simple (déjà optimisée) ;
   - URL externe (http…)                   → <img> simple (non optimisable localement) ;
   - développement local (localhost)       → <img> simple (pas d'endpoint Vercel). */
import { memo } from 'react';
import { DEFAULT_WIDTHS, DEFAULT_QUALITY, canOptimize, buildSrcSet } from '../utils/imageSrc';

function ResponsiveImage({
  src,
  alt = '',
  className,
  sizes,
  widths = DEFAULT_WIDTHS,
  quality = DEFAULT_QUALITY,
  priority = false,
  loading,
  decoding = 'async',
  fetchPriority,
  ...rest
}) {
  const optimized = canOptimize(src);
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading || (priority ? 'eager' : 'lazy')}
      decoding={decoding}
      fetchPriority={fetchPriority || (priority ? 'high' : undefined)}
      {...(optimized ? { srcSet: buildSrcSet(src, widths, quality), sizes } : {})}
      {...rest}
    />
  );
}

export default memo(ResponsiveImage);
