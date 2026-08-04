const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { put, del } = require('@vercel/blob');

// Pièces jointes candidatures : formats et taille max (sous la limite Vercel Blob de 5 Mo/upload direct)
const ALLOWED_ATTACH_EXT = /\.(pdf|doc|docx)$/i;
const MAX_ATTACH_SIZE = 4 * 1024 * 1024; // 4 Mo

const app = express();

// Simple admin guard for sensitive endpoints (contacts, newsletter, activity)
const ADMIN_KEY = process.env.ADMIN_KEY || 'arina-admin-key-2024';
function requireAdmin(req, res, next) {
  if (req.headers['x-admin-key'] === ADMIN_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.use(cors());
app.use(express.json({ limit: '10mb' })); // supporte les pièces jointes en base64

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
  ];
  return Promise.allSettled(statements.map((s) => pool.query(s)))
    .then((r) => { if (r.some((x) => x.status === 'rejected')) console.error('⚠️ Auto-migration : certaines instructions en échec'); else console.log('✅ Schéma vérifié (auto-migration)'); })
    .catch((err) => console.error('⚠️ Auto-migration :', err.message));
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
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'arina2024') {
    res.json({ success: true, user: { username, role: 'admin' }, token: ADMIN_KEY });
  } else {
    res.status(401).json({ success: false, error: 'Identifiants incorrects' });
  }
});

// ═══ BENEFICIARIES ═══
app.get('/api/beneficiaries', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM beneficiaries ORDER BY id DESC');
    const rows = result.rows.map(r => ({
      id: r.id, nom: r.last_name, prenom: r.first_name, age: r.age || 0,
      statut: r.status === 'active' ? 'Actif' : r.status === 'graduated' ? 'Diplômé' : 'Inactif',
      dateEntree: r.entry_date ? new Date(r.entry_date).toISOString().split('T')[0] : '',
      formation: r.training || '—',
    }));
    res.json(rows);
  } catch (err) { res.json([]); }
});

