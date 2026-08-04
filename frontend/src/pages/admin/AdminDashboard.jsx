import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  fetchBeneficiaries, createBeneficiary, updateBeneficiary, deleteBeneficiary,
  fetchFinances, createFinance, deleteFinance,
  fetchNews,
  fetchContacts, deleteContact,
  fetchNewsletterSubscribers, deleteNewsletterSubscriber,
  fetchActivity,
} from '../../services/api';
import { allNews } from '../../data/news';
import { CheckCircle2, Hand } from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { Icon } from '../../components/admin/icons';
import {
  formatMGA, today, fmtDate, timeAgo, initials, inputClass, CountUp, EmptyState, Th,
} from '../../components/admin/ui';

/* ═══════════════════════════════════════
   Helpers
   ═══════════════════════════════════════ */
const monthKey = (d) => {
  if (!d) return '';
  const [y, m] = String(d).split('-').map(Number);
  return y && m ? `${y}-${String(m).padStart(2, '0')}` : '';
};
const pctDelta = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0);

/* ═══════════════════════════════════════
   Charts (real data)
   ═══════════════════════════════════════ */
function MonthlyChart({ finances, loading }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const data = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('fr-FR', { month: 'short' }),
        revenus: 0,
        depenses: 0,
      });
    }
    (finances || []).forEach((f) => {
      const m = months.find((x) => x.key === monthKey(f.date));
      if (!m) return;
      if (f.type === 'Revenu') m.revenus += Number(f.montant) || 0;
      else m.depenses += Number(f.montant) || 0;
    });
    return months;
  }, [finances]);

  const max = useMemo(() => Math.max(...data.map((m) => Math.max(m.revenus, m.depenses)), 1), [data]);

  if (loading) return <div className="h-56 skeleton" />;
  if (!data.some((m) => m.revenus > 0 || m.depenses > 0)) {
    return (
      <EmptyState
        icon="wallet"
        text="Aucune transaction enregistrée — vos flux financiers mensuels apparaîtront ici."
      />
    );
  }
  return (
    <div className="h-56 flex items-end gap-3 px-1">
      {data.map((m) => (
        <div key={m.key} className="flex-1 flex flex-col items-center gap-2 h-full group">
          <div className="flex-1 w-full flex items-end justify-center gap-1.5">
            <div
              title={`Revenus : ${formatMGA(m.revenus)}`}
              className="w-full max-w-[26px] rounded-t-lg bg-gradient-to-t from-arina-blue to-arina-blue-light transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-85"
              style={{ height: mounted ? `${Math.max((m.revenus / max) * 100, 2)}%` : '0%' }}
            />
            <div
              title={`Dépenses : ${formatMGA(m.depenses)}`}
              className="w-full max-w-[26px] rounded-t-lg bg-[#C7C7CC] transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-85"
              style={{ height: mounted ? `${Math.max((m.depenses / max) * 100, 2)}%` : '0%' }}
            />
          </div>
          <span className="text-[10px] text-ios-text3 capitalize">{m.label}</span>
        </div>
      ))}
    </div>
  );
}

