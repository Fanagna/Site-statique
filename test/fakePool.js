// ── Pool PostgreSQL FACTICE pour les tests API (node:test) ──
// Simule les réponses de pg selon la requête SQL reçue : permet de tester les
// routes (validation, calculs, authentification, rate limiting) SANS base réelle.
function makeFakePool(opts = {}) {
  const state = {
    users: opts.users || [],
    donations: opts.donations || [],
    contacts: opts.contacts || [],
    volunteers: opts.volunteers || [],
    testimonials: opts.testimonials || [],
    news: opts.news || [],
    donors: opts.donors || [],
    financeRows: [],
    inserts: [],
  };

  const query = async (sql, params = []) => {
    const s = String(sql).replace(/\s+/g, ' ').trim();

    if (/^(CREATE|ALTER) TABLE/i.test(s)) return { rows: [] };
    // AVANT le générique `SELECT 1` (santé) : vérifier l'existence d'un revenu lié à un don
    if (/SELECT 1 FROM finances WHERE donation_id/i.test(s)) {
      const found = state.financeRows.some((f) => f.donation_id === Number(params[0]));
      return { rows: found ? [{ '?column?': 1 }] : [] };
    }
    if (/^SELECT 1/.test(s)) return { rows: [{ '?column?': 1 }] };
    if (/SELECT COUNT\(\*\) AS n FROM users/i.test(s)) return { rows: [{ n: state.users.length }] };

    // Comptes (password_hash stocké comme en Postgres réel)
    if (/INSERT INTO users/i.test(s)) {
      const row = { id: state.users.length + 1, username: params[0], password_hash: params[1], role: params[2], api_key: params[3] };
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
      // Copie (snapshot) : comme en PostgreSQL réel, la ligne lue avant un UPDATE
      // ne doit pas être mutée par la suite (sinon old.status refléterait déjà le
      // nouveau statut et le retrait de revenu ne se déclencherait jamais).
      const d = state.donations.find((x) => x.id === Number(params[0]));
      return { rows: d ? [{ ...d }] : [] };
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
    if (/SELECT .*FROM contacts/i.test(s)) return { rows: [...state.contacts] };
    if (/DELETE FROM contacts/i.test(s)) {
      const idx = state.contacts.findIndex((x) => x.id === Number(params[0]));
      if (idx === -1) return { rows: [] };
      const [removed] = state.contacts.splice(idx, 1);
      return { rows: [removed] };
    }

    // Candidatures bénévoles (contrôle d'accès : président + éducateur)
    if (/SELECT .*FROM volunteers/i.test(s)) return { rows: [...state.volunteers] };
    if (/DELETE FROM volunteers/i.test(s)) {
      const idx = state.volunteers.findIndex((x) => x.id === Number(params[0]));
      if (idx === -1) return { rows: [] };
      const [removed] = state.volunteers.splice(idx, 1);
      return { rows: [removed] };
    }

    // Témoignages (modération : président + éducateur)
    if (/SELECT .*FROM testimonials/i.test(s)) return { rows: [...state.testimonials] };
    if (/UPDATE testimonials SET status/i.test(s)) {
      const t = state.testimonials.find((x) => x.id === Number(params[1]));
      if (!t) return { rows: [] };
      t.status = params[0];
      return { rows: [{ id: t.id, status: t.status }] };
    }
    if (/DELETE FROM testimonials/i.test(s)) {
      const idx = state.testimonials.findIndex((x) => x.id === Number(params[0]));
      if (idx === -1) return { rows: [] };
      const [removed] = state.testimonials.splice(idx, 1);
      return { rows: [removed] };
    }

    // Finances — revenu automatique lié à un don confirmé (donation_id)
    if (/INSERT INTO finances .*donation_id/i.test(s)) {
      const row = {
        id: state.financeRows.length + 1,
        type: 'income', category: 'Don', amount: params[0],
        description: params[1], date: new Date().toISOString().split('T')[0],
        donor: params[2], donation_id: params[3],
        created_at: new Date().toISOString(),
      };
      state.financeRows.push(row);
      state.inserts.push({ table: 'finances', row });
      return { rows: [row] };
    }
    if (/DELETE FROM finances WHERE donation_id/i.test(s)) {
      const before = state.financeRows.length;
      state.financeRows = state.financeRows.filter((f) => f.donation_id !== Number(params[0]));
      return { rows: [], rowCount: before - state.financeRows.length };
    }
    if (/SELECT \* FROM finances/i.test(s)) return { rows: [...state.financeRows] };

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
    // Donateurs (GET requireAuth — données de l'évaluation mensuelle)
    if (/SELECT \* FROM donors/i.test(s)) return { rows: [...state.donors] };

    // Actualités (GET public — test du contrôle d'accès)
    if (/FROM news/i.test(s)) return { rows: [...state.news] };

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
