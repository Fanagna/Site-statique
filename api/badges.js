// ── Badges ARINA : QR codes + PDF (PDFKit, pur JS — aucun binaire requis) ──
// Trois fonctions :
//   1. generateQRCode(userId, badgeId, name)  → PNG base64 du QR { id, badgeId, name }
//   2. generateBadgePDF(user)                  → PDF Buffer d'UN badge (carte A4 centrée)
//   3. exportMultipleBadges(users)             → PDF Buffer de plusieurs badges
//      (format carte de crédit ISO 7810 — 4 badges par page A4)
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

// ── Charte graphique ARINA (identique au reçu de don) ──
const BORDEAUX = '#7A2C3E';
const TERRACOTTA = '#A94438';
const GOLD = '#B97E2B';
const DARK = '#29282F';
const GRAY = '#6B6B76';
const LIGHT = '#F2EEF0';

const ARINA_LOGO = require('./arina-logo');

// ── Dimensions « carte de crédit » (ISO/IEC 7810 ID-1 : 85,6 × 54 mm) ──
const CARD_W = 85.6 * 2.83465; // 242,6 pt
const CARD_H = 54 * 2.83465;   // 153,1 pt

/* 1) QR code → image PNG en base64 (sans le préfixe « data:image/png;base64, »).
   Le badgeId est le code imprimé sur le badge (ARINA-XXXX) : c'est lui qui
   identifie l'enfant de façon fiable au moment du scan. */
async function generateQRCode(userId, badgeId, name) {
  const payload = JSON.stringify({ id: userId, badgeId, name });
  const png = await QRCode.toBuffer(payload, {
    width: 512,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#1E1E24', light: '#FFFFFF' },
  });
  return png.toString('base64');
}

/* Découpe une photo (data URL ou base64 brute) en { mime, buffer } pour PDFKit.
   Les URLs externes (http…) ne sont PAS des images encodées : on renvoie null
   (la carte affichera alors les initiales de l'enfant). */
