// ── Générateur de reçu de don PDF (pdf-lib — pur JS, aucun binaire requis) ──
// Produit un reçu A4 professionnel aux couleurs ARINA (bordeaux/terracotta/or) :
// numéro de reçu, donateur, montant, moyen de paiement, message et coordonnées
// de l'association. Police standard Helvetica (accents français OK, WinAnsi).
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const BORDEAUX = rgb(0.478, 0.173, 0.243); // #7A2C3E
const TERRACOTTA = rgb(0.663, 0.267, 0.220); // #A94438
const GOLD = rgb(0.725, 0.494, 0.169); // #B97E2B
const DARK = rgb(0.16, 0.15, 0.19);
const GRAY = rgb(0.42, 0.42, 0.48);
const LIGHT = rgb(0.95, 0.93, 0.94);

// Formatage du montant SANS espaces insécables (compatibilité encodage PDF)
const fmtN = (n) => Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const dateFr = (d = new Date()) => `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;

const METHOD_LABELS = {
  orange: 'Orange Money',
  mvola: 'MVola',
  virement: 'Virement bancaire',
  crypto: 'Cryptomonnaie (BTC / USDT)',
  stripe: 'Paiement en ligne (carte bancaire)',
};

/* Associations par défaut (surchargeables via le paramètre association) */
const DEFAULT_ASSOCIATION = {
  name: 'ARINA',
  tagline: "Association pour la Réinsertion et l'Insertion des Nouveaux Adultes",
  address: 'Fokontany Tsaramandroso Ambony, Commune Urbaine de Mahajanga, Madagascar',
  phone: '032 77 374 89',
  email: 'rasendrazita@gmail.com',
  thanks: 'Merci pour votre générosité. Chaque don change des vies.',
};

async function buildReceiptPdf({ donation, association = {} }) {
  const a = { ...DEFAULT_ASSOCIATION, ...association };
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4 portrait
  const { width } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const amount = fmtN(donation.amount);
  const currency = (donation.currency || 'EUR').toUpperCase();
  const method = METHOD_LABELS[donation.method] || String(donation.method || '—');

  // ── Bandeau d'en-tête bordeaux ──
  page.drawRectangle({ x: 0, y: 842 - 130, width, height: 130, color: BORDEAUX });
  page.drawText(a.name, { x: 48, y: 842 - 52, size: 30, font: bold, color: rgb(1, 1, 1) });
  page.drawText('REÇU DE DON', { x: 48, y: 842 - 84, size: 16, font: bold, color: GOLD });
  page.drawText('Document officiel de remerciement', { x: 48, y: 842 - 106, size: 9.5, font, color: rgb(0.9, 0.85, 0.87) });

  // Numéro + date (encadré à droite du bandeau)
  const ref = donation.receipt_number || `ARINA-${new Date().getFullYear()}-${String(donation.id || 0).padStart(4, '0')}`;
  const refWidth = bold.widthOfTextAtSize(ref, 11) + 24;
  page.drawRectangle({ x: width - refWidth - 44, y: 842 - 100, width: refWidth, height: 56, color: rgb(1, 1, 1) });
  page.drawText(ref, { x: width - refWidth - 32, y: 842 - 78, size: 11, font: bold, color: BORDEAUX });
  page.drawText(`Émis le ${dateFr()}`, { x: width - refWidth - 32, y: 842 - 92, size: 8.5, font, color: GRAY });

  // ── Corps du reçu ──
  let y = 842 - 178;

  // Bloc donateur
  page.drawText('DONATEUR', { x: 48, y, size: 9, font: bold, color: TERRACOTTA });
  y -= 20;
  page.drawText(String(donation.name || '').toUpperCase(), { x: 48, y, size: 13, font: bold, color: DARK });
  y -= 18;
  page.drawText(String(donation.email || ''), { x: 48, y, size: 10, font, color: GRAY });
  y -= 34;

  // Ligne de séparation or
  page.drawLine({ start: { x: 48, y }, end: { x: width - 48, y }, thickness: 1.2, color: GOLD });
  y -= 30;

  // Montant (grand, encadré)
  page.drawRectangle({ x: 48, y: y - 12, width: width - 96, height: 58, color: LIGHT });
  page.drawText('MONTANT DU DON', { x: 68, y: y + 22, size: 9, font: bold, color: GRAY });
  page.drawText(`${amount} ${currency}`, { x: 68, y: y - 6, size: 24, font: bold, color: BORDEAUX });
  y -= 90;

  // Détails
  const row = (label, value, labelY) => {
    page.drawText(label, { x: 48, y: labelY, size: 9.5, font: bold, color: GRAY });
    page.drawText(value, { x: 210, y: labelY, size: 10.5, font: font, color: DARK });
  };
  row('Moyen de paiement', method, y);
  y -= 22;
  row('Référence interne', `#${donation.id}`, y);
  y -= 30;

  // Message du donateur (si présent)
  if (donation.message) {
    page.drawText('MESSAGE DU DONATEUR', { x: 48, y, size: 9, font: bold, color: TERRACOTTA });
    y -= 18;
    const words = String(donation.message);
    let line = '';
    for (const w of words.split(/\s+/)) {
      if (font.widthOfTextAtSize(line + ' ' + w, 10) > width - 96 && line) {
        page.drawText(`« ${line} »`, { x: 48, y, size: 10, font, color: DARK });
        y -= 16;
        line = w;
      } else {
        line = line ? line + ' ' + w : w;
      }
    }
    if (line) page.drawText(`« ${line} »`, { x: 48, y, size: 10, font, color: DARK });
  }

  // ── Pied de page ──
  page.drawLine({ start: { x: 48, y: 120 }, end: { x: width - 48, y: 120 }, thickness: 1, color: LIGHT });
  page.drawText(a.thanks, { x: 48, y: 98, size: 10.5, font: bold, color: BORDEAUX });
  page.drawText(`${a.name} — ${a.tagline}`, { x: 48, y: 80, size: 9, font, color: GRAY });
  page.drawText(`${a.address}`, { x: 48, y: 64, size: 9, font, color: GRAY });
  page.drawText(`Tél : ${a.phone}   ·   Email : ${a.email}`, { x: 48, y: 48, size: 9, font, color: GRAY });
  page.drawText('Document généré automatiquement — valeur non négociable.', { x: 48, y: 30, size: 8, font, color: GRAY });

  return pdf.save(); // Uint8Array
}

module.exports = { buildReceiptPdf, dateFr };
