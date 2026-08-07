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
// Politique d'accès :
//  - admin      : tout (gestion des comptes, des dons et du personnel comprise)
//  - président  : tableau de bord (aperçu complet en lecture), actualités,
//                 présences (CRUD) & scan, personnel (CRUD), évaluation mensuelle,
//                 messages, candidatures, témoignages
//  - comptable  : tableau de bord (aperçu complet en lecture), finances,
//                 évaluation mensuelle, donateurs, présences (CRUD) & scan, personnel
//  - éducateur  : tableau de bord, enfants (CRUD), présences (badges QR),
//                 personnel (présences & scan), évaluation mensuelle (lecture),
//                 messages, candidatures, témoignages
//  - personnel  : onglet présent pour tous — la CRUD des fiches reste réservée
//                 à l'admin et au président (vérifiée côté API aussi).
export const ROLE_TABS = {
  admin: ['dashboard', 'actualites', 'enfants', 'finances', 'evaluation', 'donateurs', 'dons', 'presences', 'scan', 'personnel', 'messages', 'volunteers', 'testimonials', 'comptes'],
  president: ['dashboard', 'actualites', 'presences', 'scan', 'personnel', 'evaluation', 'messages', 'volunteers', 'testimonials'],
  accountant: ['dashboard', 'finances', 'evaluation', 'donateurs', 'presences', 'scan', 'personnel'],
  educator: ['dashboard', 'enfants', 'presences', 'scan', 'personnel', 'evaluation', 'messages', 'volunteers', 'testimonials'],
  unknown: ['dashboard'],
};