function parsePhoto(photo) {
  if (!photo) return null;
  const str = String(photo).trim();
  if (/^https?:\/\//i.test(str) || str.startsWith('/')) return null;
  const m = str.match(/^data:image\/(\w+);base64,(.+)$/);
  if (m) return { mime: m[1].toLowerCase(), buffer: Buffer.from(m[2], 'base64') };
  // Base64 brute (PNG ou JPEG — on laisse PDFKit deviner le format)
  if (/^[A-Za-z0-9+/=\r\n]+$/.test(str)) return { mime: 'png', buffer: Buffer.from(str, 'base64') };
  return null;
}

/* Affiche le logo ARINA dans un carré blanc arrondi (le logo est carré) */
function drawLogo(doc, x, y, size) {
  doc.save();
  doc.roundedRect(x - 3, y - 3, size + 6, size + 6, 8).fill('#FFFFFF');
  try {
    doc.image(Buffer.from(ARINA_LOGO, 'base64'), x, y, { width: size, height: size });
  } catch {
    // Logo illisible : on trace simplement le monogramme ARINA en texte
    doc.fillColor(BORDEAUX).font('Helvetica-Bold').fontSize(size * 0.4)
      .text('ARINA', x + 2, y + size * 0.28, { width: size - 4, align: 'center' });
  }
  doc.restore();
}

/* Dessine UNE carte de badge aux coordonnées (x, y) — coin supérieur gauche.
   user = { id, badgeId, firstName, lastName, role?, photo? } */
function drawCard(doc, user, x, y) {
  const role = (user.role || 'Bénéficiaire').toUpperCase();
  const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();

  // ── Fond blanc + bordure bordeaux ──
  doc.save();
  doc.roundedRect(x, y, CARD_W, CARD_H, 12).fill('#FFFFFF').strokeColor(BORDEAUX).lineWidth(1.6).stroke();

  // ── Bandeau supérieur bordeaux (barre décorative) ──
  doc.roundedRect(x, y, CARD_W, 34, 12).fill(BORDEAUX);
  doc.rect(x, y + 22, CARD_W, 12).fill(BORDEAUX);

  // Logo + nom de l'association
  drawLogo(doc, x + 12, y + 6, 22);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12.5).text('ARINA', x + 42, y + 10, { width: 130, lineBreak: false });
  doc.save();
  doc.fillOpacity(0.78);
  doc.fillColor('#FFFFFF').font('Helvetica').fontSize(6.5).text('Réinsertion & Insertion', x + 42, y + 22, { width: 130, lineBreak: false });
  doc.restore();

  // ── Photo (ou initiales) ──
  const photoBox = { px: x + 14, py: y + 46, size: 62 };
  const photo = parsePhoto(user.photo);
  const drawInitialsFallback = () => {
    const initials = fullName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
    doc.save();
    doc.roundedRect(photoBox.px, photoBox.py, photoBox.size, photoBox.size, 8).fill(BORDEAUX);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20).text(
      initials, photoBox.px, photoBox.py + 17, { width: photoBox.size, align: 'center' }
    );
    doc.restore();
  };
  if (photo) {
    try {
      doc.save();
      doc.roundedRect(photoBox.px, photoBox.py, photoBox.size, photoBox.size, 8).fill(LIGHT);
      doc.image(photo.buffer, photoBox.px + 3, photoBox.py + 3, {
        fit: [photoBox.size - 6, photoBox.size - 6],
      });
      doc.restore();
    } catch {
      // Image illisible : initiales plutôt qu'un logo hors sujet
      drawInitialsFallback();
    }
  } else {
    drawInitialsFallback();
  }

  // ── Identité : nom (majuscules) + prénom + rôle ──
  const tx = photoBox.px + photoBox.size + 12;
  const tw = x + CARD_W - 16 - tx;
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10.5)
    .text(String(user.lastName || '').toUpperCase(), tx, y + 48, { width: tw, lineBreak: false });
  doc.fillColor(GRAY).font('Helvetica').fontSize(8.5)
    .text(String(user.firstName || ''), tx, y + 63, { width: tw, lineBreak: false });
  // Rôle (pastille terracotta)
  doc.save();
  const roleW = doc.widthOfString(role, { font: 'Helvetica-Bold', size: 6.5 }) + 12;
  doc.roundedRect(tx, y + 78, roleW, 14, 7).fill(TERRACOTTA);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(6.5).text(role, tx + 6, y + 83.5, { width: roleW - 12, lineBreak: false });
  doc.restore();

  // ── QR code (bas-droite) + référence ──
  const qrSize = 58;
  const qrX = x + CARD_W - 14 - qrSize;
  const qrY = y + 46;
  try {
    doc.save();
    doc.roundedRect(qrX - 4, qrY - 4, qrSize + 8, qrSize + 8, 6).fill('#FFFFFF');
    doc.image(Buffer.from(user.qrBase64, 'base64'), qrX, qrY, { width: qrSize, height: qrSize });
    doc.restore();
  } catch {
    // QR absent/illisible : mention écrite de la référence
    doc.fillColor(BORDEAUX).font('Helvetica-Bold').fontSize(7).text('BADGE', qrX, qrY + 8, { width: qrSize, align: 'center' });
  }
  const badgeId = user.badgeId || `ARINA-${String(user.id || '').padStart(4, '0')}`;
  doc.fillColor(BORDEAUX).font('Helvetica-Bold').fontSize(6.5).text(badgeId, qrX, qrY + qrSize + 4, { width: qrSize, align: 'center', lineBreak: false });

  // ── Ligne or + pied de carte ──
  doc.moveTo(x + 14, y + CARD_H - 24).lineTo(x + CARD_W - 14, y + CARD_H - 24).lineWidth(0.9).strokeColor(GOLD).stroke();
  doc.fillColor(GRAY).font('Helvetica').fontSize(5.8).text(
    `Bénéficiaire ARINA · ${badgeId} · Carte à présenter à l'entrée des événements`,
    x + 14, y + CARD_H - 17, { width: CARD_W - 28, lineBreak: false }
  );
}

/* 2) PDF d'UN badge : page A4 avec la carte centrée (imprimable sur papier normal) */
async function generateBadgePDF(user) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 }, bufferPages: true });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const qr = user.qrBase64 || await generateQRCode(user.id, user.badgeId, `${user.firstName || ''} ${user.lastName || ''}`.trim());
  drawCard(doc, { ...user, qrBase64: qr }, (doc.page.width - CARD_W) / 2, (doc.page.height - CARD_H) / 2 - 20);

  doc.end();
  return done;
}

/* 3) PDF de plusieurs badges : format carte de crédit, 4 par page A4 (2×2) */
async function exportMultipleBadges(users) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 }, bufferPages: true, autoFirstPage: false });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const gapX = 32;
  const gapY = 44;

  const addPage = () => {
    doc.addPage({ size: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    const W = doc.page.width;
    const H = doc.page.height;
    return { sx: (W - 2 * CARD_W - gapX) / 2, sy: (H - 2 * CARD_H - gapY) / 2, W, H };
  };

  let layout = addPage();
  let index = 0;
  for (const u of users) {
    const qr = u.qrBase64 || await generateQRCode(u.id, u.badgeId, `${u.firstName || ''} ${u.lastName || ''}`.trim());
    const col = index % 2;
    const row = Math.floor(index / 2) % 2;
    if (index > 0 && index % 4 === 0) layout = addPage();
    drawCard(doc, { ...u, qrBase64: qr }, layout.sx + col * (CARD_W + gapX), layout.sy + row * (CARD_H + gapY));
    index++;
  }

  doc.end();
  return done;
}

module.exports = { generateQRCode, generateBadgePDF, exportMultipleBadges };
