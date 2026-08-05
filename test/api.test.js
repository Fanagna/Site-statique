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
  ],
  donations: [
    { id: 1, amount: 50, currency: 'EUR', name: 'Marie', email: 'marie@exemple.mg', message: null, method: 'orange', anonymous: false, status: 'pledge', received_at: null, created_at: new Date().toISOString() },
    // Don déjà confirmé dont le reçu a déjà été envoyé : simule le cycle
    // « reçu → à confirmer → reçu » où aucun 2e reçu ne doit partir.
    { id: 2, amount: 30, currency: 'EUR', name: 'Jean', email: 'jean@exemple.mg', message: null, method: 'bank', anonymous: false, status: 'pledge', received_at: null, receipt_number: 'ARINA-2026-0002', receipt_sent_at: '2026-01-15T10:00:00.000Z', created_at: new Date().toISOString() },
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
  const r = await send('PATCH', '/api/donations/1', { status: 'received' }, { 'x-admin-key': 'test-accountant-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'received');
  assert.ok(r.body.received_at);
  assert.match(r.body.receipt_number, /^ARINA-\d{4}-0001$/); // reçu généré à la confirmation
  // Sans clé Resend, l'email n'est pas envoyé : receiptEmailSent = false, sent_at null
  assert.equal(r.body.receiptEmailSent, false);
  assert.equal(r.body.receipt_sent_at, null);
});

test('PATCH /api/donations/:id → remise en attente (pas de nouveau reçu)', async () => {
  const r = await send('PATCH', '/api/donations/1', { status: 'pledge' }, { 'x-admin-key': 'test-accountant-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'pledge');
  assert.equal(r.body.received_at, null);
});

test('PATCH /api/donations/:id → re-confirmation après reçu déjà envoyé : AUCUN 2e envoi', async () => {
  // Don 2 : reçu déjà envoyé (receipt_sent_at posé). Le re-confirmer ne doit
  // NI renvoyer d'email NI écraser l'horodatage d'envoi ni le numéro de reçu.
  const r = await send('PATCH', '/api/donations/2', { status: 'received' }, { 'x-admin-key': 'test-accountant-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'received');
  assert.equal(r.body.receiptEmailSent, false); // aucun nouvel email
  assert.equal(r.body.receipt_sent_at, '2026-01-15T10:00:00.000Z'); // horodatage conservé
  assert.equal(r.body.receipt_number, 'ARINA-2026-0002'); // numéro conservé
});

/* ═══ REVENUS AUTOMATIQUES (don confirmé → ligne de revenu) ═══ */
test('PATCH /api/donations/:id → « reçu » : revenu créé automatiquement dans les finances', async () => {
  // Le don 1 est en « pledge » (remis en attente par un test précédent)
  const r = await send('PATCH', '/api/donations/1', { status: 'received' }, { 'x-admin-key': 'test-accountant-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.incomeCreated, true);
  const fin = await get('/api/finances', { 'x-admin-key': 'test-admin-key' });
  const revenu = (fin.body || []).find((f) => f.type === 'Revenu' && Number(f.montant) === 50);
  assert.ok(revenu, 'une ligne de revenu de 50 doit exister dans les finances');
  assert.equal(revenu.categorie, 'Don');
  assert.equal(revenu.donor, 'Marie');
});

test('PATCH /api/donations/:id → « à confirmer » : le revenu est retiré des finances', async () => {
  const r = await send('PATCH', '/api/donations/1', { status: 'pledge' }, { 'x-admin-key': 'test-accountant-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.incomeRemoved, true);
  const fin = await get('/api/finances', { 'x-admin-key': 'test-admin-key' });
  assert.ok(!(fin.body || []).some((f) => f.type === 'Revenu' && Number(f.montant) === 50), 'le revenu doit avoir disparu des finances');
});

test('PATCH /api/donations/:id → re-confirmation « reçu » : aucun doublon de revenu', async () => {
  // Confirmer une 2e fois un don déjà « reçu » ne doit pas créer une 2e ligne
  const r1 = await send('PATCH', '/api/donations/1', { status: 'received' }, { 'x-admin-key': 'test-accountant-key' });
  assert.equal(r1.body.incomeCreated, true);
  const r2 = await send('PATCH', '/api/donations/1', { status: 'received' }, { 'x-admin-key': 'test-accountant-key' });
  assert.equal(r2.status, 200);
  assert.equal(r2.body.incomeCreated, false); // déjà enregistré
  const fin = await get('/api/finances', { 'x-admin-key': 'test-admin-key' });
  const revenus = (fin.body || []).filter((f) => f.type === 'Revenu' && Number(f.montant) === 50);
  assert.equal(revenus.length, 1, 'une seule ligne de revenu pour ce don');
});

test('PATCH /api/donations/:id → « reçu » avec taux : revenu converti en Ariary', async () => {
  // Remise en attente puis confirmation avec taux 5000 → 50 EUR = 250 000 Ar
  await send('PATCH', '/api/donations/1', { status: 'pledge' }, { 'x-admin-key': 'test-accountant-key' });
  const r = await send('PATCH', '/api/donations/1', { status: 'received', rate: 5000 }, { 'x-admin-key': 'test-accountant-key' });
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
  const r = await send('PATCH', '/api/donations/1', { status: 'received', rate: -5 }, { 'x-admin-key': 'test-accountant-key' });
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
  await send('PATCH', '/api/donations/1', { status: 'pledge' }, { 'x-admin-key': 'test-accountant-key' });
  const r = await send('PATCH', '/api/donations/1', { status: 'received' }, { 'x-admin-key': 'test-accountant-key' });
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
