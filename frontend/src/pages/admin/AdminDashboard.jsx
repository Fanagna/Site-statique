import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Toast, { useToast } from '../../components/admin/Toast';
import {
  fetchBeneficiaries, createBeneficiary, updateBeneficiary, deleteBeneficiary,
  fetchFinances, createFinance, updateFinance, deleteFinance,
  fetchDonors, createDonor, updateDonor, deleteDonor,
  fetchNews,
  fetchContacts, deleteContact,
  fetchVolunteers, deleteVolunteer, getVolunteerAttachment,
  fetchActivity,
  fetchUsers, createUser, deleteUser, resetUserPassword,
} from '../../services/api';

// Rôles & onglets autorisés (source unique : ./roles)
import { ROLES, ROLE_LABELS, ROLE_TABS } from './roles';
import { allNews } from '../../data/news';
import { CheckCircle2, Download, Hand, Printer } from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { Icon } from '../../components/admin/icons';
import {
  formatMGA, today, fmtDate, timeAgo, initials, inputClass, CountUp, EmptyState, Th,
} from '../../components/admin/ui';
import { exportEvaluationXlsx } from '../../components/admin/ExcelTools';
import {
  DonorDonut, DonorExpenseBars, DonorMonthlyStacked, donorColor,
} from '../../components/admin/DonorCharts';
import {
  EvolutionChart, TopExpensesChart, CategoryDonut,
} from '../../components/admin/DashboardCharts';

/* ═══════════════════════════════════════
   Helpers
   ═══════════════════════════════════════ */