app.post('/api/beneficiaries', async (req, res) => {
  try {
    const { prenom, nom, age, statut, dateEntree, formation } = req.body;
    const statusMap = { 'Actif': 'active', 'Diplômé': 'graduated', 'Inactif': 'inactive' };
    const result = await pool.query(
      'INSERT INTO beneficiaries (first_name, last_name, age, status, entry_date, training) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [prenom, nom, Number(age) || 0, statusMap[statut] || 'active', dateEntree, formation]
    );
    const r = result.rows[0];
    res.status(201).json({ id: r.id, nom: r.last_name, prenom: r.first_name, age: r.age || 0,
      statut: r.status === 'active' ? 'Actif' : r.status === 'graduated' ? 'Diplômé' : 'Inactif',
      dateEntree: r.entry_date ? new Date(r.entry_date).toISOString().split('T')[0] : '', formation: r.training || '—' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/beneficiaries/:id', async (req, res) => {
  try {
    const { prenom, nom, age, statut, dateEntree, formation } = req.body;
    const statusMap = { 'Actif': 'active', 'Diplômé': 'graduated', 'Inactif': 'inactive' };
    const result = await pool.query(
      'UPDATE beneficiaries SET first_name=$1, last_name=$2, age=$3, status=$4, entry_date=$5, training=$6 WHERE id=$7 RETURNING *',
      [prenom, nom, Number(age) || 0, statusMap[statut] || 'active', dateEntree, formation, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = result.rows[0];
    res.json({ id: r.id, nom: r.last_name, prenom: r.first_name, age: r.age || 0,
      statut: r.status === 'active' ? 'Actif' : r.status === 'graduated' ? 'Diplômé' : 'Inactif',
      dateEntree: r.entry_date ? new Date(r.entry_date).toISOString().split('T')[0] : '', formation: r.training || '—' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT photo
app.put('/api/beneficiaries/:id/photo', async (req, res) => {
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

app.delete('/api/beneficiaries/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM beneficiaries WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ FINANCES ═══
app.get('/api/finances', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM finances ORDER BY date DESC, id DESC');
    res.json(result.rows.map(r => ({
      id: r.id, type: r.type === 'income' ? 'Revenu' : 'Dépense',
      categorie: r.category || 'Autre', montant: Number(r.amount),
      description: r.description || '',
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
    })));
  } catch (err) { res.json([]); }
});

app.post('/api/finances', async (req, res) => {
  try {
    const { type, categorie, montant, description, date } = req.body;
    const result = await pool.query(
      'INSERT INTO finances (type, category, amount, description, date) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [type === 'Revenu' ? 'income' : 'expense', categorie, Number(montant) || 0, description, date]
    );
    const r = result.rows[0];
    res.status(201).json({ id: r.id, type: r.type === 'income' ? 'Revenu' : 'Dépense',
      categorie: r.category || 'Autre', montant: Number(r.amount), description: r.description || '',
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/finances/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM finances WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
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
    tags: [],
  };
}

app.get('/api/news', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM news ORDER BY created_at DESC, id DESC LIMIT 500');
    res.json(result.rows.map(normalizeNews));
  } catch (err) { res.json([]); }
});

app.post('/api/news', async (req, res) => {
  try {
    const { title, excerpt, category, image_url, status, content, featured } = req.body;
    const result = await pool.query(
      'INSERT INTO news (title, excerpt, category, image_url, status, content, featured) VALUES ($1,$2,$3,$4,COALESCE($5,\'published\'),$6,COALESCE($7,false)) RETURNING *',
      [title, excerpt, category, image_url, status, content, featured]
    );
    res.status(201).json(normalizeNews(result.rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/news/:id', async (req, res) => {
  try {
    const { title, excerpt, category, image_url, status, content, featured } = req.body;
    const result = await pool.query(
      'UPDATE news SET title=$1, excerpt=$2, category=$3, image_url=$4, status=COALESCE($5, status), content=COALESCE($6, content), featured=COALESCE($7, featured) WHERE id=$8 RETURNING *',
      [title, excerpt, category, image_url, status, content, featured, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(normalizeNews(result.rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/news/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM news WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ CONTACT & NEWSLETTER ═══
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stats LIMIT 1');
    res.json(result.rows[0] || { young_accompanied: 30, insertion_rate: 85, partners: 12, years_active: 5 });
  } catch (err) { res.json({ young_accompanied: 30, insertion_rate: 85, partners: 12, years_active: 5 }); }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const result = await pool.query(
      'INSERT INTO contacts (name, email, message) VALUES ($1,$2,$3) RETURNING *',
      [name, email, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/newsletter', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await pool.query(
      'INSERT INTO newsletters (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING *',
      [email]
    );
    res.status(201).json(result.rows[0] || { message: 'Already subscribed' });
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
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET admin — liste SANS les données base64 (sinon la réponse dépasse la limite Vercel).
// Les pièces jointes sont accessibles via file_url / cv_url, ou via l'endpoint legacy ci-dessous.
app.get('/api/volunteers', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, phone, skills, availability, motivation, file_name, file_type, file_size, file_url, cv_name, cv_type, cv_size, cv_url, created_at FROM volunteers ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) { res.json([]); }
});

// GET admin — renvoie une pièce jointe stockée en base64 (candidatures antérieures à Blob)
app.get('/api/volunteers/:id/attachment', requireAdmin, async (req, res) => {
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

app.delete('/api/volunteers/:id', requireAdmin, async (req, res) => {
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
app.get('/api/contacts', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) { res.json([]); }
});

app.delete('/api/contacts/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM contacts WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ NEWSLETTER (ADMIN) ═══
app.get('/api/newsletter/subscribers', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM newsletters ORDER BY subscribed_at DESC LIMIT 200');
    res.json(result.rows);
  } catch (err) { res.json([]); }
});

app.delete('/api/newsletter/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM newsletters WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══ ACTIVITY FEED (ADMIN) ═══
app.get('/api/activity', requireAdmin, async (req, res) => {
  try {
    const [newsR, finR, benefR] = await Promise.all([
      pool.query("SELECT id, title, created_at FROM news ORDER BY created_at DESC LIMIT 5"),
      pool.query("SELECT id, type, amount, description, date FROM finances ORDER BY date DESC, id DESC LIMIT 5"),
      pool.query("SELECT id, first_name, last_name, entry_date FROM beneficiaries ORDER BY id DESC LIMIT 5"),
    ]);
    const items = [];
    newsR.rows.forEach(r => items.push({ id: `n${r.id}`, type: 'news', text: `Actualité publiée : « ${r.title} »`, date: r.created_at }));
    finR.rows.forEach(r => items.push({
      id: `f${r.id}`, type: r.type === 'income' ? 'income' : 'expense',
      text: `${r.type === 'income' ? 'Revenu' : 'Dépense'} : ${Number(r.amount).toLocaleString('fr-FR')} Ar${r.description ? ' — ' + r.description : ''}`,
      date: r.date,
    }));
    benefR.rows.forEach(r => items.push({ id: `b${r.id}`, type: 'beneficiary', text: `Bénéficiaire ajouté : ${r.first_name} ${r.last_name}`, date: r.entry_date }));
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(items.slice(0, 12));
  } catch (err) { res.json([]); }
});

module.exports = app;
