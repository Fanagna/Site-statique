// ── Pool PostgreSQL FACTICE pour les tests API (node:test) ──
// Simule les réponses de pg selon la requête SQL reçue : permet de tester les
// routes (validation, calculs, authentification, rate limiting) SANS base réelle.
function makeFakePool(opts = {}) {
  const state = {
    users: opts.users || [],
    donations: opts.donations || [],
    contacts: [],
    financeRows: [],
    inserts: [],
  };

  const query = async (sql, params = []) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();

    if (/^(CREATE|ALTER) TABLE/i.test(s)) return { rows: [] };
    if (/^SELECT 1/.test(s)) return { rows: [{ '?column?': 1 }] };
    if (/SELECT COUNT\(\*\) AS n FROM users/i.test(s)) return { rows: [{ n: state.users.length }] };

    // Comptes
    if (/INSERT INTO users/i.test(s)) {
      const row = { id: state.users.length + 1, username: params[0], role: params[2], api_key: params[3] };
      state.users.push(row);
      return { rows: [row] };
    }
    if (/FROM users WHERE api_key/i.test(s)) {
      const u = state.users.find((x) => x.api_key === params[0]);
      return { rows: u ? [u] : [] };
    }
    if (/FROM users WHERE username/i.test(s)) {
      const u = state.users.find((x) => x.username === params[0]);
      return { rows: u ? [u] : [] };
    }

    // Dons
    if (/INSERT INTO donations/i.test(s)) {
      const row = {
        id: state.donations.length + 1,
        amount: params[0], currency: params[1], name: params[2], email: params[3],
        message: params[4], method: params[5], anonymous: params[6],
        status: 'pledge', received_at: null, created_at: new Date().toISOString(),
      };
      state.donations.push(row);
      state.inserts.push({ table: 'donations', row });
      return { rows: [row] };
    }
    if (/UPDATE donations SET status/i.test(s)) {
      // Params : [status, received_at, receipt_number, id]
      const d = state.donations.find((x) => x.id === Number(params[3]));
      if (!d) return { rows: [] };
      d.status = params[0];
      d.received_at = params[1];
      if (params[2]) d.receipt_number = params[2];
      return { rows: [d] };
    }
    if (/UPDATE donations SET receipt_sent_at/i.test(s)) {
      const d = state.donations.find((x) => x.id === Number(params[1]));
      if (!d) return { rows: [] };
      d.receipt_sent_at = params[0];
      return { rows: [d] };
    }
    if (/SELECT \* FROM donations WHERE id/i.test(s)) {
      const d = state.donations.find((x) => x.id === Number(params[0]));
      return { rows: d ? [d] : [] };
    }
    if (/DELETE FROM donations/i.test(s)) {
      const idx = state.donations.findIndex((x) => x.id === Number(params[0]));
      if (idx === -1) return { rows: [] };
      const [removed] = state.donations.splice(idx, 1);
      return { rows: [removed] };
    }
    if (/SELECT \* FROM donations/i.test(s)) return { rows: [...state.donations] };

    // Contacts (nom, email, sujet, message)
    if (/INSERT INTO contacts/i.test(s)) {
      const row = { id: state.contacts.length + 1, name: params[0], email: params[1], subject: params[2], message: params[3], created_at: new Date().toISOString() };
      state.contacts.push(row);
      return { rows: [row] };
    }

    // Finances (test du calcul automatique MNT = QT × PU)
    if (/INSERT INTO finances/i.test(s)) {
      const row = {
        id: state.financeRows.length + 1,
        type: params[0], category: params[1], amount: params[2],
        description: params[3], date: params[4], quantity: params[5], unit_price: params[6], donor: params[7],
        created_at: new Date().toISOString(),
      };
      state.financeRows.push(row);
      return { rows: [row] };
    }
    if (/id, name, need, budget FROM donors/i.test(s)) return { rows: [] }; // pas de budget → pas d'alerte

    // Stats (valeurs factices)
    if (/COUNT\(\*\) AS n FROM beneficiaries/i.test(s)) {
      return { rows: [{ n: s.includes("'active'") ? 5 : 3 }] };
    }
    if (/COUNT\(\*\) AS n FROM donors/i.test(s)) return { rows: [{ n: 3 }] };
    if (/SELECT COALESCE\(SUM\(amount\)/i.test(s)) return { rows: [{ total: 12000000 }] };

    throw new Error('FakePool : requête non simulée : ' + s);
  };

  return {
    state,
    query,
    connect: async () => ({ query, release: () => {} }),
  };
}

module.exports = { makeFakePool };
