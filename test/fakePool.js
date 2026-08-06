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
    beneficiaries: opts.beneficiaries || [],
    events: opts.events || [],
    attendances: opts.attendances || [],
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

    // Bénéficiaires
    if (/INSERT INTO beneficiaries/i.test(s)) {
      const row = {
        id: state.beneficiaries.length + 1,
        first_name: params[0], last_name: params[1], age: params[2], status: params[3],
        entry_date: params[4], training: params[5], photo_url: params[6], dossier: params[7],
        badge_id: null, created_at: new Date().toISOString(),
      };
      state.beneficiaries.push(row);
      return { rows: [row] };
    }
    if (/SELECT \* FROM beneficiaries ORDER BY id DESC/i.test(s)) return { rows: [...state.beneficiaries] };
    if (/SELECT \* FROM beneficiaries WHERE badge_id/i.test(s)) {
      const b = state.beneficiaries.find((x) => x.badge_id === params[0]);
      return { rows: b ? [{ ...b }] : [] };
    }
    if (/SELECT \* FROM beneficiaries WHERE id = ANY/i.test(s)) {
      const ids = (params[0] || []).map(Number);
      return { rows: state.beneficiaries.filter((x) => ids.includes(x.id)).map((x) => ({ ...x })) };
    }
    if (/SELECT \* FROM beneficiaries WHERE id/i.test(s)) {
      const b = state.beneficiaries.find((x) => x.id === Number(params[0]));
      return { rows: b ? [{ ...b }] : [] };
    }
    if (/UPDATE beneficiaries SET badge_id/i.test(s)) {
      const b = state.beneficiaries.find((x) => x.id === Number(params[1]));
      if (!b) return { rows: [] };
      b.badge_id = params[0];
      return { rows: [{ ...b }] };
    }
    // Bénéficiaires ACTIFS uniquement (encart « Présence du jour ») — AVANT le SELECT générique.
    // Regex PRÉCIS (pas /WHERE status/ générique) : les requêtes COUNT(*) de /api/stats
    // contiennent aussi « FROM beneficiaries WHERE status » et ne doivent pas être captées.
    if (/SELECT id, first_name, last_name FROM beneficiaries WHERE status/i.test(s)) {
      return { rows: state.beneficiaries.filter((b) => b.status === params[0]).map((b) => ({ ...b })) };
    }
    if (/SELECT \* FROM beneficiaries/i.test(s)) return { rows: [...state.beneficiaries] };

    // Événements (badge_events) — DELETE AVANT le SELECT générique (même préfixe SQL)
    // « Présence du jour » : session quotidienne unique (ON CONFLICT sur daily_key)
    if (/INSERT INTO badge_events .*daily_key/i.test(s)) {
      const existing = state.events.find((x) => x.daily_key === params[3]);
      if (existing) return { rows: [] }; // ON CONFLICT DO NOTHING
      const row = {
        // id = max+1 (comme un SERIAL Postgres : jamais réutilisé après suppression)
        id: state.events.reduce((m, e) => Math.max(m, Number(e.id) || 0), 0) + 1, name: params[0], description: null,
        event_date: params[1], location: null, is_daily: true, daily_key: params[3],
        created_at: new Date().toISOString(),
      };
      state.events.push(row);
      state.inserts.push({ table: 'badge_events', row });
      return { rows: [row] };
    }
    if (/SELECT .*FROM badge_events WHERE daily_key/i.test(s)) {
      const e = state.events.find((x) => x.daily_key === params[0]);
      return { rows: e ? [{ ...e }] : [] };
    }
    // Tendance 7 jours : sessions quotidiennes comprises dans une plage de dates
    if (/FROM badge_events WHERE is_daily/i.test(s)) {
      const [from, to] = [String(params[0]), String(params[1])];
      return { rows: state.events.filter((e) => e.is_daily && String(e.daily_key) >= from && String(e.daily_key) <= to).map((e) => ({ ...e })) };
    }
    if (/INSERT INTO badge_events/i.test(s)) {
      const row = {
        // id = max+1 (comme un SERIAL Postgres : jamais réutilisé après suppression)
        id: state.events.reduce((m, e) => Math.max(m, Number(e.id) || 0), 0) + 1, name: params[0], description: params[1],
        event_date: params[2], location: params[3], created_at: new Date().toISOString(),
      };
      state.events.push(row);
      state.inserts.push({ table: 'badge_events', row });
      return { rows: [row] };
    }
    if (/DELETE FROM badge_events/i.test(s)) {
      const idx = state.events.findIndex((x) => x.id === Number(params[0]));
      if (idx === -1) return { rows: [] };
      const [removed] = state.events.splice(idx, 1);
      return { rows: [removed] };
    }
    // SELECT par id AVANT le générique (sinon rows[0] = premier événement du tableau)
    if (/FROM badge_events WHERE id =/i.test(s)) {
      const e = state.events.find((x) => x.id === Number(params[0]));
      return { rows: e ? [{ ...e }] : [] };
    }
    if (/FROM badge_events/i.test(s)) return { rows: [...state.events] };

    // Présences (attendances) — join avec les bénéficiaires d'abord
    if (/FROM attendances a JOIN beneficiaries b/i.test(s)) {
      const rows = state.attendances
        .filter((a) => a.event_id === Number(params[0]))
        .map((a) => {
          const b = state.beneficiaries.find((x) => x.id === a.beneficiary_id) || {};
          return {
            id: a.id, type: a.type, scanned_at: a.scanned_at,
            beneficiary_id: a.beneficiary_id, first_name: b.first_name, last_name: b.last_name,
            photo_url: b.photo_url, status: b.status,
          };
        });
      return { rows };
    }
    // Tendance 7 jours : scans des sessions quotidiennes de la plage (join badge_events)
    if (/FROM attendances a JOIN badge_events/i.test(s)) {
      const [from, to] = [String(params[0]), String(params[1])];
      const ids = new Set(state.events.filter((e) => e.is_daily && String(e.daily_key) >= from && String(e.daily_key) <= to).map((e) => e.id));
      return { rows: state.attendances.filter((a) => ids.has(a.event_id)).map((a) => ({ event_id: a.event_id, beneficiary_id: a.beneficiary_id, type: a.type, scanned_at: a.scanned_at })) };
    }
    if (/SELECT id, type, scanned_at FROM attendances WHERE/i.test(s)) {
      const found = state.attendances
        .filter((a) => a.beneficiary_id === Number(params[0]) && a.event_id === Number(params[1]))
        .sort((x, y) => x.id - y.id);
      return { rows: found.length ? [{ ...found[found.length - 1] }] : [] };
    }
    if (/INSERT INTO attendances/i.test(s)) {
      const row = {
        id: state.attendances.length + 1,
        beneficiary_id: params[0], event_id: params[1], type: params[2],
        scanned_at: new Date().toISOString(), created_at: new Date().toISOString(),
      };
      state.attendances.push(row);
      state.inserts.push({ table: 'attendances', row });
      return { rows: [row] };
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
    if (/DELETE FROM news/i.test(s)) {
      const idx = state.news.findIndex((x) => x.id === Number(params[0]));
      if (idx === -1) return { rows: [] };
      const [removed] = state.news.splice(idx, 1);
      return { rows: [removed] };
    }
    if (/FROM news/i.test(s)) return { rows: [...state.news] };
    if (/UPDATE news SET views/i.test(s)) {
      // Compteur de vues : [id]
      const n = state.news.find((x) => x.id === Number(params[0]));
      if (!n) return { rows: [] };
      n.views = (n.views || 0) + 1;
      return { rows: [{ views: n.views }] };
    }
    if (/INSERT INTO news/i.test(s)) {
      // Params : [title, excerpt, category, image_url, status, content, featured]
      const row = {
        id: state.news.length + 1,
        title: params[0], excerpt: params[1], category: params[2],
        image_url: params[3], status: params[4] || 'published',
        content: params[5], featured: !!params[6], views: 0,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      state.news.push(row);
      return { rows: [row] };
    }
    if (/UPDATE news SET/i.test(s)) {
      // Params : [title, excerpt, category, image_url, status, content, featured, id]
      const n = state.news.find((x) => x.id === Number(params[7]));
      if (!n) return { rows: [] };
      n.title = params[0]; n.excerpt = params[1]; n.category = params[2]; n.image_url = params[3];
      if (params[4] != null) n.status = params[4];
      if (params[5] != null) n.content = params[5];
      if (params[6] != null) n.featured = !!params[6];
      n.updated_at = new Date().toISOString();
      return { rows: [n] };
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