const monthKey = (d) => {
  if (!d) return '';
  const [y, m] = String(d).split('-').map(Number);
  return y && m ? `${y}-${String(m).padStart(2, '0')}` : '';
};
const pctDelta = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : cur > 0 ? 100 : 0);
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

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
      arina: { dateEntreeCentre: '', recommandation: '' },
    },
  };
  const [benefForm, setBenefForm] = useState(benefFormInit);
  const [benefFilter, setBenefFilter] = useState('');
  const [benefSort, setBenefSort] = useState({ key: '', dir: 1 });

  /* ── Finance CRUD ── */
  const [showFinanceForm, setShowFinanceForm] = useState(false);
  const [editingFin, setEditingFin] = useState(null);
  const [financeForm, setFinanceForm] = useState({ type: 'Revenu', categorie: 'Don', montant: '', quantity: '', unit_price: '', description: '', date: today(), donor: '' });
  const [finType, setFinType] = useState('');
  const [finCat, setFinCat] = useState('');
  const [finSort, setFinSort] = useState({ key: '', dir: 1 });
  const [evalYear, setEvalYear] = useState(new Date().getFullYear());
  const [evalMonth, setEvalMonth] = useState(''); // '' = vue des 12 mois ; '01'…'12' = rapport mensuel détaillé
  const [evalDonor, setEvalDonor] = useState(''); // '' = tous ; 'Sans donateur' ; nom d'un donateur

  /* ── Donateurs (partenaires financiers) ── */
  const [donors, setDonors] = useState([]);
  const [showDonorForm, setShowDonorForm] = useState(false);
  const [editingDonor, setEditingDonor] = useState(null);
  const [donorForm, setDonorForm] = useState({ name: '', need: '' });

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

    // Donateurs : nécessaires pour l'évaluation (filtre + rapports) et l'onglet dédié
    const dFromApi = await fetchDonors();
    if (dFromApi !== null && Array.isArray(dFromApi)) { anyOk = true; setDonors(dFromApi); }
    else { anyFail = true; const s = localStorage.getItem('arina_donors'); setDonors(s ? JSON.parse(s) : []); }

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
  useEffect(() => { if (donors.length) localStorage.setItem('arina_donors', JSON.stringify(donors)); }, [donors]);
  useEffect(() => { if (news !== allNews && news.length) localStorage.setItem('arina_news', JSON.stringify(news)); }, [news]);
  useEffect(() => { if (contacts.length) localStorage.setItem('arina_contacts', JSON.stringify(contacts)); }, [contacts]);

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
          arina: { ...benefFormInit.dossier.arina, ...(b.dossier?.arina || {}), recommandation: b.dossier?.arina?.recommandation || b.dossier?.arina?.felicitations || '' },
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
    // Migration douce : la clé obsolète `felicitations` (remplacée par `recommandation`)
    // est retirée du dossier à l'enregistrement pour éviter qu'un ancien texte ne
    // ressorte après effacement du nouveau champ.
    if (d.dossier?.arina && 'felicitations' in d.dossier.arina) {
      const arina = { ...d.dossier.arina };
      delete arina.felicitations;
      d.dossier = { ...d.dossier, arina };
    }
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

  /* Ouvre le formulaire : pré-rempli (édition) ou vierge (nouvelle transaction) */
  const openFinForm = (f) => {
    if (f) {
      setEditingFin(f);
      // Dépense avec QT/PU → pré-remplissage QT/PU (MNT recalculé automatiquement) ;
      // don ou montant direct → pré-remplissage du montant.
      const hasCalc = f.quantity != null && f.unit_price != null;
      setFinanceForm({
        type: f.type,
        categorie: f.categorie,
        montant: hasCalc ? '' : String(f.montant || ''),
        quantity: f.quantity != null ? String(f.quantity) : '',
        unit_price: f.unit_price != null ? String(f.unit_price) : '',
        description: f.description || '',
        date: f.date || today(),
        donor: f.donor || '',
      });
    } else {
      setEditingFin(null);
      setFinanceForm({ type: 'Revenu', categorie: 'Don', montant: '', quantity: '', unit_price: '', description: '', date: today(), donor: '' });
    }
    setShowFinanceForm(true);
  };
  const saveFinance = async () => {
    // Donateur obligatoire : chaque don / dépense est rattaché au partenaire qui le finance
    if (!financeForm.donor) {
      showToast('❌ Le donateur est obligatoire — sélectionnez le partenaire qui finance cette transaction.', 'error');
      return;
    }
    const q = financeForm.quantity !== '' ? Number(financeForm.quantity) || 0 : 0;
    const p = financeForm.unit_price !== '' ? Number(financeForm.unit_price) || 0 : 0;
    // MNT = QT × PU (calcul automatique) pour une dépense ; sinon montant saisi (ex. un don).
    // MNT = QT × PU dès que QT et PU sont renseignés (tous types) — cohérent avec le backend
    const auto = q > 0 && p > 0 ? Math.round(q * p) : 0;
    const d = {
      ...financeForm,
      donor: financeForm.donor,
      quantity: q || null,
      unit_price: p || null,
      montant: auto || Number(financeForm.montant) || 0,
    };
    const r = editingFin ? await updateFinance(editingFin.id, d) : await createFinance(d);
    if (!r.ok) {
      showToast(`❌ ${editingFin ? 'Modification' : 'Transaction'} NON enregistrée dans la base : ${r.error}`, 'error');
      return;
    }
    if (editingFin) {
      setFinances(finances.map((f) => (f.id === editingFin.id ? r.data : f)));
      showToast(`✅ ${r.data.type} modifié${r.data.type === 'Dépense' ? 'e' : ''} dans la base : ${formatMGA(r.data.montant)}`);
    } else {
      setFinances([r.data, ...finances]);
      showToast(`✅ ${r.data.type} enregistré${r.data.type === 'Dépense' ? 'e' : ''} dans la base : ${formatMGA(r.data.montant)}`);
    }
    setEditingFin(null);
    setShowFinanceForm(false);
    setFinanceForm({ type: 'Revenu', categorie: 'Don', montant: '', quantity: '', unit_price: '', description: '', date: today(), donor: '' });
  };
  const removeFinance = async (id) => {
    if (!confirm('Supprimer cette transaction ?')) return;
    const r = await deleteFinance(id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    setFinances(finances.filter((f) => f.id !== id));
    showToast('✅ Transaction supprimée de la base de données');
  };

  /* ── Donateurs CRUD ── */
  const openDonorForm = (d) => {
    if (d) { setEditingDonor(d); setDonorForm({ name: d.name || '', need: d.need || '' }); }
    else { setEditingDonor(null); setDonorForm({ name: '', need: '' }); }
    setShowDonorForm(true);
  };
  const saveDonor = async () => {
    if (!donorForm.name.trim()) { showToast('❌ Le nom du donateur est requis', 'error'); return; }
    const r = editingDonor ? await updateDonor(editingDonor.id, donorForm) : await createDonor(donorForm);
    if (!r.ok) { showToast(`❌ Donateur NON enregistré dans la base : ${r.error}`, 'error'); return; }
    if (editingDonor) setDonors(donors.map((d) => (d.id === editingDonor.id ? r.data : d)));
    else setDonors([...donors, r.data]);
    showToast(`✅ Donateur « ${r.data.name} » ${editingDonor ? 'modifié' : 'ajouté'} dans la base`);
    setShowDonorForm(false);
    setDonorForm({ name: '', need: '' });
    setEditingDonor(null);
  };
  const removeDonor = async (d) => {
    if (!confirm(`Supprimer le donateur « ${d.name} » ? Les transactions existantes conserveront son nom.`)) return;
    const r = await deleteDonor(d.id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    setDonors(donors.filter((x) => x.id !== d.id));
    showToast(`✅ Donateur « ${d.name} » retiré de la liste`);
  };

  /* Stats agrégées par donateur (pour l'onglet Donateurs) */
  const donorStats = useMemo(() => {
    const map = {};
    donors.forEach((d) => { map[d.name] = { ...d, dons: 0, depenses: 0, count: 0 }; });
    finances.forEach((f) => {
      const k = f.donor;
      if (!k || !map[k]) return;
      const v = Number(f.montant) || 0;
      map[k].count++;
      if (f.type === 'Revenu') map[k].dons += v; else map[k].depenses += v;
    });
    return Object.values(map);
  }, [donors, finances]);

  const removeContact = async (id) => {
    if (!confirm('Supprimer ce message ?')) return;
    const r = await deleteContact(id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    setContacts(contacts.filter((c) => c.id !== id));
    showToast('✅ Message supprimé de la base de données');
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
    if (q) arr = arr.filter((f) => `${f.categorie} ${f.description} ${f.donor || ''}`.toLowerCase().includes(q));
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
  const filteredVolunteers = useMemo(() => {
    if (!q) return volunteers;
    return volunteers.filter((v) => `${v.name} ${v.email} ${v.skills} ${v.motivation}`.toLowerCase().includes(q));
  }, [volunteers, q]);

  /* ── Évaluation mensuelle (admin + comptable) ── */
  // Montant automatique affiché dans le formulaire de dépense : MNT = QT × PU
  const finAutoMnt = financeForm.type === 'Dépense' && Number(financeForm.quantity) > 0 && Number(financeForm.unit_price) > 0
    ? Math.round(Number(financeForm.quantity) * Number(financeForm.unit_price))
    : 0;
  // Années disponibles (données présentes + année courante)
  const evalYears = useMemo(() => {
    const set = new Set([new Date().getFullYear()]);
    finances.forEach((f) => { const k = monthKey(f.date); if (k) set.add(Number(k.split('-')[0])); });
    return [...set].sort((a, b) => b - a);
  }, [finances]);
  // Filtre donateur : appliqué aux mois, au rapport et à l'export Excel
  const evalFinances = useMemo(() => {
    if (!evalDonor) return finances;
    return finances.filter((f) => (f.donor || 'Sans donateur') === evalDonor);
  }, [finances, evalDonor]);
  // Périmètre analytics : année (+ mois si sélectionné), tous donateurs
  const evalScope = useMemo(() => finances.filter((f) => {
    const k = monthKey(f.date);
    if (!k.startsWith(String(evalYear))) return false;
    if (evalMonth && !k.endsWith(`-${evalMonth}`)) return false;
    return true;
  }), [finances, evalYear, evalMonth]);
  const yearFinances = useMemo(() => finances.filter((f) => monthKey(f.date).startsWith(String(evalYear))), [finances, evalYear]);
  const scopeDons = evalScope.filter((f) => f.type === 'Revenu').reduce((s, f) => s + (Number(f.montant) || 0), 0);
  const scopeDep = evalScope.filter((f) => f.type === 'Dépense').reduce((s, f) => s + (Number(f.montant) || 0), 0);
  const scopeSolde = scopeDons - scopeDep;
  // Transactions détaillées du filtre courant (rapport donateur / export)
  const evalDetail = useMemo(() => [...evalFinances]
    .filter((f) => {
      const k = monthKey(f.date);
      return k.startsWith(String(evalYear)) && (!evalMonth || k.endsWith(`-${evalMonth}`));
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date))),
  [evalFinances, evalYear, evalMonth]);
  const donorInfo = evalDonor ? donors.find((d) => d.name === evalDonor) : null;
  // Totaux du rapport donateur (périmètre : donateur + année + mois)
  const detailDons = evalDetail.filter((f) => f.type === 'Revenu').reduce((s, f) => s + (Number(f.montant) || 0), 0);
  const detailDep = evalDetail.filter((f) => f.type === 'Dépense').reduce((s, f) => s + (Number(f.montant) || 0), 0);
  const detailSolde = detailDons - detailDep;
  // KPI du haut : ciblés sur le donateur sélectionné (sinon toutes les données de la période)
  const kpiDons = evalDonor ? detailDons : scopeDons;
  const kpiDep = evalDonor ? detailDep : scopeDep;
  const kpiSolde = evalDonor ? detailSolde : scopeSolde;
  // 12 colonnes-mois avec dons détaillés et dépenses (QT / PU / MNT) + totaux
  const evalMonths = useMemo(() => MONTH_NAMES.map((name, i) => {
    const key = `${evalYear}-${String(i + 1).padStart(2, '0')}`;
    const rows = evalFinances.filter((f) => monthKey(f.date) === key);
    const dons = rows.filter((f) => f.type === 'Revenu');
    const depenses = rows.filter((f) => f.type === 'Dépense');
    return {
      name, key,
      dons,
      depenses,
      donTotal: dons.reduce((s, f) => s + (Number(f.montant) || 0), 0),
      depTotal: depenses.reduce((s, f) => s + (Number(f.montant) || 0), 0),
      solde: dons.reduce((s, f) => s + (Number(f.montant) || 0), 0) - depenses.reduce((s, f) => s + (Number(f.montant) || 0), 0),
    };
  }), [evalFinances, evalYear]);

  // Mois sélectionné pour le rapport mensuel détaillé (synthèse + détail par catégorie)
  const selectedMonth = evalMonth ? evalMonths.find((m) => m.key.endsWith(`-${evalMonth}`)) || null : null;
  const monthCat = useMemo(() => {
    if (!selectedMonth) return null;
    const dons = {};
    const depenses = {};
    selectedMonth.dons.forEach((d) => { const k = d.categorie || 'Autre'; dons[k] = (dons[k] || 0) + (Number(d.montant) || 0); });
    selectedMonth.depenses.forEach((d) => { const k = d.categorie || 'Autre'; depenses[k] = (depenses[k] || 0) + (Number(d.montant) || 0); });
    return {
      dons: Object.entries(dons).sort((a, b) => b[1] - a[1]),
      depenses: Object.entries(depenses).sort((a, b) => b[1] - a[1]),
    };
  }, [selectedMonth]);

  /* Export Excel (.xlsx) du rapport — filtres année / mois / donateur */
  const exportEvaluationXlsxHandler = useCallback(async () => {
    const monthName = evalMonth ? MONTH_NAMES[Number(evalMonth) - 1] : '';
    const donorSlug = evalDonor ? '-' + evalDonor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+$/g, '') : '';
    const fname = `rapport-ARINA-${evalYear}${monthName ? '-' + monthName.toLowerCase() : ''}${donorSlug}.xlsx`;
    await exportEvaluationXlsx({ year: evalYear, month: evalMonth, donor: evalDonor, finances, donors, fileName: fname });
    showToast(`📥 ${fname} téléchargé${evalDonor ? ` — ${evalDonor}` : ''}`);
  }, [evalYear, evalMonth, evalDonor, finances, donors, showToast]);

  /* Export du rapport complet d'UN donateur (toute la période) — depuis l'onglet Donateurs */
  const exportDonorReport = async (d) => {
    const slug = String(d.name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/-+$/g, '');
    await exportEvaluationXlsx({ year: '', month: '', donor: d.name, finances, donors, fileName: `rapport-${slug}-ARINA.xlsx` });
    showToast(`📥 Rapport complet de « ${d.name} » téléchargé (dépenses + revenus)`);
  };

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
  if (allowedTabs.includes('evaluation')) principalItems.push({ key: 'evaluation', label: 'Évaluation', icon: 'calendar' });
  if (allowedTabs.includes('donateurs')) principalItems.push({ key: 'donateurs', label: 'Donateurs', icon: 'handshake' });
  const communicationItems = [];
  if (allowedTabs.includes('messages')) communicationItems.push({ key: 'messages', label: 'Messages', icon: 'mail', badge: () => contacts.length });
  if (allowedTabs.includes('volunteers')) communicationItems.push({ key: 'volunteers', label: 'Candidatures', icon: 'users', badge: () => volunteers.length });
  if (allowedTabs.includes('comptes')) principalItems.push({ key: 'comptes', label: 'Comptes', icon: 'shield' });
  const groups = [
    { group: 'Principal', items: [{ key: 'dashboard', label: 'Tableau de bord', icon: 'grid' }, ...principalItems] },
    ...(communicationItems.length ? [{ group: 'Communication', items: communicationItems }] : []),
  ];
  const meta = {
    dashboard: { title: 'Tableau de bord', subtitle: "Vue d'ensemble de votre structure" },
    enfants: { title: 'Enfants', subtitle: 'Bénéficiaires accompagnés par ARINA' },
    finances: { title: 'Finances', subtitle: 'Revenus, dépenses et trésorerie' },
    evaluation: { title: 'Évaluation mensuelle', subtitle: 'Analytics temps réel et transactions par mois et par donateur — export Excel' },
    donateurs: { title: 'Donateurs', subtitle: 'Partenaires financiers et besoins financés' },
    messages: { title: 'Messages', subtitle: 'Demandes reçues via le site' },
    volunteers: { title: 'Candidatures bénévoles', subtitle: 'Bénévoles avec leur lettre de motivation' },
    comptes: { title: 'Comptes', subtitle: "Utilisateurs et rôles de l'espace admin" },
  };
  const currentMeta = meta[tab] || meta.dashboard;
  const searchPlaceholder = {
    dashboard: 'Rechercher…',
    enfants: 'Rechercher un enfant…',
    finances: 'Rechercher une transaction…',
    evaluation: 'Rechercher une transaction…',
    donateurs: 'Rechercher un donateur…',
    messages: 'Rechercher un message…',
    volunteers: 'Rechercher un bénévole…',
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
    ...(allowedTabs.includes('enfants') ? [{ label: 'Nouvel enfant', icon: 'users', color: 'bg-arina-warm text-arina-blue hover:bg-[#F6E9E4] dark:hover:bg-white/10', action: () => { setTab('enfants'); setTimeout(() => openBenefForm(null), 120); } }] : []),
    ...(allowedTabs.includes('finances') ? [
      { label: 'Nouveau revenu', icon: 'trendUp', color: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25', action: () => { setTab('finances'); setEditingFin(null); setFinanceForm({ type: 'Revenu', categorie: 'Don', montant: '', quantity: '', unit_price: '', description: '', date: today() }); setTimeout(() => setShowFinanceForm(true), 120); } },
      { label: 'Nouvelle dépense', icon: 'trendDown', color: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/25', action: () => { setTab('finances'); setEditingFin(null); setFinanceForm({ type: 'Dépense', categorie: 'Alimentation', montant: '', quantity: '', unit_price: '', description: '', date: today() }); setTimeout(() => setShowFinanceForm(true), 120); } },
    ] : []),
    ...(allowedTabs.includes('messages') ? [{ label: 'Messages', icon: 'mail', color: 'bg-ios-fill text-ios-text hover:bg-ios-fill-2', action: () => setTab('messages') }] : []),
    ...(allowedTabs.includes('volunteers') ? [{ label: 'Candidatures', icon: 'users', color: 'bg-ios-fill text-ios-text hover:bg-ios-fill-2', action: () => setTab('volunteers') }] : []),
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

          {/* Hero banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-arina-accent via-arina-blue to-arina-blue-dark text-white p-6 lg:p-8 animate-fade-up shadow-2xl shadow-arina-blue/30">
            <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-arina-gold/25 blur-3xl" />
            <div className="absolute -bottom-24 -left-12 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute top-8 right-10 w-20 h-20 rounded-full border-2 border-arina-gold-light/30 animate-float-slow" />
            <div className="absolute bottom-6 right-36 w-10 h-10 rounded-full border border-white/20 animate-float-slow" style={{ animationDelay: '1.3s' }} />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent" />
            <div className="relative flex flex-wrap items-end justify-between gap-6">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-semibold backdrop-blur-sm">
                  <span className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'online' ? 'bg-emerald-300 animate-pulse-dot' : apiStatus === 'offline' ? 'bg-amber-300' : 'bg-gray-300 animate-pulse'}`} />
                  {apiStatus === 'online' ? 'Base de données connectée' : apiStatus === 'offline' ? 'Mode local — base injoignable' : 'Connexion…'}
                </span>
                <h2 className="text-2xl lg:text-[30px] font-bold tracking-tight mt-3 flex items-center gap-2.5">
                  Bonjour, {user?.username} <Hand className="w-6 h-6 text-arina-gold animate-float-slow" />
                </h2>
                <p className="text-white/80 text-sm mt-1.5">
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} — Voici l'état de votre structure aujourd'hui.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  { label: 'Revenus ce mois', value: revThis, icon: 'trendUp', cls: 'text-emerald-300' },
                  { label: 'Dépenses ce mois', value: depThis, icon: 'trendDown', cls: 'text-rose-300' },
                  { label: 'Solde', value: solde, icon: 'wallet', cls: solde >= 0 ? 'text-emerald-300' : 'text-rose-300' },
                ].map((s, i) => (
                  <div key={s.label} className="min-w-[122px] px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 animate-fade-up" style={{ animationDelay: `${0.12 + i * 0.08}s` }}>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-white/70">
                      <Icon name={s.icon} className={`w-3 h-3 ${s.cls}`} /> {s.label}
                    </div>
                    <div className={`text-lg font-extrabold tabular mt-1 ${s.cls}`}>{financesLoading ? '—' : formatMGA(s.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((s, i) => (
              <div key={s.label} className="group relative card-apple card-apple-hover p-5 animate-fade-up overflow-hidden" style={{ animationDelay: `${i * 60}ms` }}>
                <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${s.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="flex items-start justify-between">
                  <div className={`w-11 h-11 rounded-[14px] bg-gradient-to-br ${s.gradient} text-white flex items-center justify-center shadow-lg shadow-arina-blue/15 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300`}>
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
                  <div className="text-[22px] lg:text-[26px] font-bold tracking-tight tabular mt-0.5 group-hover:text-arina-blue transition-colors duration-300">
                    <CountUp value={s.value} format={s.format} />
                  </div>
                  <div className="text-xs text-ios-text3 mt-1 truncate">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 card-apple p-6 animate-fade-up hover:shadow-apple-lg transition-shadow duration-300" style={{ animationDelay: '180ms' }}>
              <div className="flex items-center gap-3 mb-5">
                <span className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <Icon name="trendUp" className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="font-bold">Évolution sur 6 mois</h3>
                  <p className="text-xs text-ios-text3 mt-0.5">Tendance mensuelle des revenus et dépenses</p>
                </div>
              </div>
              <EvolutionChart finances={finances} loading={financesLoading} />
            </div>

            <div className="space-y-6">
              <div className="card-apple p-6 animate-fade-up hover:shadow-apple-lg transition-shadow duration-300" style={{ animationDelay: '240ms' }}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                    <Icon name="trendDown" className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-bold">Dépenses par catégorie</h3>
                    <p className="text-xs text-ios-text3 mt-0.5">Répartition réelle des sorties</p>
                  </div>
                </div>
                <CategoryDonut finances={finances} loading={financesLoading} />
              </div>

              <div className="card-apple p-6 animate-fade-up hover:shadow-apple-lg transition-shadow duration-300" style={{ animationDelay: '300ms' }}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                    <Icon name="activity" className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="font-bold">Top 5 des dépenses</h3>
                    <p className="text-xs text-ios-text3 mt-0.5">Les catégories les plus coûteuses</p>
                  </div>
                </div>
                <TopExpensesChart finances={finances} loading={financesLoading} />
              </div>
            </div>
          </div>

          {/* Enfants répartition + Activité */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="card-apple p-6 animate-fade-up" style={{ animationDelay: '360ms' }}>
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

            <div className="lg:col-span-2 card-apple p-6 animate-fade-up" style={{ animationDelay: '420ms' }}>
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
          <div className="card-apple p-6 animate-fade-up" style={{ animationDelay: '480ms' }}>
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
                            <Link to={`/admin/beneficiaire/${b.id}`} state={{ benef: b }} className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors" title="Fiche détaillée"><Icon name="eye" className="w-4 h-4" /></Link>
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
            <button onClick={() => openFinForm(null)} className={`${primaryBtn} ml-auto inline-flex items-center gap-1.5`}>
              <Icon name="plus" className="w-4 h-4" /> Ajouter
            </button>
          </div>
          <div className="card-apple overflow-hidden">
            {financesLoading ? (
              <div className="p-6 space-y-4"><div className="skeleton h-10" /><div className="skeleton h-10" /><div className="skeleton h-10" /></div>
            ) : sortedFinances.length === 0 ? (
              <EmptyState icon="wallet" text="Aucune transaction trouvée. Enregistrez votre premier mouvement !" action={<button onClick={() => openFinForm(null)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-arina-blue text-white text-sm font-semibold"><Icon name="plus" className="w-4 h-4" /> Ajouter une transaction</button>} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ios-fill">
                    <tr>
                      <Th label="Type" k="type" sort={finSort} onSort={(k) => setFinSort({ key: k, dir: finSort.key === k ? -finSort.dir : 1 })} />
                      <Th label="Catégorie" k="categorie" sort={finSort} onSort={(k) => setFinSort({ key: k, dir: finSort.key === k ? -finSort.dir : 1 })} />
                      <Th label="Donateur" k="donor" sort={finSort} onSort={(k) => setFinSort({ key: k, dir: finSort.key === k ? -finSort.dir : 1 })} />
                      <Th label="Détail (QT × PU)" />
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
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: donorColor(donors, f.donor) }} />
                            <span className={f.donor ? 'text-ios-text' : 'text-amber-600 dark:text-amber-400 font-medium'}>{f.donor || 'Sans donateur'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-ios-text3 tabular whitespace-nowrap">
                          {f.quantity != null && f.unit_price != null ? `${f.quantity} × ${formatMGA(f.unit_price)}` : '—'}
                        </td>
                        <td className={`px-4 py-3 font-semibold tabular ${f.type === 'Revenu' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {f.type === 'Revenu' ? '+' : '−'} {formatMGA(f.montant)}
                        </td>
                        <td className="px-4 py-3 text-ios-text2 max-w-[240px] truncate">{f.description || '—'}</td>
                        <td className="px-4 py-3 text-xs text-ios-text3 whitespace-nowrap">{fmtDate(f.date)}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => openFinForm(f)} className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors" title="Modifier"><Icon name="edit" className="w-4 h-4" /></button>
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

      {/* ═══════════ ÉVALUATION MENSUELLE (admin + comptable) ═══════════ */}
      {tab === 'evaluation' && (
        <div className="space-y-4 animate-fade-up">
          <div className="no-print flex flex-wrap items-center gap-2.5">
            <select value={evalYear} onChange={(e) => setEvalYear(Number(e.target.value))} className="px-3.5 py-2.5 bg-ios-card border border-ios-hairline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/30">
              {evalYears.map((y) => <option key={y} value={y}>Année {y}</option>)}
            </select>
            <select value={evalMonth} onChange={(e) => setEvalMonth(e.target.value)} className="px-3.5 py-2.5 bg-ios-card border border-ios-hairline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/30">
              <option value="">Tous les mois</option>
              {MONTH_NAMES.map((name, i) => <option key={name} value={String(i + 1).padStart(2, '0')}>{name}</option>)}
            </select>
            <select value={evalDonor} onChange={(e) => setEvalDonor(e.target.value)} className="px-3.5 py-2.5 bg-ios-card border border-ios-hairline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/30 max-w-[230px]" title="Filtrer par donateur">
              <option value="">Tous les donateurs</option>
              {donors.map((d) => <option key={d.id} value={d.name}>{d.name}{d.need ? ` — ${d.need}` : ''}</option>)}
              <option value="Sans donateur">Sans donateur (à compléter)</option>
            </select>
            <span className="hidden lg:inline text-xs text-ios-text3">MNT automatique (QT × PU) — défilement horizontal pour les 12 mois</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button onClick={exportEvaluationXlsxHandler} className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-arina-blue text-white text-sm font-semibold hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-all" title="Exporter le rapport en Excel (.xlsx)">
                <Download className="w-4 h-4" /> Exporter Excel
              </button>
            </div>
          </div>

          {/* ── Tableau de bord analytique (temps réel) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Dons reçus', value: kpiDons, icon: 'trendUp', gradient: 'from-emerald-500 to-teal-600', c: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Dépenses', value: kpiDep, icon: 'trendDown', gradient: 'from-rose-500 to-red-600', c: 'text-red-500 dark:text-red-400' },
              { label: 'Solde', value: kpiSolde, icon: 'wallet', gradient: kpiSolde >= 0 ? 'from-arina-gold to-arina-accent' : 'from-rose-500 to-red-600', c: kpiSolde >= 0 ? 'text-arina-blue' : 'text-red-600 dark:text-red-400' },
            ].map((s, i) => (
              <div key={s.label} className="group relative card-apple card-apple-hover p-5 animate-fade-up overflow-hidden" style={{ animationDelay: `${i * 70}ms` }}>
                <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${s.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="flex items-center gap-3.5">
                  <div className={`w-11 h-11 rounded-[14px] bg-gradient-to-br ${s.gradient} text-white flex items-center justify-center shadow-lg shadow-arina-blue/15 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300`}>
                    <Icon name={s.icon} className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-ios-text3 truncate">{s.label}{evalDonor ? ` · ${evalDonor}` : ''}</div>
                    <div className={`text-lg lg:text-xl font-extrabold tabular mt-0.5 ${s.c} group-hover:scale-105 origin-left transition-transform duration-300`}>{financesLoading ? '—' : <CountUp value={s.value} format={formatMGA} />}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="group relative card-apple p-5 animate-fade-up overflow-hidden" style={{ animationDelay: '60ms' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <Icon name="trendUp" className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Dons par donateur</h3>
                  <p className="text-[11px] text-ios-text3">{evalMonth ? `${MONTH_NAMES[Number(evalMonth) - 1]} ` : ''}{evalYear}</p>
                </div>
              </div>
              <DonorDonut finances={evalScope} donors={donors} loading={financesLoading} />
            </div>
            <div className="group relative card-apple p-5 animate-fade-up overflow-hidden" style={{ animationDelay: '120ms' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
                  <Icon name="trendDown" className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Dépenses par donateur</h3>
                  <p className="text-[11px] text-ios-text3">{evalMonth ? `${MONTH_NAMES[Number(evalMonth) - 1]} ` : ''}{evalYear}</p>
                </div>
              </div>
              <DonorExpenseBars finances={evalScope} donors={donors} loading={financesLoading} />
            </div>
            <div className="group relative card-apple p-5 lg:col-span-2 animate-fade-up overflow-hidden" style={{ animationDelay: '180ms' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-arina-accent to-arina-blue-dark text-white flex items-center justify-center shadow-md shadow-arina-blue/20">
                  <Icon name="calendar" className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Évolution mensuelle des dépenses par donateur</h3>
                  <p className="text-[11px] text-ios-text3">{evalYear}</p>
                </div>
              </div>
              <DonorMonthlyStacked finances={yearFinances} donors={donors} year={evalYear} loading={financesLoading} />
            </div>
          </div>

          {/* Rapport détaillé par donateur (filtre donateur) — imprimable */}
          {evalDonor && (
            <div className="card-apple p-6 animate-fade-up print-area">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">Rapport {evalDonor}</h3>
                  <p className="text-xs text-ios-text3 mt-0.5">
                    {donorInfo?.need ? `Besoin financé : ${donorInfo.need} · ` : ''}
                    {evalMonth ? `${MONTH_NAMES[Number(evalMonth) - 1]} ${evalYear}` : `Année ${evalYear}`} — {evalDetail.length} mouvement{evalDetail.length > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Icon name="trendUp" className="w-3.5 h-3.5" /> Dons : {formatMGA(detailDons)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400">
                    <Icon name="trendDown" className="w-3.5 h-3.5" /> Dépenses : {formatMGA(detailDep)}
                  </span>
                </div>
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ios-fill">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-ios-text3">Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-ios-text3">Type</th>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-ios-text3">Désignation</th>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-ios-text3">Description</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-ios-text3">QT</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-ios-text3">PU</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-ios-text3">MNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ios-hairline">
                    {evalDetail.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-ios-text3">Aucune transaction pour ce donateur sur la période sélectionnée.</td></tr>
                    )}
                    {evalDetail.map((f) => (
                      <tr key={f.id} className="hover:bg-ios-fill transition-colors">
                        <td className="px-4 py-2.5 text-xs text-ios-text3 whitespace-nowrap tabular">{fmtDate(f.date)}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${f.type === 'Revenu' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400'}`}>{f.type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-ios-text font-medium">{f.categorie || 'Autre'}</td>
                        <td className="px-4 py-2.5 text-ios-text2 text-xs max-w-[260px] truncate">{f.description || '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular text-ios-text2">{f.quantity ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular text-ios-text2">{f.unit_price != null ? formatMGA(f.unit_price) : '—'}</td>
                        <td className={`px-4 py-2.5 text-right font-semibold tabular ${f.type === 'Revenu' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{formatMGA(f.montant)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-ios-fill font-semibold">
                      <td colSpan={6} className="px-4 py-3 text-right text-xs uppercase tracking-wide text-ios-text3">Solde {evalDonor}</td>
                      <td className={`px-4 py-3 text-right font-extrabold tabular ${detailSolde >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatMGA(detailSolde)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Rapport mensuel détaillé (sélecteur de mois) */}
          {selectedMonth && monthCat && (
            <div className="card-apple p-6 animate-fade-up print-area">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold">Rapport mensuel — {selectedMonth.name} {evalYear}</h3>
                  <p className="text-xs text-ios-text3 mt-0.5">Synthèse des dons et dépenses du mois sélectionné</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-arina-warm text-arina-blue">
                  <Icon name="calendar" className="w-3.5 h-3.5" /> {selectedMonth.dons.length + selectedMonth.depenses.length} mouvement{selectedMonth.dons.length + selectedMonth.depenses.length > 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-6">
                {[
                  { label: 'Dons reçus', value: selectedMonth.donTotal, c: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Dépenses', value: selectedMonth.depTotal, c: 'text-red-500 dark:text-red-400' },
                  { label: 'Solde', value: selectedMonth.solde, c: selectedMonth.solde >= 0 ? 'text-arina-blue' : 'text-red-600 dark:text-red-400' },
                ].map((s, i) => (
                  <div key={i} className="rounded-2xl bg-ios-fill p-4">
                    <div className={`text-lg lg:text-2xl font-extrabold tabular ${s.c}`}>{formatMGA(s.value)}</div>
                    <div className="text-xs text-ios-text3 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-6 mt-6">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 mb-2">Dons par catégorie</div>
                  {monthCat.dons.length === 0 ? (
                    <div className="text-sm text-ios-text3">Aucun don ce mois.</div>
                  ) : (
                    <div className="space-y-2">
                      {monthCat.dons.map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-sm">
                          <span className="text-ios-text2">{k}</span>
                          <span className="font-semibold tabular">{formatMGA(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-red-500 dark:text-red-400 mb-2">Dépenses par catégorie</div>
                  {monthCat.depenses.length === 0 ? (
                    <div className="text-sm text-ios-text3">Aucune dépense ce mois.</div>
                  ) : (
                    <div className="space-y-2">
                      {monthCat.depenses.map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between text-sm">
                          <span className="text-ios-text2">{k}</span>
                          <span className="font-semibold tabular">{formatMGA(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* En-tête imprimable */}
          <div className="print-list-header hidden print:block">
            <div className="flex items-center justify-between border-b-2 border-arina-blue/40 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <img src="/logo-arina.jpg" alt="ARINA" className="w-12 h-12 rounded-xl object-contain" />
                <div>
                  <div className="text-lg font-extrabold tracking-tight">Association ARINA — Évaluation mensuelle des transactions</div>
                  <div className="text-xs text-ios-text3">{evalMonth ? `${MONTH_NAMES[Number(evalMonth) - 1]} ` : ''}{evalYear}{evalDonor ? ` — Donateur : ${evalDonor}` : ' — Tous les donateurs'} — éditée le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                </div>
              </div>
            </div>
          </div>

          {evalMonths.every((m) => m.dons.length === 0 && m.depenses.length === 0) ? (
            <EmptyState icon="calendar" text="Aucune transaction enregistrée pour cette année — les 12 mois apparaîtront ici avec leurs totaux automatiques." />
          ) : (
            <div className="overflow-x-auto pb-2 eval-scroll">
              <div className="flex gap-4 min-w-max eval-months">
                {evalMonths.map((m) => (
                  <div key={m.key} className={`eval-month w-[260px] flex-shrink-0 card-apple p-4 ${m.dons.length === 0 && m.depenses.length === 0 ? 'opacity-45' : ''}`}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm">{m.name}</h4>
                      <span className="text-[10px] text-ios-text3">{evalYear}</span>
                    </div>

                    {/* Dons reçus (détail par date) */}
                    <div className="mt-3">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Dons reçus</div>
                      {m.dons.length === 0 ? (
                        <div className="text-xs text-ios-text3 mt-1">—</div>
                      ) : (
                        <div className="mt-1 space-y-1">
                          {m.dons.map((d) => (
                            <div key={d.id} className="text-[11px] py-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-ios-text3 whitespace-nowrap">{fmtDate(d.date)}</span>
                                <span className="text-ios-text2 font-medium truncate">{d.categorie}</span>
                                <span className="font-semibold tabular text-emerald-600 dark:text-emerald-400">{formatMGA(d.montant)}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-ios-text3 truncate">
                                <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: donorColor(donors, d.donor) }} />
                                {d.donor || 'Sans donateur'}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-1.5 flex items-center justify-between border-t border-ios-hairline pt-1.5 text-xs">
                        <span className="font-semibold">DON REÇUS</span>
                        <span className="font-bold tabular text-emerald-600 dark:text-emerald-400">{formatMGA(m.donTotal)}</span>
                      </div>
                    </div>

                    {/* Dépenses (QT / PU / MNT) */}
                    <div className="mt-4">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-red-500 dark:text-red-400">Dépenses</div>
                      {m.depenses.length === 0 ? (
                        <div className="text-xs text-ios-text3 mt-1">—</div>
                      ) : (
                        <table className="w-full text-[11px] mt-1">
                          <thead>
                            <tr className="text-ios-text3">
                              <th className="text-left font-medium py-0.5">Date</th>
                              <th className="text-left font-medium py-0.5">Désignation</th>
                              <th className="text-right font-medium py-0.5">QT</th>
                              <th className="text-right font-medium py-0.5">PU</th>
                              <th className="text-right font-medium py-0.5">MNT</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-ios-hairline/60">
                            {m.depenses.map((d) => (
                              <tr key={d.id}>
                                <td className="py-1 text-ios-text3 whitespace-nowrap">{fmtDate(d.date)}</td>
                                <td className="py-1 text-ios-text2 truncate max-w-[96px]">
                                  {d.categorie}{d.description ? ` · ${d.description}` : ''}
                                  <span className="block text-[10px] text-ios-text3 flex items-center gap-1 truncate">
                                    <span className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: donorColor(donors, d.donor) }} />
                                    {d.donor || 'Sans donateur'}
                                  </span>
                                </td>
                                <td className="py-1 text-right tabular">{d.quantity ?? '—'}</td>
                                <td className="py-1 text-right tabular">{d.unit_price != null ? formatMGA(d.unit_price) : '—'}</td>
                                <td className="py-1 text-right font-semibold tabular">{formatMGA(d.montant)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <div className="mt-1.5 flex items-center justify-between border-t border-ios-hairline pt-1.5 text-xs">
                        <span className="font-semibold">TOTAL DÉPENSE</span>
                        <span className="font-bold tabular text-red-500 dark:text-red-400">{formatMGA(m.depTotal)}</span>
                      </div>
                    </div>

                    {/* Solde mensuel : dons − dépenses */}
                    <div className="mt-2.5 flex items-center justify-between rounded-lg bg-ios-fill px-2.5 py-2 text-xs">
                      <span className="font-semibold">SOLDE</span>
                      <span className={`font-bold tabular ${m.solde >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatMGA(m.solde)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════ DONATEURS (partenaires financiers) ═══════════ */}
      {tab === 'donateurs' && (
        <div className="space-y-4 animate-fade-up">
          <div className="flex flex-wrap items-center gap-3">
            {[
              { label: 'Donateurs', value: donors.length, c: 'text-arina-blue' },
              { label: 'Dons reçus', value: donorStats.reduce((s, d) => s + d.dons, 0), c: 'text-emerald-600 dark:text-emerald-400', fmt: formatMGA },
              { label: 'Dépenses', value: donorStats.reduce((s, d) => s + d.depenses, 0), c: 'text-red-500 dark:text-red-400', fmt: formatMGA },
            ].map((s, i) => (
              <div key={i} className="card-apple p-5 flex-1 min-w-[140px]">
                <div className={`text-xl lg:text-2xl font-extrabold tabular ${s.c}`}>{s.fmt ? s.fmt(s.value) : s.value}</div>
                <div className="text-xs text-ios-text3 mt-0.5">{s.label}</div>
              </div>
            ))}
            <button onClick={() => openDonorForm(null)} className={`${primaryBtn} ml-auto inline-flex items-center gap-1.5`}>
              <Icon name="plus" className="w-4 h-4" /> Ajouter un donateur
            </button>
          </div>

          <div className="card-apple overflow-hidden">
            {donorStats.length === 0 ? (
              <EmptyState icon="handshake" text="Aucun donateur — ajoutez vos partenaires financiers (Ravinala, Horizon, Grandir Dignement…)." action={<button onClick={() => openDonorForm(null)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-arina-blue text-white text-sm font-semibold"><Icon name="plus" className="w-4 h-4" /> Ajouter un donateur</button>} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ios-fill">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-ios-text3">Donateur</th>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-ios-text3">Besoin financé</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-ios-text3">Dons reçus</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-ios-text3">Dépenses</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-ios-text3">Solde</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-ios-text3">Transactions</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ios-hairline">
                    {donorStats.map((d) => (
                      <tr key={d.id} className="hover:bg-ios-fill transition-colors">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: donorColor(donors, d.name) }}>
                              {d.name.slice(0, 1).toUpperCase()}
                            </span>
                            <span className="font-semibold">{d.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ios-text2">{d.need || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular text-emerald-600 dark:text-emerald-400">{formatMGA(d.dons)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular text-red-500 dark:text-red-400">{formatMGA(d.depenses)}</td>
                        <td className={`px-4 py-3 text-right font-bold tabular ${d.solde >= 0 ? 'text-arina-blue' : 'text-red-600 dark:text-red-400'}`}>{formatMGA(d.solde)}</td>
                        <td className="px-4 py-3 text-right tabular text-ios-text2">{d.count}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => exportDonorReport(d)} className="p-2 rounded-lg text-ios-text3 hover:text-emerald-600 hover:bg-emerald-500/10 transition-colors" title="Exporter le rapport Excel complet (dépenses + revenus)"><Icon name="file" className="w-4 h-4" /></button>
                            <button onClick={() => openDonorForm(d)} className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors" title="Modifier"><Icon name="edit" className="w-4 h-4" /></button>
                            <button onClick={() => removeDonor(d)} className="p-2 rounded-lg text-ios-text3 hover:text-red-600 hover:bg-red-500/10 transition-colors" title="Supprimer"><Icon name="trash" className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card-apple p-5">
            <h3 className="font-bold text-sm">Comment ça marche ?</h3>
            <p className="text-sm text-ios-text2 mt-2 leading-relaxed">
              Chaque transaction (don ou dépense) est rattachée au donateur qui la finance. Dans l'onglet <span className="font-semibold">Évaluation</span>, choisissez le mois puis <span className="font-semibold">« Exporter Excel »</span> pour télécharger le rapport détaillé. Pour le rapport complet d'un donateur, cliquez sur l'icône <Icon name="file" className="w-3.5 h-3.5 inline-block" /> de sa ligne — parfait pour faire le point avec chaque partenaire (Ravinala, Horizon, Grandir Dignement…).
            </p>
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
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-ios-text3 mb-1.5">Recommandation du professeur</label>
                    <textarea
                      rows={5}
                      placeholder="Inscrivez ici la recommandation du professeur pour cet enfant (plusieurs lignes)..."
                      value={benefForm.dossier.arina.recommandation}
                      onChange={setDoss('arina', 'recommandation')}
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
                <h3 className="font-bold">{editingFin ? 'Modifier la transaction' : 'Ajouter une transaction'}</h3>
                <p className="text-xs text-ios-text3">Revenu ou dépense — MNT calculé automatiquement (QT × PU)</p>
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
              <div>
                <label className="block text-xs font-semibold text-ios-text2 mb-1">Donateur <span className="text-arina-blue">*</span></label>
                <select value={financeForm.donor} onChange={(e) => setFinanceForm({ ...financeForm, donor: e.target.value })} className={inputClass}>
                  <option value="">— Sélectionner le donateur —</option>
                  {financeForm.donor && !donors.some((d) => d.name === financeForm.donor) && (
                    <option value={financeForm.donor}>Conserver : {financeForm.donor}</option>
                  )}
                  {donors.map((d) => <option key={d.id} value={d.name}>{d.name}{d.need ? ` — ${d.need}` : ''}</option>)}
                </select>
                <p className="text-[10px] text-ios-text3 mt-1">Chaque don / dépense est rattaché au partenaire qui le finance (ex. Ravinala → salaire).</p>
              </div>
              {financeForm.type === 'Dépense' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-ios-text2 mb-1">Quantité (QT)</label>
                      <input type="number" min="0" placeholder="Ex. 3" value={financeForm.quantity} onChange={(e) => setFinanceForm({ ...financeForm, quantity: e.target.value })} className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ios-text2 mb-1">Prix unitaire (PU)</label>
                      <input type="number" min="0" placeholder="Ex. 160000" value={financeForm.unit_price} onChange={(e) => setFinanceForm({ ...financeForm, unit_price: e.target.value })} className={inputClass} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-ios-fill px-3.5 py-3">
                    <span className="text-sm text-ios-text2">Montant (MNT = QT × PU)</span>
                    <span className="text-sm font-bold tabular">{finAutoMnt ? formatMGA(finAutoMnt) : formatMGA(Number(financeForm.montant) || 0)}</span>
                  </div>
                  {finAutoMnt === 0 && (
                    <input type="number" placeholder="Montant direct (Ar) — utilisé si QT × PU non renseigné" value={financeForm.montant} onChange={(e) => setFinanceForm({ ...financeForm, montant: e.target.value })} className={inputClass} />
                  )}
                </>
              ) : (
                <input type="number" placeholder="Montant (Ar)" value={financeForm.montant} onChange={(e) => setFinanceForm({ ...financeForm, montant: e.target.value })} className={inputClass} />
              )}
              <textarea
                placeholder="Description (détail de la dépense — plusieurs lignes possibles)"
                value={financeForm.description}
                onChange={(e) => setFinanceForm({ ...financeForm, description: e.target.value })}
                rows={2}
                className={`${inputClass} resize-y min-h-[44px]`}
              />
              <input type="date" value={financeForm.date} onChange={(e) => setFinanceForm({ ...financeForm, date: e.target.value })} className={inputClass} />
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowFinanceForm(false)} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Annuler</button>
              <button onClick={saveFinance} className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — formulaire donateur */}
      {showDonorForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setShowDonorForm(false)}>
          <div className="card-apple w-full max-w-md animate-pop overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 pt-5 pb-4 border-b border-ios-hairline">
              <h3 className="font-bold">{editingDonor ? 'Modifier le donateur' : 'Ajouter un donateur'}</h3>
              <p className="text-xs text-ios-text3 mt-0.5">Partenaire financier et besoin qu'il finance</p>
            </div>
            <div className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ios-text2 mb-1">Nom du donateur <span className="text-arina-blue">*</span></label>
                <input value={donorForm.name} onChange={(e) => setDonorForm({ ...donorForm, name: e.target.value })} placeholder="Ex. Ravinala" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ios-text2 mb-1">Besoin financé</label>
                <input value={donorForm.need} onChange={(e) => setDonorForm({ ...donorForm, need: e.target.value })} placeholder="Ex. Salaire, Sakafo, Formation…" className={inputClass} />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowDonorForm(false)} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Annuler</button>
              <button onClick={saveDonor} className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification de sauvegarde (base de données) */}
      <Toast toast={toast} onClose={closeToast} />
    </AdminLayout>
  );
}
