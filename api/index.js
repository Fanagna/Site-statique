const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { put, del } = require('@vercel/blob');
const { buildReceiptPdf } = require('./receipt');
const { generateQRCode, generateBadgePDF, exportMultipleBadges } = require('./badges');

// Pièces jointes candidatures : formats et taille max (sous la limite Vercel Blob de 5 Mo/upload direct)
const ALLOWED_ATTACH_EXT = /\.(pdf|doc|docx)$/i;
const MAX_ATTACH_SIZE = 4 * 1024 * 1024; // 4 Mo

const app = express();
app.set('trust proxy', true); // derrière le proxy Vercel : req.ip = vraie IP du visiteur

// ── Authentification par rôles ────────────────────────────────────────────
// Chaque compte a un rôle (admin, president, accountant, educator) et une clé
// API unique. La clé envoyée dans le header `x-admin-key` identifie le rôle.
// L'ancienne clé globale ADMIN_KEY reste acceptée (équivaut au rôle admin).
const ADMIN_KEY = process.env.ADMIN_KEY || 'arina-admin-key-2024';
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'arina2024';
const DEFAULT_ADMIN_PASSWORD = 'arina2024'; // valeur codée en dur — refusée tant qu'ADMIN_PASSWORD n'est pas configuré
const ROLES = { admin: 'admin', president: 'president', accountant: 'accountant', educator: 'educator' };

// ── Sécurité : identifiants par défaut ──
// Tant que ADMIN_PASSWORD n'est pas défini dans les variables d'environnement,
// le mot de passe par défaut codé en dur est REFUSÉ (y compris pour un compte
// déjà en base). L'admin doit définir ADMIN_PASSWORD / ADMIN_KEY pour se connecter.
//
// Compte de secours : tant que ADMIN_PASSWORD n'est PAS configuré, un compte
// d'urgence (BOOTSTRAP_USER / BOOTSTRAP_PASSWORD) est créé en base pour accéder
// à l'espace admin. À supprimer (constantes + bloc dans ensureUsersTable) dès
// que la variable d'environnement est définie sur Vercel.
const BOOTSTRAP_USER = 'admin-arina';
const BOOTSTRAP_PASSWORD = 'Arina-FH6mRcPjOGRY';
function defaultPasswordRefused(password) {
  return !process.env.ADMIN_PASSWORD && String(password || '') === DEFAULT_ADMIN_PASSWORD;
}

// ── Rate limiting (anti-spam / anti force brute) ──
// Limiteur en mémoire, fenêtre glissante par clé. Chaque instance serverless garde
// son propre compteur : efficace pour freiner le spam et les tentatives de connexion
// répétées sans dépendance externe.
const rateBuckets = {}; // { `${name}`: { [key]: [timestamps] } }

// Adresse IP du visiteur derrière le proxy Vercel (x-forwarded-for peut contenir
// une liste « IP1, IP2 » : on prend la première, celle du client réel).
function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) return String(fwd).split(',')[0].trim();
  return req.ip || (req.socket && req.socket.remoteAddress) || 'anon';
}

function rateLimit(name, max, windowMs, keyFn) {
  return (req, res, next) => {
    const key = (keyFn ? keyFn(req) : clientIp(req)) || 'anon';
    const now = Date.now();
    const bucket = rateBuckets[name] || (rateBuckets[name] = {});
    const arr = (bucket[key] = (bucket[key] || []).filter((t) => now - t < windowMs));
    if (arr.length >= max) {
      return res.status(429).json({ error: 'Trop de requêtes — veuillez réessayer dans quelques minutes.' });
    }
    arr.push(now);
    next();
  };
}

// ── Honeypot anti-bots ──
// Les formulaires publics incluent un champ caché `website` que les humains
// laissent vide. S'il est rempli, on simule un succès sans rien enregistrer
// (le bot croit avoir réussi — aucune donnée parasite en base).
function isBot(req) {
  return !!(req.body && typeof req.body.website === 'string' && req.body.website.trim() !== '');
}

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

// Compat : l'ancien requireAdmin (clé globale) reste disponible mais est DURCI :
// si ADMIN_KEY n'est pas défini dans l'environnement, la clé par défaut codée en dur
// est refusée (même logique que le mot de passe par défaut).
function requireAdmin(req, res, next) {
  if (!process.env.ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  if (req.headers['x-admin-key'] === ADMIN_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.use(cors());
app.use(express.json({ limit: '10mb' })); // supporte les pièces jointes en base64

// Rejette les requêtes envoyées par un bot détecté via le honeypot
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && isBot(req)) {
    return res.status(201).json({ success: true, ok: true }); // simulé : le bot croit avoir réussi
  }
  next();
});

// ── Notifications email (SMTP en priorité — Gmail possible —, Resend en secours) ──
// Envoi silencieux : si rien n'est configuré, aucun email ne part et le site
// continue de fonctionner normalement.
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || '';

