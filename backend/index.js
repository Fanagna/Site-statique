// ═══════════════════════════════════════════════════════════════
// Serveur de développement ARINA
// Source UNIQUE de vérité : api/index.js (le même code tourne en
// production sur Vercel et en local — plus aucune dérive entre les
// deux fichiers). Ce fichier ne fait que charger l'API et écouter.
// ═══════════════════════════════════════════════════════════════
require('dotenv').config(); // variables locales (.env) disponibles avant le chargement de l'API
const app = require('../api/index.js');
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Serveur ARINA : http://localhost:${PORT}`);
  console.log('ℹ️  API identique à la production (Vercel) — voir /api/health');
});
