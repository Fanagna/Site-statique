// ── Rôles & permissions — source unique de vérité pour l'espace admin ──
// Chaque compte a un rôle (admin, president, accountant, educator) et une clé API.
// L'admin contrôle tout ; les autres rôles ne gèrent que leur domaine.
export const ROLES = {
  admin: 'admin', president: 'president', accountant: 'accountant', educator: 'educator',
};
export const ROLE_LABELS = {
  admin: 'Administrateur', president: 'Président', accountant: 'Comptable', educator: 'Éducateur',
};
// Onglets autorisés par rôle — utilisés pour filtrer le menu latéral et charger
// les données. Rôle inconnu → onglets restreints (fail-closed : jamais l'accès admin complet).
export const ROLE_TABS = {
  admin: ['dashboard', 'actualites', 'enfants', 'finances', 'evaluation', 'donateurs', 'dons', 'messages', 'volunteers', 'testimonials', 'comptes'],
  president: ['dashboard', 'actualites', 'dons', 'messages', 'volunteers', 'testimonials'],
  accountant: ['dashboard', 'finances', 'evaluation', 'donateurs', 'dons'],
  educator: ['dashboard', 'enfants'],
  unknown: ['dashboard'],
};
