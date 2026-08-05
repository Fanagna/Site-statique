/* ─────────────────────────────────────────────────────────────
   Outils Excel (SheetJS) — modèle téléchargeable, import mensuel,
   export de rapports .xlsx. Tout est côté navigateur (aucun upload serveur).
   ───────────────────────────────────────────────────────────── */
import * as XLSX from 'xlsx';

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/* ── Normalisation des dates ──
   Accepte 'AAAA-MM-JJ', 'JJ/MM/AAAA', Date JS, numéro de série Excel… → 'AAAA-MM-JJ' */
export function parseDate(v) {
  if (v == null || v === '') return '';
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number') {
    // Série Excel (jours depuis 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); // AAAA-MM-JJ
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/); // JJ/MM/AAAA
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return '';
}

/* ── Normalisation du type (DON / DÉPENSE) ── */
export function normalizeType(v) {
  const s = String(v || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/^(don|dons|revenu|income|donation|recu|recus|entree)/.test(s)) return 'Revenu';
  if (/^(depense|expense|sortie|charge)/.test(s)) return 'Dépense';
  return '';
}

/* ── Header → clé interne (insensible à la casse et aux accents) ── */
function headerKey(h) {
  return String(h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/* Nombre → valeur numérique (gère les formats français : espaces et virgule décimale) */
const toNum = (val) => {
  if (val == null || String(val).trim() === '') return null;
  const n = Number(String(val).replace(/[\s\u00a0\u202f]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/* ── Ligne brute → transaction normalisée ──
   Retourne { ok:true, row } ou { ok:false, row, error } */
export function normalizeImportRow(raw, donors) {
  const row = {
    date: '', type: '', categorie: '', description: '', quantity: null, unit_price: null, montant: null, donor: '',
  };
  const known = (donors || []).map((d) => String(d.name || '').toLowerCase().trim());
  let donorRaw = '';
  for (const [k, v] of Object.entries(raw)) {
    if (v == null || String(v).trim() === '') continue;
    const key = headerKey(k);
    const val = String(v).trim();
    if (key.startsWith('date')) row.date = parseDate(v);
    else if (key.startsWith('type')) row.type = normalizeType(v);
    else if (/^(designation|desig|categorie|category|categor)/.test(key)) row.categorie = val;
    else if (/^(description|detail|libelle)/.test(key)) row.description = val;
    else if (/^(qt|qte|qty|quantite|quantity)/.test(key)) row.quantity = toNum(val);
    else if (/^(pu|prixunitaire|prix-unitaire|unitprice|prix)/.test(key)) row.unit_price = toNum(val);
    else if (/^(montant|mnt|amount|total|somme)/.test(key)) row.montant = toNum(val);
    else if (/^(donateur|donor|partenaire|financeur)/.test(key)) donorRaw = val;
  }

  // Donateur : comparé insensiblement à la liste (fallback : nom exact tel que saisi)
  const dLower = donorRaw.toLowerCase().trim();
  const idx = known.indexOf(dLower);
  row.donor = idx !== -1 ? donors[idx].name : donorRaw;
  if (!donorRaw) return { ok: false, row, error: 'Donateur manquant (obligatoire)' };

  // Montant : MNT = QT × PU dès que les deux sont fournis
  if (row.quantity != null && row.unit_price != null) row.montant = Math.round(row.quantity * row.unit_price);

  if (!row.date) return { ok: false, row, error: 'Date invalide' };
  if (!row.type) return { ok: false, row, error: 'Type invalide (DON ou DÉPENSE)' };
  if (!row.montant || row.montant <= 0) return { ok: false, row, error: 'Montant manquant ou invalide' };
  if (!row.categorie) row.categorie = 'Autre';
  return { ok: true, row };
}

/* ── Lecture d'un classeur → lignes normalisées avec diagnostics ──
   donors : liste des donateurs existants (pour marquer les inconnus en aperçu). */
export async function parseWorkbook(file, donors = []) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { rows: [], valid: 0, errors: [{ row: 0, reason: 'Aucune feuille de calcul trouvée' }] };
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (matrix.length < 2) return { rows: [], valid: 0, errors: [{ row: 0, reason: 'Fichier vide — utilisez le modèle téléchargeable' }] };

  const headers = matrix[0];
  const rawRows = matrix.slice(1).filter((r) => r.some((c) => String(c).trim() !== ''));
  const rows = [];
  const errors = [];
  const unknownDonors = new Set();
  const known = (donors || []).map((d) => String(d.name || '').toLowerCase().trim());

  rawRows.forEach((r, i) => {
    const orig = {};
    headers.forEach((h, j) => { if (h != null && String(h).trim() !== '') orig[String(h).trim()] = r[j]; });
    const { ok, row, error } = normalizeImportRow(orig, donors);
    if (ok) {
      rows.push(row);
      if (!known.includes(row.donor.toLowerCase())) unknownDonors.add(row.donor);
    } else {
      errors.push({ row: i + 2, reason: error });
    }
  });
  return { rows, valid: rows.length, errors, unknownDonors: [...unknownDonors] };
}

/* ── Modèle téléchargeable (.xlsx) ── */
export function downloadTemplate() {
  const aoa = [
    ['Date (AAAA-MM-JJ)', 'Type (DON ou DÉPENSE)', 'Désignation', 'Description (détail)', 'QT', 'PU (Ar)', 'Montant (Ar)', 'Donateur'],
    ['2025-01-15', 'DON', 'Don', 'Contribution mensuelle', '', '', '3000000', 'Ravinala'],
    ['2025-01-18', 'DÉPENSE', 'Salaire', 'Salaire des éducateurs — janvier', '3', '400000', '1200000', 'Ravinala'],
    ['2025-01-20', 'DÉPENSE', 'Alimentation', 'Riz, haricots, viande — cuisine du foyer', '2', '350000', '700000', 'Horizon'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 34 }, { wch: 6 }, { wch: 10 }, { wch: 12 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
  XLSX.writeFile(wb, 'modele-import-ARINA.xlsx');
}

const escNum = (v) => (v == null || v === '' ? '' : Number(v));
const fmtDate = (d) => (d ? String(d) : '');

/* ── Export .xlsx du rapport (filtres : année, mois, donateur) ──
   Feuilles : Transactions (détail), Récapitulatif mensuel, Récapitulatif par donateur.
   year peut être '' pour exporter toute la période (rapport complet d'un donateur). */
export function exportEvaluationXlsx({ year, month, donor, finances, donors, fileName }) {
  const mk = (d) => { if (!d) return ''; const [y, m] = String(d).split('-'); return y && m ? `${y}-${String(m).padStart(2, '0')}` : ''; };

  const filtered = (finances || []).filter((f) => {
    const k = mk(f.date);
    if (year && !k.startsWith(String(year))) return false;
    if (month && !k.endsWith(`-${month}`)) return false;
    if (donor && (f.donor || 'Sans donateur') !== donor) return false;
    return true;
  }).sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // Feuille 1 — détail des transactions
  const detail = [
    ['Date', 'Type', 'Désignation', 'Description', 'QT', 'PU (Ar)', 'MNT (Ar)', 'Donateur'],
    ...filtered.map((f) => [
      fmtDate(f.date), f.type, f.categorie || 'Autre', f.description || '',
      escNum(f.quantity), escNum(f.unit_price), Number(f.montant) || 0, f.donor || '',
    ]),
  ];
  const totalDons = filtered.filter((f) => f.type === 'Revenu').reduce((s, f) => s + (Number(f.montant) || 0), 0);
  const totalDep = filtered.filter((f) => f.type === 'Dépense').reduce((s, f) => s + (Number(f.montant) || 0), 0);
  detail.push([]);
  detail.push(['TOTAL DONS REÇUS', '', '', '', '', '', totalDons, '']);
  detail.push(['TOTAL DÉPENSES', '', '', '', '', '', totalDep, '']);
  detail.push(['SOLDE', '', '', '', '', '', totalDons - totalDep, '']);

  // Feuille 2 — récapitulatif mensuel (mois avec données)
  const byMonth = {};
  filtered.forEach((f) => { const k = mk(f.date); (byMonth[k] = byMonth[k] || []).push(f); });
  const recap = [
    ['Mois', 'DON REÇUS (Ar)', 'TOTAL DÉPENSE (Ar)', 'SOLDE (Ar)'],
    ...Object.keys(byMonth).sort().map((k) => {
      const rows = byMonth[k];
      const dons = rows.filter((f) => f.type === 'Revenu').reduce((s, f) => s + (Number(f.montant) || 0), 0);
      const dep = rows.filter((f) => f.type === 'Dépense').reduce((s, f) => s + (Number(f.montant) || 0), 0);
      const [y, m] = k.split('-');
      return [`${MONTH_NAMES[Number(m) - 1]} ${y}`, dons, dep, dons - dep];
    }),
    ...(Object.keys(byMonth).length ? [['TOTAL', totalDons, totalDep, totalDons - totalDep]] : []),
  ];

  // Feuille 3 — récapitulatif par donateur
  const byDonor = {};
  filtered.forEach((f) => { const d = f.donor || 'Sans donateur'; (byDonor[d] = byDonor[d] || []).push(f); });
  const needBy = {};
  (donors || []).forEach((d) => { needBy[String(d.name).toLowerCase()] = d.need || ''; });
  const perDonor = [
    ['Donateur', 'Besoin financé', 'DONS REÇUS (Ar)', 'DÉPENSES (Ar)', 'SOLDE (Ar)'],
    ...Object.keys(byDonor).sort((a, b) => a.localeCompare(b, 'fr')).map((d) => {
      const rows = byDonor[d];
      const dons = rows.filter((f) => f.type === 'Revenu').reduce((s, f) => s + (Number(f.montant) || 0), 0);
      const dep = rows.filter((f) => f.type === 'Dépense').reduce((s, f) => s + (Number(f.montant) || 0), 0);
      return [d, needBy[d.toLowerCase()] || '', dons, dep, dons - dep];
    }),
  ];

  const wb = XLSX.utils.book_new();
  const s1 = XLSX.utils.aoa_to_sheet(detail);
  s1['!cols'] = [{ wch: 11 }, { wch: 10 }, { wch: 16 }, { wch: 40 }, { wch: 6 }, { wch: 10 }, { wch: 12 }, { wch: 18 }];
  const s2 = XLSX.utils.aoa_to_sheet(recap);
  s2['!cols'] = [{ wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 12 }];
  const s3 = XLSX.utils.aoa_to_sheet(perDonor);
  s3['!cols'] = [{ wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, s1, 'Transactions');
  XLSX.utils.book_append_sheet(wb, s2, 'Récapitulatif mensuel');
  XLSX.utils.book_append_sheet(wb, s3, 'Par donateur');
  XLSX.writeFile(wb, fileName || `rapport-ARINA-${year}.xlsx`);
}

/* Nom d'onglet Excel sûr (≤ 31 caractères, sans caractères interdits) */
function safeSheetName(name) {
  const s = String(name || '').replace(/[\\/\?\*\[\]:]/g, ' ').trim().slice(0, 31);
  return s || 'Donateur';
}

/* ── Export .xlsx « par donateur » ──
   Un seul fichier pour la période (mois + année) avec :
   - Feuille « Synthèse » : récap par donateur (dons / dépenses / solde)
   - Une feuille par donateur : détail complet des dépenses ET revenus + totaux.
   Chaque donateur peut ainsi recevoir sa propre feuille / son propre fichier. */
export function exportDonorsXlsx({ year, month, finances, donors, fileName }) {
  const mk = (d) => { if (!d) return ''; const [y, m] = String(d).split('-'); return y && m ? `${y}-${String(m).padStart(2, '0')}` : ''; };
  const periodLabel = `${month ? MONTH_NAMES[Number(month) - 1] + ' ' : ''}${year}`;

  const filtered = (finances || []).filter((f) => {
    const k = mk(f.date);
    if (!k.startsWith(String(year))) return false;
    if (month && !k.endsWith(`-${month}`)) return false;
    return true;
  });

  const needBy = {};
  (donors || []).forEach((d) => { needBy[String(d.name).toLowerCase()] = d.need || ''; });
  const byDonor = {};
  filtered.forEach((f) => { const d = f.donor || 'Sans donateur'; (byDonor[d] = byDonor[d] || []).push(f); });
  const donorNames = Object.keys(byDonor).sort((a, b) => a.localeCompare(b, 'fr'));

  const wb = XLSX.utils.book_new();
  const usedSheets = new Set(['Synthèse']);
  /* Nom d'onglet unique : évite les collisions après nettoyage/raccourcissement */
  const uniqueSheet = (base) => {
    const clean = safeSheetName(base);
    let n = clean;
    let i = 2;
    while (usedSheets.has(n)) { n = `${clean.slice(0, 29)}-${i}`; i++; }
    usedSheets.add(n);
    return n;
  };

  // Feuille 1 — synthèse par donateur
  const syn = [
    ['RAPPORT MENSUEL PAR DONATEUR — ARINA'],
    [`Période : ${periodLabel}`],
    [],
    ['Donateur', 'Besoin financé', 'DONS REÇUS (Ar)', 'DÉPENSES (Ar)', 'SOLDE (Ar)', 'Nb transactions'],
  ];
  if (donorNames.length === 0) syn.push(['Aucune transaction sur la période sélectionnée', '', '', '', '', '']);
  let tDons = 0, tDep = 0;
  donorNames.forEach((d) => {
    const rows = byDonor[d];
    const dons = rows.filter((r) => r.type === 'Revenu').reduce((s, r) => s + (Number(r.montant) || 0), 0);
    const dep = rows.filter((r) => r.type === 'Dépense').reduce((s, r) => s + (Number(r.montant) || 0), 0);
    tDons += dons; tDep += dep;
    syn.push([d, needBy[d.toLowerCase()] || '', dons, dep, dons - dep, rows.length]);
  });
  syn.push(['TOTAL', '', tDons, tDep, tDons - tDep, filtered.length]);
  const sSyn = XLSX.utils.aoa_to_sheet(syn);
  sSyn['!cols'] = [{ wch: 20 }, { wch: 26 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, sSyn, 'Synthèse');

  // Feuilles suivantes — une par donateur (détail dépenses + revenus)
  donorNames.forEach((d) => {
    const rows = [...byDonor[d]].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const dons = rows.filter((r) => r.type === 'Revenu').reduce((s, r) => s + (Number(r.montant) || 0), 0);
    const dep = rows.filter((r) => r.type === 'Dépense').reduce((s, r) => s + (Number(r.montant) || 0), 0);
    const aoa = [
      [`Rapport ARINA — Donateur : ${d}`],
      [`Besoin financé : ${needBy[d.toLowerCase()] || '—'}`],
      [`Période : ${periodLabel}`],
      [],
      ['Date', 'Type', 'Désignation', 'Description', 'QT', 'PU (Ar)', 'MNT (Ar)'],
      ...rows.map((f) => [fmtDate(f.date), f.type, f.categorie || 'Autre', f.description || '', escNum(f.quantity), escNum(f.unit_price), Number(f.montant) || 0]),
      [],
      ['DONS REÇUS', '', '', '', '', '', dons],
      ['TOTAL DÉPENSE', '', '', '', '', '', dep],
      ['SOLDE', '', '', '', '', '', dons - dep],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 11 }, { wch: 10 }, { wch: 16 }, { wch: 40 }, { wch: 6 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, uniqueSheet(d));
  });

  XLSX.writeFile(wb, fileName || `rapports-donateurs-ARINA-${year}.xlsx`);
}
