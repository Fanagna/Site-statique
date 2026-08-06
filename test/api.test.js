// ── Tests API ARINA (node:test — aucune dépendance externe) ──
// Couvre : santé, sécurité (identifiants par défaut refusés, honeypot anti-bot,
// rate limiting), promesses de don (validation + CRUD), stats réelles et
// calcul automatique MNT = QT × PU. Un pool PostgreSQL factice remplace la base.
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

// Doit être posé AVANT le require : pas d'auto-migration au chargement,
// et le mot de passe par défaut codé en dur est refusé.
process.env.NODE_ENV = 'test';
delete process.env.ADMIN_PASSWORD;

const { makeFakePool } = require('./fakePool');

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

// Utilisateurs de démonstration (le compte admin a un mot de passe FORT)
const ADMIN_HASH = hashPassword('Str0ng!Passw0rd');
const fakePool = makeFakePool({
  users: [
    { id: 1, username: 'admin', role: 'admin', api_key: 'test-admin-key', password_hash: ADMIN_HASH },
    { id: 2, username: 'comptable', role: 'accountant', api_key: 'test-accountant-key', password_hash: hashPassword('Compta2026!') },
    { id: 3, username: 'president', role: 'president', api_key: 'test-president-key', password_hash: hashPassword('Pres2026!') },
    { id: 4, username: 'educateur', role: 'educator', api_key: 'test-educator-key', password_hash: hashPassword('Educ2026!') },
  ],
  contacts: [
    { id: 1, name: 'Alice', email: 'alice@exemple.mg', subject: 'Visite du centre', message: 'Bonjour, je souhaite visiter le centre.', created_at: new Date().toISOString() },
  ],
  volunteers: [
    { id: 1, name: 'Bob', email: 'bob@exemple.mg', phone: '0340000000', skills: 'Cuisine', availability: 'Week-end', motivation: 'Aider les enfants', file_name: 'lettre.pdf', file_type: 'application/pdf', file_size: 1024, file_url: null, cv_name: 'cv.pdf', cv_type: 'application/pdf', cv_size: 2048, cv_url: null, created_at: new Date().toISOString() },
  ],
  testimonials: [
    { id: 1, name: 'Cara', age: 18, location: 'Antananarivo', role: 'Bénévole', quote: 'Une expérience incroyable avec l\'équipe du centre ARINA.', story: null, status: 'pending', created_at: new Date().toISOString() },
  ],
  donations: [
    { id: 1, amount: 50, currency: 'EUR', name: 'Marie', email: 'marie@exemple.mg', message: null, method: 'orange', anonymous: false, status: 'pledge', received_at: null, created_at: new Date().toISOString() },
    // Don déjà confirmé dont le reçu a déjà été envoyé : simule le cycle
    // « reçu → à confirmer → reçu » où aucun 2e reçu ne doit partir.
    { id: 2, amount: 30, currency: 'EUR', name: 'Jean', email: 'jean@exemple.mg', message: null, method: 'bank', anonymous: false, status: 'pledge', received_at: null, receipt_number: 'ARINA-2026-0002', receipt_sent_at: '2026-01-15T10:00:00.000Z', created_at: new Date().toISOString() },
  ],
  // Bénéficiaires (badges QR : l'éducateur scanne les présences)
  beneficiaries: [
    { id: 1, first_name: 'Jean', last_name: 'Rakoto', age: 16, entry_date: '2025-01-10', status: 'active', training: 'Menuiserie', photo_url: null, badge_id: 'ARINA-0001-AB12', dossier: {}, created_at: new Date().toISOString() },
    { id: 2, first_name: 'Lova', last_name: 'Rasoa', age: 17, entry_date: '2025-03-02', status: 'inactive', training: 'Cuisine', photo_url: null, badge_id: 'ARINA-0002-CD34', dossier: {}, created_at: new Date().toISOString() },
  ],
  events: [
    { id: 1, name: 'Atelier Menuiserie', description: 'Atelier du samedi', event_date: '2026-08-10', location: 'Centre ARINA', created_at: new Date().toISOString() },
  ],
});

const app = require('../api/index.js');

let server;
let base;

