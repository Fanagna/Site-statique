const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Simple admin guard for sensitive endpoints (contacts, newsletter, activity)
const ADMIN_KEY = process.env.ADMIN_KEY || 'arina-admin-key-2024';
function requireAdmin(req, res, next) {
  if (req.headers['x-admin-key'] === ADMIN_KEY) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // supporte les pièces jointes en base64

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'arina_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

pool.connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch((err) => console.error('❌ DB connection error:', err.message));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  // Simple hardcoded auth — replace with DB check in production
  if (username === 'admin' && password === 'arina2024') {
    res.json({ success: true, user: { username, role: 'admin' }, token: ADMIN_KEY });
  } else {
    res.status(401).json({ success: false, error: 'Identifiants incorrects' });
  }
});

// ═══════════════════════════════════════
// BENEFICIARIES CRUD
// ═══════════════════════════════════════

// GET all
app.get('/api/beneficiaries', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM beneficiaries ORDER BY id DESC');
    // Normalize column names for frontend
    const rows = result.rows.map(r => ({
      id: r.id,
      nom: r.last_name,
      prenom: r.first_name,
      age: r.age || 0,
      statut: r.status === 'active' ? 'Actif' : r.status === 'graduated' ? 'Diplômé' : 'Inactif',
      dateEntree: r.entry_date ? new Date(r.entry_date).toISOString().split('T')[0] : '',
      formation: r.training || '—',
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create
app.post('/api/beneficiaries', async (req, res) => {
  try {
    const { prenom, nom, age, statut, dateEntree, formation } = req.body;
    const statusMap = { 'Actif': 'active', 'Diplômé': 'graduated', 'Inactif': 'inactive' };
    const result = await pool.query(
      `INSERT INTO beneficiaries (first_name, last_name, age, status, entry_date, training)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [prenom, nom, Number(age) || 0, statusMap[statut] || 'active', dateEntree, formation]
    );
    const r = result.rows[0];
    res.status(201).json({
      id: r.id, nom: r.last_name, prenom: r.first_name,
      age: r.age || 0,
      statut: r.status === 'active' ? 'Actif' : r.status === 'graduated' ? 'Diplômé' : 'Inactif',
      dateEntree: r.entry_date ? new Date(r.entry_date).toISOString().split('T')[0] : '',
      formation: r.training || '—',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update
app.put('/api/beneficiaries/:id', async (req, res) => {
  try {
    const { prenom, nom, age, statut, dateEntree, formation } = req.body;
    const statusMap = { 'Actif': 'active', 'Diplômé': 'graduated', 'Inactif': 'inactive' };
    const result = await pool.query(
      `UPDATE beneficiaries SET first_name=$1, last_name=$2, age=$3, status=$4, entry_date=$5, training=$6
       WHERE id=$7 RETURNING *`,
      [prenom, nom, Number(age) || 0, statusMap[statut] || 'active', dateEntree, formation, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const r = result.rows[0];
    res.json({
      id: r.id, nom: r.last_name, prenom: r.first_name,
      age: r.age || 0,
      statut: r.status === 'active' ? 'Actif' : r.status === 'graduated' ? 'Diplômé' : 'Inactif',
      dateEntree: r.entry_date ? new Date(r.entry_date).toISOString().split('T')[0] : '',
      formation: r.training || '—',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
app.delete('/api/beneficiaries/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM beneficiaries WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════
// FINANCES CRUD
// ═══════════════════════════════════════

// GET all
app.get('/api/finances', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM finances ORDER BY date DESC, id DESC');
    const rows = result.rows.map(r => ({
      id: r.id,
      type: r.type === 'income' ? 'Revenu' : 'Dépense',
      categorie: r.category || 'Autre',
      montant: Number(r.amount),
      description: r.description || '',
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
    }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create
app.post('/api/finances', async (req, res) => {
  try {
    const { type, categorie, montant, description, date } = req.body;
    const result = await pool.query(
      `INSERT INTO finances (type, category, amount, description, date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [type === 'Revenu' ? 'income' : 'expense', categorie, Number(montant) || 0, description, date]
    );
    const r = result.rows[0];
    res.status(201).json({
      id: r.id,
      type: r.type === 'income' ? 'Revenu' : 'Dépense',
      categorie: r.category || 'Autre',
      montant: Number(r.amount),
      description: r.description || '',
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE
app.delete('/api/finances/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM finances WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════
// NEWS
// ═══════════════════════════════════════

app.get('/api/news', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM news ORDER BY created_at DESC, id DESC LIMIT 500');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/news/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM news WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create news
app.post('/api/news', async (req, res) => {
  try {
    const { title, excerpt, category, image_url, status } = req.body;
    const result = await pool.query(
      "INSERT INTO news (title, excerpt, category, image_url, status) VALUES ($1, $2, $3, $4, COALESCE($5, 'published')) RETURNING *",
      [title, excerpt, category, image_url, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update news
app.put('/api/news/:id', async (req, res) => {
  try {
    const { title, excerpt, category, image_url, status } = req.body;
    const result = await pool.query(
      'UPDATE news SET title=$1, excerpt=$2, category=$3, image_url=$4, status=COALESCE($5, status) WHERE id=$6 RETURNING *',
      [title, excerpt, category, image_url, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE news
app.delete('/api/news/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM news WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════
// CONTACT & NEWSLETTER
// ═══════════════════════════════════════

app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stats LIMIT 1');
    res.json(result.rows[0] || { young_accompanied: 30, insertion_rate: 85, partners: 12, years_active: 5 });
  } catch (err) {
    res.json({ young_accompanied: 30, insertion_rate: 85, partners: 12, years_active: 5 });
  }
});

app.get('/api/pillars', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pillars ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const result = await pool.query(
      'INSERT INTO contacts (name, email, message) VALUES ($1, $2, $3) RETURNING *',
      [name, email, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/newsletter', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await pool.query(
      'INSERT INTO newsletters (email) VALUES ($1) ON CONFLICT (email) DO NOTHING RETURNING *',
      [email]
    );
    res.status(201).json(result.rows[0] || { message: 'Already subscribed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════
// VOLUNTEERS (candidatures + lettre de motivation)
// ═══════════════════════════════════════

// POST public — reçoit une candidature bénévole avec pièce jointe (base64)
app.post('/api/volunteers', async (req, res) => {
  try {
    const { name, email, phone, skills, availability, motivation, file } = req.body;
    const result = await pool.query(
      `INSERT INTO volunteers (name, email, phone, skills, availability, motivation, file_name, file_type, file_size, file_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [name, email, phone, skills, availability, motivation,
       file?.name || null, file?.type || null, file?.size || null, file?.data || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET admin
app.get('/api/volunteers', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, phone, skills, availability, motivation, file_name, file_type, file_size, file_data, created_at FROM volunteers ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

// DELETE admin
app.delete('/api/volunteers/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM volunteers WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══ CONTACTS (ADMIN) ═══
app.get('/api/contacts', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 100');
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

app.delete('/api/contacts/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM contacts WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══ NEWSLETTER (ADMIN) ═══
app.get('/api/newsletter/subscribers', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM newsletters ORDER BY subscribed_at DESC LIMIT 200');
    res.json(result.rows);
  } catch (err) {
    res.json([]);
  }
});

app.delete('/api/newsletter/:id', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM newsletters WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
  } catch (err) {
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