function CategoryDonut({ finances, loading }) {
  const colors = ['#E8590C', '#F59F00', '#B45309', '#FFA94D', '#FFC078', '#9CA3AF'];
  const data = useMemo(() => {
    const map = {};
    (finances || [])
      .filter((f) => f.type === 'Dépense')
      .forEach((f) => {
        const v = Math.max(0, Number(f.montant) || 0);
        if (v <= 0) return;
        const k = f.categorie || 'Autre';
        map[k] = (map[k] || 0) + v;
      });
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    if (entries.length > 6) {
      const top = entries.slice(0, 5);
      const rest = entries.slice(5).reduce((s, [, v]) => s + v, 0);
      top.push(['Autres', rest]);
      return top;
    }
    return entries;
  }, [finances]);

  const total = data.reduce((s, [, v]) => s + v, 0);
  const R = 42;
  const C = 2 * Math.PI * R;

  if (loading) return <div className="h-56 skeleton" />;
  if (total === 0) {
    return <EmptyState icon="trendDown" text="Aucune dépense enregistrée — la répartition par catégorie apparaîtra ici." />;
  }

  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-5 mt-5">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-ios-hairline)" strokeWidth="11" />
          {data.map(([label, value], i) => {
            const frac = value / total;
            const dash = frac * C;
            const offset = -acc * C;
            acc += frac;
            return (
              <circle
                key={label}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="11"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={offset}
                className="transition-all duration-700"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold tabular">{formatMGA(total)}</span>
          <span className="text-[10px] text-ios-text3">total</span>
        </div>
      </div>
      <div className="w-full space-y-2">
        {data.map(([label, value], i) => (
          <div key={label} className="flex items-center gap-2.5 text-sm">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[i % colors.length] }} />
            <span className="text-ios-text2 truncate">{label}</span>
            <span className="ml-auto font-semibold tabular">{formatMGA(value)}</span>
            <span className="text-xs text-ios-text3 w-10 text-right tabular">{Math.round((value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Main dashboard
   ═══════════════════════════════════════ */
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'dashboard';
  const setTab = (key) => setSearchParams(key === 'dashboard' ? {} : { tab: key }, { replace: true });
  const [apiStatus, setApiStatus] = useState('checking');

  /* ── Data ── */
  const [benefs, setBenefs] = useState([]);
  const [finances, setFinances] = useState([]);
  const [news, setNews] = useState(allNews);
  const [contacts, setContacts] = useState([]);
  const [subs, setSubs] = useState([]);
  const [activity, setActivity] = useState([]);
  const [benefsLoading, setBenefsLoading] = useState(true);
  const [financesLoading, setFinancesLoading] = useState(true);

  /* ── UI state ── */
  const [query, setQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [expandedMsg, setExpandedMsg] = useState(null);

  /* ── Benef CRUD ── */
  const [showBenefForm, setShowBenefForm] = useState(false);
  const [editingBenef, setEditingBenef] = useState(null);
  const [benefForm, setBenefForm] = useState({ prenom: '', nom: '', age: '', statut: 'Actif', dateEntree: today(), formation: '' });
  const [benefFilter, setBenefFilter] = useState('');
  const [benefSort, setBenefSort] = useState({ key: '', dir: 1 });

  /* ── Finance CRUD ── */
  const [showFinanceForm, setShowFinanceForm] = useState(false);
  const [financeForm, setFinanceForm] = useState({ type: 'Revenu', categorie: 'Don', montant: '', description: '', date: today() });
  const [finType, setFinType] = useState('');
  const [finCat, setFinCat] = useState('');
  const [finSort, setFinSort] = useState({ key: '', dir: 1 });

  /* ── Load ── */
  const loadData = useCallback(async () => {
    const bFromApi = await fetchBeneficiaries();
    if (bFromApi !== null) {
      setApiStatus('online');
      if (bFromApi.length) setBenefs(bFromApi);
      else setBenefs([]);
    } else {
      setApiStatus('offline');
      const s = localStorage.getItem('arina_benefs');
      setBenefs(s ? JSON.parse(s) : []);
    }
    setBenefsLoading(false);

    const fFromApi = await fetchFinances();
    if (fFromApi !== null) { if (fFromApi.length) setFinances(fFromApi); else setFinances([]); }
    else { const s = localStorage.getItem('arina_finances'); setFinances(s ? JSON.parse(s) : []); }
    setFinancesLoading(false);

    const nFromApi = await fetchNews();
    if (nFromApi !== null) { if (nFromApi.length) setNews(nFromApi); else setNews([]); }
    else setNews(allNews);

    const cFromApi = await fetchContacts();
    if (cFromApi !== null) { if (cFromApi.length) setContacts(cFromApi); else setContacts([]); }
    else { const s = localStorage.getItem('arina_contacts'); setContacts(s ? JSON.parse(s) : []); }

    const subFromApi = await fetchNewsletterSubscribers();
    if (subFromApi !== null) { if (subFromApi.length) setSubs(subFromApi); else setSubs([]); }
    else { const s = localStorage.getItem('arina_subs'); setSubs(s ? JSON.parse(s) : []); }

    const actFromApi = await fetchActivity();
    if (actFromApi?.length) setActivity(actFromApi);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (benefs.length) localStorage.setItem('arina_benefs', JSON.stringify(benefs)); }, [benefs]);
  useEffect(() => { if (finances.length) localStorage.setItem('arina_finances', JSON.stringify(finances)); }, [finances]);
  useEffect(() => { if (news !== allNews && news.length) localStorage.setItem('arina_news', JSON.stringify(news)); }, [news]);
  useEffect(() => { if (contacts.length) localStorage.setItem('arina_contacts', JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { if (subs.length) localStorage.setItem('arina_subs', JSON.stringify(subs)); }, [subs]);

  /* ── CRUD handlers ── */
  const openBenefForm = (b) => {
    if (b) { setEditingBenef(b); setBenefForm({ prenom: b.prenom, nom: b.nom, age: String(b.age), statut: b.statut, dateEntree: b.dateEntree, formation: b.formation }); }
    else { setEditingBenef(null); setBenefForm({ prenom: '', nom: '', age: '', statut: 'Actif', dateEntree: today(), formation: '' }); }
    setShowBenefForm(true);
  };
  const saveBenef = async () => {
    const d = { ...benefForm, age: Number(benefForm.age) || 0 };
    if (editingBenef) { const u = await updateBeneficiary(editingBenef.id, d); setBenefs(benefs.map((b) => (b.id === editingBenef.id ? u || { ...b, ...d } : b))); }
    else { const c = await createBeneficiary(d); setBenefs([c || { id: Date.now(), ...d }, ...benefs]); }
    setShowBenefForm(false);
  };
  const removeBenef = async (id) => { if (!confirm('Supprimer ce bénéficiaire ?')) return; await deleteBeneficiary(id); setBenefs(benefs.filter((b) => b.id !== id)); };

  const saveFinance = async () => {
    const d = { ...financeForm, montant: Number(financeForm.montant) || 0 };
    const c = await createFinance(d);
    setFinances([c || { id: Date.now(), ...d }, ...finances]);
    setShowFinanceForm(false);
    setFinanceForm({ type: 'Revenu', categorie: 'Don', montant: '', description: '', date: today() });
  };
  const removeFinance = async (id) => { if (!confirm('Supprimer cette transaction ?')) return; await deleteFinance(id); setFinances(finances.filter((f) => f.id !== id)); };

  const removeContact = async (id) => { if (!confirm('Supprimer ce message ?')) return; await deleteContact(id); setContacts(contacts.filter((c) => c.id !== id)); };
  const removeSub = async (id) => { if (!confirm("Supprimer cet abonné ?")) return; await deleteNewsletterSubscriber(id); setSubs(subs.filter((s) => s.id !== id)); };

  /* ── Computed ── */
  const totalRevenus = finances.filter((f) => f.type === 'Revenu').reduce((s, f) => s + f.montant, 0);
  const totalDepenses = finances.filter((f) => f.type === 'Dépense').reduce((s, f) => s + f.montant, 0);
  const solde = totalRevenus - totalDepenses;
  const nbActifs = benefs.filter((b) => b.statut === 'Actif').length;
  const nbDiplomes = benefs.filter((b) => b.statut === 'Diplômé').length;
  const nbInactifs = benefs.filter((b) => b.statut === 'Inactif').length;

  const nowKey = (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; })();
  const prevKey = (() => { const n = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; })();
  const byMonth = (arr, type, key) => arr.filter((f) => f.type === type && monthKey(f.date) === key).reduce((s, f) => s + f.montant, 0);
  const revThis = byMonth(finances, 'Revenu', nowKey);
  const revPrev = byMonth(finances, 'Revenu', prevKey);
  const depThis = byMonth(finances, 'Dépense', nowKey);
  const depPrev = byMonth(finances, 'Dépense', prevKey);
  const revDelta = pctDelta(revThis, revPrev);
  const depDelta = pctDelta(depThis, depPrev);

  /* Filtering + sorting */
  const q = query.trim().toLowerCase();
  const filteredBenefs = useMemo(() => {
    let arr = benefs.filter((b) => (benefFilter ? b.statut === benefFilter : true));
    if (q) arr = arr.filter((b) => `${b.prenom} ${b.nom} ${b.formation}`.toLowerCase().includes(q));
    return arr;
  }, [benefs, benefFilter, q]);
  const sortedBenefs = useMemo(() => {
    if (!benefSort.key) return filteredBenefs;
    return [...filteredBenefs].sort((a, b) => {
      const x = a[benefSort.key]; const y = b[benefSort.key];
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * benefSort.dir;
      return String(x ?? '').localeCompare(String(y ?? ''), 'fr') * benefSort.dir;
    });
  }, [filteredBenefs, benefSort]);

  const filteredFinances = useMemo(() => {
    let arr = finances.filter((f) => (finType ? f.type === finType : true) && (finCat ? f.categorie === finCat : true));
    if (q) arr = arr.filter((f) => `${f.categorie} ${f.description}`.toLowerCase().includes(q));
    return arr;
  }, [finances, finType, finCat, q]);
  const sortedFinances = useMemo(() => {
    if (!finSort.key) return filteredFinances;
    return [...filteredFinances].sort((a, b) => {
      const x = a[finSort.key]; const y = b[finSort.key];
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * finSort.dir;
      return String(x ?? '').localeCompare(String(y ?? ''), 'fr') * finSort.dir;
    });
  }, [filteredFinances, finSort]);

  const filteredContacts = useMemo(() => {
    if (!q) return contacts;
    return contacts.filter((c) => `${c.name} ${c.email} ${c.message}`.toLowerCase().includes(q));
  }, [contacts, q]);
  const filteredSubs = useMemo(() => {
    if (!q) return subs;
    return subs.filter((s) => s.email.toLowerCase().includes(q));
  }, [subs, q]);

  /* Activity feed (real from API, else derived from loaded data) */
  const localActivity = useMemo(() => [
    ...news.slice(0, 3).map((n) => ({ id: `ln${n.id}`, type: 'news', text: `Actualité publiée : « ${n.title} »`, date: n.date || n.created_at })),
    ...finances.slice(0, 3).map((f) => ({ id: `lf${f.id}`, type: f.type === 'Revenu' ? 'income' : 'expense', text: `${f.type} : ${formatMGA(f.montant)}`, date: f.date })),
    ...benefs.slice(0, 3).map((b) => ({ id: `lb${b.id}`, type: 'beneficiary', text: `Bénéficiaire ajouté : ${b.prenom} ${b.nom}`, date: b.dateEntree })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10), [news, finances, benefs]);
  const activityFeed = activity.length ? activity : localActivity;

  /* Real alerts -> notifications bell */
  const alerts = useMemo(() => {
    const a = [];
    if (solde < 0) a.push({ level: 'error', icon: 'trendDown', text: `Solde négatif : ${formatMGA(Math.abs(solde))}`, tab: 'finances' });
    else if (finances.length > 0 && totalDepenses > totalRevenus) a.push({ level: 'warn', icon: 'bell', text: 'Les dépenses dépassent les revenus', tab: 'finances' });
    if (finances.length === 0) a.push({ level: 'info', icon: 'wallet', text: 'Aucune transaction — ajoutez un premier revenu', tab: 'finances' });
    if (contacts.length > 0) a.push({ level: 'info', icon: 'mail', text: `${contacts.length} message${contacts.length > 1 ? 's' : ''} reçu${contacts.length > 1 ? 's' : ''} via le formulaire`, tab: 'messages' });
    if (news.length === 0) a.push({ level: 'info', icon: 'file', text: 'Aucune actualité publiée', to: '/admin/actualites' });
    return a;
  }, [solde, finances.length, totalDepenses, totalRevenus, contacts.length, news.length]);

  const dbEmpty = apiStatus === 'online' && benefs.length === 0 && finances.length === 0 && news.length === 0;

  /* Navigation config for the layout */
  const groups = [
    { group: 'Principal', items: [
      { key: 'dashboard', label: 'Tableau de bord', icon: 'grid' },
      { key: 'actualites', label: 'Actualités', icon: 'file', to: '/admin/actualites' },
      { key: 'enfants', label: 'Enfants', icon: 'users' },
      { key: 'finances', label: 'Finances', icon: 'wallet' },
    ] },
    { group: 'Communication', items: [
      { key: 'messages', label: 'Messages', icon: 'mail', badge: () => contacts.length },
      { key: 'newsletter', label: 'Newsletter', icon: 'send', badge: () => subs.length },
    ] },
  ];
  const meta = {
    dashboard: { title: 'Tableau de bord', subtitle: "Vue d'ensemble de votre structure" },
    enfants: { title: 'Enfants', subtitle: 'Bénéficiaires accompagnés par ARINA' },
    finances: { title: 'Finances', subtitle: 'Revenus, dépenses et trésorerie' },
    messages: { title: 'Messages', subtitle: 'Demandes reçues via le site' },
    newsletter: { title: 'Newsletter', subtitle: "Abonnés à votre lettre d'information" },
  };
  const currentMeta = meta[tab] || meta.dashboard;
  const searchPlaceholder = {
    dashboard: 'Rechercher…',
    enfants: 'Rechercher un enfant…',
    finances: 'Rechercher une transaction…',
    messages: 'Rechercher un message…',
    newsletter: 'Rechercher un e-mail…',
  }[tab] || 'Rechercher…';

  /* KPI cards */
  const kpis = [
    { icon: 'users', label: 'Enfants actifs', value: nbActifs, format: null, sub: `sur ${benefs.length} accompagnés · ${nbDiplomes} diplômés`, gradient: 'from-arina-blue to-arina-accent-dark', delta: null },
    { icon: 'trendUp', label: 'Revenus', value: totalRevenus, format: formatMGA, sub: `Ce mois : ${formatMGA(revThis)}`, gradient: 'from-emerald-500 to-teal-600', delta: revDelta },
    { icon: 'trendDown', label: 'Dépenses', value: totalDepenses, format: formatMGA, sub: `Ce mois : ${formatMGA(depThis)}`, gradient: 'from-rose-500 to-red-600', delta: depDelta },
    { icon: 'wallet', label: 'Solde', value: solde, format: formatMGA, sub: 'Revenus − dépenses', gradient: 'from-arina-gold to-arina-accent', delta: null },
  ];

  const quickActions = [
    { label: 'Nouvelle actu', icon: 'file', color: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/25', action: () => navigate('/admin/actualites?new=1') },
    { label: 'Nouvel enfant', icon: 'users', color: 'bg-arina-warm text-arina-blue hover:bg-[#FFEEDB] dark:hover:bg-white/10', action: () => { setTab('enfants'); setTimeout(() => openBenefForm(null), 120); } },
    { label: 'Nouveau revenu', icon: 'trendUp', color: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25', action: () => { setTab('finances'); setFinanceForm({ type: 'Revenu', categorie: 'Don', montant: '', description: '', date: today() }); setTimeout(() => setShowFinanceForm(true), 120); } },
    { label: 'Nouvelle dépense', icon: 'trendDown', color: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/25', action: () => { setTab('finances'); setFinanceForm({ type: 'Dépense', categorie: 'Alimentation', montant: '', description: '', date: today() }); setTimeout(() => setShowFinanceForm(true), 120); } },
    { label: 'Messages', icon: 'mail', color: 'bg-ios-fill text-ios-text hover:bg-ios-fill-2', action: () => setTab('messages') },
    { label: 'Newsletter', icon: 'send', color: 'bg-ios-fill text-ios-text hover:bg-ios-fill-2', action: () => setTab('newsletter') },
  ];

  const activityMeta = {
    news: { icon: 'file', cls: 'bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400' },
    income: { icon: 'trendUp', cls: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    expense: { icon: 'trendDown', cls: 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400' },
    beneficiary: { icon: 'users', cls: 'bg-arina-warm text-arina-blue' },
  };

  const actionBtn = 'px-4 py-2 rounded-xl text-sm font-semibold transition-all';
  const primaryBtn = `${actionBtn} bg-arina-blue text-white hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20`;

  return (
    <AdminLayout
      groups={groups}
      activeKey={tab}
      onNavigate={setTab}
      title={currentMeta.title}
      subtitle={currentMeta.subtitle}
      search={{ value: query, onChange: setQuery, placeholder: searchPlaceholder }}
      footerNav={[{ key: 'site', label: 'Voir le site', icon: 'globe', to: '/' }]}
      user={user}
      onLogout={logout}
      actions={
        <>
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full ${
              apiStatus === 'online' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : apiStatus === 'offline' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-ios-fill text-ios-text3'
            }`}
            title={apiStatus === 'online' ? 'Base de données connectée' : apiStatus === 'offline' ? 'Mode local — base non joignable' : 'Connexion en cours'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'online' ? 'bg-emerald-500' : apiStatus === 'offline' ? 'bg-amber-500 animate-pulse-dot' : 'bg-gray-400 animate-pulse'}`} />
            {apiStatus === 'online' ? 'Base connectée' : apiStatus === 'offline' ? 'Mode local' : 'Connexion…'}
          </span>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className={`relative p-2 rounded-full transition-colors ${notifOpen ? 'bg-ios-fill-2' : 'hover:bg-ios-fill-2'}`}
              title="Notifications"
            >
              <Icon name="bell" className="w-5 h-5" />
              {alerts.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-arina-blue ring-2 ring-white" />
              )}
            </button>
            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 top-12 z-50 w-[320px] card-apple animate-pop overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-ios-hairline flex items-center justify-between">
                    <span className="font-bold text-sm">Notifications</span>
                    <span className="text-[10px] font-semibold text-ios-text3">{alerts.length} alerte{alerts.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto scroll-slim">
                    {alerts.length === 0 && (
                      <p className="px-5 py-10 text-center text-sm text-ios-text3">Tout est sous contrôle <CheckCircle2 className="w-4 h-4 inline-block text-emerald-500" /></p>
                    )}
                    {alerts.map((a, i) => (
                      <button
                        key={i}
                        onClick={() => { if (a.to) navigate(a.to); else if (a.tab) setTab(a.tab); setNotifOpen(false); }}
                        className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-ios-fill transition-colors border-b border-ios-hairline last:border-0"
                      >
                        <span className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          a.level === 'error' ? 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400' : a.level === 'warn' ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-arina-warm text-arina-blue'
                        }`}>
                          <Icon name={a.icon} className="w-4 h-4" />
                        </span>
                        <span>
                          <span className="block text-[13px] font-medium text-ios-text leading-snug">{a.text}</span>
                          <span className="block text-[11px] text-ios-text3 mt-1">Cliquer pour ouvrir</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      }
    >
      {/* Mobile search */}
      {tab !== 'dashboard' && (
        <div className="relative md:hidden mb-4">
          <Icon name="search" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-text3 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-ios-card border border-ios-hairline text-sm placeholder:text-ios-text3 focus:outline-none focus:ring-2 focus:ring-arina-blue/30"
          />
        </div>
      )}

      {/* ═══════════ DASHBOARD ═══════════ */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {apiStatus === 'offline' && (
            <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2.5 animate-fade-up">
              <Icon name="activity" className="w-4 h-4 flex-shrink-0" />
              <span>Mode local — les données proviennent de ce navigateur. Déployez sur Vercel pour lire votre base PostgreSQL.</span>
            </div>
          )}
          {dbEmpty && (
            <div className="rounded-2xl border border-arina-blue/20 bg-arina-warm/60 px-4 py-3 text-sm text-arina-blue flex items-center gap-2.5 animate-fade-up">
              <Icon name="plus" className="w-4 h-4 flex-shrink-0" />
              <span>Base connectée mais vide — utilisez les actions rapides pour ajouter vos premiers enfants, transactions et actualités.</span>
            </div>
          )}

          <div className="animate-fade-up">
            <h2 className="text-2xl lg:text-[28px] font-bold tracking-tight flex items-center gap-2">Bonjour, {user?.username} <Hand className="w-6 h-6 text-arina-gold" /></h2>
            <p className="text-ios-text3 text-sm mt-1">
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — Voici l'état de votre structure aujourd'hui.
            </p>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((s, i) => (
              <div key={s.label} className="card-apple card-apple-hover p-5 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-start justify-between">
                  <div className={`w-11 h-11 rounded-[14px] bg-gradient-to-br ${s.gradient} text-white flex items-center justify-center shadow-sm`}>
                    <Icon name={s.icon} className="w-5 h-5" />
                  </div>
                  {s.delta !== null && (
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${s.delta >= 0 ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                      <Icon name={s.delta >= 0 ? 'trendUp' : 'trendDown'} className="w-3.5 h-3.5" />
                      {Math.abs(s.delta)}%
                    </span>
                  )}
                </div>
                <div className="mt-4">
                  <div className="text-xs font-medium text-ios-text3">{s.label}</div>
                  <div className="text-[22px] lg:text-[26px] font-bold tracking-tight tabular mt-0.5">
                    <CountUp value={s.value} format={s.format} />
                  </div>
                  <div className="text-xs text-ios-text3 mt-1 truncate">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card-apple p-6 animate-fade-up" style={{ animationDelay: '180ms' }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="font-bold">Flux financiers</h3>
                  <p className="text-xs text-ios-text3 mt-0.5">Revenus vs dépenses — 6 derniers mois</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-ios-text3">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-arina-blue" /> Revenus</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#C7C7CC]" /> Dépenses</span>
                </div>
              </div>
              <MonthlyChart finances={finances} loading={financesLoading} />
            </div>

            <div className="card-apple p-6 animate-fade-up" style={{ animationDelay: '240ms' }}>
              <h3 className="font-bold">Dépenses par catégorie</h3>
              <p className="text-xs text-ios-text3 mt-0.5">Répartition réelle des sorties</p>
              <CategoryDonut finances={finances} loading={financesLoading} />
            </div>
          </div>

          {/* Enfants répartition + Activité */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="card-apple p-6 animate-fade-up" style={{ animationDelay: '300ms' }}>
              <h3 className="font-bold">Enfants accompagnés</h3>
              <p className="text-xs text-ios-text3 mt-0.5">Répartition par statut</p>
              <div className="mt-6">
                <div className="flex h-3.5 rounded-full overflow-hidden bg-ios-fill">
                  <div className="bg-green-500 transition-all duration-700" style={{ width: `${benefs.length ? (nbActifs / benefs.length) * 100 : 0}%` }} />
                  <div className="bg-purple-500 transition-all duration-700" style={{ width: `${benefs.length ? (nbDiplomes / benefs.length) * 100 : 0}%` }} />
                  <div className="bg-red-400 transition-all duration-700" style={{ width: `${benefs.length ? (nbInactifs / benefs.length) * 100 : 0}%` }} />
                </div>
                <div className="mt-5 space-y-3">
                  {[
                    { label: 'Actifs', value: nbActifs, dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
                    { label: 'Diplômés', value: nbDiplomes, dot: 'bg-purple-500', text: 'text-purple-600 dark:text-purple-400' },
                    { label: 'Inactifs', value: nbInactifs, dot: 'bg-red-400', text: 'text-red-500 dark:text-red-400' },
                  ].map((r) => (
                    <div key={r.label} className="flex items-center gap-3 text-sm">
                      <span className={`w-2.5 h-2.5 rounded-full ${r.dot}`} />
                      <span className="text-ios-text2">{r.label}</span>
                      <span className={`ml-auto font-bold tabular ${r.text}`}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 card-apple p-6 animate-fade-up" style={{ animationDelay: '360ms' }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold">Activité récente</h3>
                  <p className="text-xs text-ios-text3 mt-0.5">Dernières actions dans votre base</p>
                </div>
                <button onClick={() => navigate('/admin/actualites')} className="text-xs font-semibold text-arina-blue hover:underline">Tout voir</button>
              </div>
              <div className="space-y-1">
                {activityFeed.length === 0 && (
                  <EmptyState icon="activity" text="Aucune activité pour le moment — vos actions apparaîtront ici." />
                )}
                {activityFeed.slice(0, 6).map((a, i) => {
                  const metaIcon = activityMeta[a.type] || activityMeta.news;
                  return (
                    <div key={a.id || i} className="flex items-center gap-3.5 p-2.5 rounded-xl hover:bg-ios-fill transition-colors">
                      <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${metaIcon.cls}`}>
                        <Icon name={metaIcon.icon} className="w-4 h-4" />
                      </span>
                      <span className="text-sm text-ios-text flex-1 min-w-0 truncate">{a.text}</span>
                      <span className="text-[11px] text-ios-text3 whitespace-nowrap flex-shrink-0">{timeAgo(a.date)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="card-apple p-6 animate-fade-up" style={{ animationDelay: '420ms' }}>
            <div>
              <h3 className="font-bold">Actions rapides</h3>
              <p className="text-xs text-ios-text3 mt-0.5">Raccourcis vers les tâches fréquentes</p>
            </div>
            <div className="flex flex-wrap gap-2.5 mt-4">
              {quickActions.map((q) => (
                <button key={q.label} onClick={q.action} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 ${q.color}`}>
                  <Icon name={q.icon} className="w-4 h-4" /> {q.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ ENFANTS ═══════════ */}
      {tab === 'enfants' && (
        <div className="space-y-4 animate-fade-up">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: '', value: benefs.length, color: 'text-ios-text', onClick: () => setBenefFilter('') },
              { label: 'Actif', value: nbActifs, color: 'text-green-600 dark:text-green-400', onClick: () => setBenefFilter('Actif') },
              { label: 'Diplômé', value: nbDiplomes, color: 'text-purple-600 dark:text-purple-400', onClick: () => setBenefFilter('Diplômé') },
              { label: 'Inactif', value: nbInactifs, color: 'text-red-500 dark:text-red-400', onClick: () => setBenefFilter('Inactif') },
            ].map((s, i) => (
              <button key={i} onClick={s.onClick} className={`card-apple card-apple-hover p-4 text-left ${benefFilter === s.label ? 'ring-2 ring-arina-blue/50' : ''}`}>
                <div className={`text-2xl font-extrabold tabular ${s.color}`}>{benefsLoading ? '—' : s.value}</div>
                <div className="text-xs text-ios-text3 mt-0.5">{i === 0 ? 'Total enfants' : s.label + 's'}</div>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={benefFilter} onChange={(e) => setBenefFilter(e.target.value)} className="px-3.5 py-2.5 bg-ios-card border border-ios-hairline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/30">
              <option value="">Tous les statuts</option>
              <option value="Actif">Actif</option>
              <option value="Diplômé">Diplômé</option>
              <option value="Inactif">Inactif</option>
            </select>
            <button onClick={() => openBenefForm(null)} className={`${primaryBtn} ml-auto inline-flex items-center gap-1.5`}>
              <Icon name="plus" className="w-4 h-4" /> Ajouter
            </button>
          </div>
          <div className="card-apple overflow-hidden">
            {benefsLoading ? (
              <div className="p-6 space-y-4"><div className="skeleton h-10" /><div className="skeleton h-10" /><div className="skeleton h-10" /></div>
            ) : sortedBenefs.length === 0 ? (
              <EmptyState icon="users" text="Aucun enfant trouvé. Ajoutez votre premier bénéficiaire !" action={<button onClick={() => openBenefForm(null)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-arina-blue text-white text-sm font-semibold"><Icon name="plus" className="w-4 h-4" /> Ajouter un enfant</button>} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ios-fill">
                    <tr>
                      <Th label="Élève" k="nom" sort={benefSort} onSort={(k) => setBenefSort({ key: k, dir: benefSort.key === k ? -benefSort.dir : 1 })} />
                      <Th label="Âge" k="age" sort={benefSort} onSort={(k) => setBenefSort({ key: k, dir: benefSort.key === k ? -benefSort.dir : 1 })} />
                      <Th label="Statut" k="statut" sort={benefSort} onSort={(k) => setBenefSort({ key: k, dir: benefSort.key === k ? -benefSort.dir : 1 })} />
                      <Th label="Formation" k="formation" sort={benefSort} onSort={(k) => setBenefSort({ key: k, dir: benefSort.key === k ? -benefSort.dir : 1 })} />
                      <Th label="Entrée" k="dateEntree" sort={benefSort} onSort={(k) => setBenefSort({ key: k, dir: benefSort.key === k ? -benefSort.dir : 1 })} />
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ios-hairline">
                    {sortedBenefs.map((b) => (
                      <tr key={b.id} className="hover:bg-ios-fill transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-arina-blue/70 to-arina-blue-dark text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {initials(`${b.prenom} ${b.nom}`)}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-ios-text truncate">{b.prenom} {b.nom}</div>
                              <div className="text-[11px] text-ios-text3 font-mono">AR-{String(b.id).padStart(3, '0')}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 tabular text-ios-text2">{b.age} ans</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${b.statut === 'Actif' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : b.statut === 'Diplômé' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400'}`}>{b.statut}</span>
                        </td>
                        <td className="px-4 py-3 text-ios-text2">{b.formation || '—'}</td>
                        <td className="px-4 py-3 text-xs text-ios-text3 whitespace-nowrap">{fmtDate(b.dateEntree)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <Link to={`/admin/beneficiaire/${b.id}`} className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors" title="Fiche détaillée"><Icon name="eye" className="w-4 h-4" /></Link>
                            <button onClick={() => openBenefForm(b)} className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors" title="Modifier"><Icon name="edit" className="w-4 h-4" /></button>
                            <button onClick={() => removeBenef(b.id)} className="p-2 rounded-lg text-ios-text3 hover:text-red-600 hover:bg-red-500/10 transition-colors" title="Supprimer"><Icon name="trash" className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ FINANCES ═══════════ */}
      {tab === 'finances' && (
        <div className="space-y-4 animate-fade-up">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Revenus', value: totalRevenus, c: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Dépenses', value: totalDepenses, c: 'text-red-500 dark:text-red-400' },
              { label: 'Solde', value: solde, c: solde >= 0 ? 'text-arina-blue' : 'text-red-600 dark:text-red-400' },
            ].map((s, i) => (
              <div key={i} className="card-apple p-5">
                <div className={`text-xl lg:text-2xl font-extrabold tabular ${s.c}`}>{financesLoading ? '—' : formatMGA(s.value)}</div>
                <div className="text-xs text-ios-text3 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={finType} onChange={(e) => setFinType(e.target.value)} className="px-3.5 py-2.5 bg-ios-card border border-ios-hairline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/30">
              <option value="">Tous les types</option>
              <option value="Revenu">Revenu</option>
              <option value="Dépense">Dépense</option>
            </select>
            <select value={finCat} onChange={(e) => setFinCat(e.target.value)} className="px-3.5 py-2.5 bg-ios-card border border-ios-hairline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/30">
              <option value="">Toutes catégories</option>
              {['Don', 'Subvention', 'Alimentation', 'Équipement', 'Salaire', 'Autre'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => setShowFinanceForm(true)} className={`${primaryBtn} ml-auto inline-flex items-center gap-1.5`}>
              <Icon name="plus" className="w-4 h-4" /> Ajouter
            </button>
          </div>
          <div className="card-apple overflow-hidden">
            {financesLoading ? (
              <div className="p-6 space-y-4"><div className="skeleton h-10" /><div className="skeleton h-10" /><div className="skeleton h-10" /></div>
            ) : sortedFinances.length === 0 ? (
              <EmptyState icon="wallet" text="Aucune transaction trouvée. Enregistrez votre premier mouvement !" action={<button onClick={() => setShowFinanceForm(true)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-arina-blue text-white text-sm font-semibold"><Icon name="plus" className="w-4 h-4" /> Ajouter une transaction</button>} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ios-fill">
                    <tr>
                      <Th label="Type" k="type" sort={finSort} onSort={(k) => setFinSort({ key: k, dir: finSort.key === k ? -finSort.dir : 1 })} />
                      <Th label="Catégorie" k="categorie" sort={finSort} onSort={(k) => setFinSort({ key: k, dir: finSort.key === k ? -finSort.dir : 1 })} />
                      <Th label="Montant" k="montant" sort={finSort} onSort={(k) => setFinSort({ key: k, dir: finSort.key === k ? -finSort.dir : 1 })} />
                      <Th label="Description" />
                      <Th label="Date" k="date" sort={finSort} onSort={(k) => setFinSort({ key: k, dir: finSort.key === k ? -finSort.dir : 1 })} />
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ios-hairline">
                    {sortedFinances.map((f) => (
                      <tr key={f.id} className="hover:bg-ios-fill transition-colors">
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${f.type === 'Revenu' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400'}`}>{f.type}</span>
                        </td>
                        <td className="px-4 py-3 text-ios-text">{f.categorie || 'Autre'}</td>
                        <td className={`px-4 py-3 font-semibold tabular ${f.type === 'Revenu' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {f.type === 'Revenu' ? '+' : '−'} {formatMGA(f.montant)}
                        </td>
                        <td className="px-4 py-3 text-ios-text2 max-w-[240px] truncate">{f.description || '—'}</td>
                        <td className="px-4 py-3 text-xs text-ios-text3 whitespace-nowrap">{fmtDate(f.date)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <button onClick={() => removeFinance(f.id)} className="p-2 rounded-lg text-ios-text3 hover:text-red-600 hover:bg-red-500/10 transition-colors" title="Supprimer"><Icon name="trash" className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ MESSAGES ═══════════ */}
      {tab === 'messages' && (
        <div className="space-y-4 animate-fade-up">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'Messages reçus', value: contacts.length },
              { label: 'Cette semaine', value: contacts.filter((c) => c.created_at && Date.now() - new Date(c.created_at) < 7 * 864e5).length },
              { label: 'Dernier message', value: contacts[0] ? timeAgo(contacts[0].created_at) : '—' },
            ].map((s, i) => (
              <div key={i} className="card-apple p-5">
                <div className="text-2xl font-extrabold tabular">{s.value}</div>
                <div className="text-xs text-ios-text3 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="card-apple overflow-hidden">
            {filteredContacts.length === 0 ? (
              <EmptyState icon="mail" text={contacts.length === 0 ? 'Aucun message reçu — les demandes du formulaire de contact apparaîtront ici.' : 'Aucun message ne correspond à votre recherche.'} />
            ) : (
              <div className="divide-y divide-ios-hairline">
                {filteredContacts.map((c) => (
                  <div key={c.id} className="p-5 hover:bg-ios-fill transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-arina-blue/80 to-arina-blue-dark text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {initials(c.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-semibold text-sm truncate">{c.name}</span>
                            <a href={`mailto:${c.email}`} className="text-xs text-ios-text3 hover:text-arina-blue truncate">{c.email}</a>
                          </div>
                          <span className="text-[11px] text-ios-text3 whitespace-nowrap">{timeAgo(c.created_at)}</span>
                        </div>
                        <p className={`text-sm text-ios-text2 mt-2 leading-relaxed ${expandedMsg === c.id ? '' : 'line-clamp-2'}`}>{c.message}</p>
                        <div className="mt-2.5 flex items-center gap-4">
                          <button onClick={() => setExpandedMsg(expandedMsg === c.id ? null : c.id)} className="text-xs font-semibold text-arina-blue hover:underline">
                            {expandedMsg === c.id ? 'Réduire' : 'Lire la suite'}
                          </button>
                          <button onClick={() => removeContact(c.id)} className="text-xs font-semibold text-red-500 hover:underline">Supprimer</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ NEWSLETTER ═══════════ */}
      {tab === 'newsletter' && (
        <div className="space-y-4 animate-fade-up">
          <div className="grid grid-cols-2 gap-3 max-w-xl">
            <div className="card-apple p-5">
              <div className="text-2xl font-extrabold tabular">{subs.length}</div>
              <div className="text-xs text-ios-text3 mt-0.5">Abonnés inscrits</div>
            </div>
            <div className="card-apple p-5">
              <div className="text-2xl font-extrabold tabular">{subs.filter((s) => s.subscribed_at && Date.now() - new Date(s.subscribed_at) < 7 * 864e5).length}</div>
              <div className="text-xs text-ios-text3 mt-0.5">Cette semaine</div>
            </div>
          </div>
          <div className="card-apple overflow-hidden">
            {filteredSubs.length === 0 ? (
              <EmptyState icon="send" text={subs.length === 0 ? 'Aucun abonné pour le moment — les inscriptions à la newsletter apparaîtront ici.' : 'Aucun abonné ne correspond à votre recherche.'} />
            ) : (
              <div className="divide-y divide-ios-hairline">
                {filteredSubs.map((s) => (
                  <div key={s.id} className="flex items-center gap-4 px-5 py-4 hover:bg-ios-fill transition-colors">
                    <div className="w-9 h-9 rounded-full bg-arina-warm text-arina-blue flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {initials(s.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{s.email}</div>
                      <div className="text-[11px] text-ios-text3">Inscrit {timeAgo(s.subscribed_at)}</div>
                    </div>
                    <button onClick={() => removeSub(s.id)} className="p-2 rounded-lg text-ios-text3 hover:text-red-600 hover:bg-red-500/10 transition-colors" title="Supprimer"><Icon name="trash" className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════ MODALS ═══════ */}
      {showBenefForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowBenefForm(false)} />
          <div className="relative w-full max-w-md bg-ios-card rounded-3xl shadow-2xl animate-pop overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-ios-hairline flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-arina-warm text-arina-blue flex items-center justify-center"><Icon name="users" className="w-5 h-5" /></div>
              <div>
                <h3 className="font-bold">{editingBenef ? 'Modifier' : 'Ajouter'} un bénéficiaire</h3>
                <p className="text-xs text-ios-text3">Fiche confidentielle</p>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <input placeholder="Prénom" value={benefForm.prenom} onChange={(e) => setBenefForm({ ...benefForm, prenom: e.target.value })} className={inputClass} />
              <input placeholder="Nom" value={benefForm.nom} onChange={(e) => setBenefForm({ ...benefForm, nom: e.target.value })} className={inputClass} />
              <input type="number" placeholder="Âge" value={benefForm.age} onChange={(e) => setBenefForm({ ...benefForm, age: e.target.value })} className={inputClass} />
              <select value={benefForm.statut} onChange={(e) => setBenefForm({ ...benefForm, statut: e.target.value })} className={inputClass}>
                <option value="Actif">Actif</option>
                <option value="Diplômé">Diplômé</option>
                <option value="Inactif">Inactif</option>
              </select>
              <input placeholder="Formation" value={benefForm.formation} onChange={(e) => setBenefForm({ ...benefForm, formation: e.target.value })} className={inputClass} />
              <input type="date" value={benefForm.dateEntree} onChange={(e) => setBenefForm({ ...benefForm, dateEntree: e.target.value })} className={inputClass} />
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowBenefForm(false)} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Annuler</button>
              <button onClick={saveBenef} className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {showFinanceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowFinanceForm(false)} />
          <div className="relative w-full max-w-md bg-ios-card rounded-3xl shadow-2xl animate-pop overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-ios-hairline flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><Icon name="wallet" className="w-5 h-5" /></div>
              <div>
                <h3 className="font-bold">Ajouter une transaction</h3>
                <p className="text-xs text-ios-text3">Revenu ou dépense</p>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <select value={financeForm.type} onChange={(e) => setFinanceForm({ ...financeForm, type: e.target.value })} className={inputClass}>
                <option value="Revenu">Revenu</option>
                <option value="Dépense">Dépense</option>
              </select>
              <select value={financeForm.categorie} onChange={(e) => setFinanceForm({ ...financeForm, categorie: e.target.value })} className={inputClass}>
                <option value="Don">Don</option>
                <option value="Subvention">Subvention</option>
                <option value="Alimentation">Alimentation</option>
                <option value="Équipement">Équipement</option>
                <option value="Salaire">Salaire</option>
                <option value="Autre">Autre</option>
              </select>
              <input type="number" placeholder="Montant (Ar)" value={financeForm.montant} onChange={(e) => setFinanceForm({ ...financeForm, montant: e.target.value })} className={inputClass} />
              <input placeholder="Description" value={financeForm.description} onChange={(e) => setFinanceForm({ ...financeForm, description: e.target.value })} className={inputClass} />
              <input type="date" value={financeForm.date} onChange={(e) => setFinanceForm({ ...financeForm, date: e.target.value })} className={inputClass} />
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowFinanceForm(false)} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Annuler</button>
              <button onClick={saveFinance} className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
