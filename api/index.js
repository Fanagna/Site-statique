const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const { put, del } = require('@vercel/blob');

// Pièces jointes candidatures : formats et taille max (sous la limite Vercel Blob de 5 Mo/upload direct)
const ALLOWED_ATTACH_EXT = /\.(pdf|doc|docx)$/i;
const MAX_ATTACH_SIZE = 4 * 1024 * 1024; // 4 Mo

const app = express();

// ── Authentification par rôles ────────────────────────────────────────────
// Chaque compte a un rôle (admin, president, accountant, educator) et une clé
// API unique. La clé envoyée dans le header `x-admin-key` identifie le rôle.
// L'ancienne clé globale ADMIN_KEY reste acceptée (équivaut au rôle admin).
const ADMIN_KEY = process.env.ADMIN_KEY || 'arina-admin-key-2024';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'arina2024';
const ROLES = { admin: 'admin', president: 'president', accountant: 'accountant', educator: 'educator' };

// Hachage des mots de passe (scrypt natif — aucune dépendance ajoutée)
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}

// Récupère l'utilisateur associé à la clé passée dans le header.
// Renvoie { ok:true, user } ou { ok:false }.
async function getUserFromKey(apiKey) {
  if (!apiKey) return { ok: false };
  // Seuls les comptes de la table users sont reconnus (l'ancienne clé globale
  // ADMIN_KEY n'est plus acceptée — elle contournait le système de rôles).
  try {
    const r = await pool.query('SELECT id, username, role FROM users WHERE api_key = $1', [apiKey]);
    if (r.rows.length === 0) return { ok: false };
    return { ok: true, user: r.rows[0] };
  } catch {
    return { ok: false };
  }
}

// Middleware : authentifie + vérifie que le rôle est autorisé.
// requireRole() = ADMIN UNIQUEMENT. requireRole('president','accountant',…) = un de ces rôles.
// L'admin peut tout ; les autres rôles doivent être explicitement listés.
// NB : fonction NON-async (Express 5 refuse les middlewares qui retournent une Promise).
function requireRole(...allowed) {
  return (req, res, next) => {
    getUserFromKey(req.headers['x-admin-key']).then(({ ok, user }) => {
      if (!ok) return res.status(401).json({ error: 'Unauthorized' });
      req.user = user;
      if (user.role === ROLES.admin) return next(); // l'admin peut tout
      if (allowed.includes(user.role)) return next();
      return res.status(403).json({ error: 'Forbidden' });
    }).catch(() => res.status(401).json({ error: 'Unauthorized' }));
  };
}

// Authentification seule (n'importe quel rôle) — permet de lire l'aperçu du
// tableau de bord (KPI + graphiques) sans donner accès à la gestion du domaine.
function requireAuth(req, res, next) {
  getUserFromKey(req.headers['x-admin-key']).then(({ ok, user }) => {
    if (!ok) return res.status(401).json({ error: 'Unauthorized' });
    req.user = user;
    next();
  }).catch(() => res.status(401).json({ error: 'Unauthorized' }));
}

