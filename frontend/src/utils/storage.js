/* ── Accès sécurisé à localStorage ───────────────────────────────
   Une panne de stockage (quota dépassé, mode privé, stockage désactivé)
   ne doit JAMAIS faire planter l'application : la console montrait une
   « QuotaExceededError » sur 'arina_news' (actualités avec images base64)
   qui déclenchait l'écran d'erreur « Une erreur est survenue lors du
   chargement ». Tous les accès passent par ces helpers. */

export function safeGet(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

export function safeSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* stockage indisponible ou plein */ }
}

export function safeRemove(key) {
  try { window.localStorage.removeItem(key); } catch { /* stockage indisponible */ }
}

// JSON.parse protégé : renvoie `fallback` si la valeur est absente ou corrompue.
export function safeParse(str, fallback) {
  try { return str ? JSON.parse(str) : fallback; } catch { return fallback; }
}

/* Purge des caches de données volumineux (> 1 Mo). Les données réelles vivent
   dans l'API — le cache n'est qu'un repli hors-ligne — donc un cache gonflé
   (ex. actualités avec images base64, photos de bénéficiaires) peut être jeté
   sans risque. Appelé au login : sans cette purge, un localStorage plein
   ferait échouer silencieusement l'écriture de la clé de session (l'ancienne
   clé périmée resterait → 401 sur tous les endpoints au prochain refresh). */
const CACHE_KEYS = [
  'arina_news', 'arina_benefs', 'arina_finances', 'arina_donors',
  'arina_contacts', 'arina_volunteers', 'arina_testimonials', 'arina_donations',
];
const MAX_CACHE_BYTES = 1024 * 1024;

export function pruneOversizedCaches() {
  for (const key of CACHE_KEYS) {
    const v = safeGet(key);
    if (v && v.length > MAX_CACHE_BYTES) safeRemove(key);
  }
}
