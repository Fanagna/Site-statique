import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Toast from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import {
  fetchBeneficiaries, createBeneficiary, updateBeneficiary, deleteBeneficiary,
  fetchBeneficiaryBadge, fetchBeneficiaryBadgePdf,
  fetchFinances, createFinance, updateFinance, deleteFinance,
  fetchDonors, createDonor, updateDonor, deleteDonor,
  fetchDonations, updateDonation, deleteDonation, fetchDonationReceipt, fetchEmailStatus,
  fetchNews,
  fetchContacts, deleteContact,
  fetchVolunteers, deleteVolunteer, getVolunteerAttachment,
  fetchTestimonials, updateTestimonial, deleteTestimonial,
  fetchActivity,
  fetchTodayPresence,
  fetchUsers, createUser, deleteUser, resetUserPassword,
} from '../../services/api';

// Accès localStorage protégé : une panne de stockage ne doit jamais planter l'app
import { safeGet, safeSet, safeParse } from '../../utils/storage';

// Rôles & onglets autorisés (source unique : ./roles)
import { ROLES, ROLE_LABELS, ROLE_TABS } from './roles';
import { allNews } from '../../data/news';
import { CheckCircle2, Download, Hand, Printer } from 'lucide-react';
import AdminLayout from '../../components/admin/AdminLayout';
import { Icon } from '../../components/admin/icons';
import {
  inputClass, CountUp, EmptyState, Th,
} from '../../components/admin/ui';
import {
  formatMGA, today, fmtDate, timeAgo, initials, donorColor,
} from '../../components/admin/utils';
import { exportEvaluationXlsx } from '../../components/admin/ExcelTools';
import {
  DonorDonut, DonorExpenseBars, DonorMonthlyStacked,
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
  const [testimonials, setTestimonials] = useState([]);
  const [donations, setDonations] = useState([]);
  const [activity, setActivity] = useState([]);
  const [users, setUsers] = useState([]);
  const [benefsLoading, setBenefsLoading] = useState(true);
  const [financesLoading, setFinancesLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState(null); // diagnostic envoi des reçus (Resend)

  /* ── UI state ── */
  const [query, setQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [expandedMsg, setExpandedMsg] = useState(null);
  const [expandedVol, setExpandedVol] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null); // don dont on prévisualise le reçu
  const [confirmDonation, setConfirmDonation] = useState(null); // don en attente de confirmation (modale taux)
  const [confirmRate, setConfirmRate] = useState(''); // taux de conversion EUR → Ar saisi à la confirmation
  const [confirmSubmitting, setConfirmSubmitting] = useState(false); // anti double-clic
  const [receiptUrl, setReceiptUrl] = useState(null); // URL Blob du PDF
  const [receiptLoading, setReceiptLoading] = useState(false);
  const receiptUrlRef = useRef(null); // toujours l'URL Blob courante (libérée au démontage)

  // Libère l'URL Blob du reçu si l'admin quitte la page avec la modale ouverte (pas de fuite mémoire)
  useEffect(() => () => { if (receiptUrlRef.current) URL.revokeObjectURL(receiptUrlRef.current); }, []);
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
  const [donorForm, setDonorForm] = useState({ name: '', need: '', budget: '' });

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
    else { anyFail = true; setBenefs(safeParse(safeGet('arina_benefs'), [])); }
    setBenefsLoading(false);

    const fFromApi = await fetchFinances();
    if (fFromApi !== null) { anyOk = true; if (fFromApi.length) setFinances(fFromApi); else setFinances([]); }
    else { anyFail = true; setFinances(safeParse(safeGet('arina_finances'), [])); }
    setFinancesLoading(false);

    // Diagnostic email (Resend) : affiché en bannière dans l'onglet Dons si non configuré
    const eFromApi = await fetchEmailStatus();
    if (eFromApi?.configured != null) setEmailStatus(eFromApi);

    // Donateurs : nécessaires pour l'évaluation (filtre + rapports) et l'onglet dédié
    const dFromApi = await fetchDonors();
    if (dFromApi !== null && Array.isArray(dFromApi)) { anyOk = true; setDonors(dFromApi); }
    else { anyFail = true; setDonors(safeParse(safeGet('arina_donors'), [])); }

    if (can('actualites')) {
      const nFromApi = await fetchNews();
      if (nFromApi !== null) { anyOk = true; if (nFromApi.length) setNews(nFromApi); else setNews([]); }
      else { anyFail = true; setNews(allNews); }
    }

    if (can('messages')) {
      const cFromApi = await fetchContacts();
      if (cFromApi !== null) { anyOk = true; if (cFromApi.length) setContacts(cFromApi); else setContacts([]); }
      else { anyFail = true; setContacts(safeParse(safeGet('arina_contacts'), [])); }
    }

    if (can('volunteers')) {
      const vFromApi = await fetchVolunteers();
      if (vFromApi !== null) { anyOk = true; if (vFromApi.length) setVolunteers(vFromApi); else setVolunteers([]); }
      else { anyFail = true; setVolunteers(safeParse(safeGet('arina_volunteers'), [])); }
    }

    if (can('testimonials')) {
      const tFromApi = await fetchTestimonials();
      if (tFromApi !== null) { anyOk = true; if (tFromApi.length) setTestimonials(tFromApi); else setTestimonials([]); }
      else { anyFail = true; setTestimonials(safeParse(safeGet('arina_testimonials'), [])); }
    }

    if (can('dons')) {
      const dFromApi = await fetchDonations();
      if (dFromApi !== null && Array.isArray(dFromApi)) { anyOk = true; setDonations(dFromApi); }
      else { anyFail = true; setDonations(safeParse(safeGet('arina_donations'), [])); }
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

  // Rafraîchit uniquement les finances (revenus/dépenses) — appelé après la
  // confirmation d'un don pour refléter immédiatement le nouveau revenu.
  const refreshFinances = async () => {
    const f = await fetchFinances();
    if (f !== null) { if (f.length) setFinances(f); else setFinances([]); }
  };

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    // Cache « léger » : les photos sont des base64 volumineuses — elles feraient
    // dépasser le quota localStorage (le cache échouerait silencieusement).
    if (benefs.length) safeSet('arina_benefs', JSON.stringify(benefs.map((b) => ({ ...b, photo: '' }))));
  }, [benefs]);
  useEffect(() => { if (finances.length) safeSet('arina_finances', JSON.stringify(finances)); }, [finances]);
  useEffect(() => { if (donors.length) safeSet('arina_donors', JSON.stringify(donors)); }, [donors]);
  useEffect(() => {
    // Cache « léger » : les images base64 (jusqu'à 2 Mo chacune) feraient dépasser
    // le quota localStorage (~5 Mo) et planteraient l'application (écran d'erreur).
    if (news !== allNews && news.length) {
      safeSet('arina_news', JSON.stringify(news.map((n) => ({ ...n, image: '', image_url: '' }))));
    }
  }, [news]);
  useEffect(() => { if (contacts.length) safeSet('arina_contacts', JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { if (testimonials.length) safeSet('arina_testimonials', JSON.stringify(testimonials)); }, [testimonials]);
  useEffect(() => { if (donations.length) safeSet('arina_donations', JSON.stringify(donations)); }, [donations]);

  /* ── Encart « Présence du jour » (éducateur / admin) ── */
  const [todayPresence, setTodayPresence] = useState(null); // { event, total, present, late, absent, … }
  const [todayPresenceLoading, setTodayPresenceLoading] = useState(false); // squelette initial
  const [todayRefreshing, setTodayRefreshing] = useState(false); // spinner du bouton (manuel uniquement)
  const [hoveredWeekDay, setHoveredWeekDay] = useState(null); // jour de la tendance survolé (infobulle)
  const todayReqRef = useRef(0); // ignore les réponses périmées (rafraîchissements concurrents)

  const refreshTodayPresence = useCallback(async (manual = false) => {
    if (!allowedTabs.includes('presences')) return;
    const reqId = ++todayReqRef.current;
    if (manual) setTodayRefreshing(true);
    const p = await fetchTodayPresence();
    if (reqId !== todayReqRef.current) return; // une demande plus récente a pris la main
    setTodayPresence(p || null);
    setHoveredWeekDay(null); // les jours peuvent avoir changé au rafraîchissement
    setTodayPresenceLoading(false);
    if (manual) setTodayRefreshing(false);
  }, [allowedTabs]);

  // Chargement initial + rafraîchissement automatique toutes les 60 s, UNIQUEMENT
  // sur l'onglet tableau de bord (les scans se font sur une autre page).
  useEffect(() => {
    if (!allowedTabs.includes('presences') || tab !== 'dashboard') return;
    setTodayPresenceLoading(true);
    refreshTodayPresence();
    const id = window.setInterval(() => refreshTodayPresence(), 60000);
    return () => window.clearInterval(id);
  }, [allowedTabs, tab, refreshTodayPresence]);

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

  /* ── Badge QR d'un enfant (QR + PDF) ── */
  const [badgeModal, setBadgeModal] = useState(null); // { child, badgeId?, qrCode? }
  const [badgeLoading, setBadgeLoading] = useState(false);
  const badgeReqRef = useRef(null); // id de l'enfant demandé — ignore les réponses tardives (course)

  // Ouvre la modale badge : génère (ou retrouve) le badgeId + le QR code de l'enfant
  const openBadgeModal = async (child) => {
    badgeReqRef.current = child.id;
    setBadgeModal({ child });
    setBadgeLoading(true);
    const r = await fetchBeneficiaryBadge(child.id);
    if (badgeReqRef.current !== child.id) return; // un autre badge a été demandé entre-temps
    badgeReqRef.current = null;
    setBadgeLoading(false);
    if (!r.ok || !r.data) {
      setBadgeModal(null);
      showToast(`❌ Impossible de générer le badge : ${r?.error || 'base injoignable'}`, 'error');
      return;
    }
    // Mémorise le badgeId dans la liste locale (affiché dans la modale)
    setBenefs((prev) => prev.map((x) => (x.id === child.id ? { ...x, badgeId: r.data.badgeId } : x)));
    setBadgeModal({ child: { ...child, badgeId: r.data.badgeId }, badgeId: r.data.badgeId, qrCode: r.data.qrCode });
  };

  // Télécharge le badge PDF complet (logo + photo + QR + identité)
  const downloadBenefBadge = async (child) => {
    showToast('⏳ Génération du badge PDF…');
    const url = await fetchBeneficiaryBadgePdf(child.id);
    const badgeId = child.badgeId || `ARINA-${String(child.id).padStart(4, '0')}`;
    if (!url) { showToast('❌ Impossible de générer le PDF (base injoignable ?)', 'error'); return; }
    const el = document.createElement('a');
    el.href = url;
    el.download = `badge-${badgeId}.pdf`;
    document.body.appendChild(el);
    el.click();
    el.remove();
    // Révocation différée : le téléchargement d'un badge (photo + logo) peut être lent
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    showToast(`✅ Badge de ${child.prenom} ${child.nom} généré`);
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
    if (d) { setEditingDonor(d); setDonorForm({ name: d.name || '', need: d.need || '', budget: d.budget != null && Number(d.budget) > 0 ? String(Number(d.budget)) : '' }); }
    else { setEditingDonor(null); setDonorForm({ name: '', need: '', budget: '' }); }
    setShowDonorForm(true);
  };
  const saveDonor = async () => {
    if (!donorForm.name.trim()) { showToast('❌ Le nom du donateur est requis', 'error'); return; }
    const payload = {
      name: donorForm.name.trim(),
      need: donorForm.need.trim(),
      budget: donorForm.budget !== '' && Number(donorForm.budget) > 0 ? Number(donorForm.budget) : 0,
    };
    const r = editingDonor ? await updateDonor(editingDonor.id, payload) : await createDonor(payload);
    if (!r.ok) { showToast(`❌ Donateur NON enregistré dans la base : ${r.error}`, 'error'); return; }
    if (editingDonor) setDonors(donors.map((d) => (d.id === editingDonor.id ? r.data : d)));
    else setDonors([...donors, r.data]);
    showToast(`✅ Donateur « ${r.data.name} » ${editingDonor ? 'modifié' : 'ajouté'} dans la base`);
    setShowDonorForm(false);
    setDonorForm({ name: '', need: '', budget: '' });
    setEditingDonor(null);
  };
  const removeDonor = async (d) => {
    if (!confirm(`Supprimer le donateur « ${d.name} » ? Les transactions existantes conserveront son nom.`)) return;
    const r = await deleteDonor(d.id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    setDonors(donors.filter((x) => x.id !== d.id));
    showToast(`✅ Donateur « ${d.name} » retiré de la liste`);
  };

  /* Stats agrégées par donateur (pour l'onglet Donateurs) + suivi budgétaire.
     Le budget est ANNUEL : la comparaison (pct/restant/dépassement) se fait sur les
     dépenses de l'ANNÉE EN COURS uniquement (cohérent avec l'alerte email backend).
     Les totaux globaux (dons/depenses) restent calculés sur tout l'historique. */
  const donorStats = useMemo(() => {
    const nowYear = String(new Date().getFullYear());
    const map = {};
    donors.forEach((d) => { map[d.name] = { ...d, dons: 0, depenses: 0, depensesAn: 0, budget: Number(d.budget) || 0 }; });
    finances.forEach((f) => {
      const k = f.donor;
      if (!k || !map[k]) return;
      const v = Number(f.montant) || 0;
      if (f.type === 'Revenu') map[k].dons += v;
      else {
        map[k].depenses += v;
        if (monthKey(f.date).startsWith(nowYear)) map[k].depensesAn += v;
      }
    });
    return Object.values(map).map((d) => ({
      ...d,
      restant: Math.max(0, d.budget - d.depensesAn),
      pct: d.budget > 0 ? Math.min(150, Math.round((d.depensesAn / d.budget) * 100)) : 0,
      depasse: d.budget > 0 && d.depensesAn > d.budget,
    }));
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

  /* ── Témoignages : publier / dépublier + supprimer ── */
  const toggleTestimonial = async (t) => {
    const next = t.status === 'published' ? 'pending' : 'published';
    const r = await updateTestimonial(t.id, { status: next });
    if (!r.ok) {
      showToast(`❌ ${next === 'published' ? 'Publication' : 'Retrait'} NON enregistré dans la base : ${r.error}`, 'error');
      return;
    }
    setTestimonials(testimonials.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    showToast(next === 'published' ? `✅ Témoignage de ${t.name} publié sur le site` : `Témoignage de ${t.name} remis en attente`);
  };
  const removeTestimonial = async (id) => {
    if (!confirm('Supprimer ce témoignage ?')) return;
    const r = await deleteTestimonial(id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    setTestimonials(testimonials.filter((t) => t.id !== id));
    showToast('✅ Témoignage supprimé de la base de données');
  };

  /* ── Dons : confirmer la réception d'une promesse / remettre en attente ── */
  // Confirmer un don « reçu » ouvre une modale pour saisir le taux EUR → Ar
  // (le revenu est enregistré en Ariary). Remettre en attente reste direct.
  const toggleDonation = (d) => {
    if (d.status !== 'received') {
      setConfirmRate(safeGet('arina_eur_rate') || '');
      setConfirmDonation(d);
      return;
    }
    // Retour en « à confirmer » : aucun taux requis
    updateDonation(d.id, { status: 'pledge' }).then((r) => {
      if (!r.ok) { showToast(`❌ Statut NON enregistré dans la base : ${r.error}`, 'error'); return; }
      setDonations(donations.map((x) => (x.id === d.id ? { ...x, ...(r.data || {}) } : x)));
      refreshFinances();
      showToast(r.data?.incomeRemoved ? `Promesse de ${d.name} remise en attente — revenu retiré des finances` : `Promesse de ${d.name} remise en attente`);
    });
  };

  const doConfirmDonation = async () => {
    const d = confirmDonation;
    if (!d || confirmSubmitting) return; // anti double-clic
    const rate = confirmRate.trim();
    if (rate !== '' && (!Number.isFinite(Number(rate)) || Number(rate) <= 0)) {
      showToast('❌ Le taux de conversion doit être un nombre positif', 'error');
      return;
    }
    const body = { status: 'received' };
    if (rate !== '') {
      body.rate = Number(rate);
      safeSet('arina_eur_rate', rate); // taux mémorisé pour la prochaine fois
    }
    setConfirmSubmitting(true);
    const r = await updateDonation(d.id, body);
    setConfirmSubmitting(false);
    if (!r.ok) { showToast(`❌ Statut NON enregistré dans la base : ${r.error}`, 'error'); return; }
    setDonations(donations.map((x) => (x.id === d.id ? { ...x, ...(r.data || {}) } : x)));
    // Le revenu est déjà en base : on rafraîchit les finances pour que KPI,
    // graphiques, Évaluation et exports reflètent immédiatement le changement.
    refreshFinances();
    // Devise réelle du revenu : « Ar » si converti (taux saisi), sinon la devise d'origine
    const converted = !!r.data?.rateUsed && r.data.rateUsed > 0;
    const income = r.data?.incomeCreated
      ? ` · revenu de ${Number(r.data.incomeAmount || 0).toLocaleString('fr-FR')}${converted ? ' Ar' : ` ${d.currency || '€'}`} ajouté${converted ? '' : ' (non converti)'}`
      : '';
    const emailNote = !r.data?.receiptEmailSent && r.data?.receiptEmailReason
      ? ` — reçu NON envoyé : ${r.data.receiptEmailReason}`
      : '';
    showToast(
      r.data?.receiptEmailSent
        ? `✅ Don de ${d.name} confirmé — reçu PDF envoyé à ${d.email}${income}`
        : `✅ Don de ${d.name} confirmé comme reçu${income}${emailNote}`,
      r.data?.receiptEmailSent ? 'success' : 'warning',
    );
    setConfirmDonation(null);
  };
  const removeDonation = async (id) => {
    if (!confirm('Supprimer cette promesse de don ?')) return;
    const r = await deleteDonation(id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    setDonations(donations.filter((d) => d.id !== id));
    showToast('✅ Promesse de don supprimée de la base de données');
  };

  /* Aperçu du reçu PDF avant confirmation (même PDF que celui envoyé par email).
     La modale s'ouvre immédiatement (état de chargement visible), l'URL arrive ensuite. */
  const viewReceipt = async (d) => {
    if (receiptUrlRef.current) URL.revokeObjectURL(receiptUrlRef.current);
    receiptUrlRef.current = null;
    setReceiptUrl(null);
    setReceiptPreview(d);
    setReceiptLoading(true);
    const url = await fetchDonationReceipt(d.id);
    setReceiptLoading(false);
    if (!url) { showToast('❌ Impossible de générer le reçu — réessayez.', 'error'); return; }
    receiptUrlRef.current = url;
    setReceiptUrl(url);
  };
  const closeReceipt = () => {
    if (receiptUrlRef.current) URL.revokeObjectURL(receiptUrlRef.current);
    receiptUrlRef.current = null;
    setReceiptUrl(null);
    setReceiptPreview(null);
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
  const filteredTestimonials = useMemo(() => {
    if (!q) return testimonials;
    return testimonials.filter((t) => `${t.name} ${t.quote} ${t.location} ${t.role}`.toLowerCase().includes(q));
  }, [testimonials, q]);
  const filteredDonations = useMemo(() => {
    if (!q) return donations;
    return donations.filter((d) => `${d.name} ${d.email} ${d.method || ''}`.toLowerCase().includes(q));
  }, [donations, q]);

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
    ...(allowedTabs.includes('testimonials') ? testimonials.slice(0, 3).map((t) => ({ id: `lt${t.id}`, type: 'testimonial', text: t.status === 'published' ? `Témoignage publié : ${t.name}` : `Témoignage reçu : ${t.name}`, date: t.created_at })) : []),
    ...(allowedTabs.includes('dons') ? donations.slice(0, 3).map((d) => ({ id: `ld${d.id}`, type: 'donation', text: d.status === 'received' ? `Don reçu : ${d.name} (${Number(d.amount) || 0} €)` : `Promesse de don : ${d.name}`, date: d.created_at })) : []),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10), [allowedTabs, news, finances, benefs, volunteers, contacts, testimonials, donations]);
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
    // Alertes budget : un donateur dépasse son budget annuel accordé
    donorStats.filter((d) => d.depasse).forEach((d) => {
      a.push({
        level: 'error', icon: 'trendDown',
        text: `⚠️ Budget dépassé — ${d.name} : ${formatMGA(d.depensesAn - d.budget)} au-delà de son budget ${new Date().getFullYear()}`,
        tab: 'donateurs',
      });
    });
    const pendingTest = testimonials.filter((t) => t.status === 'pending').length;
    if (allowedTabs.includes('testimonials') && pendingTest > 0) a.push({ level: 'info', icon: 'star', text: `${pendingTest} témoignage${pendingTest > 1 ? 's' : ''} en attente de validation`, tab: 'testimonials' });
    const pendingDonations = donations.filter((d) => d.status === 'pledge').length;
    if (allowedTabs.includes('dons') && pendingDonations > 0) a.push({ level: 'info', icon: 'heart', text: `${pendingDonations} promesse${pendingDonations > 1 ? 's' : ''} de don à confirmer`, tab: 'dons' });
    return a;
  }, [allowedTabs, solde, finances.length, totalDepenses, totalRevenus, contacts.length, volunteers.length, news.length, donorStats, testimonials, donations]);

  /* Base connectée mais vide — selon les données que le rôle a le droit de voir */
  const dbEmpty = apiStatus === 'online' && benefs.length === 0 && finances.length === 0 && (!allowedTabs.includes('actualites') || news.length === 0);

  /* Navigation config for the layout (filtrée par rôle) */
  const principalItems = [];
  if (allowedTabs.includes('actualites')) principalItems.push({ key: 'actualites', label: 'Actualités', icon: 'file', to: '/admin/actualites' });
  if (allowedTabs.includes('enfants')) principalItems.push({ key: 'enfants', label: 'Enfants', icon: 'users' });
  if (allowedTabs.includes('finances')) principalItems.push({ key: 'finances', label: 'Finances', icon: 'wallet' });
  if (allowedTabs.includes('evaluation')) principalItems.push({ key: 'evaluation', label: 'Évaluation', icon: 'calendar' });
  if (allowedTabs.includes('donateurs')) principalItems.push({ key: 'donateurs', label: 'Donateurs', icon: 'handshake' });
  if (allowedTabs.includes('dons')) principalItems.push({ key: 'dons', label: 'Dons', icon: 'heart', badge: () => donations.filter((d) => d.status === 'pledge').length });
  if (allowedTabs.includes('presences')) principalItems.push({ key: 'presences', label: 'Présences', icon: 'calendar', to: '/admin/presences' });
  if (allowedTabs.includes('scan')) principalItems.push({ key: 'scan', label: 'Scanner', icon: 'send', to: '/admin/scan' });
  const communicationItems = [];
  if (allowedTabs.includes('messages')) communicationItems.push({ key: 'messages', label: 'Messages', icon: 'mail', badge: () => contacts.length });
  if (allowedTabs.includes('volunteers')) communicationItems.push({ key: 'volunteers', label: 'Candidatures', icon: 'users', badge: () => volunteers.length });
  if (allowedTabs.includes('testimonials')) communicationItems.push({ key: 'testimonials', label: 'Témoignages', icon: 'star', badge: () => testimonials.filter((t) => t.status === 'pending').length });
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
    dons: { title: 'Dons', subtitle: "Promesses de don des visiteurs — à confirmer à réception" },
    messages: { title: 'Messages', subtitle: 'Demandes reçues via le site' },
    volunteers: { title: 'Candidatures bénévoles', subtitle: 'Bénévoles avec leur lettre de motivation' },
    testimonials: { title: 'Témoignages', subtitle: "Témoignages envoyés par les visiteurs — à valider avant publication" },
    comptes: { title: 'Comptes', subtitle: "Utilisateurs et rôles de l'espace admin" },
  };
  const currentMeta = meta[tab] || meta.dashboard;
  const searchPlaceholder = {
    dashboard: 'Rechercher…',
    enfants: 'Rechercher un enfant…',
    finances: 'Rechercher une transaction…',
    evaluation: 'Rechercher une transaction…',
    donateurs: 'Rechercher un donateur…',
    dons: 'Rechercher une promesse de don…',
    messages: 'Rechercher un message…',
    volunteers: 'Rechercher un bénévole…',
    testimonials: 'Rechercher un témoignage…',
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

  // Dernier jour de la tendance 7 jours (= aujourd'hui côté serveur) — pour surligner la barre
  const weekLastDate = todayPresence?.week?.length ? todayPresence.week[todayPresence.week.length - 1].date : null;

  const quickActions = [
    ...(allowedTabs.includes('actualites') ? [{ label: 'Nouvelle actu', icon: 'file', color: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/25', action: () => navigate('/admin/actualites?new=1') }] : []),
    ...(allowedTabs.includes('enfants') ? [{ label: 'Nouvel enfant', icon: 'users', color: 'bg-arina-warm text-arina-blue hover:bg-[#F6E9E4] dark:hover:bg-white/10', action: () => { setTab('enfants'); setTimeout(() => openBenefForm(null), 120); } }] : []),
    ...(allowedTabs.includes('finances') ? [
      { label: 'Nouveau revenu', icon: 'trendUp', color: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25', action: () => { setTab('finances'); setEditingFin(null); setFinanceForm({ type: 'Revenu', categorie: 'Don', montant: '', quantity: '', unit_price: '', description: '', date: today() }); setTimeout(() => setShowFinanceForm(true), 120); } },
      { label: 'Nouvelle dépense', icon: 'trendDown', color: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/25', action: () => { setTab('finances'); setEditingFin(null); setFinanceForm({ type: 'Dépense', categorie: 'Alimentation', montant: '', quantity: '', unit_price: '', description: '', date: today() }); setTimeout(() => setShowFinanceForm(true), 120); } },
    ] : []),
    ...(allowedTabs.includes('messages') ? [{ label: 'Messages', icon: 'mail', color: 'bg-ios-fill text-ios-text hover:bg-ios-fill-2', action: () => setTab('messages') }] : []),
    ...(allowedTabs.includes('volunteers') ? [{ label: 'Candidatures', icon: 'users', color: 'bg-ios-fill text-ios-text hover:bg-ios-fill-2', action: () => setTab('volunteers') }] : []),
    ...(allowedTabs.includes('testimonials') ? [{ label: 'Témoignages', icon: 'star', color: 'bg-ios-fill text-ios-text hover:bg-ios-fill-2', action: () => setTab('testimonials') }] : []),
    ...(allowedTabs.includes('dons') ? [{ label: 'Dons', icon: 'heart', color: 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/25', action: () => setTab('dons') }] : []),
  ];

  const activityMeta = {
    news: { icon: 'file', cls: 'bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400' },
    income: { icon: 'trendUp', cls: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
    expense: { icon: 'trendDown', cls: 'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400' },
    beneficiary: { icon: 'users', cls: 'bg-arina-warm text-arina-blue' },
    volunteer: { icon: 'users', cls: 'bg-sky-100 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400' },
    message: { icon: 'mail', cls: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' },
    testimonial: { icon: 'star', cls: 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400' },
    donation: { icon: 'heart', cls: 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400' },
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

          {/* ── Encart « Présence du jour » (éducateur / admin) ── */}
          {allowedTabs.includes('presences') && (
            <div className="card-apple overflow-hidden animate-fade-up" style={{ animationDelay: '140ms' }}>
              <div className="px-5 py-4 border-b border-ios-hairline flex flex-wrap items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-arina-warm text-arina-blue flex items-center justify-center flex-shrink-0">
                  <Icon name="calendar" className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold flex items-center gap-2">
                    🌞 Présence du jour
                    {todayPresence?.event && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold">Quotidien</span>
                    )}
                  </h3>
                  <p className="text-xs text-ios-text3">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} — pointage par badge QR</p>
                </div>
                <button
                  onClick={() => refreshTodayPresence(true)}
                  className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors"
                  title="Actualiser"
                >
                  <Icon name="refreshCw" className={`w-4 h-4 ${todayRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <Link to="/admin/scan" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-arina-blue text-white text-xs font-semibold hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-all">
                  <Icon name="send" className="w-3.5 h-3.5" /> Scanner
                </Link>
                <Link to="/admin/presences" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-ios-fill text-ios-text2 text-xs font-semibold hover:bg-ios-fill-2 hover:text-arina-blue transition-all">
                  <Icon name="activity" className="w-3.5 h-3.5" /> Présences
                </Link>
              </div>

              {todayPresenceLoading && !todayPresence ? (
                <div className="p-6 space-y-3"><div className="skeleton h-24" /></div>
              ) : !todayPresence?.event ? (
                <div className="px-5 py-6 flex flex-col sm:flex-row sm:items-center gap-3">
                  <Icon name={apiStatus === 'offline' ? 'alertCircle' : 'activity'} className={`w-8 h-8 flex-shrink-0 ${apiStatus === 'offline' ? 'text-amber-500' : 'text-ios-text3'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{apiStatus === 'offline' ? 'Compteurs indisponibles' : "Aucun pointage aujourd'hui"}</p>
                    <p className="text-xs text-ios-text3 mt-0.5">
                      {apiStatus === 'offline'
                        ? 'La base de données est injoignable — les présences du jour ne peuvent pas être chargées.'
                        : "La session « Présence du jour » sera créée automatiquement au premier scan d'un badge."}
                    </p>
                  </div>
                  {apiStatus !== 'offline' && (
                    <Link to="/admin/scan" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-arina-blue text-white text-sm font-semibold hover:bg-arina-blue-dark transition-all">
                      <Icon name="send" className="w-4 h-4" /> Ouvrir le scanner
                    </Link>
                  )}
                </div>
              ) : (
                <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-ios-hairline">
                  {[
                    { icon: 'check', label: 'Sur place', value: todayPresence.present, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', sub: `${todayPresence.entries} entrée${todayPresence.entries > 1 ? 's' : ''} · ${todayPresence.exits} sortie${todayPresence.exits > 1 ? 's' : ''}` },
                    { icon: 'clock', label: 'Retardataires', value: todayPresence.late, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', sub: `entré(e)s après ${todayPresence.startTime}` },
                    { icon: 'x', label: 'Absents', value: todayPresence.absent, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-500/10', sub: `sur ${todayPresence.total} actif${todayPresence.total > 1 ? 's' : ''}` },
                    { icon: 'trendUp', label: 'Taux de présence', value: `${todayPresence.attendanceRate}%`, color: 'text-arina-blue', bg: 'bg-arina-warm', sub: `${todayPresence.entered} pointé${todayPresence.entered > 1 ? 's' : ''} / ${todayPresence.total}` },
                  ].map((s) => (
                    <div key={s.label} className="bg-ios-card p-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-lg ${s.bg} ${s.color} flex items-center justify-center`}>
                          <Icon name={s.icon} className="w-3.5 h-3.5" />
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-ios-text3">{s.label}</span>
                      </div>
                      <div className={`text-[24px] lg:text-[28px] font-bold tracking-tight tabular mt-2 ${s.color}`}>{s.value}</div>
                      <div className="text-[11px] text-ios-text3 mt-0.5">{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-3.5 border-t border-ios-hairline">
                  <div className="flex items-center justify-between text-[11px] text-ios-text3 mb-1.5">
                    <span>{todayPresence.entered} / {todayPresence.total} enfant{todayPresence.total > 1 ? 's' : ''} pointé{todayPresence.entered > 1 ? 's' : ''} aujourd'hui</span>
                    <span className="font-bold text-arina-blue">{todayPresence.attendanceRate}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-ios-fill overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-arina-blue" style={{ width: `${Math.min(100, todayPresence.attendanceRate)}%` }} />
                  </div>
                  {(todayPresence.lateNames?.length > 0 || todayPresence.absentNames?.length > 0) && (
                    <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-ios-text3">
                      {todayPresence.lateNames.length > 0 && (
                        <span>⏰ Retards : <span className="text-amber-600 dark:text-amber-400 font-medium">{todayPresence.lateNames.join(', ')}{todayPresence.late > todayPresence.lateNames.length ? ` +${todayPresence.late - todayPresence.lateNames.length} autre(s)` : ''}</span></span>
                      )}
                      {todayPresence.absentNames.length > 0 && (
                        <span>🚫 Absents : <span className="text-red-500 font-medium">{todayPresence.absentNames.join(', ')}{todayPresence.absent > todayPresence.absentNames.length ? ` +${todayPresence.absent - todayPresence.absentNames.length} autre(s)` : ''}</span></span>
                      )}
                    </div>
                  )}
                </div>
                </>
              )}

              {/* Tendance 7 derniers jours — visible même sans session aujourd'hui */}
              {todayPresence?.week?.length > 0 && (
                <div className="px-5 py-4 border-t border-ios-hairline">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-ios-text3">Tendance 7 derniers jours</span>
                    <span className="text-[10px] text-ios-text3">taux de présence par jour</span>
                  </div>
                  <div className="flex items-stretch gap-1.5 sm:gap-2 h-28">
                    {todayPresence.week.map((d, i) => {
                      const isToday = d.date === weekLastDate;
                      const hasInfo = d.hasSession || d.entered > 0;
                      return (
                        <div
                          key={d.date}
                          className={`flex-1 min-w-0 flex flex-col items-center gap-1.5 group ${hasInfo ? 'relative' : ''}`}
                          onMouseEnter={() => hasInfo && setHoveredWeekDay(d.date)}
                          onMouseLeave={() => hasInfo && setHoveredWeekDay(null)}
                          title={hasInfo ? undefined : 'Jour sans pointage'}
                        >
                          {/* Infobulle : détail retardataires / absents du jour survolé */}
                          {hasInfo && hoveredWeekDay === d.date && (
                            <div
                              className={`absolute z-30 bottom-full mb-2 w-max max-w-[min(260px,72vw)] rounded-xl bg-gray-900/95 dark:bg-gray-800/95 text-white text-[11px] shadow-2xl backdrop-blur-sm pointer-events-none animate-pop ${i === 0 ? 'left-0' : i === todayPresence.week.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}
                            >
                              <div className="px-3 py-2.5 space-y-1.5 leading-snug">
                                <div className="font-bold flex items-center justify-between gap-4">
                                  <span className="capitalize">{d.weekday} {d.date.slice(8)}/{d.date.slice(5, 7)}</span>
                                  <span className="text-white/70 font-normal tabular">{d.entered}/{d.total} pointé(s) · {d.rate}%</span>
                                </div>
                                <div>
                                  {d.late > 0 ? (
                                    <span className="text-amber-300">⏰ Retards ({d.late}) : <span className="text-white">{d.lateNames.join(', ')}{d.late > d.lateNames.length ? ` +${d.late - d.lateNames.length} autre(s)` : ''}</span></span>
                                  ) : (
                                    <span className="text-emerald-300">⏰ Aucun retard</span>
                                  )}
                                </div>
                                <div>
                                  {d.absent > 0 ? (
                                    <span className="text-red-300">🚫 Absents ({d.absent}) : <span className="text-white">{d.absentNames.join(', ')}{d.absent > d.absentNames.length ? ` +${d.absent - d.absentNames.length} autre(s)` : ''}</span></span>
                                  ) : (
                                    <span className="text-emerald-300">✅ Tout le monde est là</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                          <div className="flex-1 w-full flex items-end justify-center">
                            {hasInfo ? (
                              <div
                                className={`w-full max-w-[24px] rounded-t-md animate-bar transition-all duration-500 group-hover:brightness-110 ${isToday ? 'bg-gradient-to-t from-arina-blue to-arina-accent' : 'bg-gradient-to-t from-emerald-500 to-emerald-400'}`}
                                style={{ height: `${Math.max(6, d.rate)}%` }}
                              />
                            ) : (
                              <div className="w-1.5 h-1.5 rounded-full bg-ios-fill mb-1" />
                            )}
                          </div>
                          <span className={`text-[10px] truncate ${isToday ? 'font-bold text-arina-blue' : 'text-ios-text3'}`}>{d.weekday}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

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
                            <button onClick={() => openBadgeModal(b)} className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors" title="Badge QR + PDF"><Icon name="qrCode" className="w-4 h-4" /></button>
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
            <div className="group relative card-apple p-5 lg:col-span-2 animate-fade-up overflow-hidden" style={{ animationDelay: '150ms' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-arina-gold to-arina-blue-dark text-white flex items-center justify-center shadow-md shadow-arina-blue/20">
                  <Icon name="wallet" className="w-[18px] h-[18px]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Suivi budgétaire {evalYear} — budget accordé vs dépensé</h3>
                  <p className="text-[11px] text-ios-text3">Restant, taux d'utilisation et alertes de dépassement par partenaire</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
                {donorStats.map((d) => (
                  <div key={d.id} className={`rounded-xl border p-4 transition-colors ${d.depasse ? 'border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/10' : d.pct >= 80 ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10' : 'border-ios-hairline bg-ios-fill/40'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: donorColor(donors, d.name) }} />
                        {d.name}
                      </span>
                      {d.depasse && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 flex-shrink-0">
                          <Icon name="trendDown" className="w-3 h-3" /> Dépassé
                        </span>
                      )}
                      {!d.depasse && d.pct >= 80 && (
                        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex-shrink-0">
                          Attention
                        </span>
                      )}
                    </div>
                    {d.budget > 0 ? (
                      <>
                        <div className="flex items-baseline justify-between mt-2.5 text-xs text-ios-text2">
                          <span>Dépensé {evalYear} <b className="tabular text-red-500 dark:text-red-400">{formatMGA(d.depensesAn)}</b> / {formatMGA(d.budget)}</span>
                          <b className={`tabular ${d.depasse ? 'text-red-600 dark:text-red-400' : 'text-ios-text'}`}>{d.pct}%</b>
                        </div>
                        <div className="h-2 rounded-full bg-ios-fill overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${d.depasse ? 'bg-gradient-to-r from-red-500 to-rose-500' : d.pct >= 80 ? 'bg-gradient-to-r from-amber-500 to-arina-gold' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`}
                            style={{ width: `${Math.min(100, d.pct)}%` }}
                          />
                        </div>
                        <div className={`text-[11px] font-semibold mt-1.5 tabular ${d.depasse ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {d.depasse ? `Dépassement : ${formatMGA(d.depensesAn - d.budget)}` : `Restant : ${formatMGA(d.restant)}`}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-ios-text3 mt-2.5">
                        Dépensé {evalYear} <b className="tabular text-red-500 dark:text-red-400">{formatMGA(d.depensesAn)}</b> — budget non défini
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="group relative card-apple p-5 lg:col-span-2 animate-fade-up overflow-hidden" style={{ animationDelay: '200ms' }}>
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
              { label: 'Budgets annuels', value: donorStats.reduce((s, d) => s + d.budget, 0), c: 'text-arina-blue', fmt: formatMGA },
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
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-ios-text3">Budget annuel</th>
                      <th className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide text-ios-text3">Utilisation du budget</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-ios-text3">Dons reçus</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-ios-text3">Dépenses</th>
                      <th className="px-4 py-3 text-right font-semibold text-xs uppercase tracking-wide text-ios-text3">Solde</th>
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
                        <td className="px-4 py-3 text-right tabular text-ios-text2">
                          {d.budget > 0 ? formatMGA(d.budget) : <span className="text-ios-text3">—</span>}
                        </td>
                        <td className="px-4 py-3 min-w-[180px]">
                          {d.budget > 0 ? (
                            <div className="flex items-center gap-2.5">
                              <div className="flex-1 h-2 rounded-full bg-ios-fill overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${d.depasse ? 'bg-gradient-to-r from-red-500 to-rose-500' : d.pct >= 80 ? 'bg-gradient-to-r from-amber-500 to-arina-gold' : 'bg-gradient-to-r from-emerald-500 to-teal-500'}`}
                                  style={{ width: `${Math.min(100, d.pct)}%` }}
                                />
                              </div>
                              <span className={`text-xs font-bold tabular ${d.depasse ? 'text-red-600 dark:text-red-400' : d.pct >= 80 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{d.pct}%</span>
                            </div>
                          ) : (
                            <span className="text-xs text-ios-text3">Budget non défini</span>
                          )}
                          {d.depasse && (
                            <div className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                              <Icon name="trendDown" className="w-3 h-3" /> Dépassement {new Date().getFullYear()} : {formatMGA(d.depensesAn - d.budget)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular text-emerald-600 dark:text-emerald-400">{formatMGA(d.dons)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular text-red-500 dark:text-red-400">{formatMGA(d.depenses)}</td>
                        <td className={`px-4 py-3 text-right font-bold tabular ${d.solde >= 0 ? 'text-arina-blue' : 'text-red-600 dark:text-red-400'}`}>{formatMGA(d.solde)}</td>
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
            <h3 className="font-bold text-sm">Suivi budgétaire & rapports</h3>
            <p className="text-sm text-ios-text2 mt-2 leading-relaxed">
              Renseignez le <span className="font-semibold">budget annuel accordé</span> de chaque partenaire : le tableau affiche le taux d'utilisation, le restant et signale en rouge tout dépassement (une alerte email est aussi envoyée au président). Dans l'onglet <span className="font-semibold">Évaluation</span>, le suivi budgétaire de l'année est visible par partenaire. Pour le rapport complet d'un donateur, cliquez sur l'icône <Icon name="file" className="w-3.5 h-3.5 inline-block" /> de sa ligne — parfait pour faire le point avec chaque partenaire (Ravinala, Horizon, Grandir Dignement…).
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

      {/* ═══════════ TESTIMONIALS ═══════════ */}
      {tab === 'testimonials' && (
        <div className="space-y-4 animate-fade-up">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'Témoignages reçus', value: testimonials.length },
              { label: 'En attente de validation', value: testimonials.filter((t) => t.status === 'pending').length },
              { label: 'Publiés sur le site', value: testimonials.filter((t) => t.status === 'published').length },
            ].map((s, i) => (
              <div key={i} className="card-apple p-5">
                <div className="text-2xl font-extrabold tabular">{s.value}</div>
                <div className="text-xs text-ios-text3 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="card-apple overflow-hidden">
            {filteredTestimonials.length === 0 ? (
              <EmptyState icon="star" text={testimonials.length === 0 ? 'Aucun témoignage pour le moment — les témoignages envoyés depuis la page Témoignages du site apparaîtront ici.' : 'Aucun témoignage ne correspond à votre recherche.'} />
            ) : (
              <div className="divide-y divide-ios-hairline">
                {filteredTestimonials.map((t) => (
                  <div key={t.id} className="p-5 hover:bg-ios-fill transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-arina-gold/80 to-arina-accent text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {initials(t.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-semibold text-sm truncate">{t.name}</span>
                            <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${t.status === 'published' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                              {t.status === 'published' ? 'Publié' : 'En attente'}
                            </span>
                          </div>
                          <span className="text-[11px] text-ios-text3 whitespace-nowrap">{timeAgo(t.created_at)}</span>
                        </div>
                        {(t.age || t.location || t.role) && (
                          <div className="text-[11px] text-ios-text3 mt-0.5">{[t.age ? `${t.age} ans` : '', t.location, t.role].filter(Boolean).join(' · ')}</div>
                        )}
                        <blockquote className="text-sm text-ios-text2 italic mt-2 leading-relaxed">&laquo; {t.quote} &raquo;</blockquote>
                        {t.story && (
                          <p className="text-sm text-ios-text2 mt-2 leading-relaxed line-clamp-2">{t.story}</p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => toggleTestimonial(t)}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                              t.status === 'published'
                                ? 'bg-ios-fill text-ios-text2 hover:bg-ios-fill-2'
                                : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25'
                            }`}
                          >
                            <Icon name="check" className="w-3.5 h-3.5" />
                            {t.status === 'published' ? 'Retirer de la publication' : 'Publier sur le site'}
                          </button>
                          <button onClick={() => removeTestimonial(t.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:underline">
                            <Icon name="trash" className="w-3.5 h-3.5" /> Supprimer
                          </button>
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

      {/* ═══════════ DONS (promesses de don) ═══════════ */}
      {tab === 'dons' && (
        <div className="space-y-4 animate-fade-up">
          {emailStatus && !emailStatus.configured && (
            <div className="rounded-2xl border border-amber-300/60 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3.5 flex items-start gap-3">
              <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠️</span>
              <div className="text-sm">
                <p className="font-semibold text-amber-800 dark:text-amber-200">Les reçus PDF ne seront PAS envoyés par email</p>
                <p className="text-amber-700 dark:text-amber-300 mt-1 text-[13px] leading-relaxed">
                  Variables manquantes dans Vercel (Settings → Environment Variables → Production) :{' '}
                  <strong>{(emailStatus.missing || []).join(', ')}</strong>.
                  Ajoutez-les puis redéployez. {emailStatus.gmailHint ? (
                    <>
                      💡 Gmail : créez un <strong>mot de passe d'application</strong> (compte Google → Sécurité →
                      Vérification en 2 étapes → Mots de passe des applications) et utilisez-le dans{' '}
                      <strong>SMTP_PASS</strong> — pas votre mot de passe normal. <strong>EMAIL_FROM</strong> doit être
                      l'adresse Gmail elle-même (ex. <code className="text-xs">ARINA &lt;president.arina@gmail.com&gt;</code>),
                      port <strong>465</strong> (ou 587).
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'Promesses de don', value: donations.length },
              { label: 'À confirmer (en attente)', value: donations.filter((d) => d.status === 'pledge').length },
              { label: 'Dons confirmés reçus', value: donations.filter((d) => d.status === 'received').length },
            ].map((s, i) => (
              <div key={i} className="card-apple p-5">
                <div className="text-2xl font-extrabold tabular">{s.value}</div>
                <div className="text-xs text-ios-text3 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="card-apple overflow-hidden">
            {filteredDonations.length === 0 ? (
              <EmptyState icon="heart" text={donations.length === 0 ? 'Aucune promesse de don pour le moment — les engagements pris depuis la page Soutenir du site apparaîtront ici. Confirmez chaque don à sa réception.' : 'Aucune promesse ne correspond à votre recherche.'} />
            ) : (
              <div className="divide-y divide-ios-hairline">
                {filteredDonations.map((d) => (
                  <div key={d.id} className="p-5 hover:bg-ios-fill transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${d.status === 'received' ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-arina-gold to-arina-accent'}`}>
                        {initials(d.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-semibold text-sm truncate">{d.name}</span>
                            {d.anonymous && <span className="text-[11px] text-ios-text3">(anonyme)</span>}
                            <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${d.status === 'received' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
                              {d.status === 'received' ? 'Don reçu ✓' : 'À confirmer'}
                            </span>
                            {d.receipt_sent_at && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400" title={`Reçu ${d.receipt_number || ''} envoyé à ${d.email}`}>
                                <Icon name="mail" className="w-3 h-3" /> Reçu envoyé
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-ios-text3 whitespace-nowrap">{timeAgo(d.created_at)}</span>
                        </div>
                        <div className="text-[11px] text-ios-text3 mt-0.5">
                          {d.email}{d.method ? ` · ${d.method}` : ''}
                        </div>
                        <div className="mt-1.5 text-lg font-extrabold text-arina-blue tabular">
                          {Number(d.amount) || 0} {d.currency || '€'}
                          {d.receipt_number && (
                            <span className="ml-2 text-[11px] font-semibold text-ios-text3 align-middle">{d.receipt_number}</span>
                          )}
                        </div>
                        {d.message && <p className="text-sm text-ios-text2 mt-1 leading-relaxed line-clamp-2">« {d.message} »</p>}
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => viewReceipt(d)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-ios-fill text-ios-text2 hover:bg-ios-fill-2 transition-colors"
                          >
                            <Icon name="eye" className="w-3.5 h-3.5" /> Voir le reçu
                          </button>
                          <button
                            onClick={() => toggleDonation(d)}
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                              d.status === 'received'
                                ? 'bg-ios-fill text-ios-text2 hover:bg-ios-fill-2'
                                : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/25'
                            }`}
                          >
                            <Icon name="check" className="w-3.5 h-3.5" />
                            {d.status === 'received' ? 'Remettre en attente' : 'Confirmer le don reçu'}
                          </button>
                          <button onClick={() => removeDonation(d.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:underline">
                            <Icon name="trash" className="w-3.5 h-3.5" /> Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-ios-text3 px-1">
            💡 Une promesse de don ne correspond pas à un paiement prélevé : confirmez la réception après vérification (Orange Money, virement, crypto…). Le don confirmé crée automatiquement le revenu dans Finances (taux EUR → Ar saisi à la confirmation) et envoie le reçu PDF au donateur.
          </p>
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
              <div>
                <label className="block text-xs font-semibold text-ios-text2 mb-1">Budget annuel accordé (Ar)</label>
                <input type="number" min="0" step="1000" value={donorForm.budget} onChange={(e) => setDonorForm({ ...donorForm, budget: e.target.value })} placeholder="Ex. 50000000" className={inputClass} />
                <p className="text-[11px] text-ios-text3 mt-1">Le suivi alerte quand les dépenses dépassent ce budget.</p>
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowDonorForm(false)} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Annuler</button>
              <button onClick={saveDonor} className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ MODALE — Confirmer le don reçu (taux EUR → Ar) ═══════ */}
      {confirmDonation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDonation(null)} />
          <div className="relative w-full max-w-md bg-ios-card rounded-3xl shadow-2xl animate-pop overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-ios-hairline flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center flex-shrink-0"><Icon name="check" className="w-5 h-5" /></div>
              <div className="min-w-0">
                <h3 className="font-bold truncate">Confirmer le don de {confirmDonation.name}</h3>
                <p className="text-xs text-ios-text3 truncate">
                  {Number(confirmDonation.amount) || 0} {confirmDonation.currency || '€'} · {confirmDonation.email}
                </p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ios-text2 mb-1.5">
                  Taux de conversion {confirmDonation.currency || 'EUR'} → Ariary
                  <span className="text-ios-text3 font-normal"> (le revenu sera enregistré en Ar)</span>
                </label>
                <input
                  type="number" min="1" step="any" value={confirmRate}
                  onChange={(e) => setConfirmRate(e.target.value)}
                  placeholder="ex. 5500"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-ios-fill border border-ios-hairline text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/40"
                />
                <p className="text-[11px] text-ios-text3 mt-1.5">
                  {confirmRate && Number.isFinite(Number(confirmRate)) && Number(confirmRate) > 0 ? (
                    <>Revenu estimé : <strong className="text-arina-blue">{(Number(confirmDonation.amount) * Number(confirmRate)).toLocaleString('fr-FR')} Ar</strong></>
                  ) : (
                    <>Laissez vide pour enregistrer le montant tel quel ({Number(confirmDonation.amount) || 0} {confirmDonation.currency || '€'})</>
                  )}
                </p>
              </div>
              <p className="text-[11px] text-ios-text2 bg-ios-fill rounded-xl px-3.5 py-2.5">
                Le reçu PDF sera envoyé automatiquement à <strong>{confirmDonation.email}</strong> et le revenu sera ajouté aux Finances.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-ios-hairline flex justify-end gap-2.5">
              <button onClick={() => setConfirmDonation(null)} className="px-4 py-2 rounded-xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Annuler</button>                <button
                  onClick={doConfirmDonation}
                  disabled={confirmSubmitting}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-colors ${confirmSubmitting ? 'bg-ios-fill-2 text-ios-text3 cursor-wait' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                >
                  <Icon name="check" className="w-4 h-4" /> {confirmSubmitting ? 'Confirmation…' : 'Confirmer le don reçu'}
                </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ MODALE — Aperçu du reçu PDF ═══════ */}
      {receiptPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeReceipt} />
          <div className="relative w-full max-w-3xl bg-ios-card rounded-3xl shadow-2xl animate-pop overflow-hidden">
            <div className="px-6 pt-5 pb-4 border-b border-ios-hairline flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-arina-warm text-arina-blue flex items-center justify-center flex-shrink-0"><Icon name="eye" className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <h3 className="font-bold truncate">Aperçu du reçu — {receiptPreview.name}</h3>
                  <p className="text-xs text-ios-text3 truncate">
                    {receiptPreview.receipt_number || `ARINA-${new Date().getFullYear()}-${String(receiptPreview.id).padStart(4, '0')}`} · {Number(receiptPreview.amount) || 0} {receiptPreview.currency || '€'}
                  </p>
                </div>
              </div>
              <button onClick={closeReceipt} className="p-2 hover:bg-ios-fill-2 rounded-lg transition-colors" aria-label="Fermer">
                <Icon name="x" className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-ios-fill">
              {receiptLoading ? (
                <div className="h-[65vh] flex items-center justify-center text-sm text-ios-text3">Génération du reçu…</div>
              ) : (
                receiptUrl ? (
                  <iframe src={receiptUrl} title="Aperçu du reçu" className="w-full h-[65vh] bg-white" />
                ) : (
                  <div className="h-[65vh] flex items-center justify-center text-sm text-ios-text3">Aucun aperçu disponible.</div>
                )
              )}
            </div>
            <div className="px-6 py-4 border-t border-ios-hairline flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-ios-text3">Le reçu sera envoyé au donateur ({receiptPreview.email}) lors de la confirmation.</p>
              <div className="flex gap-2.5">
                <a
                  href={receiptUrl || '#'}
                  download={`${receiptPreview.receipt_number || `ARINA-${new Date().getFullYear()}-${String(receiptPreview.id).padStart(4, '0')}`}.pdf`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors"
                >
                  <Icon name="download" className="w-4 h-4" /> Télécharger
                </a>
                <button onClick={closeReceipt} className="px-4 py-2 rounded-xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark transition-colors">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ MODALE — Badge QR d'un enfant ═══════ */}
      {badgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBadgeModal(null)} />
          <div className="relative w-full max-w-sm bg-ios-card rounded-3xl shadow-2xl animate-pop overflow-hidden text-center">
            <div className="px-6 pt-6 pb-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-arina-blue/70 to-arina-blue-dark text-white flex items-center justify-center text-lg font-bold">
                {initials(`${badgeModal.child.prenom} ${badgeModal.child.nom}`)}
              </div>
              <h3 className="mt-3 font-bold">{badgeModal.child.prenom} {badgeModal.child.nom}</h3>
              <p className="text-xs text-ios-text3">Badge {badgeModal.badgeId || '…'}</p>
            </div>
            <div className="p-6">
              {badgeLoading ? (
                <div className="h-44 flex flex-col items-center justify-center gap-3">
                  <div className="animate-spin w-8 h-8 border-3 border-arina-blue border-t-transparent rounded-full" />
                  <span className="text-xs text-ios-text3">Génération du QR code…</span>
                </div>
              ) : badgeModal.qrCode ? (
                <>
                  <div className="w-44 h-44 mx-auto rounded-2xl bg-white border border-ios-hairline p-2 shadow-inner">
                    <img src={badgeModal.qrCode} alt={`QR code badge ${badgeModal.badgeId}`} className="w-full h-full object-contain" />
                  </div>
                  <p className="mt-3 text-[11px] text-ios-text3">Scannez ce code à l'entrée des événements, ou imprimez le badge PDF complet.</p>
                </>
              ) : (
                <p className="text-sm text-ios-text2 py-8">QR code indisponible.</p>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setBadgeModal(null)} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Fermer</button>
              <button
                onClick={() => downloadBenefBadge(badgeModal.child)}
                disabled={!badgeModal.badgeId}
                className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors disabled:opacity-40"
              >
                <Icon name="download" className="w-4 h-4 inline -mt-0.5 mr-1" /> Badge PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification de sauvegarde (base de données) */}
      <Toast toast={toast} onClose={closeToast} />
    </AdminLayout>
  );
}