// Compat : l'ancien requireAdmin (clé globale) reste disponible
// NB : ne protège PAS le système de rôles (les endpoints sensibles utilisent requireRole).
function requireAdmin(req, res, next) {
  if (req.headers['x-admin-key'] === ADMIN_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.use(cors());
app.use(express.json({ limit: '10mb' })); // supporte les pièces jointes en base64

// ── Notifications email (Resend — API REST, aucune dépendance) ────────────
// Envoi silencieux : si RESEND_API_KEY / NOTIFY_EMAIL ne sont pas configurés,
// rien n'est envoyé et le site continue de fonctionner normalement.
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || '';
async function sendEmail({ subject, text, html }) {
  try {
    if (!process.env.RESEND_API_KEY || !NOTIFY_EMAIL) return false;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'ARINA <onboarding@resend.dev>',
        to: [NOTIFY_EMAIL],
        subject,
        text,
        html: html || `<div style="font-family:Arial,sans-serif"><p>${text}</p></div>`,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error('⚠️ Email non envoyé :', err.message);
    return false;
  }
}

// Alerte budget : après une dépense, vérifie si le donateur dépasse son budget
// annuel accordé et prévient par email (une seule fois par dépassement).
const budgetAlertSent = {}; // { `${donor}-${year}`: true }
async function checkDonorBudgetAlert(donorName, amount, description) {
  try {
    const n = String(donorName || '').trim();
    if (!n) return;
    const r = await pool.query('SELECT id, name, need, budget FROM donors WHERE LOWER(name) = LOWER($1)', [n]);
    const donor = r.rows[0];
    if (!donor || !donor.budget || Number(donor.budget) <= 0) return;
    const year = new Date().getFullYear();
    const dep = await pool.query(
      "SELECT COALESCE(SUM(amount),0) AS total FROM finances WHERE LOWER(donor) = LOWER($1) AND type = 'expense' AND EXTRACT(YEAR FROM date) = $2",
      [n, year]
    );
    const total = Number(dep.rows[0].total);
    const budget = Number(donor.budget);
    if (total > budget) {
      const key = `${n.toLowerCase()}-${year}`;
      if (!budgetAlertSent[key]) {
        budgetAlertSent[key] = true;
        await sendEmail({
          subject: `⚠️ Alerte budget ${year} — ${donor.name} a dépassé son budget`,
          text: `${donor.name} (${donor.need || 'besoin non précisé'}) :\n` +
            `Dépenses ${year} : ${total.toLocaleString('fr-FR')} Ar\n` +
            `Budget accordé : ${budget.toLocaleString('fr-FR')} Ar\n` +
            `Dépassement : ${(total - budget).toLocaleString('fr-FR')} Ar\n` +
            `Dernière dépense : ${description || '-'}`,
        });
      }
    }
  } catch (err) {
    console.error('⚠️ Alerte budget :', err.message);
  }
}

// Serverless-friendly DB pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'arina_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Auto-migration idempotente au démarrage — crée/répare les tables absentes ou obsolètes
// (ex. table volunteers inexistante ou table news sans colonne status en production).
// Garantit que la table users existe (et son compte admin par défaut) —
// appelé au login pour couvrir le démarrage à froid des fonctions serverless.
async function ensureUsersTable() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin',
    api_key VARCHAR(64) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  const r = await pool.query('SELECT COUNT(*) AS n FROM users');
  if (Number(r.rows[0].n) === 0) {
    const apiKey = crypto.randomBytes(24).toString('hex');
    await pool.query(
      'INSERT INTO users (username, password_hash, role, api_key) VALUES ($1,$2,$3,$4)',
      [ADMIN_USER, hashPassword(ADMIN_PASSWORD), ROLES.admin, apiKey]
    );
  }
}

function ensureSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS volunteers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      skills TEXT,
      availability VARCHAR(100),
      motivation TEXT,
      file_name VARCHAR(255),
      file_type VARCHAR(100),
      file_size INTEGER,
      file_data TEXT,
      cv_name VARCHAR(255),
      cv_type VARCHAR(100),
      cv_size INTEGER,
      cv_data TEXT,
      file_url VARCHAR(500),
      cv_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS file_url VARCHAR(500)`,
    `ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS cv_url VARCHAR(500)`,
    `CREATE TABLE IF NOT EXISTS news (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      excerpt TEXT,
      content TEXT,
      image_url TEXT,
      category VARCHAR(100),
      status VARCHAR(20) DEFAULT 'published',
      views INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE news ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'published'`,
    `ALTER TABLE news ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE`,
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'admin',
      api_key VARCHAR(64) UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS finances (
      id SERIAL PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE finances ADD COLUMN IF NOT EXISTS quantity INTEGER`,
    `ALTER TABLE finances ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2)`,
    `ALTER TABLE finances ADD COLUMN IF NOT EXISTS donor VARCHAR(255)`,
    `CREATE TABLE IF NOT EXISTS donors (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      need VARCHAR(255),
      budget NUMERIC(14,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE donors ADD COLUMN IF NOT EXISTS budget NUMERIC(14,2) DEFAULT 0`,
    `INSERT INTO donors (name, need) VALUES
      ('Ravinala', 'Salaire'),
      ('Horizon', 'Sakafo — Alimentation'),
      ('Grandir Dignement', 'Formation professionnelle')
     ON CONFLICT (name) DO NOTHING`,
    `CREATE TABLE IF NOT EXISTS beneficiaries (
      id SERIAL PRIMARY KEY,
      first_name VARCHAR(255) NOT NULL,
      last_name VARCHAR(255) NOT NULL,
      age INTEGER DEFAULT 0,
      entry_date DATE DEFAULT CURRENT_DATE,
      status VARCHAR(50) DEFAULT 'active',
      training VARCHAR(255),
      notes TEXT,
      photo_url TEXT,
      dossier JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS photo_url TEXT`,
    `ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS dossier JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS notes TEXT`,
  ];

  // Après création des tables : crée le compte admin par défaut s'il n'existe pas
  (async () => {
    try {
      const r = await pool.query('SELECT COUNT(*) AS n FROM users');
      if (Number(r.rows[0].n) === 0) {
        const apiKey = crypto.randomBytes(24).toString('hex');
        await pool.query(
          'INSERT INTO users (username, password_hash, role, api_key) VALUES ($1,$2,$3,$4)',
          [ADMIN_USER, hashPassword(ADMIN_PASSWORD), ROLES.admin, apiKey]
        );
        console.log('👤 Compte admin par défaut créé');
      }
    } catch (err) { console.error('⚠️ Seed admin :', err.message); }
  })();
  // Exécution SÉQUENTIELLE (les ALTER doivent suivre le CREATE, sinon ils échouent)
  (async () => {
    for (const s of statements) {
      try { await pool.query(s); } catch (err) { console.error('⚠️ Auto-migration :', err.message); }
    }
    console.log('✅ Schéma vérifié (auto-migration)');
  })();
}
ensureSchema();

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.json({ status: 'ok', db: 'disconnected', error: err.message });
  }
});

