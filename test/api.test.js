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

test('PATCH /api/donations/:id → marquer reçu', async () => {
  const r = await send('PATCH', '/api/donations/1', { status: 'received' }, { 'x-admin-key': 'test-accountant-key' });
  assert.equal(r.status, 200);
  assert.equal(r.body.status, 'received');
  assert.ok(r.body.received_at);
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

/* ═══ TRANSPARENCE ═══ */
test('GET /api/transparency → agrégats de l’année', async () => {
  const r = await get('/api/transparency?year=2026');
  assert.equal(r.status, 200);
  assert.equal(r.body.year, 2026);
  assert.ok(Array.isArray(r.body.donateurs));
  assert.ok(r.body.donateurs.length >= 1);
  assert.equal(r.body.donateurs[0].name, 'Ravinala');
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
