const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'arina_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// Test DB connection
pool.connect()
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch((err) => console.error('❌ DB connection error:', err.message));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Routes ---

// GET all news
app.get('/api/news', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM news ORDER BY created_at DESC LIMIT 10'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single news
app.get('/api/news/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM news WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET stats
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stats LIMIT 1');
    res.json(result.rows[0] || {
      young_accompanied: 30,
      insertion_rate: 85,
      partners: 12,
      years_active: 5,
    });
  } catch (err) {
    res.json({
      young_accompanied: 30,
      insertion_rate: 85,
      partners: 12,
      years_active: 5,
    });
  }
});

// GET pillars
app.get('/api/pillars', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM pillars ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST contact form
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

// POST newsletter subscription
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
