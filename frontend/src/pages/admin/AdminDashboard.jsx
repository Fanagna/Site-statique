import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Toast, { useToast } from '../../components/admin/Toast';
import {
  fetchBeneficiaries, createBeneficiary, updateBeneficiary, deleteBeneficiary,
  fetchFinances, createFinance, deleteFinance,
  fetchNews,
  fetchContacts, deleteContact,
  fetchNewsletterSubscribers, deleteNewsletterSubscriber,
  fetchVolunteers, deleteVolunteer, getVolunteerAttachment,
  fetchActivity,
  fetchUsers, createUser, deleteUser, resetUserPassword,
} from '../../services/api';

// Rôles & onglets autorisés (source unique : ./roles)
import { ROLES, ROLE_LABELS, ROLE_TABS } from './roles';
import { allNews } from '../../data/news';
import { CheckCircle2, Hand, Printer } from 'lucide-react';
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
  const colors = ['#E0574F', '#F59F00', '#B14A54', '#FFA18E', '#FFD0B3', '#9CA3AF'];
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
  const role = user?.role || ROLES.admin;
  const allowedTabs = ROLE_TABS[role] || ROLE_TABS.unknown;
  const rawTab = searchParams.get('tab') || 'dashboard';
  const tab = allowedTabs.includes(rawTab) ? rawTab : 'dashboard';
  const setTab = (key) => setSearchParams(key === 'dashboard' ? {} : { tab: key }, { replace: true });
  const [apiStatus, setApiStatus] = useState('checking');

  /* ── Data ── */
  const [benefs, setBenefs] = useState([]);
  const [finances, setFinances] = useState([]);
  const [news, setNews] = useState(allNews);
  const [contacts, setContacts] = useState([]);
  const [subs, setSubs] = useState([]);
  const [volunteers, setVolunteers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [users, setUsers] = useState([]);
  const [benefsLoading, setBenefsLoading] = useState(true);
  const [financesLoading, setFinancesLoading] = useState(true);

  /* ── UI state ── */
  const [query, setQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [expandedMsg, setExpandedMsg] = useState(null);
  const [expandedVol, setExpandedVol] = useState(null);
  const { toast, showToast, closeToast } = useToast();

  /* ── Benef CRUD ── */
  const [showBenefForm, setShowBenefForm] = useState(false);
  const [editingBenef, setEditingBenef] = useState(null);
  const benefFormInit = {
    prenom: '', nom: '', age: '', statut: 'Actif', dateEntree: today(), formation: '', photo: '',
    dossier: {
      identite: { pseudo: '', dateNaissance: '', lieuNaissance: '', adresse: '', contact: '', situationScolaire: '', loisirs: '' },
      familiale: {
        pereNom: '', pereProfession: '', pereContact: '', pereAdresse: '',
        mereNom: '', mereProfession: '', mereContact: '', mereAdresse: '',
        tuteurNom: '', tuteurContact: '', tuteurAdresse: '',
        nbFreresSoeurs: '', situationParents: '', niveauVie: '',
      },
      juridique: { motifInculpation: '', dateEcrou: '', dureeDetention: '', dateLiberation: '', motifLiberation: '' },
      etude: { classeActuelle: '', etablissement: '', carriereEnvisagee: '', diplomeObtenu: '', specialites: '' },
      arina: { dateEntreeCentre: '', felicitations: '' },
    },
  };
  const [benefForm, setBenefForm] = useState(benefFormInit);
  const [benefFilter, setBenefFilter] = useState('');
  const [benefSort, setBenefSort] = useState({ key: '', dir: 1 });

  /* ── Finance CRUD ── */
  const [showFinanceForm, setShowFinanceForm] = useState(false);
  const [financeForm, setFinanceForm] = useState({ type: 'Revenu', categorie: 'Don', montant: '', description: '', date: today() });
  const [finType, setFinType] = useState('');
  const [finCat, setFinCat] = useState('');
  const [finSort, setFinSort] = useState({ key: '', dir: 1 });

  /* ── Load (uniquement les données du rôle) ── */
  const loadData = useCallback(async () => {
    const can = (t) => allowedTabs.includes(t);
    let anyOk = false;
    let anyFail = false;

    // L'aperçu du tableau de bord (KPI + graphiques) est visible par tous les rôles :
    // bénéficiaires et finances sont donc chargés pour tout le monde (lecture seule —
    // la gestion de chaque domaine reste réservée au rôle concerné).
    const bFromApi = await fetchBeneficiaries();
    if (bFromApi !== null) { anyOk = true; if (bFromApi.length) setBenefs(bFromApi); else setBenefs([]); }
    else { anyFail = true; const s = localStorage.getItem('arina_benefs'); setBenefs(s ? JSON.parse(s) : []); }
    setBenefsLoading(false);

    const fFromApi = await fetchFinances();
    if (fFromApi !== null) { anyOk = true; if (fFromApi.length) setFinances(fFromApi); else setFinances([]); }
    else { anyFail = true; const s = localStorage.getItem('arina_finances'); setFinances(s ? JSON.parse(s) : []); }
    setFinancesLoading(false);

    if (can('actualites')) {
      const nFromApi = await fetchNews();
      if (nFromApi !== null) { anyOk = true; if (nFromApi.length) setNews(nFromApi); else setNews([]); }
      else { anyFail = true; setNews(allNews); }
    }

    if (can('messages')) {
      const cFromApi = await fetchContacts();
      if (cFromApi !== null) { anyOk = true; if (cFromApi.length) setContacts(cFromApi); else setContacts([]); }
      else { anyFail = true; const s = localStorage.getItem('arina_contacts'); setContacts(s ? JSON.parse(s) : []); }
    }

    if (can('newsletter')) {
      const subFromApi = await fetchNewsletterSubscribers();
      if (subFromApi !== null) { anyOk = true; if (subFromApi.length) setSubs(subFromApi); else setSubs([]); }
      else { anyFail = true; const s = localStorage.getItem('arina_subs'); setSubs(s ? JSON.parse(s) : []); }
    }

    if (can('volunteers')) {
      const vFromApi = await fetchVolunteers();
      if (vFromApi !== null) { anyOk = true; if (vFromApi.length) setVolunteers(vFromApi); else setVolunteers([]); }
      else { anyFail = true; const s = localStorage.getItem('arina_volunteers'); setVolunteers(s ? JSON.parse(s) : []); }
    }

    if (can('comptes')) {
      const uFromApi = await fetchUsers();
      if (uFromApi !== null && Array.isArray(uFromApi)) { anyOk = true; setUsers(uFromApi); }
      else anyFail = true;
    }

    // L'activité est réservée à l'admin (requireRole() côté API) : pour les autres
    // rôles, le fil local (construit à partir des données autorisées) prend le relais.
    const actFromApi = await fetchActivity();
    if (actFromApi?.length) setActivity(actFromApi);

    // Statut de la base : « en ligne » dès qu'une requête autorisée aboutit,
    // « hors ligne » seulement si toutes ont échoué, « en ligne » par défaut si
    // aucun fetch autorisé n'a été tenté (rôle restreint) — plus de badge bloqué.
    if (anyOk || !anyFail) setApiStatus('online');
    else setApiStatus('offline');
  }, [allowedTabs]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (benefs.length) localStorage.setItem('arina_benefs', JSON.stringify(benefs)); }, [benefs]);
  useEffect(() => { if (finances.length) localStorage.setItem('arina_finances', JSON.stringify(finances)); }, [finances]);
  useEffect(() => { if (news !== allNews && news.length) localStorage.setItem('arina_news', JSON.stringify(news)); }, [news]);
  useEffect(() => { if (contacts.length) localStorage.setItem('arina_contacts', JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { if (subs.length) localStorage.setItem('arina_subs', JSON.stringify(subs)); }, [subs]);

  /* ── CRUD handlers ── */
  /* Met à jour un champ du dossier (section.module) */
  const setDoss = (section, field) => (e) => {
    const v = e.target ? e.target.value : e;
    setBenefForm((prev) => ({
      ...prev,
      dossier: { ...prev.dossier, [section]: { ...(prev.dossier[section] || {}), [field]: v } },
    }));
  };

  /* Upload photo (base64) avec aperçu */
  const onBenefPhoto = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(f.type)) { alert('Format non accepté — utilisez JPG, PNG, WebP ou GIF.'); return; }
    if (f.size > 3 * 1024 * 1024) { alert('Photo trop volumineuse (maximum 3 Mo).'); return; }
    const reader = new FileReader();
    reader.onload = () => setBenefForm((prev) => ({ ...prev, photo: String(reader.result) }));
    reader.readAsDataURL(f);
  };

  const openBenefForm = (b) => {
    if (b) {
      setEditingBenef(b);
      setBenefForm({
        prenom: b.prenom, nom: b.nom, age: String(b.age), statut: b.statut, dateEntree: b.dateEntree || today(), formation: b.formation || '', photo: b.photo || '',
        dossier: {
          identite: { ...benefFormInit.dossier.identite, ...(b.dossier?.identite || {}) },
          familiale: { ...benefFormInit.dossier.familiale, ...(b.dossier?.familiale || {}) },
          juridique: { ...benefFormInit.dossier.juridique, ...(b.dossier?.juridique || {}) },
          etude: { ...benefFormInit.dossier.etude, ...(b.dossier?.etude || {}) },
          arina: { ...benefFormInit.dossier.arina, ...(b.dossier?.arina || {}) },
        },
      });
    } else {
      setEditingBenef(null);
      setBenefForm({ ...benefFormInit, dateEntree: today() });
    }
    setShowBenefForm(true);
  };
  const saveBenef = async () => {
    // Âge calculé depuis la date de naissance si renseignée
    let age = Number(benefForm.age) || 0;
    const dob = benefForm.dossier.identite.dateNaissance;
    if (!age && dob) {
      const d = new Date(dob);
      if (!Number.isNaN(d.getTime())) {
        const diff = Date.now() - d.getTime();
        age = Math.floor(diff / (365.25 * 24 * 3600000));
      }
    }
    const d = { ...benefForm, age };
    // Sauvegarde STRICTE : le dossier ne compte comme enregistré que s'il a
    // réellement atteint la base de données. Sinon, erreur claire + formulaire
    // laissé ouvert (les données ne sont pas perdues) — jamais d'enregistrement fantôme.
    const r = editingBenef ? await updateBeneficiary(editingBenef.id, d) : await createBeneficiary(d);
    if (!r.ok) {
      showToast(`❌ ${editingBenef ? 'Modification' : 'Ajout'} NON enregistré dans la base : ${r.error}`, 'error');
      return;
    }
    if (editingBenef) {
      setBenefs(benefs.map((b) => (b.id === editingBenef.id ? r.data : b)));
      showToast(`✅ Dossier de ${r.data.prenom} ${r.data.nom} modifié et enregistré dans la base`);
    } else {
      setBenefs([r.data, ...benefs]);
      showToast(`✅ Dossier de ${r.data.prenom} ${r.data.nom} créé et enregistré dans la base`);
    }
    setShowBenefForm(false);
    setBenefForm({ ...benefFormInit, dateEntree: today() });
  };
  const removeBenef = async (id) => {
    if (!confirm('Supprimer ce bénéficiaire ?')) return;
    const r = await deleteBeneficiary(id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    setBenefs(benefs.filter((b) => b.id !== id));
    showToast('✅ Bénéficiaire supprimé de la base de données');
  };

  const saveFinance = async () => {
    const d = { ...financeForm, montant: Number(financeForm.montant) || 0 };
    const r = await createFinance(d);
    if (!r.ok) {
      showToast(`❌ Transaction NON enregistrée dans la base : ${r.error}`, 'error');
      return;
    }
    setFinances([r.data, ...finances]);
    showToast(`✅ ${r.data.type} enregistré${r.data.type === 'Dépense' ? 'e' : ''} dans la base : ${formatMGA(r.data.montant)}`);
    setShowFinanceForm(false);
    setFinanceForm({ type: 'Revenu', categorie: 'Don', montant: '', description: '', date: today() });
  };
  const removeFinance = async (id) => {
    if (!confirm('Supprimer cette transaction ?')) return;
    const r = await deleteFinance(id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    setFinances(finances.filter((f) => f.id !== id));
    showToast('✅ Transaction supprimée de la base de données');
  };

  const removeContact = async (id) => {
    if (!confirm('Supprimer ce message ?')) return;
    const r = await deleteContact(id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    setContacts(contacts.filter((c) => c.id !== id));
    showToast('✅ Message supprimé de la base de données');
  };
  const removeSub = async (id) => {
    if (!confirm('Supprimer cet abonné ?')) return;
    const r = await deleteNewsletterSubscriber(id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    setSubs(subs.filter((s) => s.id !== id));
    showToast('✅ Abonné supprimé de la base de données');
  };
  const removeVolunteer = async (id) => {
    if (!confirm('Supprimer cette candidature ?')) return;
    const r = await deleteVolunteer(id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    setVolunteers(volunteers.filter((v) => v.id !== id));
    showToast('✅ Candidature supprimée de la base de données');
  };

  /* ── Comptes (admin) ── */
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: 'educator' });
  const [userMsg, setUserMsg] = useState(null);
  const saveUser = async () => {
    setUserMsg(null);
    if (!userForm.username.trim() || !userForm.password) { setUserMsg({ ok: false, text: 'Nom d\'utilisateur et mot de passe requis.' }); return; }
    if (userForm.password.length < 4) { setUserMsg({ ok: false, text: 'Le mot de passe doit contenir au moins 4 caractères.' }); return; }
    const c = await createUser({ username: userForm.username.trim(), password: userForm.password, role: userForm.role });
    if (!c || c.error) { setUserMsg({ ok: false, text: c?.error || 'Impossible de créer le compte.' }); return; }
    setUsers([...users, c]);
    setUserForm({ username: '', password: '', role: 'educator' });
    setShowUserForm(false);
    setUserMsg({ ok: true, text: `Compte « ${c.username} » créé.` });
  };
  const removeUser = async (u) => {
    if (!confirm(`Supprimer le compte « ${u.username} » ?`)) return;
    const r = await deleteUser(u.id);
    if (r && r.deleted) { setUsers(users.filter((x) => x.id !== u.id)); setUserMsg({ ok: true, text: 'Compte supprimé.' }); }
    else setUserMsg({ ok: false, text: r?.error || 'Impossible de supprimer ce compte.' });
  };
  const resetPass = async (u) => {
    const p = prompt(`Nouveau mot de passe pour « ${u.username} » :`);
    if (!p) return;
    if (p.length < 4) { setUserMsg({ ok: false, text: 'Mot de passe trop court (min. 4 caractères).' }); return; }
    const r = await resetUserPassword(u.id, p);
    if (r && r.success) setUserMsg({ ok: true, text: `Mot de passe de « ${u.username} » réinitialisé.` });
    else setUserMsg({ ok: false, text: r?.error || 'Échec de la réinitialisation.' });
  };
  // Résout une pièce jointe : URL Blob (nouvelle) ou base64 récupérée à la demande (legacy)
  const resolveAttachment = async (v, kind = 'file') => {
    const url = kind === 'cv' ? v.cv_url : v.file_url;
    const name = kind === 'cv' ? v.cv_name : v.file_name;
    const type = kind === 'cv' ? v.cv_type : v.file_type;
    if (url) return { url, name, type };
    const legacy = await getVolunteerAttachment(v.id, kind);
    if (!legacy?.data) return null;
    return { url: `data:${legacy.type || 'application/octet-stream'};base64,${legacy.data}`, name: legacy.name, type: legacy.type };
  };
  const openAttachment = async (v, kind = 'file') => {
    const a = await resolveAttachment(v, kind);
    if (!a) return;
    const downloadName = a.name || (kind === 'cv' ? 'cv' : 'lettre-de-motivation');
    let href = a.url;
    if (!a.url.startsWith('data:')) {
      // URL Blob : on récupère le contenu pour forcer le bon nom de fichier
      try {
        const res = await fetch(a.url);
        const blob = await res.blob();
        href = URL.createObjectURL(blob);
        setTimeout(() => URL.revokeObjectURL(href), 4000);
      } catch {
        window.open(a.url, '_blank');
        return;
      }
    }
    const el = document.createElement('a');
    el.href = href;
    el.download = downloadName;
    document.body.appendChild(el);
    el.click();
    el.remove();
  };
  const previewAttachment = async (v, kind = 'file') => {
    const a = await resolveAttachment(v, kind);
    if (!a) return;
    window.open(a.url, '_blank');
  };

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
  const filteredVolunteers = useMemo(() => {
    if (!q) return volunteers;
    return volunteers.filter((v) => `${v.name} ${v.email} ${v.skills} ${v.motivation}`.toLowerCase().includes(q));
  }, [volunteers, q]);

  /* Activity feed (real from API, else derived from loaded data) */
  /* Fil d'activité local : l'aperçu (finances + enfants) est visible par tous ;
     actualités/candidatures/messages seulement pour les rôles qui les gèrent
     (évite aussi d'afficher les actualités de démonstration aux autres rôles). */
  const localActivity = useMemo(() => [
    ...(allowedTabs.includes('actualites') ? news.slice(0, 3).map((n) => ({ id: `ln${n.id}`, type: 'news', text: `Actualité publiée : « ${n.title} »`, date: n.date || n.created_at })) : []),
    ...finances.slice(0, 3).map((f) => ({ id: `lf${f.id}`, type: f.type === 'Revenu' ? 'income' : 'expense', text: `${f.type} : ${formatMGA(f.montant)}`, date: f.date })),
    ...benefs.slice(0, 3).map((b) => ({ id: `lb${b.id}`, type: 'beneficiary', text: `Bénéficiaire ajouté : ${b.prenom} ${b.nom}`, date: b.dateEntree })),
    ...(allowedTabs.includes('volunteers') ? volunteers.slice(0, 3).map((v) => ({ id: `lv${v.id}`, type: 'volunteer', text: `Candidature reçue : ${v.name}`, date: v.created_at })) : []),
    ...(allowedTabs.includes('messages') ? contacts.slice(0, 3).map((c) => ({ id: `lc${c.id}`, type: 'message', text: `Message de ${c.name}`, date: c.created_at })) : []),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10), [allowedTabs, news, finances, benefs, volunteers, contacts]);
  const activityFeed = activity.length ? activity : localActivity;

  /* Real alerts -> notifications bell. L'aperçu finances étant visible par tous,
     les alertes financières s'affichent pour tout le monde — mais le clic n'ouvre
     l'onglet Finances que si le rôle y a accès (sinon information seule). */
  const alerts = useMemo(() => {
    const a = [];
    const finTab = allowedTabs.includes('finances') ? 'finances' : null;
    if (solde < 0) a.push({ level: 'error', icon: 'trendDown', text: `Solde négatif : ${formatMGA(Math.abs(solde))}`, tab: finTab });
    else if (finances.length > 0 && totalDepenses > totalRevenus) a.push({ level: 'warn', icon: 'bell', text: 'Les dépenses dépassent les revenus', tab: finTab });
    if (finances.length === 0) a.push({ level: 'info', icon: 'wallet', text: 'Aucune transaction enregistrée', tab: finTab });
    if (allowedTabs.includes('messages') && contacts.length > 0) a.push({ level: 'info', icon: 'mail', text: `${contacts.length} message${contacts.length > 1 ? 's' : ''} reçu${contacts.length > 1 ? 's' : ''} via le formulaire`, tab: 'messages' });
    if (allowedTabs.includes('volunteers') && volunteers.length > 0) a.push({ level: 'info', icon: 'users', text: `${volunteers.length} candidature${volunteers.length > 1 ? 's' : ''} bénévole${volunteers.length > 1 ? 's' : ''} avec lettre de motivation`, tab: 'volunteers' });
    if (allowedTabs.includes('actualites') && news.length === 0) a.push({ level: 'info', icon: 'file', text: 'Aucune actualité publiée', to: '/admin/actualites' });
    return a;
  }, [allowedTabs, solde, finances.length, totalDepenses, totalRevenus, contacts.length, volunteers.length, news.length]);

  /* Base connectée mais vide — selon les données que le rôle a le droit de voir */
  const dbEmpty = apiStatus === 'online' && benefs.length === 0 && finances.length === 0 && (!allowedTabs.includes('actualites') || news.length === 0);

  /* Navigation config for the layout (filtrée par rôle) */
  const principalItems = [];
  if (allowedTabs.includes('actualites')) principalItems.push({ key: 'actualites', label: 'Actualités', icon: 'file', to: '/admin/actualites' });
  if (allowedTabs.includes('enfants')) principalItems.push({ key: 'enfants', label: 'Enfants', icon: 'users' });
  if (allowedTabs.includes('finances')) principalItems.push({ key: 'finances', label: 'Finances', icon: 'wallet' });
  const communicationItems = [];
  if (allowedTabs.includes('messages')) communicationItems.push({ key: 'messages', label: 'Messages', icon: 'mail', badge: () => contacts.length });
  if (allowedTabs.includes('volunteers')) communicationItems.push({ key: 'volunteers', label: 'Candidatures', icon: 'users', badge: () => volunteers.length });
  if (allowedTabs.includes('newsletter')) communicationItems.push({ key: 'newsletter', label: 'Newsletter', icon: 'send', badge: () => subs.length });
  if (allowedTabs.includes('comptes')) principalItems.push({ key: 'comptes', label: 'Comptes', icon: 'shield' });
  const groups = [
    { group: 'Principal', items: [{ key: 'dashboard', label: 'Tableau de bord', icon: 'grid' }, ...principalItems] },
    ...(communicationItems.length ? [{ group: 'Communication', items: communicationItems }] : []),
  ];
  const meta = {
    dashboard: { title: 'Tableau de bord', subtitle: "Vue d'ensemble de votre structure" },
    enfants: { title: 'Enfants', subtitle: 'Bénéficiaires accompagnés par ARINA' },
    finances: { title: 'Finances', subtitle: 'Revenus, dépenses et trésorerie' },
    messages: { title: 'Messages', subtitle: 'Demandes reçues via le site' },
    volunteers: { title: 'Candidatures bénévoles', subtitle: 'Bénévoles avec leur lettre de motivation' },
    newsletter: { title: 'Newsletter', subtitle: "Abonnés à votre lettre d'information" },
    comptes: { title: 'Comptes', subtitle: "Utilisateurs et rôles de l'espace admin" },
  };
  const currentMeta = meta[tab] || meta.dashboard;
  const searchPlaceholder = {
    dashboard: 'Rechercher…',
    enfants: 'Rechercher un enfant…',
    finances: 'Rechercher une transaction…',
    messages: 'Rechercher un message…',
    volunteers: 'Rechercher un bénévole…',
    newsletter: 'Rechercher un e-mail…',
    comptes: 'Rechercher un compte…',
  }[tab] || 'Rechercher…';

  /* KPI cards — l'aperçu (enfants + finances) est visible par tous les rôles.
     La gestion de chaque domaine reste réservée au rôle concerné (onglets masqués). */
  const kpis = [
    { icon: 'users', label: 'Enfants actifs', value: nbActifs, format: null, sub: `sur ${benefs.length} accompagnés · ${nbDiplomes} diplômés`, gradient: 'from-arina-blue to-arina-accent-dark', delta: null },
    { icon: 'trendUp', label: 'Revenus', value: totalRevenus, format: formatMGA, sub: `Ce mois : ${formatMGA(revThis)}`, gradient: 'from-emerald-500 to-teal-600', delta: revDelta },
    { icon: 'trendDown', label: 'Dépenses', value: totalDepenses, format: formatMGA, sub: `Ce mois : ${formatMGA(depThis)}`, gradient: 'from-rose-500 to-red-600', delta: depDelta },
    { icon: 'wallet', label: 'Solde', value: solde, format: formatMGA, sub: 'Revenus − dépenses', gradient: 'from-arina-gold to-arina-accent', delta: null },
  ];

  const quickActions = [
    ...(allowedTabs.includes('actualites') ? [{ label: 'Nouvelle actu', icon: 'file', color: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/25', action: () => navigate('/admin/actualites?new=1') }] : []),
    ...(allowedTabs.includes('enfants') ? [{ label: 'Nouvel enfant', icon: 'users', color: 'bg-arina-warm text-arina-blue hover:bg-[#FDE7E1] dark:hover:bg-white/10', action: () => { setTab('enfants'); setTimeout(() => openBenefForm(null), 120); } }] : []),
    ...(allowedTabs.includes('finances') ? [
      { label: 'Nouveau revenu', icon: 'trendUp', color: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25', action: () => { setTab('finances'); setFinanceForm({ type: 'Revenu', categorie: 'Don', montant: '', description: '', date: today() }); setTimeout(() => setShowFinanceForm(true), 120); } },
      { label: 'Nouvelle dépense', icon: 'trendDown', color: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/25', action: () => { setTab('finances'); setFinanceForm({ type: 'Dépense', categorie: 'Alimentation', montant: '', description: '', date: today() }); setTimeout(() => setShowFinanceForm(true), 120); } },
    ] : []),
    ...(allowedTabs.includes('messages') ? [{ label: 'Messages', icon: 'mail', color: 'bg-ios-fill text-ios-text hover:bg-ios-fill-2', action: () => setTab('messages') }] : []),
    ...(allowedTabs.includes('volunteers') ? [{ label: 'Candidatures', icon: 'users', color: 'bg-ios-fill text-ios-text hover:bg-ios-fill-2', action: () => setTab('volunteers') }] : []),
    ...(allowedTabs.includes('newsletter') ? [{ label: 'Newsletter', icon: 'send', color: 'bg-ios-fill text-ios-text hover:bg-ios-fill-2', action: () => setTab('newsletter') }] : []),
  ];

  const activityMeta = {
    news: { icon: 'file', cls: 'bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400' },
    income: { icon: 'trendUp', cls: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    expense: { icon: 'trendDown', cls: 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400' },
    beneficiary: { icon: 'users', cls: 'bg-arina-warm text-arina-blue' },
    volunteer: { icon: 'users', cls: 'bg-sky-100 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400' },
    message: { icon: 'mail', cls: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
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
              <span>Base de données injoignable — lecture seule (données locales). L'enregistrement est bloqué tant que la base n'est pas joignable.</span>
            </div>
          )}
          {dbEmpty && (
            <div className="rounded-2xl border border-arina-blue/20 bg-arina-warm/60 px-4 py-3 text-sm text-arina-blue flex items-center gap-2.5 animate-fade-up">
              <Icon name="plus" className="w-4 h-4 flex-shrink-0" />
              <span>Base connectée mais vide — utilisez les actions rapides pour ajouter vos premières données.</span>
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
          <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            <select value={benefFilter} onChange={(e) => setBenefFilter(e.target.value)} className="no-print px-3.5 py-2.5 bg-ios-card border border-ios-hairline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/30">
              <option value="">Tous les statuts</option>
              <option value="Actif">Actif</option>
              <option value="Diplômé">Diplômé</option>
              <option value="Inactif">Inactif</option>
            </select>
            <button onClick={() => openBenefForm(null)} className={`${primaryBtn} ml-auto inline-flex items-center gap-1.5 no-print`}>
              <Icon name="plus" className="w-4 h-4" /> Ajouter
            </button>
            <button onClick={() => window.print()} className="no-print inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-ios-fill text-ios-text text-sm font-semibold hover:bg-ios-fill-2 transition-all">
              <Printer className="w-4 h-4" /> Imprimer / PDF
            </button>
          </div>

          {/* En-tête imprimable de la liste */}
          <div className="print-list-header hidden print:block">
            <div className="flex items-center justify-between border-b-2 border-arina-blue/40 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <img src="/logo-arina.jpg" alt="ARINA" className="w-12 h-12 rounded-xl object-contain" />
                <div>
                  <div className="text-lg font-extrabold tracking-tight">Association ARINA — Liste des enfants</div>
                  <div className="text-xs text-ios-text3">Édité le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                </div>
              </div>
              <div className="text-right text-xs text-ios-text3">
                <div><span className="font-bold text-ios-text">{benefs.length}</span> enfants · <span className="font-bold text-emerald-600">{nbActifs}</span> actifs · <span className="font-bold text-purple-600">{nbDiplomes}</span> diplômés</div>
                {benefFilter && <div>Filtre : {benefFilter}</div>}
              </div>
            </div>
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

          {/* Pied de page officiel (impression / PDF) */}
          <div className="print-list-footer hidden print:block mt-8 pt-6 border-t-2 border-arina-blue/30">
            <div className="grid sm:grid-cols-3 gap-6 items-end">
              {/* Date */}
              <div className="text-sm">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-ios-text3 mb-1">Fait à Mahajanga, le</div>
                <div className="font-bold text-ios-text">
                  {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
              {/* Signature */}
              <div className="text-center">
                <div className="inline-flex flex-col items-center">
                  <div className="w-40 border-b-2 border-ios-text/60 mb-1" />
                  <div className="text-sm font-bold text-ios-text">Signature</div>
                  <div className="text-[11px] text-ios-text3">Responsable ARINA</div>
                </div>
              </div>
              {/* Tampon */}
              <div className="flex justify-center sm:justify-end">
                <div className="relative w-28 h-28 rounded-full border-2 border-arina-blue/70 text-arina-blue flex flex-col items-center justify-center text-center rotate-[-8deg] select-none">
                  <img src="/logo-arina.jpg" alt="" className="w-9 h-9 object-contain opacity-80" />
                  <div className="text-[11px] font-extrabold uppercase tracking-widest leading-tight">ARINA</div>
                  <div className="text-[8px] font-semibold uppercase tracking-wide">Association</div>
                  <div className="text-[8px] mt-0.5 font-medium">Mahajanga · 2024</div>
                </div>
              </div>
            </div>
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

      {/* ═══════════ COMPTES (admin uniquement) ═══════════ */}
      {tab === 'comptes' && (
        <div className="space-y-4 animate-fade-up">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-ios-text2 flex-1 min-w-[220px]">
              Créez les comptes de vos collaborateurs : <b>Éducateur</b> (enfants), <b>Comptable</b> (finances), <b>Président</b> (actualités, candidatures, messages). Chacun se connecte avec son identifiant.
            </p>
            <button onClick={() => setShowUserForm(true)} className={`${primaryBtn} inline-flex items-center gap-1.5`}>
              <Icon name="plus" className="w-4 h-4" /> Nouveau compte
            </button>
          </div>

          {userMsg && (
            <div className={`rounded-2xl px-4 py-3 text-sm flex items-center gap-2.5 ${userMsg.ok ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30'}`}>
              <Icon name={userMsg.ok ? 'check' : 'alert'} className="w-4 h-4 flex-shrink-0" />
              <span>{userMsg.text}</span>
            </div>
          )}

          <div className="card-apple overflow-hidden">
            {users.length === 0 ? (
              <EmptyState icon="shield" text="Aucun compte pour le moment — créez le premier compte éducateur, comptable ou président." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ios-fill">
                    <tr>
                      <Th label="Identifiant" />
                      <Th label="Rôle" />
                      <Th label="Créé le" />
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ios-hairline">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-ios-fill transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white ${u.role === 'admin' ? 'bg-gradient-to-br from-arina-gold to-arina-accent' : u.role === 'president' ? 'bg-gradient-to-br from-purple-500 to-purple-700' : u.role === 'accountant' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-arina-blue to-arina-blue-dark'}`}>
                              {initials(u.username)}
                            </div>
                            <div>
                              <div className="font-medium text-ios-text">{u.username}</div>
                              {u.username === user?.username && <div className="text-[11px] text-arina-blue font-semibold">Vous</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' : u.role === 'president' ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' : u.role === 'accountant' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-arina-warm text-arina-blue'}`}>
                            {ROLE_LABELS[u.role] || u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-ios-text3 whitespace-nowrap">{fmtDate(u.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => resetPass(u)} className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors" title="Réinitialiser le mot de passe"><Icon name="key" className="w-4 h-4" /></button>
                            {u.role !== 'admin' && (
                              <button onClick={() => removeUser(u)} className="p-2 rounded-lg text-ios-text3 hover:text-red-600 hover:bg-red-500/10 transition-colors" title="Supprimer"><Icon name="trash" className="w-4 h-4" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal — nouveau compte */}
          {showUserForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowUserForm(false)} />
              <div className="relative w-full max-w-md card-apple p-6 animate-pop">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold">Nouveau compte</h3>
                  <button onClick={() => setShowUserForm(false)} className="p-1.5 rounded-lg text-ios-text3 hover:bg-ios-fill"><Icon name="x" className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-ios-text2 mb-1.5">Identifiant</label>
                    <input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} placeholder="ex. educateur1" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ios-text2 mb-1.5">Mot de passe</label>
                    <input type="text" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Minimum 4 caractères" className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-ios-text2 mb-1.5">Rôle</label>
                    <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} className={`${inputClass} cursor-pointer`}>
                      <option value="educator">Éducateur — gère les enfants</option>
                      <option value="accountant">Comptable — gère les finances</option>
                      <option value="president">Président — actualités, candidatures, messages</option>
                      <option value="admin">Administrateur — contrôle total</option>
                    </select>
                  </div>
                </div>
                <div className="mt-6 flex gap-3">
                  <button onClick={() => setShowUserForm(false)} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Annuler</button>
                  <button onClick={saveUser} className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors">Créer le compte</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ VOLUNTEERS ═══════════ */}
      {tab === 'volunteers' && (
        <div className="space-y-4 animate-fade-up">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'Candidatures reçues', value: volunteers.length },
              { label: 'Cette semaine', value: volunteers.filter((v) => v.created_at && Date.now() - new Date(v.created_at) < 7 * 864e5).length },
              { label: 'Avec pièces jointes', value: volunteers.filter((v) => v.file_url || v.cv_url || v.file_name || v.cv_name).length },
            ].map((s, i) => (
              <div key={i} className="card-apple p-5">
                <div className="text-2xl font-extrabold tabular">{s.value}</div>
                <div className="text-xs text-ios-text3 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="card-apple overflow-hidden">
            {filteredVolunteers.length === 0 ? (
              <EmptyState icon="users" text={volunteers.length === 0 ? 'Aucune candidature pour le moment — les demandes bénévoles avec leur lettre de motivation apparaîtront ici.' : 'Aucune candidature ne correspond à votre recherche.'} />
            ) : (
              <div className="divide-y divide-ios-hairline">
                {filteredVolunteers.map((v) => (
                  <div key={v.id} className="p-5 hover:bg-ios-fill transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-arina-blue/80 to-arina-blue-dark text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {initials(v.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-semibold text-sm truncate">{v.name}</span>
                            <a href={`mailto:${v.email}`} className="text-xs text-ios-text3 hover:text-arina-blue truncate">{v.email}</a>
                          </div>
                          <span className="text-[11px] text-ios-text3 whitespace-nowrap">{timeAgo(v.created_at)}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {v.phone && <span className="text-[11px] text-ios-text2">{v.phone}</span>}
                          {v.skills && <span className="px-2 py-0.5 bg-arina-warm text-arina-blue text-[11px] font-semibold rounded-full">{v.skills}</span>}
                          {v.availability && <span className="px-2 py-0.5 bg-ios-fill text-ios-text2 text-[11px] font-semibold rounded-full">{v.availability}</span>}
                        </div>
                        {v.motivation && (
                          <p className={`text-sm text-ios-text2 mt-2 leading-relaxed ${expandedVol === v.id ? '' : 'line-clamp-2'}`}>{v.motivation}</p>
                        )}
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                          {v.file_name && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-ios-text2 font-medium max-w-[200px]">
                              <Icon name="file" className="w-3.5 h-3.5 shrink-0 text-arina-accent" />
                              <span className="truncate">Lettre : {v.file_name}</span>
                            </span>
                          )}
                          {(v.file_url || v.file_name) && (
                            <>
                              <button onClick={() => openAttachment(v, 'file')} className="inline-flex items-center gap-1 text-xs font-semibold text-arina-blue hover:underline">Télécharger</button>
                              <button onClick={() => previewAttachment(v, 'file')} className="text-xs font-semibold text-arina-blue hover:underline">Voir</button>
                            </>
                          )}
                          {v.cv_name && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-ios-text2 font-medium max-w-[200px]">
                              <Icon name="file" className="w-3.5 h-3.5 shrink-0 text-arina-gold" />
                              <span className="truncate">CV : {v.cv_name}</span>
                            </span>
                          )}
                          {(v.cv_url || v.cv_name) && (
                            <>
                              <button onClick={() => openAttachment(v, 'cv')} className="inline-flex items-center gap-1 text-xs font-semibold text-arina-blue hover:underline">Télécharger</button>
                              <button onClick={() => previewAttachment(v, 'cv')} className="text-xs font-semibold text-arina-blue hover:underline">Voir</button>
                            </>
                          )}
                          {v.motivation && (
                            <button onClick={() => setExpandedVol(expandedVol === v.id ? null : v.id)} className="text-xs font-semibold text-arina-blue hover:underline">
                              {expandedVol === v.id ? 'Réduire' : 'Lire la suite'}
                            </button>
                          )}
                          <button onClick={() => removeVolunteer(v.id)} className="text-xs font-semibold text-red-500 hover:underline">Supprimer</button>
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

      {/* ═══════ MODALS ═══════ */}
      {showBenefForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowBenefForm(false)} />
          <div className="relative w-full max-w-4xl bg-ios-card rounded-3xl shadow-2xl animate-pop overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-ios-hairline flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-arina-warm text-arina-blue flex items-center justify-center"><Icon name="users" className="w-5 h-5" /></div>
              <div>
                <h3 className="font-bold">{editingBenef ? 'Modifier' : 'Ajouter'} un enfant</h3>
                <p className="text-xs text-ios-text3">Dossier complet confidentiel — une seule page</p>
              </div>
            </div>
            <div className="p-6 max-h-[72vh] overflow-y-auto scroll-slim grid md:grid-cols-2 gap-6 items-start">
              {/* ═══ IDENTITÉ ═══ */}
              <section className="rounded-2xl border border-ios-hairline overflow-hidden">
                <div className="px-5 py-3 bg-arina-warm/70 dark:bg-white/5 flex items-center gap-2">
                  <Icon name="users" className="w-4 h-4 text-arina-blue" />
                  <h4 className="font-bold uppercase tracking-wide text-sm">Identité</h4>
                </div>
                <div className="p-5 grid md:grid-cols-2 gap-3">
                  {/* Photo — tout en haut de l'identité */}
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-ios-text3 mb-1.5">Photo</label>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden bg-ios-fill flex items-center justify-center flex-shrink-0">
                        {benefForm.photo ? <img src={benefForm.photo} alt="" className="w-full h-full object-cover" /> : <Icon name="users" className="w-10 h-10 text-ios-text3" />}
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="px-4 py-2 rounded-xl bg-arina-blue/10 text-arina-blue text-sm font-semibold cursor-pointer hover:bg-arina-blue/20 transition-colors text-center">
                          Choisir une photo
                          <input type="file" accept="image/*" onChange={onBenefPhoto} className="hidden" />
                        </label>
                        {benefForm.photo && <button type="button" onClick={() => setBenefForm((p) => ({ ...p, photo: '' }))} className="text-xs text-red-500 hover:text-red-600 transition-colors">Retirer</button>}
                      </div>
                    </div>
                  </div>
                  <input placeholder="Prénom" value={benefForm.prenom} onChange={(e) => setBenefForm({ ...benefForm, prenom: e.target.value })} className={inputClass} />
                  <input placeholder="Nom" value={benefForm.nom} onChange={(e) => setBenefForm({ ...benefForm, nom: e.target.value })} className={inputClass} />
                  <input placeholder="Pseudo" value={benefForm.dossier.identite.pseudo} onChange={setDoss('identite', 'pseudo')} className={inputClass} />
                  <input type="date" placeholder="Date de naissance" value={benefForm.dossier.identite.dateNaissance} onChange={setDoss('identite', 'dateNaissance')} className={inputClass} />
                  <input placeholder="Lieu de naissance" value={benefForm.dossier.identite.lieuNaissance} onChange={setDoss('identite', 'lieuNaissance')} className={inputClass} />
                  <input placeholder="Adresse exacte" value={benefForm.dossier.identite.adresse} onChange={setDoss('identite', 'adresse')} className={inputClass} />
                  <input placeholder="Contact" value={benefForm.dossier.identite.contact} onChange={setDoss('identite', 'contact')} className={inputClass} />
                  <input placeholder="Situation scolaire" value={benefForm.dossier.identite.situationScolaire} onChange={setDoss('identite', 'situationScolaire')} className={inputClass} />
                  <div className="md:col-span-2">
                    <input placeholder="Loisirs" value={benefForm.dossier.identite.loisirs} onChange={setDoss('identite', 'loisirs')} className={inputClass} />
                  </div>
                </div>
              </section>

              {/* ═══ SITUATION FAMILIALE ═══ */}
              <section className="rounded-2xl border border-ios-hairline overflow-hidden">
                <div className="px-5 py-3 bg-arina-warm/70 dark:bg-white/5 flex items-center gap-2">
                  <Icon name="grid" className="w-4 h-4 text-arina-blue" />
                  <h4 className="font-bold uppercase tracking-wide text-sm">Situation familiale</h4>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ios-text3 mb-2">Père</div>
                    <div className="grid md:grid-cols-4 gap-3">
                      <input placeholder="Nom du père" value={benefForm.dossier.familiale.pereNom} onChange={setDoss('familiale', 'pereNom')} className={inputClass} />
                      <input placeholder="Profession" value={benefForm.dossier.familiale.pereProfession} onChange={setDoss('familiale', 'pereProfession')} className={inputClass} />
                      <input placeholder="Contact" value={benefForm.dossier.familiale.pereContact} onChange={setDoss('familiale', 'pereContact')} className={inputClass} />
                      <input placeholder="Adresse" value={benefForm.dossier.familiale.pereAdresse} onChange={setDoss('familiale', 'pereAdresse')} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ios-text3 mb-2">Mère</div>
                    <div className="grid md:grid-cols-4 gap-3">
                      <input placeholder="Nom de la mère" value={benefForm.dossier.familiale.mereNom} onChange={setDoss('familiale', 'mereNom')} className={inputClass} />
                      <input placeholder="Profession" value={benefForm.dossier.familiale.mereProfession} onChange={setDoss('familiale', 'mereProfession')} className={inputClass} />
                      <input placeholder="Contact" value={benefForm.dossier.familiale.mereContact} onChange={setDoss('familiale', 'mereContact')} className={inputClass} />
                      <input placeholder="Adresse" value={benefForm.dossier.familiale.mereAdresse} onChange={setDoss('familiale', 'mereAdresse')} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ios-text3 mb-2">Tuteur</div>
                    <div className="grid md:grid-cols-3 gap-3">
                      <input placeholder="Nom du tuteur" value={benefForm.dossier.familiale.tuteurNom} onChange={setDoss('familiale', 'tuteurNom')} className={inputClass} />
                      <input placeholder="Contacts" value={benefForm.dossier.familiale.tuteurContact} onChange={setDoss('familiale', 'tuteurContact')} className={inputClass} />
                      <input placeholder="Adresse" value={benefForm.dossier.familiale.tuteurAdresse} onChange={setDoss('familiale', 'tuteurAdresse')} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-3 gap-3 pt-3 border-t border-ios-hairline">
                    <input placeholder="Nombre de frères et sœurs" value={benefForm.dossier.familiale.nbFreresSoeurs} onChange={setDoss('familiale', 'nbFreresSoeurs')} className={inputClass} />
                    <input placeholder="Situation des parents" value={benefForm.dossier.familiale.situationParents} onChange={setDoss('familiale', 'situationParents')} className={inputClass} />
                    <input placeholder="Niveau de vie des parents" value={benefForm.dossier.familiale.niveauVie} onChange={setDoss('familiale', 'niveauVie')} className={inputClass} />
                  </div>
                </div>
              </section>

              {/* ═══ SITUATION JURIDIQUE ═══ */}
              <section className="rounded-2xl border border-ios-hairline overflow-hidden">
                <div className="px-5 py-3 bg-arina-warm/70 dark:bg-white/5 flex items-center gap-2">
                  <Icon name="file" className="w-4 h-4 text-arina-blue" />
                  <h4 className="font-bold uppercase tracking-wide text-sm">Situation juridique</h4>
                </div>
                <div className="p-5 grid md:grid-cols-2 gap-3">
                  <div className="md:col-span-2"><input placeholder="Motifs d'inculpation" value={benefForm.dossier.juridique.motifInculpation} onChange={setDoss('juridique', 'motifInculpation')} className={inputClass} /></div>
                  <input type="date" placeholder="Date d'écrou" value={benefForm.dossier.juridique.dateEcrou} onChange={setDoss('juridique', 'dateEcrou')} className={inputClass} />
                  <input placeholder="Durée de détention" value={benefForm.dossier.juridique.dureeDetention} onChange={setDoss('juridique', 'dureeDetention')} className={inputClass} />
                  <input type="date" placeholder="Date de libération" value={benefForm.dossier.juridique.dateLiberation} onChange={setDoss('juridique', 'dateLiberation')} className={inputClass} />
                  <input placeholder="Motifs de libération" value={benefForm.dossier.juridique.motifLiberation} onChange={setDoss('juridique', 'motifLiberation')} className={inputClass} />
                </div>
              </section>

              {/* ═══ ÉTUDE ═══ */}
              <section className="rounded-2xl border border-ios-hairline overflow-hidden">
                <div className="px-5 py-3 bg-arina-warm/70 dark:bg-white/5 flex items-center gap-2">
                  <Icon name="calendar" className="w-4 h-4 text-arina-blue" />
                  <h4 className="font-bold uppercase tracking-wide text-sm">Étude</h4>
                </div>
                <div className="p-5 grid md:grid-cols-2 gap-3">
                  <input placeholder="Classe actuelle" value={benefForm.dossier.etude.classeActuelle} onChange={setDoss('etude', 'classeActuelle')} className={inputClass} />
                  <input placeholder="Établissement" value={benefForm.dossier.etude.etablissement} onChange={setDoss('etude', 'etablissement')} className={inputClass} />
                  <input placeholder="Carrière envisagée" value={benefForm.dossier.etude.carriereEnvisagee} onChange={setDoss('etude', 'carriereEnvisagee')} className={inputClass} />
                  <input placeholder="Diplôme obtenu" value={benefForm.dossier.etude.diplomeObtenu} onChange={setDoss('etude', 'diplomeObtenu')} className={inputClass} />
                  <div className="md:col-span-2"><input placeholder="Spécialités" value={benefForm.dossier.etude.specialites} onChange={setDoss('etude', 'specialites')} className={inputClass} /></div>
                </div>
              </section>

              {/* ═══ ARINA — pleine largeur ═══ */}
              <section className="rounded-2xl border border-ios-hairline overflow-hidden md:col-span-2">
                <div className="px-5 py-3 bg-arina-warm/70 dark:bg-white/5 flex items-center gap-2">
                  <Icon name="star" className="w-4 h-4 text-arina-blue" />
                  <h4 className="font-bold uppercase tracking-wide text-sm">ARINA</h4>
                </div>
                <div className="p-5 grid md:grid-cols-2 gap-3">
                  <input type="date" placeholder="Date d'entrée au centre" value={benefForm.dossier.arina.dateEntreeCentre} onChange={setDoss('arina', 'dateEntreeCentre')} className={inputClass} />
                  <input placeholder="Formation au centre" value={benefForm.formation} onChange={(e) => setBenefForm({ ...benefForm, formation: e.target.value })} className={inputClass} />
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-ios-text3 mb-1.5">Félicitations et encouragements</label>
                    <textarea
                      rows={5}
                      placeholder="Écrivez ici vos félicitations et encouragements pour cet enfant (plusieurs lignes)..."
                      value={benefForm.dossier.arina.felicitations}
                      onChange={setDoss('arina', 'felicitations')}
                      className={`${inputClass} resize-y`}
                    />
                  </div>
                  <div className="md:col-span-2 grid md:grid-cols-2 gap-3">
                    <select value={benefForm.statut} onChange={(e) => setBenefForm({ ...benefForm, statut: e.target.value })} className={inputClass}>
                      <option value="Actif">Statut : Actif</option>
                      <option value="Diplômé">Statut : Diplômé</option>
                      <option value="Inactif">Statut : Inactif</option>
                    </select>
                    <input type="date" value={benefForm.dateEntree} onChange={(e) => setBenefForm({ ...benefForm, dateEntree: e.target.value })} className={inputClass} />
                  </div>
                </div>
              </section>
            </div>
            <div className="px-6 py-4 border-t border-ios-hairline flex gap-3">
              <button onClick={() => setShowBenefForm(false)} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Annuler</button>
              <button onClick={saveBenef} className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors">Enregistrer le dossier</button>
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

      {/* Notification de sauvegarde (base de données) */}
      <Toast toast={toast} onClose={closeToast} />
    </AdminLayout>
  );
}