// ═══ AUTH ═══
// Connexion : vérifie la table users (comptes gérés par l'admin), puis l'ancien
// compte global (ADMIN_USER/ADMIN_PASSWORD) pour compatibilité.
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: 'Identifiants manquants' });
    // Démarrage à froid : garantit la table users + compte admin par défaut
    await ensureUsersTable();
    // 1) Table users
    const r = await pool.query('SELECT id, username, role, api_key, password_hash FROM users WHERE username = $1', [String(username).trim()]);
    if (r.rows.length > 0) {
      const u = r.rows[0];
      if (verifyPassword(password, u.password_hash)) {
        return res.json({ success: true, user: { username: u.username, role: u.role }, token: u.api_key });
      }
      return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
    }
    // 2) Ancien compte global (env) — compat
    if (username === ADMIN_USER && password === ADMIN_PASSWORD) {
      // Crée le compte admin s'il n'existe pas ; ne fait PAS tourner la clé
      // existante (sinon les sessions en cours seraient invalidées).
      const seeded = await pool.query(
        `INSERT INTO users (username, password_hash, role, api_key) VALUES ($1,$2,$3,$4)
         ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING api_key`,
        [ADMIN_USER, hashPassword(ADMIN_PASSWORD), ROLES.admin, crypto.randomBytes(24).toString('hex')]
      );
      const key = seeded.rows[0]?.api_key || ADMIN_KEY;
      return res.json({ success: true, user: { username: ADMIN_USER, role: ROLES.admin }, token: key });
    }
    return res.status(401).json({ success: false, error: 'Identifiants incorrects' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Qui suis-je ? (validation de session côté frontend — toute clé valide)
app.get('/api/auth/me', async (req, res) => {
  const { ok, user } = await getUserFromKey(req.headers['x-admin-key']);
  if (!ok) return res.status(401).json({ error: 'Unauthorized' });
  res.json(user);
});

// ═══ USERS (comptes — admin uniquement) ═══
function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role, created_at: u.created_at };
}