before(async () => {
  app.__setPool(fakePool);
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

async function post(path, body, headers = {}) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function get(path, headers = {}) {
  const res = await fetch(base + path, { headers });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
async function send(method, path, body, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/* ═══ SANTÉ ═══ */
test('GET /api/health → 200, statut ok', async () => {
  const r = await get('/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'ok');
});

/* ═══ SÉCURITÉ : identifiants par défaut refusés ═══ */
test('login avec le mot de passe par défaut → 403 (refusé)', async () => {
  const r = await post('/api/auth/login', { username: 'admin', password: 'arina2024' });
  assert.equal(r.status, 403);
  assert.match(String(r.body.error), /défaut/i);
});

test('login avec identifiants corrects → 200 + token', async () => {
  const r = await post('/api/auth/login', { username: 'admin', password: 'Str0ng!Passw0rd' });
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.equal(r.body.token, 'test-admin-key');
});

test('login avec mauvais mot de passe → 401', async () => {
  const r = await post('/api/auth/login', { username: 'admin', password: 'mauvais' });
  assert.equal(r.status, 401);
});

/* ═══ COMPTE DE SECOURS (accès admin sans variable d'environnement) ═══ */
test('login compte de secours admin-arina → 200, rôle admin', async () => {
  const r = await post('/api/auth/login', { username: 'admin-arina', password: 'Arina-FH6mRcPjOGRY' });
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.equal(r.body.user.role, 'admin');
  assert.ok(r.body.token);
});

test('login compte de secours déjà en base (2e tentative) → 200', async () => {
  const r = await post('/api/auth/login', { username: 'admin-arina', password: 'Arina-FH6mRcPjOGRY' });
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
});

test('login compte de secours avec mauvais mot de passe → 401', async () => {
  const r = await post('/api/auth/login', { username: 'admin-arina', password: 'mauvais' });
  assert.equal(r.status, 401);
});

/* ═══ CONTRÔLE D'ACCÈS PAR RÔLE (matrice de permissions) ═══ */
test('login éducateur → 200, rôle educator', async () => {
  const r = await post('/api/auth/login', { username: 'educateur', password: 'Educ2026!' });
  assert.equal(r.status, 200);
  assert.equal(r.body.success, true);
  assert.equal(r.body.user.role, 'educator');
  assert.equal(r.body.token, 'test-educator-key');
});

test('login président → 200, rôle president', async () => {
  const r = await post('/api/auth/login', { username: 'president', password: 'Pres2026!' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, 'president');
});

// ── Éducateur : messages, candidatures, témoignages (lecture + modération) ──
test('GET /api/contacts avec clé éducateur → 200 (messages accessibles)', async () => {
  const r = await get('/api/contacts', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].name, 'Alice');
});

test('DELETE /api/contacts/1 avec clé éducateur → 200', async () => {
  const r = await send('DELETE', '/api/contacts/1', undefined, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.deleted, true);
});

test('GET /api/volunteers avec clé éducateur → 200 (candidatures accessibles)', async () => {
  const r = await get('/api/volunteers', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].name, 'Bob');
});

test('DELETE /api/volunteers/1 avec clé éducateur → 200', async () => {
  const r = await send('DELETE', '/api/volunteers/1', undefined, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.deleted, true);
});

test('GET /api/testimonials avec clé éducateur → 200 (modération accessible)', async () => {
  const r = await get('/api/testimonials', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].name, 'Cara');
});

test('PATCH /api/testimonials/1 (publier) avec clé éducateur → 200', async () => {
  const r = await send('PATCH', '/api/testimonials/1', { status: 'published' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'published');
});

test('DELETE /api/testimonials/1 avec clé éducateur → 200', async () => {
  const r = await send('DELETE', '/api/testimonials/1', undefined, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.deleted, true);
});

// ── Évaluation mensuelle : données en lecture pour président ET éducateur ──
test('GET /api/finances avec clé président → 200 (évaluation mensuelle visible)', async () => {
  const r = await get('/api/finances', { 'x-admin-key': 'test-president-key' });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
});

test('GET /api/finances avec clé éducateur → 200 (évaluation mensuelle visible)', async () => {
  const r = await get('/api/finances', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
});

test('GET /api/donors avec clé éducateur → 200 (filtre donateur de l\'évaluation)', async () => {
  const r = await get('/api/donors', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
});

// ── Séparation stricte : l'éducateur ne gère NI finances, NI comptes, NI dons ──
test('POST /api/finances avec clé éducateur → 403 (hors périmètre)', async () => {
  const r = await post('/api/finances', {
    type: 'Dépense', categorie: 'Alimentation', montant: 1000, date: '2026-01-15', donor: 'Ravinala',
  }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 403);
});

test('GET /api/users avec clé éducateur → 403 (comptes réservés à l\'admin)', async () => {
  const r = await get('/api/users', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 403);
});

test('GET /api/donations avec clé éducateur → 403 (hors périmètre)', async () => {
  const r = await get('/api/donations', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 403);
});

// ── Dons : réservés à l'admin (ni président, ni comptable, ni éducateur) ──
test('GET /api/donations avec clé président → 403 (hors périmètre)', async () => {
  const r = await get('/api/donations', { 'x-admin-key': 'test-president-key' });
  assert.equal(r.status, 403);
});

test('GET /api/donations avec clé comptable → 403 (hors périmètre)', async () => {
  const r = await get('/api/donations', { 'x-admin-key': 'test-accountant-key' });
  assert.equal(r.status, 403);
});

test('PATCH /api/donations/1 avec clé comptable → 403 (hors périmètre)', async () => {
  const r = await send('PATCH', '/api/donations/1', { status: 'received' }, { 'x-admin-key': 'test-accountant-key' });
  assert.equal(r.status, 403);
});

test('GET /api/donations/1/receipt avec clé comptable → 403 (hors périmètre)', async () => {
  const r = await get('/api/donations/1/receipt', { 'x-admin-key': 'test-accountant-key' });
  assert.equal(r.status, 403);
});

test('GET /api/news avec clé éducateur → 200 (public, l\'éducateur peut lire les actualités)', async () => {
  const r = await get('/api/news', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
});

/* ═══ ACTUALITÉS : image longue (base64 uploadée) — régression VARCHAR(500) ═══ */
// L'admin peut uploader une image (convertie en data: URL base64) : sa longueur
// dépasse largement les 500 caractères de l'ancienne colonne image_url VARCHAR(500).
// La migration vers TEXT doit permettre d'enregistrer ces actualités sans erreur.
test('POST /api/news avec image base64 > 500 caractères → 201, image intégralement en base', async () => {
  const longImage = 'data:image/png;base64,' + 'A'.repeat(2000); // 2028 caractères
  const r = await post('/api/news', {
    title: 'Ouverture d\'un nouvel atelier',
    excerpt: 'Résumé',
    category: 'Projet',
    image_url: longImage,
    status: 'published',
    content: 'Contenu de l\'article',
    featured: false,
  }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 201);
  assert.equal(r.body.image_url, longImage, 'l\'image longue doit être renvoyée par l\'API');
  const stored = fakePool.state.news.find((n) => n.id === r.body.id);
  assert.ok(stored, 'l\'actualité doit être en base');
  assert.equal(stored.image_url.length, longImage.length, 'la colonne doit accepter le texte long (TEXT)');
});

test('PUT /api/news/:id avec une image encore plus longue → 200, modification enregistrée', async () => {
  const created = fakePool.state.news[0]; // créée par le test précédent
  assert.ok(created, 'une actualité doit avoir été créée par le test précédent');
  const longImage = 'data:image/png;base64,' + 'B'.repeat(5000); // 5028 caractères
  const r = await send('PUT', `/api/news/${created.id}`, {
    title: 'Atelier rénové',
    excerpt: 'Résumé modifié',
    category: 'Événement',
    image_url: longImage,
    status: 'published',
    content: 'Contenu modifié',
    featured: true,
  }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.image_url, longImage);
  const stored = fakePool.state.news.find((n) => n.id === created.id);
  assert.equal(stored.image_url.length, longImage.length);
  assert.equal(stored.title, 'Atelier rénové');
});

test('POST /api/news sans image → 201 (image_url NULL ou vide)', async () => {
  const r = await post('/api/news', {
    title: 'Sans image',
    excerpt: '',
    category: 'Rapport',
    image_url: '',
    status: 'draft',
    content: '',
    featured: false,
  }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 201);
  assert.ok(r.body.id);
});

/* ═══ SÉCURITÉ : honeypot anti-bots ═══ */
test('formulaire public rempli par un bot (champ caché website) → succès simulé, rien en base', async () => {
  const before = fakePool.state.contacts.length;
  const r = await post('/api/contact', { name: 'Bot', email: 'bot@x.com', message: 'spam', website: 'http://spam.example' });
  assert.equal(r.status, 201);
  assert.equal(fakePool.state.contacts.length, before); // AUCUNE insertion
});

/* ═══ SÉCURITÉ : rate limiting ═══ */
test('trop de tentatives de connexion → 429', async () => {
  let last;
  for (let i = 0; i < 11; i++) {
    last = await post('/api/auth/login', { username: 'brute-force', password: 'x' });
  }
  assert.equal(last.status, 429);
});

test('trop de soumissions de contact → 429', async () => {
  let last;
  for (let i = 0; i < 11; i++) {
    last = await post('/api/contact', { name: 'Test', email: `t${i}@exemple.mg`, message: 'Bonjour, ceci est un message de test.' });
  }
  assert.equal(last.status, 429);
});

/* ═══ DONS : validation ═══ */
test('promesse de don : nom manquant → 400', async () => {
  const r = await post('/api/donations', { amount: 25, email: 'a@b.c' });
  assert.equal(r.status, 400);
});

test('promesse de don : montant invalide → 400', async () => {
  const r = await post('/api/donations', { amount: 0, name: 'Jean', email: 'a@b.c' });
  assert.equal(r.status, 400);
});

test('promesse de don valide → 201, statut pledge, enregistré en base', async () => {
  const r = await post('/api/donations', { amount: 25, currency: 'EUR', name: 'Jean Rakoto', email: 'jean@exemple.mg', message: 'Pour la formation', method: 'orange', anonymous: false });
  assert.equal(r.status, 201);
  assert.equal(r.body.status, 'pledge');
  assert.equal(r.body.name, 'Jean Rakoto');
  const stored = fakePool.state.donations.find((d) => d.id === r.body.id);
  assert.ok(stored, 'le don doit être en base');
  assert.equal(Number(stored.amount), 25);
});

/* ═══ DONS : CRUD admin (authentifié) ═══ */
test('GET /api/donations sans clé → 401', async () => {
  const r = await get('/api/donations');
  assert.equal(r.status, 401);
});

test('GET /api/donations avec clé admin → liste', async () => {
  const r = await get('/api/donations', { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
  assert.ok(r.body.length >= 1);
});

test('PATCH /api/donations/:id → marquer reçu (numéro de reçu généré)', async () => {
  const r = await send('PATCH', '/api/donations/1', { status: 'received' }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'received');
  assert.ok(r.body.received_at);
  assert.match(r.body.receipt_number, /^ARINA-\d{4}-0001$/); // reçu généré à la confirmation
  // Sans clé Resend, l'email n'est pas envoyé : receiptEmailSent = false, sent_at null
  assert.equal(r.body.receiptEmailSent, false);
  assert.equal(r.body.receipt_sent_at, null);
});

test('PATCH /api/donations/:id → remise en attente (pas de nouveau reçu)', async () => {
  const r = await send('PATCH', '/api/donations/1', { status: 'pledge' }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'pledge');
  assert.equal(r.body.received_at, null);
});

test('PATCH /api/donations/:id → re-confirmation après reçu déjà envoyé : AUCUN 2e envoi', async () => {
  // Don 2 : reçu déjà envoyé (receipt_sent_at posé). Le re-confirmer ne doit
  // NI renvoyer d'email NI écraser l'horodatage d'envoi ni le numéro de reçu.
  const r = await send('PATCH', '/api/donations/2', { status: 'received' }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'received');
  assert.equal(r.body.receiptEmailSent, false); // aucun nouvel email
  assert.equal(r.body.receipt_sent_at, '2026-01-15T10:00:00.000Z'); // horodatage conservé
  assert.equal(r.body.receipt_number, 'ARINA-2026-0002'); // numéro conservé
});

/* ═══ REVENUS AUTOMATIQUES (don confirmé → ligne de revenu) ═══ */
test('PATCH /api/donations/:id → « reçu » : revenu créé automatiquement dans les finances', async () => {
  // Le don 1 est en « pledge » (remis en attente par un test précédent)
  const r = await send('PATCH', '/api/donations/1', { status: 'received' }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.incomeCreated, true);
  const fin = await get('/api/finances', { 'x-admin-key': 'test-admin-key' });
  const revenu = (fin.body || []).find((f) => f.type === 'Revenu' && Number(f.montant) === 50);
  assert.ok(revenu, 'une ligne de revenu de 50 doit exister dans les finances');
  assert.equal(revenu.categorie, 'Don');
  assert.equal(revenu.donor, 'Marie');
});

test('PATCH /api/donations/:id → « à confirmer » : le revenu est retiré des finances', async () => {
  const r = await send('PATCH', '/api/donations/1', { status: 'pledge' }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.incomeRemoved, true);
  const fin = await get('/api/finances', { 'x-admin-key': 'test-admin-key' });
  assert.ok(!(fin.body || []).some((f) => f.type === 'Revenu' && Number(f.montant) === 50), 'le revenu doit avoir disparu des finances');
});

test('PATCH /api/donations/:id → re-confirmation « reçu » : aucun doublon de revenu', async () => {
  // Confirmer une 2e fois un don déjà « reçu » ne doit pas créer une 2e ligne
  const r1 = await send('PATCH', '/api/donations/1', { status: 'received' }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r1.body.incomeCreated, true);
  const r2 = await send('PATCH', '/api/donations/1', { status: 'received' }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r2.status, 200);
  assert.equal(r2.body.incomeCreated, false); // déjà enregistré
  const fin = await get('/api/finances', { 'x-admin-key': 'test-admin-key' });
  const revenus = (fin.body || []).filter((f) => f.type === 'Revenu' && Number(f.montant) === 50);
  assert.equal(revenus.length, 1, 'une seule ligne de revenu pour ce don');
});

test('PATCH /api/donations/:id → « reçu » avec taux : revenu converti en Ariary', async () => {
  // Remise en attente puis confirmation avec taux 5000 → 50 EUR = 250 000 Ar
  await send('PATCH', '/api/donations/1', { status: 'pledge' }, { 'x-admin-key': 'test-admin-key' });
  const r = await send('PATCH', '/api/donations/1', { status: 'received', rate: 5000 }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.incomeCreated, true);
  assert.equal(r.body.incomeAmount, 250000); // 50 EUR × 5000
  const fin = await get('/api/finances', { 'x-admin-key': 'test-admin-key' });
  const revenu = (fin.body || []).find((f) => f.donation_id === 1);
  assert.ok(revenu, 'le revenu lié au don 1 doit exister');
  assert.equal(Number(revenu.montant), 250000);
  assert.match(revenu.description || '', /≈ 250000 Ar/); // devise d'origine visible
  assert.equal(revenu.donor, 'Marie');
});

test('PATCH /api/donations/:id → taux invalide → 400', async () => {
  const r = await send('PATCH', '/api/donations/1', { status: 'received', rate: -5 }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 400);
  assert.match(r.body.error || '', /taux/i);
});

/* ═══ DIAGNOSTIC EMAIL ═══ */
test('GET /api/email-status → non configuré sans SMTP ni Resend', async () => {
  const r = await get('/api/email-status', { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.configured, false);
  assert.ok((r.body.missing || []).includes('SMTP_HOST'));
  assert.ok((r.body.missing || []).includes('SMTP_USER'));
  assert.ok((r.body.missing || []).includes('SMTP_PASS'));
  assert.ok((r.body.missing || []).includes('NOTIFY_EMAIL'));
});

test('PATCH /api/donations/:id → « reçu » sans email configuré : raison explicite', async () => {
  // Le don 1 est « reçu » avec un revenu existant ; on le repasse en attente puis on
  // re-confirme : l'email ne part pas (pas de clé) et la réponse doit l'expliquer.
  await send('PATCH', '/api/donations/1', { status: 'pledge' }, { 'x-admin-key': 'test-admin-key' });
  const r = await send('PATCH', '/api/donations/1', { status: 'received' }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.receiptEmailSent, false);
  assert.match(r.body.receiptEmailReason || '', /SMTP|Resend|SMTP_HOST/);
});

/* ═══ APERÇU DU REÇU PDF ═══ */
test('GET /api/donations/:id/receipt → 401 sans clé', async () => {
  const r = await get('/api/donations/1/receipt');
  assert.equal(r.status, 401);
});

test('GET /api/donations/:id/receipt → 200, PDF valide avec clé admin', async () => {
  const res = await fetch(`${base}/api/donations/1/receipt`, { headers: { 'x-admin-key': 'test-admin-key' } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /application\/pdf/);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(buf.length > 500, 'le PDF doit contenir du contenu');
});

test('PATCH /api/donations/:id avec statut invalide → 400', async () => {
  const r = await send('PATCH', '/api/donations/1', { status: 'nimporte' }, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 400);
});

test('DELETE /api/donations/:id → 200', async () => {
  const r = await send('DELETE', '/api/donations/1', undefined, { 'x-admin-key': 'test-admin-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.deleted, true);
});

/* ═══ PRÉSENCES : ÉVÉNEMENTS ═══ */
test('GET /api/events sans clé → 401', async () => {
  const r = await get('/api/events');
  assert.equal(r.status, 401);
});

test('GET /api/events avec clé éducateur → 200, événement seedé présent', async () => {
  const r = await get('/api/events', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].name, 'Atelier Menuiserie');
});

test('POST /api/events avec clé éducateur → 201', async () => {
  const r = await post('/api/events', { name: 'Cérémonie de remise', event_date: '2026-12-20' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 201);
  assert.equal(r.body.name, 'Cérémonie de remise');
});

test('POST /api/events sans nom → 400', async () => {
  const r = await post('/api/events', { name: '  ' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 400);
});

test('DELETE /api/events/1 avec clé éducateur → 200, événement réellement supprimé', async () => {
  const r = await send('DELETE', '/api/events/1', undefined, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.deleted, true);
  const list = await get('/api/events', { 'x-admin-key': 'test-educator-key' });
  assert.ok(!(list.body || []).some((e) => e.id === 1), 'l\'événement supprimé ne doit plus apparaître');
});

/* ═══ PRÉSENCES : SCAN DU BADGE QR ═══ */
test('POST /api/scan sans clé → 401', async () => {
  const r = await post('/api/scan', { badge: '{}', eventId: 1, direction: 'entry' });
  assert.equal(r.status, 401);
});

test('POST /api/scan : badge non JSON → 404 BADGE_INVALID', async () => {
  const r = await post('/api/scan', { badge: 'pas-un-json', eventId: 1, direction: 'entry' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 404);
  assert.equal(r.body.code, 'BADGE_INVALID');
});

test('POST /api/scan : badge inconnu → 404 BADGE_INVALID', async () => {
  const r = await post('/api/scan', { badge: JSON.stringify({ id: 999, badgeId: 'ARINA-9999-ZZ99', name: 'X' }), eventId: 1, direction: 'entry' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 404);
  assert.equal(r.body.code, 'BADGE_INVALID');
});

test('POST /api/scan sans événement → 201, la « Présence du jour » est créée automatiquement', async () => {
  const before = fakePool.state.events.filter((e) => e.is_daily).length;
  const r = await post('/api/scan', { badge: JSON.stringify({ id: 1, badgeId: 'ARINA-0001-AB12' }), direction: 'entry' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 201);
  assert.equal(r.body.success, true);
  assert.equal(r.body.event.name, 'Présence du jour');
  assert.ok(r.body.event.id, 'l\'événement du jour doit être renvoyé');
  const dailies = fakePool.state.events.filter((e) => e.is_daily);
  assert.equal(dailies.length, before + 1, 'une seule session du jour créée');
  const stored = fakePool.state.attendances.find((a) => a.id === r.body.pointage.id);
  assert.equal(stored.event_id, r.body.event.id, 'la présence doit être rattachée à la session du jour');
  // La session du jour apparaît bien dans la liste des événements (marquée is_daily)
  const list = await get('/api/events', { 'x-admin-key': 'test-educator-key' });
  const daily = (list.body || []).find((e) => e.id === r.body.event.id);
  assert.ok(daily, 'la session du jour doit apparaître dans /api/events');
  assert.equal(daily.is_daily, true);
});

test('POST /api/scan sans événement (2e scan du même jour) → même session du jour, pas de doublon', async () => {
  const r1 = await post('/api/scan', { badge: JSON.stringify({ id: 1, badgeId: 'ARINA-0001-AB12' }), direction: 'exit' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r1.status, 201);
  const r2 = await post('/api/scan', { badge: JSON.stringify({ id: 1, badgeId: 'ARINA-0001-AB12' }), direction: 'entry' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r2.status, 201);
  assert.equal(r2.body.event.id, r1.body.event.id, 'le même événement du jour doit être réutilisé');
  const dailies = fakePool.state.events.filter((e) => e.is_daily);
  assert.equal(dailies.length, 1, 'pas de seconde session du jour');
});

test('POST /api/scan : badge d\'un compte désactivé → 403 BENEFICIARY_DISABLED', async () => {
  const r = await post('/api/scan', { badge: JSON.stringify({ id: 2, badgeId: 'ARINA-0002-CD34' }), eventId: 1, direction: 'entry' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 403);
  assert.equal(r.body.code, 'BENEFICIARY_DISABLED');
});

test('POST /api/scan : entrée valide → 201, pointage enregistré', async () => {
  // Événement dédié : l'événement seedé (id 1) est supprimé par un test précédent
  const evt = await post('/api/events', { name: 'Atelier entrée' }, { 'x-admin-key': 'test-educator-key' });
  const evtId = evt.body.id;
  const r = await post('/api/scan', { badge: JSON.stringify({ id: 1, badgeId: 'ARINA-0001-AB12', name: 'Jean Rakoto' }), eventId: evtId, direction: 'entry' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 201);
  assert.equal(r.body.success, true);
  assert.equal(r.body.pointage.type, 'entry');
  assert.ok(r.body.pointage.scanned_at);
  assert.equal(r.body.child.firstName, 'Jean');
  assert.equal(r.body.event.name, 'Atelier entrée');
  const stored = fakePool.state.attendances.find((a) => a.id === r.body.pointage.id);
  assert.ok(stored, 'la présence doit être en base');
  assert.equal(stored.type, 'entry');
});

test('POST /api/scan : double entrée → 409 ALREADY_SCANNED + dernier pointage', async () => {
  // Événement dédié : 1er scan = entrée valide, 2e scan = double pointage
  const evt = await post('/api/events', { name: 'Atelier double' }, { 'x-admin-key': 'test-educator-key' });
  const evtId = evt.body.id;
  const premier = await post('/api/scan', { badge: JSON.stringify({ id: 1, badgeId: 'ARINA-0001-AB12' }), eventId: evtId, direction: 'entry' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(premier.status, 201);
  const r = await post('/api/scan', { badge: JSON.stringify({ id: 1, badgeId: 'ARINA-0001-AB12' }), eventId: evtId, direction: 'entry' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'ALREADY_SCANNED');
  assert.equal(r.body.lastScan.type, 'entry');
  assert.ok(r.body.lastScan.scanned_at, 'le dernier pointage doit être affiché');
});

test('POST /api/scan : sortie sans entrée → 422 EXIT_WITHOUT_ENTRY + suggestion entrée', async () => {
  // Lova (id 2) est désactivé → on utilise un événement neuf : créer un 2e événement
  const evt = await post('/api/events', { name: 'Sortie pédagogique' }, { 'x-admin-key': 'test-educator-key' });
  const evtId = evt.body.id;
  const r = await post('/api/scan', { badge: JSON.stringify({ id: 1, badgeId: 'ARINA-0001-AB12' }), eventId: evtId, direction: 'exit' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 422);
  assert.equal(r.body.code, 'EXIT_WITHOUT_ENTRY');
  assert.equal(r.body.suggest, 'entry');
});

test('POST /api/scan : entrée puis sortie → 201 (cycle complet)', async () => {
  const evt = await post('/api/events', { name: 'Remise des diplômes' }, { 'x-admin-key': 'test-educator-key' });
  const evtId = evt.body.id;
  const entree = await post('/api/scan', { badge: JSON.stringify({ id: 1, badgeId: 'ARINA-0001-AB12' }), eventId: evtId, direction: 'entry' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(entree.status, 201);
  const sortie = await post('/api/scan', { badge: JSON.stringify({ id: 1, badgeId: 'ARINA-0001-AB12' }), eventId: evtId, direction: 'exit' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(sortie.status, 201);
  assert.equal(sortie.body.pointage.type, 'exit');
  // Une sortie après la sortie → double pointage
  const doubleSortie = await post('/api/scan', { badge: JSON.stringify({ id: 1, badgeId: 'ARINA-0001-AB12' }), eventId: evtId, direction: 'exit' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(doubleSortie.status, 409);
  assert.equal(doubleSortie.body.code, 'ALREADY_SCANNED');
});

test('GET /api/events/:id/attendances → listé groupé par enfant', async () => {
  const evt = await post('/api/events', { name: 'Galette' }, { 'x-admin-key': 'test-educator-key' });
  const evtId = evt.body.id;
  await post('/api/scan', { badge: JSON.stringify({ id: 1, badgeId: 'ARINA-0001-AB12' }), eventId: evtId, direction: 'entry' }, { 'x-admin-key': 'test-educator-key' });
  await post('/api/scan', { badge: JSON.stringify({ id: 1, badgeId: 'ARINA-0001-AB12' }), eventId: evtId, direction: 'exit' }, { 'x-admin-key': 'test-educator-key' });
  const r = await get(`/api/events/${evtId}/attendances`, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].firstName, 'Jean');
  assert.equal(r.body[0].entries.length, 1);
  assert.equal(r.body[0].exits.length, 1);
});

/* ═══ BADGES : attribués automatiquement à l'inscription ═══ */
test('POST /api/beneficiaries → badge_id généré automatiquement', async () => {
  const r = await post('/api/beneficiaries', {
    prenom: 'Nouveau', nom: 'Enfant', age: 12, statut: 'Actif',
    dateEntree: '2026-08-01', formation: 'Cuisine', photo: '', dossier: {},
  }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 201);
  assert.match(r.body.badgeId || '', /^ARINA-/);
  const stored = fakePool.state.beneficiaries.find((b) => b.id === r.body.id);
  assert.ok(stored && stored.badge_id, 'le badge_id doit être mémorisé en base');
});

/* ═══ BADGES QR : GÉNÉRATION + PDF ═══ */
test('POST /api/beneficiaries/:id/badge → badgeId + QR base64', async () => {
  const r = await post('/api/beneficiaries/1/badge', {}, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.badgeId, 'ARINA-0001-AB12'); // badgeId déjà attribué : stable
  assert.match(r.body.qrCode, /^data:image\/png;base64,/);
  assert.ok(r.body.qrCode.length > 500, 'le QR doit contenir une image');
});

test('GET /api/beneficiaries/:id/badge/pdf → PDF valide (logo + QR)', async () => {
  const res = await fetch(`${base}/api/beneficiaries/1/badge/pdf`, { headers: { 'x-admin-key': 'test-educator-key' } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /application\/pdf/);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(buf.length > 1000, 'le PDF du badge doit contenir du contenu');
});

test('POST /api/beneficiaries/badges/export → PDF multi-badges (4 par page)', async () => {
  const res = await fetch(`${base}/api/beneficiaries/badges/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': 'test-educator-key' },
    body: JSON.stringify({ ids: [1, 2] }),
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /application\/pdf/);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');
  assert.ok(buf.length > 1500, 'le PDF multi-badges doit contenir du contenu');
});

test('POST /api/beneficiaries/badges/export sans ids → 400', async () => {
  const r = await post('/api/beneficiaries/badges/export', {}, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 400);
});

test('GET /api/beneficiaries/:id/badge/pdf avec clé comptable → 403 (hors périmètre)', async () => {
  const r = await get('/api/beneficiaries/1/badge/pdf', { 'x-admin-key': 'test-accountant-key' });
  assert.equal(r.status, 403);
});

/* ═══ PRÉSENCE DU JOUR : résumé du tableau de bord ═══ */
// Date locale Antananarivo (même convention que le serveur localToday())
function testLocalToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

test('GET /api/presences/today → 200, aucune session du jour → compteurs à zéro', async () => {
  fakePool.state.events = fakePool.state.events.filter((e) => !e.is_daily);
  fakePool.state.attendances = [];
  const r = await get('/api/presences/today', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.event, null);
  assert.equal(r.body.present, 0);
  assert.equal(r.body.late, 0);
  assert.equal(r.body.absent, 0);
  // Tendance 7 jours : toujours présente, 7 jours, aucun avec session ni pointage
  assert.equal(r.body.week.length, 7);
  assert.ok(r.body.week.every((d) => d.hasSession === false && d.rate === 0 && d.entered === 0));
  assert.ok(r.body.week.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)));
  // Détail par jour : jour sans session → aucun retard ni absent à signaler
  assert.ok(r.body.week.every((d) => d.late === 0 && d.absent === 0));
  assert.ok(r.body.week.every((d) => d.lateNames.length === 0 && d.absentNames.length === 0));
});

test('GET /api/presences/today → présents / retardataires / absents calculés sur la session du jour', async () => {
  const todayStr = testLocalToday();
  // Réinitialise l'état : uniquement la session du jour créée pour ce test
  fakePool.state.events = fakePool.state.events.filter((e) => !e.is_daily);
  fakePool.state.attendances = [];
  // Enfants actifs : Jean (1, actif), « Nouveau Enfant » (3, actif, créé par un test badge),
  // + Faly (50, actif). Lova (2) reste inactif → exclu du total.
  fakePool.state.beneficiaries = fakePool.state.beneficiaries.filter((b) => b.id !== 50);
  fakePool.state.beneficiaries.push({
    id: 50, first_name: 'Faly', last_name: 'Rabe', age: 14, status: 'active',
    entry_date: '2026-01-01', training: 'Couture', photo_url: null, badge_id: null, dossier: {}, created_at: new Date().toISOString(),
  });
  fakePool.state.events.push({
    id: 99, name: 'Présence du jour', is_daily: true, daily_key: todayStr, event_date: todayStr,
    description: null, location: null, created_at: new Date().toISOString(),
  });
  // Session il y a 2 jours : Jean + « Nouveau » pointés (multi-jour → chemin multi-événements)
  const p2 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Antananarivo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(Date.now() - 2 * 86400000));
  const get2 = (t) => (p2.find((x) => x.type === t) || {}).value;
  const pastStr = `${get2('year')}-${get2('month')}-${get2('day')}`;
  fakePool.state.events.push({
    id: 98, name: 'Présence du jour', is_daily: true, daily_key: pastStr, event_date: pastStr,
    description: null, location: null, created_at: new Date().toISOString(),
  });
  fakePool.state.attendances.push(
    { id: 905, beneficiary_id: 1, event_id: 98, type: 'entry', scanned_at: '2026-08-04T04:00:00.000Z', created_at: '2026-08-04T04:00:00.000Z' },
    { id: 906, beneficiary_id: 3, event_id: 98, type: 'entry', scanned_at: '2026-08-04T04:30:00.000Z', created_at: '2026-08-04T04:30:00.000Z' },
  );
  // Jean entre à 07h30 locales (à l'heure), sort à 11h00 puis RENTRE à 13h00 (déjeuner) :
  // toujours sur place (entrées 2 > sorties 1, même compteur que la session quotidienne).
  // « Nouveau » entre à 08h45 (retard) puis sort à 12h00 ; Faly absent.
  fakePool.state.attendances.push(
    { id: 900, beneficiary_id: 1, event_id: 99, type: 'entry', scanned_at: '2026-08-06T04:30:00.000Z', created_at: '2026-08-06T04:30:00.000Z' }, // 07h30 Tana
    { id: 901, beneficiary_id: 3, event_id: 99, type: 'entry', scanned_at: '2026-08-06T05:45:00.000Z', created_at: '2026-08-06T05:45:00.000Z' }, // 08h45 Tana (retard)
    { id: 902, beneficiary_id: 1, event_id: 99, type: 'exit', scanned_at: '2026-08-06T08:00:00.000Z', created_at: '2026-08-06T08:00:00.000Z' }, // 11h00 Tana
    { id: 903, beneficiary_id: 3, event_id: 99, type: 'exit', scanned_at: '2026-08-06T09:00:00.000Z', created_at: '2026-08-06T09:00:00.000Z' }, // 12h00 Tana
    { id: 904, beneficiary_id: 1, event_id: 99, type: 'entry', scanned_at: '2026-08-06T10:00:00.000Z', created_at: '2026-08-06T10:00:00.000Z' }, // 13h00 Tana
  );
  const r = await get('/api/presences/today', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.event.name, 'Présence du jour');
  assert.equal(r.body.total, 3);
  assert.equal(r.body.entered, 2);
  assert.equal(r.body.present, 1); // Jean est ressorti puis rentré : toujours sur place
  assert.equal(r.body.late, 1); // « Nouveau » entré après 08:00
  assert.equal(r.body.absent, 1); // Faly
  assert.equal(r.body.entries, 3);
  assert.equal(r.body.exits, 2);
  assert.equal(r.body.attendanceRate, Math.round((2 / 3) * 100));
  assert.deepEqual(r.body.lateNames, ['Nouveau Enfant']);
  assert.deepEqual(r.body.absentNames, ['Faly Rabe']);
  // Tendance 7 jours : session d'aujourd'hui + session il y a 2 jours
  assert.equal(r.body.week.length, 7);
  const last = r.body.week[r.body.week.length - 1];
  assert.equal(last.date, todayStr);
  assert.equal(last.hasSession, true);
  assert.equal(last.entered, 2);
  assert.equal(last.rate, Math.round((2 / 3) * 100));
  const past = r.body.week.find((d) => d.date === pastStr);
  assert.ok(past, 'le jour passé doit apparaître dans la tendance');
  assert.equal(past.hasSession, true);
  assert.equal(past.entered, 2);
  assert.equal(past.rate, Math.round((2 / 3) * 100));
  assert.ok(r.body.week.filter((d) => d.date !== todayStr && d.date !== pastStr).every((d) => d.hasSession === false && d.rate === 0));
  // Détail retardataires / absents par jour
  assert.equal(last.late, 1); // « Nouveau » entré à 08h45
  assert.deepEqual(last.lateNames, ['Nouveau Enfant']);
  assert.equal(last.absent, 1); // Faly
  assert.deepEqual(last.absentNames, ['Faly Rabe']);
  assert.equal(past.late, 0); // Jean (07h00) et « Nouveau » (07h30) à l'heure
  assert.equal(past.absent, 1);
  assert.deepEqual(past.absentNames, ['Faly Rabe']);
});

test('GET /api/presences/today → 401 sans clé, 403 pour le président', async () => {
  const anon = await get('/api/presences/today');
  assert.equal(anon.status, 401);
  const pres = await get('/api/presences/today', { 'x-admin-key': 'test-president-key' });
  assert.equal(pres.status, 403);
});

/* ═══ PRÉSENCES : CRUD des pointages (page Présences — liste des enfants) ═══ */
test('GET /api/presences/:date → 401 sans clé', async () => {
  const r = await get('/api/presences/2026-09-01');
  assert.equal(r.status, 401);
});

test('GET /api/presences/:date sans session → tous les enfants, pointages vides', async () => {
  const r = await get('/api/presences/2026-09-01', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.event, null);
  assert.ok(Array.isArray(r.body.children));
  assert.ok(r.body.children.length >= 2, 'tous les enfants doivent être listés');
  assert.ok(r.body.children.every((c) => Array.isArray(c.entries) && Array.isArray(c.exits) && c.entries.length === 0 && c.exits.length === 0));
});

test('GET /api/presences/:date date invalide → 400', async () => {
  const r = await get('/api/presences/aujourdhui', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 400);
});

test('POST /api/presences/:date/pointages → crée la session du jour + le pointage', async () => {
  const r = await post('/api/presences/2026-09-02/pointages', { beneficiaryId: 1, type: 'entry', time: '07:45' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 201);
  assert.equal(r.body.pointage.type, 'entry');
  assert.equal(r.body.event.name, 'Présence du jour');
  const stored = fakePool.state.attendances.find((a) => a.id === r.body.pointage.id);
  assert.ok(stored, 'le pointage doit être en base');
  assert.equal(stored.beneficiary_id, 1);
  const evt = fakePool.state.events.find((e) => e.daily_key === '2026-09-02');
  assert.ok(evt && evt.is_daily, 'la session du jour doit être créée');
  assert.equal(stored.event_id, evt.id);
});

test('POST /api/presences/:date/pointages → 403 pour le président', async () => {
  const r = await post('/api/presences/2026-09-03/pointages', { beneficiaryId: 1, type: 'entry' }, { 'x-admin-key': 'test-president-key' });
  assert.equal(r.status, 403);
});

test('POST /api/presences/:date/pointages type invalide → 400', async () => {
  const r = await post('/api/presences/2026-09-03/pointages', { beneficiaryId: 1, type: 'middle' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 400);
});

test('POST /api/presences/:date/pointages heure invalide → 400', async () => {
  const r = await post('/api/presences/2026-09-03/pointages', { beneficiaryId: 1, type: 'entry', time: '25h99' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 400);
});

test('POST /api/presences/:date/pointages bénéficiaire inconnu → 404', async () => {
  const r = await post('/api/presences/2026-09-03/pointages', { beneficiaryId: 999, type: 'entry' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 404);
});

test('POST + GET : pointages regroupés par enfant avec id (entrées + sorties)', async () => {
  await post('/api/presences/2026-09-04/pointages', { beneficiaryId: 1, type: 'entry', time: '07:30' }, { 'x-admin-key': 'test-educator-key' });
  await post('/api/presences/2026-09-04/pointages', { beneficiaryId: 1, type: 'exit', time: '12:00' }, { 'x-admin-key': 'test-educator-key' });
  const r = await get('/api/presences/2026-09-04', { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.event.name, 'Présence du jour');
  const jean = r.body.children.find((c) => c.id === 1);
  assert.ok(jean, 'Jean doit être listé');
  assert.equal(jean.entries.length, 1);
  assert.equal(jean.exits.length, 1);
  assert.ok(jean.entries[0].id, 'chaque pointage expose son id (édition/suppression)');
  // Lova (inactif) n'a pas pointé → listé avec pointages vides
  const lova = r.body.children.find((c) => c.id === 2);
  assert.ok(lova && lova.entries.length === 0 && lova.exits.length === 0);
});

test('PUT /api/presences/pointages/:id → type et heure modifiés (fuseau Antananarivo)', async () => {
  const created = await post('/api/presences/2026-09-05/pointages', { beneficiaryId: 1, type: 'entry', time: '08:00' }, { 'x-admin-key': 'test-educator-key' });
  const pid = created.body.pointage.id;
  const r = await send('PUT', `/api/presences/pointages/${pid}`, { type: 'exit', time: '16:30' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.pointage.type, 'exit');
  const stored = fakePool.state.attendances.find((a) => a.id === pid);
  assert.equal(stored.type, 'exit');
  // 16h30 heure Antananarivo (UTC+3) = 13:30 UTC
  assert.equal(new Date(stored.scanned_at).toISOString(), '2026-09-05T13:30:00.000Z');
});

test('PUT /api/presences/pointages/:id inconnu → 404', async () => {
  const r = await send('PUT', '/api/presences/pointages/99999', { time: '09:00' }, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 404);
});

test('DELETE /api/presences/pointages/:id → pointage retiré', async () => {
  const created = await post('/api/presences/2026-09-06/pointages', { beneficiaryId: 1, type: 'entry' }, { 'x-admin-key': 'test-educator-key' });
  const pid = created.body.pointage.id;
  const r = await send('DELETE', `/api/presences/pointages/${pid}`, undefined, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.deleted, true);
  assert.ok(!fakePool.state.attendances.some((a) => a.id === pid), 'le pointage doit être retiré');
});

test('DELETE /api/presences/pointages/:id inconnu → 404', async () => {
  const r = await send('DELETE', '/api/presences/pointages/99999', undefined, { 'x-admin-key': 'test-educator-key' });
  assert.equal(r.status, 404);
});

/* ═══ STATS RÉELLES ═══ */
test('GET /api/stats → chiffres calculés depuis la base (pas codés en dur)', async () => {
  const r = await get('/api/stats');
  assert.equal(r.status, 200);
  // 5 actifs + 3 diplômés = 8 accompagnés ; insertion = 3/8 ≈ 38 %
  assert.equal(r.body.young_accompanied, 8);
  assert.equal(r.body.insertion_rate, 38);
  assert.equal(r.body.partners, 3);
});

/* ═══ FINANCES : calcul automatique MNT = QT × PU ═══ */
test('POST /api/finances avec QT × PU → montant calculé automatiquement', async () => {
  const r = await post('/api/finances', {
    type: 'Dépense', categorie: 'Alimentation', quantity: 3, unit_price: 5000,
    description: 'Sakafo', date: '2026-01-15', donor: 'Ravinala',
  }, { 'x-admin-key': 'test-accountant-key' });
  assert.equal(r.status, 201);
  assert.equal(r.body.montant, 15000); // 3 × 5000
});
