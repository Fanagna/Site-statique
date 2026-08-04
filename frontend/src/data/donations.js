/* ── Moyens de paiement des dons ──
   Modifiez uniquement les valeurs dans `details` :
   - Orange Money : le numéro officiel de l'association
   - Crypto : remplacez les adresses vides par vos vraies adresses (BTC / USDT)
   - Virement : remplacez les valeurs vides par votre IBAN, BIC, banque…
   Un champ vide s'affiche « Coordonnées à venir » sur le site. */

export const paymentMethods = [
  {
    id: 'orange',
    name: 'Orange Money',
    badge: 'Mobile Money',
    icon: 'smartphone',
    description:
      "Envoyez votre don directement depuis votre téléphone avec Orange Money, disponible partout à Madagascar.",
    steps: [
      "Ouvrez l'application Orange Money ou composez le #144#",
      "Choisissez « Envoyer de l'argent »",
      "Saisissez le numéro ci-dessous puis le montant de votre don",
      "Validez avec votre code secret — vous recevez une confirmation par SMS",
    ],
    details: [{ label: 'Numéro Orange Money', value: '032 77 374 89' }],
  },
  {
    id: 'crypto',
    name: 'Cryptomonnaie',
    badge: 'BTC · USDT',
    icon: 'bitcoin',
    description:
      'Soutenez ARINA en Bitcoin (BTC) ou en USDT (réseau TRC20). Don international sans frais.',
    steps: [
      'Ouvrez votre portefeuille crypto (Binance, Trust Wallet, Bybit…)',
      'Choisissez « Envoyer » et scannez ou copiez l’adresse ci-dessous',
      "Indiquez le montant de votre don et le réseau indiqué",
      "Envoyez — votre don est crédité en quelques minutes",
    ],
    details: [
      { label: 'Bitcoin (BTC)', value: '' },
      { label: 'USDT (TRC20)', value: '' },
    ],
  },
  {
    id: 'virement',
    name: 'Virement bancaire',
    badge: 'Banque',
    icon: 'landmark',
    description:
      'Virement national ou international vers le compte bancaire de l’association ARINA.',
    steps: [
      'Connectez-vous à votre application bancaire ou à votre agence',
      'Créez un virement vers le compte ci-dessous',
      'Indiquez « Don ARINA + votre nom » en libellé',
      "Envoyez-nous un email avec votre preuve de virement pour recevoir votre reçu",
    ],
    details: [
      { label: 'Titulaire du compte', value: 'Association ARINA' },
      { label: 'IBAN', value: '' },
      { label: 'BIC / SWIFT', value: '' },
      { label: 'Banque', value: '' },
    ],
  },
];