app.get('/api/users', requireRole(), async (req, res) => {
  try {
    const r = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY id');
    res.json(r.rows.map(publicUser));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/users', requireRole(), async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const name = String(username || '').trim();
    if (!name || !password) return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    if (!ROLES[role]) return res.status(400).json({ error: 'Rôle invalide' });
    const apiKey = crypto.randomBytes(24).toString('hex');
    const r = await pool.query(
      'INSERT INTO users (username, password_hash, role, api_key) VALUES ($1,$2,$3,$4) RETURNING id, username, role, created_at',
      [name, hashPassword(password), role, apiKey]
    );
    res.status(201).json(publicUser(r.rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ce nom d\'utilisateur existe déjà' });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id/password', requireRole(), async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Mot de passe requis' });
    const r = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id',
      [hashPassword(password), req.params.id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Compte introuvable' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/users/:id', requireRole(), async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM users WHERE id = $1 AND role <> $2 RETURNING id', [req.params.id, ROLES.admin]);
    if (r.rows.length === 0) return res.status(400).json({ error: 'Impossible de supprimer ce compte' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ BENEFICIARIES ═══
/* Normalise une ligne bénéficiaire (colonnes → champs frontend, inclut le dossier complet) */
function normalizeBenef(r) {
  let dossier = {};
  if (r.dossier) {
    try { dossier = typeof r.dossier === 'string' ? JSON.parse(r.dossier) : r.dossier; } catch { dossier = {}; }
  }
  return {
    id: r.id, nom: r.last_name, prenom: r.first_name, age: r.age || 0,
    statut: r.status === 'active' ? 'Actif' : r.status === 'graduated' ? 'Diplômé' : 'Inactif',
    dateEntree: r.entry_date ? new Date(r.entry_date).toISOString().split('T')[0] : '',
    formation: r.training || '—',
    photo: r.photo_url || '',
    dossier,
  };
}

// GET all — lecture ouverte à tous les rôles authentifiés (aperçu du tableau de bord) ;
// la création/modification/suppression reste réservée à l'éducateur et à l'admin.
app.get('/api/beneficiaries', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM beneficiaries ORDER BY id DESC');
    res.json(result.rows.map(normalizeBenef));
  } catch (err) { res.json([]); }
});

app.post('/api/beneficiaries', requireRole(ROLES.educator), async (req, res) => {
  try {
    const { prenom, nom, age, statut, dateEntree, formation, photo, dossier } = req.body;
    const statusMap = { 'Actif': 'active', 'Diplômé': 'graduated', 'Inactif': 'inactive' };
    const result = await pool.query(
      'INSERT INTO beneficiaries (first_name, last_name, age, status, entry_date, training, photo_url, dossier) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [prenom, nom, Number(age) || 0, statusMap[statut] || 'active', dateEntree, formation, photo || null, dossier || {}]
    );
    res.status(201).json(normalizeBenef(result.rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/beneficiaries/:id', requireRole(ROLES.educator), async (req, res) => {
  try {
    const { prenom, nom, age, statut, dateEntree, formation, photo, dossier } = req.body;
    const statusMap = { 'Actif': 'active', 'Diplômé': 'graduated', 'Inactif': 'inactive' };
    const result = await pool.query(
      'UPDATE beneficiaries SET first_name=$1, last_name=$2, age=$3, status=$4, entry_date=$5, training=$6, photo_url=CASE WHEN $7 = \'\' THEN NULL ELSE COALESCE($7, photo_url) END, dossier=COALESCE($8, dossier) WHERE id=$9 RETURNING *',
      [prenom, nom, Number(age) || 0, statusMap[statut] || 'active', dateEntree, formation, photo || null, dossier || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(normalizeBenef(result.rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT photo
app.put('/api/beneficiaries/:id/photo', requireRole(ROLES.educator), async (req, res) => {
  try {
    const { photo } = req.body;
    const result = await pool.query(
      'UPDATE beneficiaries SET photo_url=$1 WHERE id=$2 RETURNING *',
      [photo, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/beneficiaries/:id', requireRole(ROLES.educator), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM beneficiaries WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ FINANCES ═══
// GET all — lecture ouverte à tous les rôles authentifiés (aperçu du tableau de bord) ;
// la création/suppression reste réservée au comptable et à l'admin.
app.get('/api/finances', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM finances ORDER BY date DESC, id DESC');
    res.json(result.rows.map(r => ({
      id: r.id, type: r.type === 'income' ? 'Revenu' : 'Dépense',
      categorie: r.category || 'Autre', montant: Number(r.amount),
      quantity: r.quantity != null ? Number(r.quantity) : null,
      unit_price: r.unit_price != null ? Number(r.unit_price) : null,
      description: r.description || '',
      donor: r.donor || '',
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
    })));
  } catch (err) { res.json([]); }
});

app.post('/api/finances', requireRole(ROLES.accountant), async (req, res) => {
  try {
    const { type, categorie, montant, description, date, quantity, unit_price, donor } = req.body;
    const q = quantity != null && quantity !== '' ? Number(quantity) : null;
    const p = unit_price != null && unit_price !== '' ? Number(unit_price) : null;
    // Montant automatique : MNT = QT × PU quand les deux sont fournis (dépense) ;
    // sinon le montant saisi (ex. un don).
    const computed = q != null && p != null ? Math.round(q * p) : (Number(montant) || 0);
    const result = await pool.query(
      'INSERT INTO finances (type, category, amount, description, date, quantity, unit_price, donor) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [type === 'Revenu' ? 'income' : 'expense', categorie, computed, description, date, q, p, donor || null]
    );
    const r = result.rows[0];
    // Alerte budget : si cette dépense fait dépasser le budget annuel du donateur
    if (type === 'Dépense') checkDonorBudgetAlert(donor, computed, description);
    res.status(201).json({ id: r.id, type: r.type === 'income' ? 'Revenu' : 'Dépense',
      categorie: r.category || 'Autre', montant: Number(r.amount),
      quantity: r.quantity != null ? Number(r.quantity) : null,
      unit_price: r.unit_price != null ? Number(r.unit_price) : null,
      description: r.description || '',
      donor: r.donor || '',
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/finances/:id', requireRole(ROLES.accountant), async (req, res) => {
  try {
    const { type, categorie, montant, description, date, quantity, unit_price, donor } = req.body;
    const q = quantity != null && quantity !== '' ? Number(quantity) : null;
    const p = unit_price != null && unit_price !== '' ? Number(unit_price) : null;
    // Montant automatique : MNT = QT × PU quand les deux sont fournis (dépense) ;
    // sinon le montant saisi (ex. un don).
    const computed = q != null && p != null ? Math.round(q * p) : (Number(montant) || 0);
    const result = await pool.query(
      'UPDATE finances SET type=$1, category=$2, amount=$3, description=$4, date=$5, quantity=$6, unit_price=$7, donor=$8 WHERE id=$9 RETURNING *',
      [type === 'Revenu' ? 'income' : 'expense', categorie, computed, description, date, q, p, donor || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = result.rows[0];
    // Alerte budget : si cette dépense fait dépasser le budget annuel du donateur
    if (type === 'Dépense') checkDonorBudgetAlert(donor, computed, description);
    res.json({ id: r.id, type: r.type === 'income' ? 'Revenu' : 'Dépense',
      categorie: r.category || 'Autre', montant: Number(r.amount),
      quantity: r.quantity != null ? Number(r.quantity) : null,
      unit_price: r.unit_price != null ? Number(r.unit_price) : null,
      description: r.description || '',
      donor: r.donor || '',
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/finances/:id', requireRole(ROLES.accountant), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM finances WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST bulk import — reçoit un tableau de transactions normalisées (import Excel mensuel).
// Résout/crée les donateurs, puis insère les lignes valides dans une transaction.
app.post('/api/finances/import', requireRole(ROLES.accountant), async (req, res) => {
  try {
    const { rows, autoCreateDonors } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'Aucune ligne à importer' });
    if (rows.length > 2000) return res.status(400).json({ error: 'Trop de lignes (maximum 2000 par import)' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1) Résolution des donateurs (par nom, insensible à la casse) + création si demandée
      const names = [...new Set(rows.map(r => String(r.donor || '').trim()).filter(Boolean))];
      const idByLower = {};
      const createdDonors = [];
      for (const name of names) {
        const lower = name.toLowerCase();
        const found = await client.query('SELECT id FROM donors WHERE LOWER(name) = $1', [lower]);
        if (found.rows.length) { idByLower[lower] = found.rows[0].id; continue; }
        if (!autoCreateDonors) continue;
        const ins = await client.query('INSERT INTO donors (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING id', [name]);
        if (ins.rows.length) { idByLower[lower] = ins.rows[0].id; createdDonors.push(name); }
        else {
          const again = await client.query('SELECT id FROM donors WHERE LOWER(name) = $1', [lower]);
          if (again.rows.length) idByLower[lower] = again.rows[0].id;
        }
      }

      // 2) Insertion des lignes valides
      let created = 0;
      const errors = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const q = r.quantity != null && r.quantity !== '' ? Number(r.quantity) : null;
        const p = r.unit_price != null && r.unit_price !== '' ? Number(r.unit_price) : null;
        const computed = q != null && p != null ? Math.round(q * p) : (Number(r.montant) || 0);
        const type = r.type === 'Dépense' ? 'expense' : 'income';
        const date = r.date || null;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
          errors.push({ row: i + 2, reason: 'Date manquante ou invalide' }); continue;
        }
        if (computed <= 0) { errors.push({ row: i + 2, reason: 'Montant manquant ou invalide' }); continue; }
        const dName = String(r.donor || '').trim();
        if (!dName || !idByLower[dName.toLowerCase()]) { errors.push({ row: i + 2, reason: `Donateur inconnu : ${dName || '—'}` }); continue; }
        await client.query(
          'INSERT INTO finances (type, category, amount, description, date, quantity, unit_price, donor) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [type, r.categorie || 'Autre', computed, r.description || '', date, q, p, dName]
        );
        created++;
      }

      await client.query('COMMIT');
      res.status(201).json({ created, errors, createdDonors });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══ DONORS (donateurs — partenaires financiers) ═══
// GET all — lecture ouverte à tous les rôles authentifiés (filtres + rapports)
app.get('/api/donors', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM donors ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create (comptable ou admin)
app.post('/api/donors', requireRole(ROLES.accountant), async (req, res) => {
  try {
    const { name, need, budget } = req.body;
    const n = String(name || '').trim();
    if (!n) return res.status(400).json({ error: 'Le nom du donateur est requis' });
    const b = budget != null && budget !== '' ? Math.max(0, Number(budget) || 0) : 0;
    const result = await pool.query(
      'INSERT INTO donors (name, need, budget) VALUES ($1,$2,$3) RETURNING *',
      [n, String(need || '').trim(), b]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ce donateur existe déjà' });
    res.status(500).json({ error: err.message });
  }
});

// PUT update (comptable ou admin)
app.put('/api/donors/:id', requireRole(ROLES.accountant), async (req, res) => {
  try {
    const { name, need, budget } = req.body;
    const n = String(name || '').trim();
    if (!n) return res.status(400).json({ error: 'Le nom du donateur est requis' });
    const b = budget != null && budget !== '' ? Math.max(0, Number(budget) || 0) : 0;
    const result = await pool.query(
      'UPDATE donors SET name=$1, need=$2, budget=$3 WHERE id=$4 RETURNING *',
      [n, String(need || '').trim(), b, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Donateur introuvable' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE (comptable ou admin) — les transactions existantes conservent le nom
app.delete('/api/donors/:id', requireRole(ROLES.accountant), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM donors WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Donateur introuvable' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ NEWS ═══
/* Normalise une ligne de la table news pour le frontend (slug, date, image…) */
function normalizeNews(r) {
  const raw = r.title || '';
  const slug = (raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)) || 'article';
  const d = r.created_at || r.date ? new Date(r.created_at || r.date) : null;
  const fmt = (x) => String(x).padStart(2, '0');
  const monthsFr = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const contentStr = typeof r.content === 'string' ? r.content : '';
  const wordCount = Math.max(0, (r.excerpt || '').split(/\s+/).filter(Boolean).length) + Math.max(0, contentStr.split(/\s+/).filter(Boolean).length);
  return {
    ...r,
    slug: `${slug}-${r.id}`,
    image: r.image_url || '',
    date: d ? `${fmt(d.getDate())}/${fmt(d.getMonth() + 1)}/${d.getFullYear()}` : '',
    month: d ? monthsFr[d.getMonth()] : '',
    year: d ? d.getFullYear() : '',
    featured: !!r.featured,
    author: 'ARINA',
    readTime: `${Math.max(1, Math.round(wordCount / 200))} min`,
    updatedAt: r.updated_at || r.created_at || null,
    tags: [],
  };
}

app.get('/api/news', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store'); // jamais de cache : le site public doit toujours refléter les changements admin
    const result = await pool.query('SELECT * FROM news ORDER BY created_at DESC, id DESC LIMIT 500');
    res.json(result.rows.map(normalizeNews));
  } catch (err) { res.json([]); }
});

// POST public — incrémente le compteur de vues d'un article (alimente le tri « Plus populaires »)
app.post('/api/news/:id/view', async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE news SET views = views + 1 WHERE id = $1 AND COALESCE(status, 'published') = 'published' RETURNING views",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ views: result.rows[0].views });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create news (président ou admin)
app.post('/api/news', requireRole(ROLES.president), async (req, res) => {
  try {
    const { title, excerpt, category, image_url, status, content, featured } = req.body;
    const result = await pool.query(
      'INSERT INTO news (title, excerpt, category, image_url, status, content, featured) VALUES ($1,$2,$3,$4,COALESCE($5,\'published\'),$6,COALESCE($7,false)) RETURNING *',
      [title, excerpt, category, image_url, status, content, featured]
    );
    res.status(201).json(normalizeNews(result.rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update news (président ou admin)
app.put('/api/news/:id', requireRole(ROLES.president), async (req, res) => {
  try {
    const { title, excerpt, category, image_url, status, content, featured } = req.body;
    const result = await pool.query(
      'UPDATE news SET title=$1, excerpt=$2, category=$3, image_url=$4, status=COALESCE($5, status), content=COALESCE($6, content), featured=COALESCE($7, featured), updated_at=CURRENT_TIMESTAMP WHERE id=$8 RETURNING *',
      [title, excerpt, category, image_url, status, content, featured, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(normalizeNews(result.rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE news (président ou admin)
app.delete('/api/news/:id', requireRole(ROLES.president), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM news WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ CONTACT ═══
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stats LIMIT 1');    res.json(result.rows[0] || { young_accompanied: 30, insertion_rate: 85, partners: 1, years_active: 2 });
  } catch (err) {
    res.json({ young_accompanied: 30, insertion_rate: 85, partners: 1, years_active: 2 });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const result = await pool.query(
      'INSERT INTO contacts (name, email, message) VALUES ($1,$2,$3) RETURNING *',
      [name, email, message]
    );
    // Notification au président à chaque nouveau message
    sendEmail({
      subject: `📩 Nouveau message de ${name} (${email})`,
      text: `${name} <${email}> a envoyé un message depuis le site :\n\n${message}\n\nConnectez-vous à l'espace admin → Messages pour y répondre.`,
    });
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ═══ VOLUNTEERS (candidatures + lettre de motivation + CV) ═══

// GET public — génère une URL d'upload signée (Vercel Blob) pour une pièce jointe.
// L'upload direct côté client contourne la limite de 4,5 Mo des fonctions serverless.
app.get('/api/volunteers/upload-url', async (req, res) => {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(503).json({ error: 'Stockage non configuré' });
    }
    const { filename = '', type = '', size = '0' } = req.query;
    if (!ALLOWED_ATTACH_EXT.test(filename)) {
      return res.status(400).json({ error: 'Format non accepté — utilisez un PDF, DOC ou DOCX.' });
    }
    const numSize = Number(size);
    if (!Number.isFinite(numSize) || numSize <= 0 || numSize > MAX_ATTACH_SIZE) {
      return res.status(400).json({ error: 'Fichier trop volumineux (maximum 4 Mo).' });
    }
    const safeName = String(filename).replace(/[^\w.\- ]+/g, '_').slice(0, 120);
    const blob = await put(`candidatures/${Date.now()}-${safeName}`, '', {
      access: 'public',
      contentType: type || 'application/octet-stream',
      handleUploadUrl: true,
      addRandomSuffix: true,
    });
    res.json({ uploadUrl: blob.uploadUrl, url: blob.url, pathname: blob.pathname });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST public — reçoit une candidature bénévole. Pièces jointes soit via URL Blob
// (nouveau), soit en base64 (legacy) ; le serveur valide toujours les champs.
app.post('/api/volunteers', async (req, res) => {
  try {
    const { name, email, phone, skills, availability, motivation, file, cv } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Le nom est requis' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ error: "L'email est invalide" });
    const attachErr = (a, label) => {
      if (!a || !a.name) return `${label} est requise`;
      if (!ALLOWED_ATTACH_EXT.test(a.name)) return `${label} : format non accepté (PDF, DOC ou DOCX)`;
      const sz = Number(a.size);
      if (!Number.isFinite(sz) || sz > MAX_ATTACH_SIZE) return `${label} : fichier trop volumineux (maximum 4 Mo)`;
      return null;
    };
    const errFile = attachErr(file, 'La lettre de motivation');
    if (errFile) return res.status(400).json({ error: errFile });
    const errCv = attachErr(cv, 'Le CV');
    if (errCv) return res.status(400).json({ error: errCv });
    const result = await pool.query(
      `INSERT INTO volunteers (name, email, phone, skills, availability, motivation, file_name, file_type, file_size, file_data, file_url, cv_name, cv_type, cv_size, cv_data, cv_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [name, email, phone, skills, availability, motivation,
       file?.name || null, file?.type || null, file?.size || null, file?.data || null, file?.url || null,
       cv?.name || null, cv?.type || null, cv?.size || null, cv?.data || null, cv?.url || null]
    );
    // Notification au président à chaque nouvelle candidature
    sendEmail({
      subject: `🙋 Nouvelle candidature bénévole : ${name}`,
      text: `${name} <${email}> a postulé pour devenir bénévole.\nCompétences : ${skills || '—'} · Disponibilité : ${availability || '—'}\n\nConnectez-vous à l'espace admin → Candidatures pour voir la lettre de motivation et le CV.`,
    });
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET admin — liste SANS les données base64 (sinon la réponse dépasse la limite Vercel).
// Les pièces jointes sont accessibles via file_url / cv_url, ou via l'endpoint legacy ci-dessous.
app.get('/api/volunteers', requireRole(ROLES.president), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, phone, skills, availability, motivation, file_name, file_type, file_size, file_url, cv_name, cv_type, cv_size, cv_url, created_at FROM volunteers ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) { res.json([]); }
});

// GET admin — renvoie une pièce jointe stockée en base64 (candidatures antérieures à Blob)
app.get('/api/volunteers/:id/attachment', requireRole(ROLES.president), async (req, res) => {
  try {
    const kind = req.query.kind === 'cv' ? 'cv' : 'file';
    const result = await pool.query(
      `SELECT ${kind === 'cv' ? 'cv_name, cv_type, cv_data' : 'file_name, file_type, file_data'} FROM volunteers WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = result.rows[0];
    const data = kind === 'cv' ? r.cv_data : r.file_data;
    if (!data) return res.status(404).json({ error: 'Aucune pièce jointe' });
    res.json({
      name: kind === 'cv' ? r.cv_name : r.file_name,
      type: kind === 'cv' ? r.cv_type : r.file_type,
      data,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/volunteers/:id', requireRole(ROLES.president), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM volunteers WHERE id=$1 RETURNING file_url, cv_url', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    // Suppression best-effort des fichiers Blob associés (évite de saturer le quota)
    const urls = [result.rows[0].file_url, result.rows[0].cv_url].filter(Boolean);
    if (urls.length && process.env.BLOB_READ_WRITE_TOKEN) {
      try { await Promise.allSettled(urls.map((u) => del(u))); } catch { /* best effort */ }
    }
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ CONTACTS (ADMIN) ═══
app.get('/api/contacts', requireRole(ROLES.president), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) { res.json([]); }
});

app.delete('/api/contacts/:id', requireRole(ROLES.president), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM contacts WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ ACTIVITY FEED (ADMIN) ═══
app.get('/api/activity', requireRole(), async (req, res) => {
  try {
    const [newsR, finR, benefR, volR, msgR] = await Promise.all([
      pool.query("SELECT id, title, created_at FROM news ORDER BY created_at DESC LIMIT 5"),
      pool.query("SELECT id, type, amount, description, date FROM finances ORDER BY date DESC, id DESC LIMIT 5"),
      pool.query("SELECT id, first_name, last_name, entry_date FROM beneficiaries ORDER BY id DESC LIMIT 5"),
      pool.query("SELECT id, name, created_at FROM volunteers ORDER BY created_at DESC LIMIT 5"),
      pool.query("SELECT id, name, created_at FROM contacts ORDER BY created_at DESC LIMIT 5"),
    ]);
    const items = [];
    newsR.rows.forEach(r => items.push({ id: `n${r.id}`, type: 'news', text: `Actualité publiée : « ${r.title} »`, date: r.created_at }));
    finR.rows.forEach(r => items.push({
      id: `f${r.id}`, type: r.type === 'income' ? 'income' : 'expense',
      text: `${r.type === 'income' ? 'Revenu' : 'Dépense'} : ${Number(r.amount).toLocaleString('fr-FR')} Ar${r.description ? ' — ' + r.description : ''}`,
      date: r.date,
    }));
    benefR.rows.forEach(r => items.push({ id: `b${r.id}`, type: 'beneficiary', text: `Bénéficiaire ajouté : ${r.first_name} ${r.last_name}`, date: r.entry_date }));
    volR.rows.forEach(r => items.push({ id: `v${r.id}`, type: 'volunteer', text: `Candidature reçue : ${r.name}`, date: r.created_at }));
    msgR.rows.forEach(r => items.push({ id: `m${r.id}`, type: 'message', text: `Message de ${r.name}`, date: r.created_at }));
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(items.slice(0, 12));
  } catch (err) { res.json([]); }
});

module.exports = app;
