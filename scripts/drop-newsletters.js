#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────
   Analyse + suppression de la table `newsletters` (PostgreSQL).
   Sécurisé : l'analyse est en lecture seule ; la suppression
   n'a lieu qu'avec l'argument --yes ; le résultat est vérifié.

   Utilisation :
     DATABASE_URL="postgresql://..." node scripts/drop-newsletters.js           # analyse seule
     DATABASE_URL="postgresql://..." node scripts/drop-newsletters.js --yes     # analyse + suppression
   ───────────────────────────────────────────────────────────── */
const { Client } = require('pg');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ Variable DATABASE_URL manquante.');
    console.error('Utilisation : DATABASE_URL="postgresql://..." node scripts/drop-newsletters.js [--yes]');
    process.exit(1);
  }

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // ── ÉTAPE 1 — ANALYSE (lecture seule) ──
  const tables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE '%newsletter%'"
  );
  if (tables.rows.length === 0) {
    console.log('ℹ️ Aucune table newsletter trouvée dans la base : rien à supprimer.');
    await client.end();
    return;
  }
  for (const { table_name } of tables.rows) {
    const cnt = await client.query(`SELECT count(*) AS n FROM "${table_name}"`);
    console.log(`📋 Table trouvée : ${table_name} (${cnt.rows[0].n} ligne(s))`);
  }

  // ── ÉTAPE 2 — SUPPRESSION (uniquement avec --yes) ──
  if (!process.argv.includes('--yes')) {
    console.log('\n⚠️  Suppression imminente de la/des table(s) ci-dessus.');
    console.log('Relancez avec --yes pour confirmer la suppression.');
    await client.end();
    process.exit(0);
  }
  for (const { table_name } of tables.rows) {
    await client.query(`DROP TABLE IF EXISTS "${table_name}"`);
    console.log(`🗑️  Table ${table_name} supprimée.`);
  }

  // ── ÉTAPE 3 — VÉRIFICATION ──
  const after = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE '%newsletter%'"
  );
  console.log(after.rows.length === 0
    ? '✅ Vérifié : plus aucune table newsletter dans la base.'
    : '⚠️ Des tables newsletter subsistent encore : ' + after.rows.map((r) => r.table_name).join(', '));
  await client.end();
})().catch((err) => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});