// SMTP configuré ? (ex. Gmail : SMTP_HOST=smtp.gmail.com, SMTP_PORT=465, SMTP_SECURE=true)
function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Échappe les entités HTML (les champs publics — nom, message — ne doivent
// jamais être interpolés bruts dans un email HTML : risque d'injection).
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function sendEmail({ subject, text, html, to, cc, attachments }) {
  try {
    // ── 1) SMTP (Gmail ou autre) : prioritaire ──
    if (smtpConfigured()) {
      const smtpPort = Number(process.env.SMTP_PORT || 587);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        // 465 = SSL direct ; 587 = STARTTLS. SMTP_SECURE force le choix sinon auto.
        secure: smtpPort === 465 || process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `ARINA <${process.env.SMTP_USER}>`,
        to: (to && to.length ? to : [NOTIFY_EMAIL]).join(', '),
        ...(cc && cc.length ? { cc: cc.join(', ') } : {}),
        subject,
        text,
        html: html || `<div style="font-family:Arial,sans-serif"><p>${text}</p></div>`,
        ...(attachments && attachments.length
          ? { attachments: attachments.map((a) => ({ filename: a.filename, content: Buffer.from(a.content, 'base64'), contentType: a.content_type })) }
          : {}),
      });
      return true;
    }

    // ── 2) Resend (API REST — secours si SMTP non configuré) ──
    if (process.env.RESEND_API_KEY && NOTIFY_EMAIL) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'ARINA <onboarding@resend.dev>',
          to: to || [NOTIFY_EMAIL],
          ...(cc && cc.length ? { cc } : {}),
          subject,
          text,
          html: html || `<div style="font-family:Arial,sans-serif"><p>${text}</p></div>`,
          ...(attachments && attachments.length ? { attachments } : {}),
        }),
      });
      return res.ok;
    }
    return false;
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
let pool = new Pool({
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
  // Compte de secours : inséré UNIQUEMENT s'il n'existe pas déjà (ON CONFLICT DO
  // NOTHING — un mot de passe changé depuis l'onglet « Comptes » est conservé).
  // Créé tant que ADMIN_PASSWORD n'est pas configuré : accès admin garanti.
  if (!process.env.ADMIN_PASSWORD) {
    await pool.query(
      `INSERT INTO users (username, password_hash, role, api_key) VALUES ($1,$2,$3,$4)
       ON CONFLICT (username) DO NOTHING`,
      [BOOTSTRAP_USER, hashPassword(BOOTSTRAP_PASSWORD), ROLES.admin, crypto.randomBytes(24).toString('hex')]
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
    // Les images uploadées deviennent des data: URLs base64 qui dépassent
    // largement 500 caractères : VARCHAR(500) faisait échouer l'enregistrement
    // (« value too long for type character varying(500) »). Passage en TEXT.
    `ALTER TABLE news ALTER COLUMN image_url TYPE TEXT`,
    `CREATE TABLE IF NOT EXISTS testimonials (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      age INTEGER,
      location VARCHAR(120),
      role VARCHAR(120),
      quote TEXT NOT NULL,
      story TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'`,
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
    `ALTER TABLE finances ADD COLUMN IF NOT EXISTS donation_id INTEGER`,
    // Un don confirmé ne peut créer qu'UNE seule ligne de revenu (garde anti-doublon
    // même si deux confirmations arrivent en même temps — les lignes saisies
    // manuellement (donation_id NULL) ne sont pas concernées)
    `CREATE UNIQUE INDEX IF NOT EXISTS finances_donation_id_unique ON finances (donation_id) WHERE donation_id IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      subject VARCHAR(255),
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE contacts ADD COLUMN IF NOT EXISTS subject VARCHAR(255)`,
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
    `ALTER TABLE beneficiaries ADD COLUMN IF NOT EXISTS badge_id VARCHAR(64)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS beneficiaries_badge_id_unique ON beneficiaries (badge_id) WHERE badge_id IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS badge_events (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      event_date DATE DEFAULT CURRENT_DATE,
      location VARCHAR(255),
      is_daily BOOLEAN DEFAULT FALSE,
      daily_key DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE badge_events ADD COLUMN IF NOT EXISTS is_daily BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE badge_events ADD COLUMN IF NOT EXISTS daily_key DATE`,
    `CREATE UNIQUE INDEX IF NOT EXISTS badge_events_daily_key_unique ON badge_events (daily_key) WHERE daily_key IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS attendances (
      id SERIAL PRIMARY KEY,
      beneficiary_id INTEGER NOT NULL,
      event_id INTEGER NOT NULL,
      type VARCHAR(10) NOT NULL CHECK (type IN ('entry', 'exit')),
      scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS attendances_benef_event_idx ON attendances (beneficiary_id, event_id)`,
    `CREATE TABLE IF NOT EXISTS donations (
      id SERIAL PRIMARY KEY,
      amount NUMERIC(12,2) NOT NULL,
      currency VARCHAR(8) DEFAULT 'EUR',
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      message TEXT,
      method VARCHAR(30) DEFAULT 'orange',
      anonymous BOOLEAN DEFAULT FALSE,
      status VARCHAR(20) DEFAULT 'pledge',
      received_at TIMESTAMP,
      receipt_number VARCHAR(40),
      receipt_sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE donations ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(40)`,
    `ALTER TABLE donations ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMP`,
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
// En test (node:test), pas d'auto-migration au chargement : le pool factice est injecté ensuite.
if (process.env.NODE_ENV !== 'test') ensureSchema();

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
// Limiteur de connexion PAR COMPTE (IP + nom d'utilisateur) : les échecs sur un
// compte ne bloquent pas les connexions légitimes des autres utilisateurs.
app.post('/api/auth/login', rateLimit('login', 10, 5 * 60 * 1000, (req) => `${clientIp(req)}:${String((req.body && req.body.username) || '').trim().toLowerCase()}`), async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, error: 'Identifiants manquants' });
    // Sécurité : mot de passe par défaut refusé tant qu'ADMIN_PASSWORD n'est pas configuré
    if (defaultPasswordRefused(password)) {
      return res.status(403).json({ success: false, error: 'Identifiants par défaut désactivés — définissez ADMIN_PASSWORD dans les variables d\'environnement, puis reconnectez-vous.' });
    }
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
    badgeId: r.badge_id || '',
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
    const created = result.rows[0];
    // Chaque enfant inscrit a IMMÉDIATEMENT son badge QR personnel (badge_id stable)
    const badgeId = await ensureBenefBadge(created);
    res.status(201).json(normalizeBenef({ ...created, badge_id: badgeId }));
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
      donation_id: r.donation_id != null ? r.donation_id : null,
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
// Statistiques RÉELLES calculées depuis la base (plus de chiffres codés en dur) :
// bénéficiaires actifs/diplômés, taux d'insertion, partenaires (donateurs) et années d'action.
app.get('/api/stats', async (req, res) => {
  try {
    const [actifsR, diplomesR, donorsR, revenusR] = await Promise.all([
      pool.query("SELECT COUNT(*) AS n FROM beneficiaries WHERE status = 'active'"),
      pool.query("SELECT COUNT(*) AS n FROM beneficiaries WHERE status = 'graduated'"),
      pool.query('SELECT COUNT(*) AS n FROM donors'),
      pool.query("SELECT COALESCE(SUM(amount),0) AS total FROM finances WHERE type = 'income'"),
    ]);
    const actifs = Number(actifsR.rows[0].n) || 0;
    const diplomes = Number(diplomesR.rows[0].n) || 0;
    const accompagnes = actifs + diplomes;
    const insertion = accompagnes > 0 ? Math.round((diplomes / accompagnes) * 100) : 0;
    res.json({
      young_accompanied: accompagnes,
      insertion_rate: insertion,
      partners: Number(donorsR.rows[0].n) || 0,
      years_active: Math.max(1, new Date().getFullYear() - 2024 + 1), // l'association agit depuis 2024
      total_income: Number(revenusR.rows[0].total) || 0,
    });
  } catch (err) {
    // Base injoignable : valeurs prudentes (l'UI reste fonctionnelle)
    res.json({ young_accompanied: 30, insertion_rate: 85, partners: 1, years_active: 2, total_income: 0 });
  }
});

// POST public — message de contact (rate limité + honeypot anti-bot)
app.post('/api/contact', rateLimit('contact', 10, 10 * 60 * 1000), async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    const result = await pool.query(
      'INSERT INTO contacts (name, email, subject, message) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, email, String(subject || '').trim().slice(0, 255) || null, message]
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
app.post('/api/volunteers', rateLimit('volunteers', 5, 10 * 60 * 1000), async (req, res) => {
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
// Accès : président + éducateur (l'éducateur suit aussi les candidatures).
app.get('/api/volunteers', requireRole(ROLES.president, ROLES.educator), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, phone, skills, availability, motivation, file_name, file_type, file_size, file_url, cv_name, cv_type, cv_size, cv_url, created_at FROM volunteers ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) { res.json([]); }
});

// GET admin — renvoie une pièce jointe stockée en base64 (candidatures antérieures à Blob)
app.get('/api/volunteers/:id/attachment', requireRole(ROLES.president, ROLES.educator), async (req, res) => {
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

app.delete('/api/volunteers/:id', requireRole(ROLES.president, ROLES.educator), async (req, res) => {
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

// ═══ TESTIMONIALS (témoignages visiteurs + modération) ═══

// POST public — reçoit un témoignage soumis depuis la page Témoignages du site.
// Statut initial : pending (l'admin le publie après validation).
app.post('/api/testimonials', rateLimit('testimonials', 5, 10 * 60 * 1000), async (req, res) => {
  try {
    const { name, age, location, role, quote, story } = req.body || {};
    const cleanName = String(name || '').trim();
    const cleanQuote = String(quote || '').trim();
    if (!cleanName) return res.status(400).json({ error: 'Le nom est requis' });
    if (cleanQuote.length < 20) return res.status(400).json({ error: 'Le témoignage doit contenir au moins 20 caractères.' });
    if (cleanQuote.length > 500) return res.status(400).json({ error: 'Le témoignage est trop long (500 caractères max).' });
    const result = await pool.query(
      `INSERT INTO testimonials (name, age, location, role, quote, story, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING id, name, status, created_at`,
      [cleanName, Number(age) || null, String(location || '').trim() || null, String(role || '').trim() || null, cleanQuote, String(story || '').trim().slice(0, 5000) || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET public — témoignages PUBLIÉS seulement (affichés sur la page Témoignages)
app.get('/api/testimonials/published', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, age, location, role, quote, story, created_at FROM testimonials WHERE status='published' ORDER BY created_at DESC LIMIT 50"
    );
    res.json(result.rows);
  } catch (err) { res.json([]); }
});

// GET admin — tous les témoignages (en attente + publiés), du plus récent au plus ancien.
// Accès : président + éducateur (l'éducateur participe à la modération).
app.get('/api/testimonials', requireRole(ROLES.president, ROLES.educator), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, age, location, role, quote, story, status, created_at FROM testimonials ORDER BY created_at DESC LIMIT 200');
    res.json(result.rows);
  } catch (err) { res.json([]); }
});

// PATCH admin — publier / remettre en attente (modération)
app.patch('/api/testimonials/:id', requireRole(ROLES.president, ROLES.educator), async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['pending', 'published'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
    const result = await pool.query('UPDATE testimonials SET status=$1 WHERE id=$2 RETURNING id, status', [status, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE admin
app.delete('/api/testimonials/:id', requireRole(ROLES.president, ROLES.educator), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM testimonials WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ DONATIONS (promesses de don) ═══
// Le visiteur S'ENGAGE (pledge) sur un montant et un moyen de paiement. Aucun
// paiement n'est prélevé en ligne : l'équipe confirme la réception (Orange Money,
// virement, crypto…) et bascule le statut en « received ». Cette promesse honnête
// remplace l'ancien formulaire décoratif qui n'enregistrait rien.

// POST public — promesse de don (rate limité ; le honeypot global protège déjà)
app.post('/api/donations', rateLimit('donations', 10, 10 * 60 * 1000), async (req, res) => {
  try {
    const { amount, currency, name, email, message, method, anonymous } = req.body || {};
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim();
    const a = Number(amount);
    if (!cleanName) return res.status(400).json({ error: 'Le nom est requis' });
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ error: "L'email est invalide" });
    if (!Number.isFinite(a) || a < 1) return res.status(400).json({ error: 'Le montant est invalide (minimum 1)' });
    if (a > 1000000) return res.status(400).json({ error: 'Montant trop élevé (maximum 1 000 000)' });
    const result = await pool.query(
      `INSERT INTO donations (amount, currency, name, email, message, method, anonymous, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pledge') RETURNING *`,
      [a, String(currency || 'EUR').slice(0, 8), cleanName, cleanEmail,
        String(message || '').trim().slice(0, 1000) || null, String(method || 'orange').slice(0, 30), !!anonymous]
    );
    const r = result.rows[0];
    // Notification au président à chaque nouvelle promesse de don
    sendEmail({
      subject: `💝 Nouvelle promesse de don : ${a} ${r.currency} de ${r.name}`,
      text: `${r.name} <${r.email}> s'est engagé à donner ${a} ${r.currency} (${r.method || '—'}).\n${r.message ? 'Message : ' + r.message + '\n' : ''}Connectez-vous à l'espace admin → Dons pour confirmer la réception.`,
    });
    res.status(201).json({ id: r.id, amount: Number(r.amount), currency: r.currency, name: r.name, status: r.status, created_at: r.created_at });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET admin — toutes les promesses de don (ADMIN UNIQUEMENT — la confirmation d'un
// don crée une ligne de revenu dans les finances, la manipulation est réservée à l'admin)
app.get('/api/donations', requireRole(), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM donations ORDER BY created_at DESC LIMIT 200');
    res.json(result.rows.map((r) => ({ ...r, amount: Number(r.amount) })));
  } catch (err) { res.json([]); }
});

// PATCH admin — marquer « reçu » / remettre en attente (ADMIN UNIQUEMENT)
app.patch('/api/donations/:id', requireRole(), async (req, res) => {
  try {
    const { status, rate } = req.body || {};
    if (!['pledge', 'received'].includes(status)) return res.status(400).json({ error: 'Statut invalide' });
    // Taux de conversion EUR → Ar (optionnel, pour le revenu automatique)
    if (rate != null && rate !== '' && (!Number.isFinite(Number(rate)) || Number(rate) <= 0)) {
      return res.status(400).json({ error: 'Le taux de conversion doit être un nombre positif' });
    }
    const before = await pool.query('SELECT * FROM donations WHERE id = $1', [req.params.id]);
    if (before.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const old = before.rows[0];
    // Premier passage à « reçu » : un reçu PDF est généré et envoyé au donateur.
    // Garde-fou : si un reçu a DÉJÀ été envoyé (receipt_sent_at posé), on n'en renvoie
    // pas un second après un retour en « à confirmer » — l'horodatage d'origine est
    // conservé. En revanche, si le 1er envoi avait échoué (receipt_sent_at NULL),
    // une re-confirmation relance bien l'envoi.
    const firstReceipt = status === 'received' && old.status !== 'received' && !old.receipt_sent_at;
    const receiptNumber = firstReceipt
      ? `ARINA-${new Date().getFullYear()}-${String(old.id).padStart(4, '0')}`
      : (old.receipt_number || null);

    // NB: received_at est calculé en JS (et non via CASE WHEN $1 = 'received') pour éviter
    // l'erreur Postgres « inconsistent types deduced for parameter $1 » (varchar vs text).
    const receivedAt = status === 'received' ? (old.received_at || new Date().toISOString()) : null;
    const result = await pool.query(
      `UPDATE donations SET status=$1, received_at=$2, receipt_number=COALESCE($3, receipt_number)
       WHERE id=$4 RETURNING *`,
      [status, receivedAt, firstReceipt ? receiptNumber : null, req.params.id]
    );
    let r = result.rows[0];
    let receiptEmailSent = false;
    let receiptEmailReason = null;

    if (firstReceipt) {
      // Génération du reçu + envoi par email (Resend) : au donateur, copie à l'association
      try {
        const pdf = await buildReceiptPdf({ donation: { ...r, amount: Number(r.amount) } });
        const amount = Number(r.amount).toLocaleString('fr-FR');
        receiptEmailSent = await sendEmail({
          to: [r.email],
          cc: [NOTIFY_EMAIL],
          subject: `Votre reçu de don ARINA — ${receiptNumber}`,
          text: `Bonjour ${r.name},\n\nMerci pour votre don de ${amount} ${(r.currency || 'EUR').toUpperCase()}.\nVotre reçu (réf. ${receiptNumber}) est joint à cet email.\n\n${r.message ? 'Votre message : ' + r.message + '\n\n' : ''}Merci pour votre générosité.\n\nL'équipe ARINA`,
          html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
            <div style="background:#7A2C3E;color:#fff;padding:18px 24px;border-radius:12px 12px 0 0">
              <strong style="font-size:18px">ARINA — Reçu de don</strong>
            </div>
            <div style="border:1px solid #eee;border-top:0;padding:24px;border-radius:0 0 12px 12px">
              <p>Bonjour <strong>${escapeHtml(r.name)}</strong>,</p>
              <p>Merci pour votre don de <strong style="color:#7A2C3E">${amount} ${(r.currency || 'EUR').toUpperCase()}</strong>.</p>
              <p>Votre reçu (réf. <strong>${escapeHtml(receiptNumber)}</strong>) est joint à cet email.</p>
              ${r.message ? `<p style="color:#666">« ${escapeHtml(r.message)} »</p>` : ''}
              <p style="color:#888;font-size:13px">Merci pour votre générosité — chaque don change des vies.<br/>L'équipe ARINA</p>
            </div>
          </div>`,
          attachments: [{ filename: `${receiptNumber}.pdf`, content: Buffer.from(pdf).toString('base64'), content_type: 'application/pdf' }],
        });
        // L'horodatage d'envoi n'est enregistré QUE si l'email est réellement parti
        const upd = await pool.query('UPDATE donations SET receipt_sent_at = $1 WHERE id = $2 RETURNING *', [receiptEmailSent ? new Date().toISOString() : null, r.id]);
        if (upd.rows.length) r = upd.rows[0];
        // Diagnostic : si l'email n'est pas parti, expliquer pourquoi (visible dans l'admin)
        if (!receiptEmailSent) {
          receiptEmailReason = !smtpConfigured() && !process.env.RESEND_API_KEY
            ? 'Emails non configurés : définissez SMTP_HOST, SMTP_USER, SMTP_PASS (Gmail) ou RESEND_API_KEY dans Vercel (Settings → Environment Variables)'
            : !NOTIFY_EMAIL
              ? 'Emails non configurés : NOTIFY_EMAIL manquante dans Vercel'
              : "Envoi refusé par le serveur (identifiants SMTP invalides, mot de passe d'application Gmail incorrect, ou compte non autorisé)";
        }
      } catch (err) {
        console.error('⚠️ Reçu non envoyé :', err.message);
        receiptEmailReason = 'Erreur lors de la génération/envoi : ' + err.message;
      }
    }

    // 💰 Revenus automatiques : un don confirmé « reçu » crée automatiquement une
    // ligne de revenu (type income, catégorie Don) liée au don (donation_id). Le
    // tableau de bord, l'Évaluation et les exports Excel se mettent à jour aussitôt.
    // Retour en « à confirmer » : la ligne est retirée → les revenus ne reflètent
    // que les dons réellement reçus. La liaison donation_id empêche tout doublon.
    let incomeCreated = false;
    let incomeRemoved = false;
    let incomeAmount = null;
    let rateUsed = null;
    try {
      if (status === 'received') {
        const linked = await pool.query('SELECT 1 FROM finances WHERE donation_id = $1', [r.id]);
        if (linked.rows.length === 0) {
          // Taux de conversion : celui saisi à la confirmation, sinon EUR_TO_MGA_RATE,
          // sinon montant enregistré tel quel (devise d'origine visible en description).
          const convRate = rate != null && rate !== '' ? Number(rate) : (Number(process.env.EUR_TO_MGA_RATE) || null);
          const base = Number(r.amount);
          const amountAr = convRate && convRate > 0 ? Math.round(base * convRate) : null;
          incomeAmount = amountAr || base;
          rateUsed = convRate && convRate > 0 ? convRate : null;
          const who = r.anonymous ? 'anonyme' : (r.name || 'anonyme');
          const desc = amountAr
            ? `Don de ${who} (${base} ${r.currency || 'EUR'} ≈ ${amountAr} Ar) — réf ${r.receipt_number || receiptNumber || '—'}`
            : `Don de ${who} (${base} ${r.currency || 'EUR'}) — réf ${r.receipt_number || receiptNumber || '—'}`;
          await pool.query(
            `INSERT INTO finances (type, category, amount, description, date, donor, donation_id)
             VALUES ('income', 'Don', $1, $2, CURRENT_DATE, $3, $4)`,
            [incomeAmount, desc, r.anonymous ? 'Anonyme' : (r.name || 'Anonyme'), r.id]
          );
          incomeCreated = true;
        }
      } else if (old.status === 'received') {
        // Retour en « à confirmer » : on retire le revenu enregistré pour ce don
        const del = await pool.query('DELETE FROM finances WHERE donation_id = $1', [r.id]);
        incomeRemoved = (del.rowCount || 0) > 0;
      }
    } catch (err) {
      // La confirmation du don reste valide même si la mise à jour des revenus échoue
      console.error('⚠️ Revenus non mis à jour :', err.message);
    }

    res.json({ ...r, amount: Number(r.amount), receiptEmailSent, receiptEmailReason, incomeCreated, incomeRemoved, incomeAmount, rateUsed });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET admin — diagnostic de la configuration email (pourquoi les reçus ne partent pas)
app.get('/api/email-status', requireAuth, async (req, res) => {
  const smtp = smtpConfigured();
  const resend = !!(process.env.RESEND_API_KEY && NOTIFY_EMAIL);
  const missing = [];
  if (!smtp && !resend) missing.push('SMTP_HOST', 'SMTP_USER', 'SMTP_PASS');
  if (!process.env.NOTIFY_EMAIL) missing.push('NOTIFY_EMAIL');
  res.json({
    configured: (smtp || resend) && !!process.env.NOTIFY_EMAIL,
    provider: smtp ? 'smtp' : resend ? 'resend' : null,
    missing,
    from: process.env.EMAIL_FROM || (process.env.SMTP_USER ? `ARINA <${process.env.SMTP_USER}>` : null),
    // Gmail : le mot de passe doit être un « mot de passe d'application » (2FA activé)
    gmailHint: /smtp\.gmail\.com/i.test(process.env.SMTP_HOST || ''),
  });
});

// GET admin — APERÇU du reçu PDF (avant confirmation/envoi). Génère le MÊME PDF
// que celui envoyé par email : l'équipe vérifie le reçu avant de confirmer le don.
app.get('/api/donations/:id/receipt', requireRole(), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM donations WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = result.rows[0];
    const pdf = await buildReceiptPdf({ donation: { ...r, amount: Number(r.amount) } });
    const number = r.receipt_number || `ARINA-${new Date().getFullYear()}-${String(r.id).padStart(4, '0')}`;
    res.set('Cache-Control', 'no-store'); // jamais d'aperçu périmé après un changement de statut
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${number}.pdf"`);
    res.send(Buffer.from(pdf));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE admin
app.delete('/api/donations/:id', requireRole(), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM donations WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ CONTACTS (ADMIN) ═══
// Messages du formulaire de contact — accès : président + éducateur
app.get('/api/contacts', requireRole(ROLES.president, ROLES.educator), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) { res.json([]); }
});

app.delete('/api/contacts/:id', requireRole(ROLES.president, ROLES.educator), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM contacts WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ ACTIVITY FEED (ADMIN) ═══
app.get('/api/activity', requireRole(), async (req, res) => {
  try {
    const [newsR, finR, benefR, volR, msgR, testimR, donR] = await Promise.all([
      pool.query("SELECT id, title, created_at FROM news ORDER BY created_at DESC LIMIT 5"),
      pool.query("SELECT id, type, amount, description, date FROM finances ORDER BY date DESC, id DESC LIMIT 5"),
      pool.query("SELECT id, first_name, last_name, entry_date FROM beneficiaries ORDER BY id DESC LIMIT 5"),
      pool.query("SELECT id, name, created_at FROM volunteers ORDER BY created_at DESC LIMIT 5"),
      pool.query("SELECT id, name, created_at FROM contacts ORDER BY created_at DESC LIMIT 5"),
      pool.query("SELECT id, name, status, created_at FROM testimonials ORDER BY created_at DESC LIMIT 5"),
      pool.query("SELECT id, name, amount, status, created_at FROM donations ORDER BY created_at DESC LIMIT 5"),
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
    testimR.rows.forEach(r => items.push({ id: `t${r.id}`, type: 'testimonial', text: r.status === 'published' ? `Témoignage publié : ${r.name}` : `Témoignage reçu : ${r.name}`, date: r.created_at }));
    donR.rows.forEach(r => items.push({ id: `d${r.id}`, type: 'donation', text: r.status === 'received' ? `💝 Don reçu : ${r.name} (${Number(r.amount).toLocaleString('fr-FR')} €)` : `Promesse de don : ${r.name}`, date: r.created_at }));
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(items.slice(0, 12));
  } catch (err) { res.json([]); }
});

// ═══ PRÉSENCES & BADGES QR (événements + pointages scannés) ═══
// Le badge QR encode { id, badgeId, name }. Au scan, l'API retrouve l'enfant
// par badgeId, valide son statut puis enregistre l'entrée/la sortie.

/* Génère (et mémorise) le badgeId d'un bénéficiaire — stable entre deux exports.
   NB : deux exports simultanés d'un enfant sans badge pourraient générer deux
   identifiants (le dernier enregistré gagne) — scénario improbable en usage
   réel, l'index UNIQUE bénéficie d'un second essai par l'éducateur. */
async function ensureBenefBadge(benef) {
  if (benef.badge_id) return benef.badge_id;
  const badgeId = `ARINA-${String(benef.id).padStart(4, '0')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  await pool.query('UPDATE beneficiaries SET badge_id = $1 WHERE id = $2', [badgeId, benef.id]);
  return badgeId;
}

const roleBadge = (status) => (status === 'graduated' ? 'Diplômé' : status === 'inactive' ? 'Ancien bénéficiaire' : 'Bénéficiaire');

// GET événements (tous les rôles authentifiés) — avec compteurs entrées/sorties
app.get('/api/events', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT e.*,
        (SELECT COUNT(*) FROM attendances a WHERE a.event_id = e.id AND a.type = 'entry') AS entries,
        (SELECT COUNT(*) FROM attendances a WHERE a.event_id = e.id AND a.type = 'exit') AS exits
      FROM badge_events e ORDER BY e.event_date DESC, e.id DESC`);
    res.json(r.rows.map((x) => ({
      id: x.id, name: x.name, description: x.description || '',
      event_date: x.event_date ? new Date(x.event_date).toISOString().split('T')[0] : '',
      location: x.location || '',
      is_daily: !!x.is_daily,
      entries: Number(x.entries) || 0, exits: Number(x.exits) || 0,
      created_at: x.created_at,
    })));
  } catch (err) { res.json([]); }
});

// POST événement (éducateur ou admin)
app.post('/api/events', requireRole(ROLES.educator), async (req, res) => {
  try {
    const { name, description, event_date, location } = req.body || {};
    if (!String(name || '').trim()) return res.status(400).json({ error: "Le nom de l'événement est requis" });
    const r = await pool.query(
      'INSERT INTO badge_events (name, description, event_date, location) VALUES ($1,$2,$3,$4) RETURNING *',
      [String(name).trim(), String(description || '').trim() || null, event_date || null, String(location || '').trim() || null]
    );
    const x = r.rows[0];
    res.status(201).json({
      id: x.id, name: x.name, description: x.description || '',
      event_date: x.event_date ? new Date(x.event_date).toISOString().split('T')[0] : '',
      location: x.location || '', is_daily: false, entries: 0, exits: 0, created_at: x.created_at,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE événement (éducateur ou admin) — les présences liées sont supprimées (cascade)
app.delete('/api/events/:id', requireRole(ROLES.educator), async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM badge_events WHERE id = $1 RETURNING *', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Événement introuvable' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET présences d'un événement — groupées par enfant (entrées + sorties horodatées)
app.get('/api/events/:id/attendances', requireAuth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT a.id, a.type, a.scanned_at, b.id AS beneficiary_id, b.first_name, b.last_name, b.photo_url, b.status
      FROM attendances a JOIN beneficiaries b ON b.id = a.beneficiary_id
      WHERE a.event_id = $1 ORDER BY a.id ASC`,
      [req.params.id]);
    const map = new Map();
    for (const row of r.rows) {
      let g = map.get(row.beneficiary_id);
      if (!g) {
        g = {
          id: row.beneficiary_id, firstName: row.first_name, lastName: row.last_name,
          photo: row.photo_url || '', status: row.status, entries: [], exits: [], lastScan: null,
        };
        map.set(row.beneficiary_id, g);
      }
      const stamp = row.scanned_at ? new Date(row.scanned_at).toISOString() : null;
      if (row.type === 'entry') g.entries.push(stamp); else g.exits.push(stamp);
      g.lastScan = stamp;
    }
    res.json([...map.values()]);
  } catch (err) { res.json([]); }
});

// POST /api/scan — pointage entrée/sortie depuis le QR du badge.
// Cas d'erreur (codes utilisés par l'écran de scan) :
//   BADGE_INVALID        → 400/404 « Badge non reconnu »
//   BENEFICIARY_DISABLED → 403 « Compte désactivé »
//   ALREADY_SCANNED      → 409 « Vous êtes déjà pointé(e) ! » (+ dernier pointage)
// Date locale du centre (Indian/Antananarivo, UTC+3) au format YYYY-MM-DD : la
// « journée » de pointage bascule à minuit heure locale (pas à minuit UTC, qui
// tomberait à 21 h locales). Le frontend utilise la même convention côté client.
// Date locale Antananarivo formatée (utilisée par localToday() et la tendance 7 jours)
function localDateStr(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Indian/Antananarivo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function localToday() {
  return localDateStr();
}

// POST /api/scan — pointage entrée/sortie depuis le QR du badge.
// Cas d'erreur (codes utilisés par l'écran de scan) :
//   BADGE_INVALID        → 400/404 « Badge non reconnu »
//   BENEFICIARY_DISABLED → 403 « Compte désactivé »
//   ALREADY_SCANNED      → 409 « Vous êtes déjà pointé(e) ! » (+ dernier pointage)
//   EXIT_WITHOUT_ENTRY   → 422 « Vous devez d'abord scanner l'entrée » (+ suggestion)
// Sans eventId, le pointage est rattaché à la « Présence du jour » (session
// quotidienne créée automatiquement au premier scan valide — une seule par jour).
app.post('/api/scan', rateLimit('scan', 300, 60 * 1000), requireRole(ROLES.educator), async (req, res) => {
  try {
    const { badge, eventId, direction } = req.body || {};
    let parsed = null;
    if (typeof badge === 'string' && badge.trim()) {
      try { parsed = JSON.parse(badge); } catch { /* badge illisible */ }
    }
    const dir = direction === 'exit' ? 'exit' : 'entry';

    // 1) Badge inconnu / mal formé — on ne crée PAS de session du jour pour un mauvais badge
    if (!parsed || !parsed.id) {
      return res.status(404).json({ code: 'BADGE_INVALID', error: 'Badge non reconnu' });
    }
    const badgeId = String(parsed.badgeId || '');
    const rows = badgeId
      ? await pool.query('SELECT * FROM beneficiaries WHERE badge_id = $1', [badgeId])
      : await pool.query('SELECT * FROM beneficiaries WHERE id = $1', [Number(parsed.id)]);
    const benef = rows.rows[0];
    if (!benef) return res.status(404).json({ code: 'BADGE_INVALID', error: 'Badge non reconnu' });

    // 2) Compte désactivé (statut ≠ actif → badge refusé)
    if (benef.status !== 'active') {
      return res.status(403).json({ code: 'BENEFICIARY_DISABLED', error: 'Compte désactivé — contactez l\'administrateur.' });
    }

    // 3) Événement : explicitement choisi, ou « Présence du jour » (session quotidienne
    //    créée automatiquement au premier scan valide — une seule par jour, minuit local).
    let evtId = Number(eventId);
    if (!evtId || !Number.isFinite(evtId)) {
      const todayStr = localToday();
      let dR = await pool.query('SELECT * FROM badge_events WHERE daily_key = $1', [todayStr]);
      if (dR.rows.length === 0) {
        await pool.query(
          `INSERT INTO badge_events (name, event_date, is_daily, daily_key) VALUES ($1,$2,$3,$4)
           ON CONFLICT (daily_key) WHERE daily_key IS NOT NULL DO NOTHING`,
          ['Présence du jour', todayStr, true, todayStr]
        );
        dR = await pool.query('SELECT * FROM badge_events WHERE daily_key = $1', [todayStr]);
      }
      if (dR.rows.length === 0) return res.status(500).json({ error: 'Impossible de créer la présence du jour' });
      evtId = dR.rows[0].id;
    }
    const evtR = await pool.query('SELECT id, name FROM badge_events WHERE id = $1', [evtId]);
    if (evtR.rows.length === 0) {
      return res.status(404).json({ code: 'EVENT_INVALID', error: 'Événement introuvable' });
    }

    // 4) Dernier pointage de l'enfant pour cet événement
    const lastR = await pool.query(
      'SELECT id, type, scanned_at FROM attendances WHERE beneficiary_id = $1 AND event_id = $2 ORDER BY id DESC LIMIT 1',
      [benef.id, evtId]
    );
    const prev = lastR.rows[0];

    // 5) Double pointage : on rescanner le MÊME sens que le dernier scan
    if (prev && prev.type === dir) {
      return res.status(409).json({
        code: 'ALREADY_SCANNED',
        error: 'Vous êtes déjà pointé(e) !',
        lastScan: { type: prev.type, scanned_at: prev.scanned_at },
      });
    }

    // 6) Sortie sans entrée : on propose automatiquement une entrée
    //    (le cas « double sortie » est déjà intercepté par le contrôle 5)
    if (dir === 'exit' && !prev) {
      return res.status(422).json({
        code: 'EXIT_WITHOUT_ENTRY',
        error: 'Vous devez d\'abord scanner l\'entrée',
        suggest: 'entry',
      });
    }

    // 7) Pointage valide → enregistré en base
    const ins = await pool.query(
      'INSERT INTO attendances (beneficiary_id, event_id, type) VALUES ($1,$2,$3) RETURNING id, type, scanned_at',
      [benef.id, evtId, dir]
    );
    const p = ins.rows[0];
    res.status(201).json({
      success: true, code: 'OK',
      pointage: { id: p.id, type: p.type, scanned_at: p.scanned_at },
      child: { id: benef.id, badgeId: benef.badge_id, firstName: benef.first_name, lastName: benef.last_name },
      event: { id: evtId, name: evtR.rows[0].name },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST badge — génère (ou retrouve) le badgeId + le QR code base64 de l'enfant
app.post('/api/beneficiaries/:id/badge', requireRole(ROLES.educator), async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM beneficiaries WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Bénéficiaire introuvable' });
    const b = r.rows[0];
    const badgeId = await ensureBenefBadge(b);
    const qr = await generateQRCode(b.id, badgeId, `${b.first_name} ${b.last_name}`.trim());
    res.json({ badgeId, qrCode: `data:image/png;base64,${qr}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET PDF d'UN badge (logo + photo + QR + identité)
app.get('/api/beneficiaries/:id/badge/pdf', requireRole(ROLES.educator), async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM beneficiaries WHERE id = $1', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Bénéficiaire introuvable' });
    const b = r.rows[0];
    const badgeId = await ensureBenefBadge(b);
    const pdf = await generateBadgePDF({
      id: b.id, badgeId, firstName: b.first_name, lastName: b.last_name,
      role: roleBadge(b.status), photo: b.photo_url,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="badge-${badgeId}.pdf"`);
    res.send(Buffer.from(pdf));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST export — PDF de plusieurs badges (format carte de crédit, 4 par page)
app.post('/api/beneficiaries/badges/export', requireRole(ROLES.educator), async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.map(Number).filter((n) => n > 0))] : [];
    if (ids.length === 0) return res.status(400).json({ error: 'Sélectionnez au moins un bénéficiaire' });
    const r = await pool.query('SELECT * FROM beneficiaries WHERE id = ANY($1)', [ids]);
    const byId = new Map(r.rows.map((x) => [x.id, x]));
    const users = [];
    for (const id of ids) {
      const b = byId.get(id);
      if (!b) continue;
      const badgeId = await ensureBenefBadge(b);
      users.push({ id: b.id, badgeId, firstName: b.first_name, lastName: b.last_name, role: roleBadge(b.status), photo: b.photo_url });
    }
    if (users.length === 0) return res.status(404).json({ error: 'Aucun bénéficiaire trouvé' });
    const pdf = await exportMultipleBadges(users);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="badges-arina.pdf"');
    res.send(Buffer.from(pdf));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ PRÉSENCE DU JOUR : résumé pour le tableau de bord ═══
// Compteurs de la session quotidienne du jour (mêmes données que le scanner) :
// présents sur place, retardataires (1re entrée après l'heure de début) et
// absents (bénéficiaires actifs jamais pointés aujourd'hui).
const DAILY_START_TIME = '08:00'; // heure de début de la journée — retard = 1re entrée après

// Heure locale (Antananarivo) d'un horodatage au format HH:MM — même fuseau que localToday()
function localTimeHHMM(iso) {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Indian/Antananarivo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  return `${get('hour')}:${get('minute')}`;
}
const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return (Number(h) || 0) * 60 + (Number(m) || 0);
};

app.get('/api/presences/today', requireRole(ROLES.educator), async (req, res) => {
  try {
    const todayStr = localToday();

    // ── Tendance 7 derniers jours (taux de présence quotidien) ──
    // Toujours calculée (même sans session aujourd'hui) : l'encart montre la tendance.
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(localDateStr(new Date(Date.now() - i * 86400000)));
    const [weekEvtsR, weekAttR, activeR] = await Promise.all([
      pool.query('SELECT * FROM badge_events WHERE is_daily = TRUE AND daily_key >= $1 AND daily_key <= $2 ORDER BY daily_key', [days[0], days[6]]),
      pool.query('SELECT a.event_id, a.beneficiary_id, a.type, a.scanned_at FROM attendances a JOIN badge_events e ON e.id = a.event_id WHERE e.is_daily = TRUE AND e.daily_key >= $1 AND e.daily_key <= $2', [days[0], days[6]]),
      pool.query('SELECT id, first_name, last_name FROM beneficiaries WHERE status = $1 ORDER BY first_name', ['active']),
    ]);
    const activeRows = activeR.rows; // liste complète des actifs (réutilisée pour « aujourd'hui »)
    const weekTotal = activeRows.length;
    // event_id → enfant → { firstEntry, entries } : heure de la 1re entrée (retard) + pointage
    const scansByEvt = new Map();
    for (const row of weekAttR.rows) {
      let byChild = scansByEvt.get(row.event_id);
      if (!byChild) { byChild = new Map(); scansByEvt.set(row.event_id, byChild); }
      let g = byChild.get(row.beneficiary_id);
      if (!g) { g = { firstEntry: null, entries: 0 }; byChild.set(row.beneficiary_id, g); }
      const t = row.scanned_at ? new Date(row.scanned_at) : null;
      if (row.type === 'entry') {
        g.entries++;
        if (t && (!g.firstEntry || t < g.firstEntry)) g.firstEntry = t;
      }
    }
    const evtByKey = new Map(weekEvtsR.rows.map((e) => [String(e.daily_key), e]));
    const startMin = toMin(DAILY_START_TIME);
    // NB : le dénominateur est le nombre d'actifs ACTUEL — approximation acceptable
    // pour les jours passés (si des enfants sont entrés/sortis en cours de semaine).
    const week = days.map((date) => {
      const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'short', timeZone: 'UTC' });
      const evt = evtByKey.get(date);
      // Jour sans session : aucun pointage possible → pas de retardataire ni d'absent affiché
      if (!evt) {
        return { date, weekday, entered: 0, total: weekTotal, rate: 0, hasSession: false, late: 0, absent: 0, lateNames: [], absentNames: [] };
      }
      const scans = scansByEvt.get(evt.id) || new Map();
      const entered = [...scans.values()].filter((g) => g.entries > 0).length;
      let late = 0;
      const lateNames = [];
      const absentNames = [];
      for (const b of activeRows) {
        const g = scans.get(b.id);
        const name = `${b.first_name || ''} ${b.last_name || ''}`.trim();
        if (!g || g.entries === 0) { if (name && absentNames.length < 12) absentNames.push(name); continue; }
        if (g.firstEntry && toMin(localTimeHHMM(g.firstEntry)) > startMin) { late++; if (name && lateNames.length < 12) lateNames.push(name); }
      }
      return {
        date, weekday,
        entered,
        total: weekTotal,
        rate: weekTotal > 0 ? Math.round((entered / weekTotal) * 100) : 0,
        hasSession: true,
        late,
        absent: Math.max(0, weekTotal - entered),
        lateNames,
        absentNames,
      };
    });

    const evtR = await pool.query('SELECT * FROM badge_events WHERE daily_key = $1', [todayStr]);
    const evt = evtR.rows[0];
    if (!evt) {
      return res.json({
        event: null, startTime: DAILY_START_TIME,
        total: weekTotal, entered: 0, present: 0, late: 0, absent: 0, entries: 0, exits: 0,
        lateNames: [], absentNames: [], attendanceRate: 0, week,
      });
    }

    const attR = await pool.query(
      'SELECT a.beneficiary_id, a.type, a.scanned_at FROM attendances a JOIN beneficiaries b ON b.id = a.beneficiary_id WHERE a.event_id = $1 ORDER BY a.scanned_at ASC, a.id ASC',
      [evt.id]
    );

    // Compteurs entrées/sorties par enfant — « Sur place » = entrées > sorties (même
    // logique que le compteur de la session quotidienne : un enfant qui ressort puis
    // rentre — ex. déjeuner — reste présent).
    const byChild = new Map();
    let entries = 0;
    let exits = 0;
    for (const row of attR.rows) {
      const id = row.beneficiary_id;
      if (row.type === 'entry') entries++;
      else exits++;
      let g = byChild.get(id);
      if (!g) { g = { entries: 0, exits: 0 }; byChild.set(id, g); }
      if (row.type === 'entry') g.entries++;
      else g.exits++;
    }

    const active = activeRows; // même liste que la tendance semaine (bénéficiaires actifs)
    const total = active.length;
    let present = 0;
    for (const g of byChild.values()) if (g.entries > g.exits) present++;

    // Le dernier jour de la tendance EST aujourd'hui : on réutilise ses pointés,
    // retardataires et absents (calcul unique, une seule source de vérité) — seul
    // « présent » a besoin des sorties, d'où la requête attR dédiée.
    const todayWeek = week[week.length - 1];

    res.json({
      event: { id: evt.id, name: evt.name, event_date: evt.event_date ? new Date(evt.event_date).toISOString().split('T')[0] : todayStr },
      startTime: DAILY_START_TIME,
      total,
      entered: todayWeek.entered,
      present,
      late: todayWeek.late,
      absent: todayWeek.absent,
      entries, exits,
      lateNames: todayWeek.lateNames,
      absentNames: todayWeek.absentNames,
      attendanceRate: total > 0 ? Math.round((todayWeek.entered / total) * 100) : 0,
      week,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = app;

// Hook de test (node:test) : injecte un pool factice pour tester l'API sans base réelle
app.__setPool = (p) => { pool = p; };
