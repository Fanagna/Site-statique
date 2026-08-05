/* ─────────────────────────────────────────────────────────────
   Outils Excel (SheetJS) — export de rapports .xlsx.
   Tout est côté navigateur (aucun upload serveur).
   ───────────────────────────────────────────────────────────── */

/* Chargement paresseux de SheetJS : le paquet `xlsx` (~1 Mo) n'est téléchargé
   qu'au premier export Excel — jamais au chargement de la page. */
let xlsxPromise = null;
const loadXLSX = () => {
  if (!xlsxPromise) {
    // En cas d'échec passager, on remet à zéro pour pouvoir réessayer au clic suivant.
    xlsxPromise = import('xlsx').catch((err) => { xlsxPromise = null; throw err; });
  }
  return xlsxPromise;
};

const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const escNum = (v) => (v == null || v === '' ? '' : Number(v));
const fmtDate = (d) => (d ? String(d) : '');

/* ── Export .xlsx du rapport (filtres : année, mois, donateur) ──
   Feuilles : Transactions (détail), Récapitulatif mensuel, Récapitulatif par donateur.
   year peut être '' pour exporter toute la période (rapport complet d'un donateur). */
export async function exportEvaluationXlsx({ year, month, donor, finances, donors, fileName }) {
  const XLSX = await loadXLSX();
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
