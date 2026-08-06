import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Camera, Lock, Printer, Trash2, User } from 'lucide-react';
import AppIcon from '../../components/icons';
import { useAuth } from '../../hooks/useAuth';
import { fetchBeneficiaries, updateBeneficiary, updateBeneficiaryPhoto, deleteBeneficiary } from '../../services/api';
import { safeGet, safeSet, safeParse } from '../../utils/storage';
import AdminLayout from '../../components/admin/AdminLayout';
import Toast from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { Icon } from '../../components/admin/icons';
import { inputClass } from '../../components/admin/ui';
import { fmtDate } from '../../components/admin/utils';

/* Met en forme une ligne bénéficiaire (dossier JSON) en fiche détaillée exploitable. */
function shapeDetail(b) {
  const dossier = b.dossier || {};
  return {
    ...b, code: `AR-${String(b.id).padStart(3, '0')}`,
    assiduite: dossier.assiduite || 0, progression: dossier.progression || 0,
    formations: [], suivis: dossier.suivis || [], notes: dossier.notes || '',
    dossier,
  };
}

export default function BeneficiaryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  /* Fiche déjà chargée dans la liste (clic sur l'œil) : on l'affiche IMMÉDIATEMENT,
     sans écran de chargement ni message « Bénéficiaire introuvable ». */
  const initial = location.state?.benef ? shapeDetail(location.state.benef) : null;
  /* Réf. stable lue dans l'effet (l'objet est recréé à chaque rendu : l'ajouter aux
     deps ferait boucler le rechargement — la réf. évite aussi l'avertissement du linter). */
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const [tab, setTab] = useState('detail');
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!initial);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(initial ? { ...initial } : {});
  const [suivis, setSuivis] = useState(initial ? initial.suivis || [] : []);
  const [newSuivi, setNewSuivi] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const { toast, showToast, closeToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    const hydrate = (b) => {
      const detail = shapeDetail(b);
      setData(detail);
      setForm({ ...detail });
      setSuivis(detail.suivis || []);
    };

    (async () => {
      // Clic sur l'œil : la fiche transmise est déjà affichée (on la re-hydrate aussi
      // si l'id change dans la même session, pour ne jamais montrer un autre enfant).
      // Accès direct par URL : on repart d'une fiche vierge avec squelette de chargement.
      if (initialRef.current) {
        hydrate(initialRef.current);
      } else {
        setData(null);
        setForm({});
        setSuivis([]);
        setLoading(true);
      }
      try {
        // Rafraîchissement depuis l'API (dossier le plus à jour) — puis cache local
        const fromApi = await fetchBeneficiaries();
        if (cancelled) return;
        if (Array.isArray(fromApi) && fromApi.length) {
          const b = fromApi.find((x) => String(x.id) === String(id));
          if (b) { hydrate(b); return; }
        }
        // Base injoignable ou enfant absent : on garde la fiche déjà affichée,
        // sinon on tente le cache local avant la redirection automatique.
        if (initialRef.current) return;
        const stored = safeParse(safeGet('arina_benefs'), []);
        const cached = stored.find((x) => x.id === Number(id));
        if (cached) { hydrate(cached); return; }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  /* La fiche n'a pas pu être chargée (enfant inexistant) : retour automatique au
     tableau de bord avec une notification — plus aucun écran « Bénéficiaire introuvable ». */
  useEffect(() => {
    if (loading || data) return;
    showToast('⚠️ Impossible d\'afficher la fiche — retour au tableau de bord', 'error');
    const t = setTimeout(() => navigate('/admin'), 1200);
    return () => clearTimeout(t);
  }, [loading, data, navigate, showToast]);

  /* Chargement : squelette élégant — plus jamais « Bénéficiaire introuvable »
     pendant que la fiche se charge. */
  if (loading) return (
    <div className="min-h-screen bg-ios-bg px-4 py-6">
      <div className="max-w-5xl mx-auto animate-fade-up">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-5 h-5 animate-spin border-2 border-arina-blue border-t-transparent rounded-full" />
          <span className="text-sm font-medium text-ios-text3">Chargement du dossier…</span>
        </div>
        <div className="space-y-6">
          {/* En-tête squelette */}
          <div className="rounded-[18px] overflow-hidden border border-ios-hairline">
            <div className="bg-gradient-to-b from-arina-accent via-arina-blue to-arina-blue-dark px-6 py-10">
              <div className="w-32 h-32 mx-auto skeleton" style={{ borderRadius: 18 }} />
              <div className="mt-5 mx-auto w-48 h-6 skeleton" style={{ borderRadius: 8 }} />
              <div className="mt-2.5 mx-auto w-64 h-3.5 skeleton" style={{ borderRadius: 8 }} />
              <div className="flex justify-center gap-2 mt-4">
                <div className="w-16 h-6 skeleton" style={{ borderRadius: 999 }} />
                <div className="w-16 h-6 skeleton" style={{ borderRadius: 999 }} />
                <div className="w-20 h-6 skeleton" style={{ borderRadius: 999 }} />
              </div>
            </div>
          </div>
          {/* Cartes squelette */}
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="card-apple p-6">
              <div className="w-24 h-24 mx-auto skeleton" style={{ borderRadius: 999 }} />
              <div className="mt-4 mx-auto w-28 h-3 skeleton" style={{ borderRadius: 8 }} />
            </div>
            <div className="lg:col-span-2 card-apple p-6 space-y-3">
              <div className="w-40 h-4 skeleton" style={{ borderRadius: 8 }} />
              <div className="grid sm:grid-cols-2 gap-3 pt-1">
                {[...Array(6)].map((_, i) => <div key={i} className="h-4 skeleton" style={{ borderRadius: 8 }} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* Enfant non trouvé : plus de message d'erreur — simple écran de redirection
     (le useEffect ci-dessus ramène automatiquement au tableau de bord). */
  if (!data) return (
    <div className="min-h-screen bg-ios-bg flex items-center justify-center px-4">
      <div className="text-center animate-fade-up">
        <div className="animate-spin w-8 h-8 border-3 border-arina-blue border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm font-medium text-ios-text3">Retour au tableau de bord…</p>
      </div>
    </div>
  );

  /* Sauvegarde STRICTE : le dossier n'est mis à jour que si la base l'a accepté. */
  const persistBenef = async (next) => {
    const payload = {
      prenom: next.prenom, nom: next.nom, age: Number(next.age) || 0,
      statut: next.statut, dateEntree: next.dateEntree, formation: next.formation,
      photo: next.photo, dossier: next.dossier || {},
    };
    const r = await updateBeneficiary(id, payload);
    if (!r.ok) {
      showToast(`❌ Modifications NON enregistrées dans la base : ${r.error}`, 'error');
      return false;
    }
    const shaped = shapeDetail(r.data);
    setData(shaped);
    setForm({ ...shaped, ...form });
    showToast('✅ Fiche mise à jour et enregistrée dans la base de données');
    return true;
  };

  /* Suppression DÉFINITIVE : appel réel à l'API. (Avant, le bouton « Supprimer »
     ne faisait que naviguer — aucun enregistrement n'était supprimé en base.) */
  const removeBenef = async () => {
    if (!confirm(`Supprimer définitivement ${data.prenom} ${data.nom} ? Cette action est irréversible.`)) return;
    const r = await deleteBeneficiary(id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    // Cache local : on retire l'enfant pour rester cohérent (lecture hors-ligne)
    const stored = safeParse(safeGet('arina_benefs'), []);
    safeSet('arina_benefs', JSON.stringify(stored.filter((x) => String(x.id) !== String(id))));
    showToast(`✅ ${data.prenom} ${data.nom} supprimé de la base de données`);
    navigate('/admin');
  };

  const saveNotes = async (value) => {
    setData((d) => ({ ...d, notes: value }));
    const ok = await persistBenef({ ...data, notes: value, dossier: { ...(data.dossier || {}), notes: value } });
    if (!ok) setData((d) => ({ ...d, notes: data.notes }));
  };
  const saveEdit = async () => {
    // Le dossier édité (form.dossier) prime — plus la seule fiche. Les pourcentages
    // d'assiduité/progression restent synchronisés dans le dossier comme avant.
    const dossier = { ...(form.dossier || data.dossier || {}) };
    dossier.assiduite = Number(form.assiduite) || Number(data.assiduite) || 0;
    dossier.progression = Number(form.progression) || Number(data.progression) || 0;
    // Migration douce : la clé obsolète `felicitations` (remplacée par `recommandation`)
    // est retirée du dossier à l'enregistrement pour éviter qu'un ancien texte ne ressorte.
    if (dossier.arina && 'felicitations' in dossier.arina) {
      const arina = { ...dossier.arina };
      delete arina.felicitations;
      dossier.arina = arina;
    }
    const ok = await persistBenef({
      ...data, ...form,
      assiduite: dossier.assiduite, progression: dossier.progression,
      dossier,
    });
    if (ok) setEditing(false);
  };

  const addSuivi = async () => {
    if (!newSuivi.trim()) return;
    const entry = { date: new Date().toLocaleDateString('fr-FR'), type: 'Suivi', note: newSuivi };
    const nextSuivis = [entry, ...suivis];
    const saved = await persistBenef({
      ...data,
      suivis: nextSuivis,
      dossier: { ...(data.dossier || {}), suivis: nextSuivis },
    });
    if (saved) {
      setSuivis(nextSuivis);
      setNewSuivi('');
    }
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image trop volumineuse (max 5MB)');
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      const updated = { ...data, photo: base64 };
      setData(updated);
      setForm({ ...form, photo: base64 });
      // NB : le cache local reste volontairement SANS photo (base64 volumineuse →
      // quota localStorage). La photo est chargée depuis l'API à chaque visite.
      // Sauvegarde STRICTE : la photo ne compte que si elle a atteint la base
      const r = await updateBeneficiaryPhoto(id, base64);
      setUploading(false);
      if (!r.ok) {
        showToast(`❌ Photo NON enregistrée dans la base : ${r.error}`, 'error');
        return;
      }
      showToast('✅ Photo enregistrée dans la base de données');
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = async () => {
    const r = await updateBeneficiaryPhoto(id, null);
    if (!r.ok) {
      showToast(`❌ Photo NON retirée de la base : ${r.error}`, 'error');
      return;
    }
    const updated = { ...data };
    delete updated.photo;
    setData(updated);
    setForm({ ...form, photo: undefined });
    const stored = safeParse(safeGet('arina_benefs'), []);
    const idx = stored.findIndex((x) => x.id === Number(id));
    if (idx >= 0) {
      delete stored[idx].photo;
      safeSet('arina_benefs', JSON.stringify(stored));
    }
    showToast('✅ Photo retirée de la base de données');
  };

  const groups = [
    { group: 'Fiche', items: [
      { key: 'detail', label: 'Détail', icon: 'users' },
      { key: 'suivi', label: 'Suivi', icon: 'activity' },
      { key: 'formations', label: 'Formations', icon: 'file' },
    ] },
  ];

  const cardTitle = (icon, title, sub) => (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-arina-warm text-arina-blue flex items-center justify-center"><Icon name={icon} className="w-4 h-4" /></div>
      <div>
        <h3 className="font-bold">{title}</h3>
        {sub && <p className="text-xs text-ios-text3">{sub}</p>}
      </div>
    </div>
  );

  /* ── Édition du dossier complet (Identité / Familiale / Juridique / Étude / ARINA) ──
     Les valeurs sont lues dans le formulaire d'édition (form.dossier), avec repli sur
     les données affichées — les sections vides deviennent saisissables en mode édition. */
  const dossVal = (section, field) => (form.dossier?.[section]?.[field] ?? data.dossier?.[section]?.[field] ?? '');
  const setDoss = (section, field) => (e) => {
    const v = e.target ? e.target.value : e;
    setForm((prev) => ({
      ...prev,
      dossier: { ...(prev.dossier || {}), [section]: { ...(prev.dossier?.[section] || {}), [field]: v } },
    }));
  };

  return (
    <AdminLayout
      groups={groups}
      activeKey={tab}
      onNavigate={setTab}
      title={`${data.prenom} ${data.nom}`}
      subtitle={`Bénéficiaire — ${data.code} · ${data.statut}`}
      footerNav={[{ key: 'dash', label: 'Retour au dashboard', icon: 'grid', to: '/admin' }]}
      user={user}
      onLogout={logout}
      actions={
        <>
          <button onClick={() => window.print()} className="no-print px-4 py-2 rounded-xl text-sm font-semibold bg-ios-fill text-ios-text hover:bg-ios-fill-2 transition-all inline-flex items-center gap-1.5">
            <Printer className="w-4 h-4" /> Imprimer / PDF
          </button>
          <button onClick={() => setEditing(!editing)} className={`no-print px-4 py-2 rounded-xl text-sm font-semibold transition-all ${editing ? 'bg-ios-fill-2 text-ios-text hover:bg-ios-fill-2' : 'bg-arina-blue text-white hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20'}`}>
            {editing ? 'Annuler' : 'Modifier'}
          </button>
          <button onClick={() => setTab('suivi')} className="no-print px-4 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all">Suivi</button>
          <button onClick={removeBenef} className="no-print px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-all">Supprimer</button>
        </>
      }
    >
      <div className="print-area space-y-6">
        {/* ── EN-TÊTE DE FICHE (imprimable) — photo tout en haut ── */}
        <div className="print-header card-apple overflow-hidden">
          <div className="bg-gradient-to-b from-arina-accent via-arina-blue to-arina-blue-dark px-6 py-8 text-white text-center relative">
            {/* Filigrane logo ARINA en fond */}
            <img src="/logo-arina.jpg" alt="" className="absolute right-4 top-4 w-14 h-14 rounded-xl object-contain bg-white/90 p-1 opacity-90 shadow-lg" />

            {/* Photo — tout en haut, au-dessus des écritures (UNIQUE : plus de
                 deuxième photo dupliquée dans l'onglet Détail) */}
            <div className="relative w-36 h-36 lg:w-40 lg:h-40 rounded-2xl overflow-hidden bg-white/20 border-2 border-white/50 flex items-center justify-center mx-auto shadow-2xl">
              {uploading ? (
                <div className="animate-spin w-10 h-10 border-3 border-white border-t-transparent rounded-full" />
              ) : data.photo ? (
                <img src={data.photo} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <User className="w-16 h-16 text-white/80" />
              )}
            </div>
            {/* Contrôles photo — discrets, non imprimés */}
            <div className="no-print flex items-center justify-center gap-2 mt-3">
              <button onClick={handlePhotoClick} className="px-3.5 py-1.5 rounded-full bg-white/15 hover:bg-white/30 border border-white/30 text-xs font-semibold inline-flex items-center gap-1.5 transition-all">
                <Camera className="w-3.5 h-3.5" /> {data.photo ? 'Changer la photo' : 'Ajouter une photo'}
              </button>
              {data.photo && (
                <button onClick={removePhoto} className="px-3.5 py-1.5 rounded-full bg-red-500/25 hover:bg-red-500/40 border border-red-300/40 text-xs font-semibold inline-flex items-center gap-1.5 transition-all">
                  <Trash2 className="w-3.5 h-3.5" /> Supprimer
                </button>
              )}
            </div>

            {/* Écritures — en dessous de la photo */}
            <div className="mt-5">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Association ARINA — Dossier bénéficiaire</div>
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">{data.prenom} {data.nom}</h2>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold border border-white/30">{data.code}</span>
                <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold border border-white/30">{data.age} ans</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${data.statut === 'Actif' ? 'bg-emerald-500/30 border-emerald-200/60' : data.statut === 'Diplômé' ? 'bg-purple-500/30 border-purple-200/60' : 'bg-gray-500/30 border-gray-200/60'}`}>
                  {data.statut}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Champ d'upload photo — TOUJOURS monté (les boutons de l'en-tête sont
             visibles sur tous les onglets : Détail, Suivi, Formations) */}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden no-print" />

        {/* ── DÉTAIL TAB ── */}
        {tab === 'detail' && (
          <>
            <div className="grid lg:grid-cols-3 gap-6 animate-fade-up">
              {/* Fiche de renseignements */}
              <div className="lg:col-span-2 card-apple p-6">
                {cardTitle('users', 'Fiche de renseignements')}
                {editing ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { k: 'prenom', label: 'Prénom' },
                      { k: 'nom', label: 'Nom' },
                      { k: 'age', label: 'Âge', type: 'number' },
                      { k: 'dateEntree', label: "Date d'entrée", type: 'date' },
                      { k: 'formation', label: 'Formation au centre' },
                    ].map((f) => (
                      <label key={f.k} className="block">
                        <span className="block text-xs font-semibold text-ios-text3 mb-1">{f.label}</span>
                        <input type={f.type || 'text'} value={form[f.k] || ''} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} className={inputClass} />
                      </label>
                    ))}
                    <label className="block">
                      <span className="block text-xs font-semibold text-ios-text3 mb-1">Statut</span>
                      <select value={form.statut || 'Actif'} onChange={(e) => setForm({ ...form, statut: e.target.value })} className={inputClass}>
                        <option>Actif</option>
                        <option>Diplômé</option>
                        <option>Inactif</option>
                      </select>
                    </label>
                    <div className="col-span-2 flex justify-end gap-2 mt-2">
                      <button onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-ios-fill text-ios-text hover:bg-ios-fill-2 transition-all">Annuler</button>
                      <button onClick={saveEdit} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-arina-blue text-white hover:bg-arina-blue-dark transition-all">Enregistrer</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    {[
                      { l: 'Prénom', v: data.prenom },
                      { l: 'Nom', v: data.nom },
                      { l: 'Âge', v: `${data.age} ans` },
                      { l: 'Statut', v: data.statut },
                      { l: "Date d'entrée", v: fmtDate(data.dateEntree) },
                      { l: 'Formation', v: data.formation },
                    ].map((r, i) => (
                      <div key={i}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{r.v || '—'}</span></div>
                    ))}
                  </div>
                )}
              </div>

              {/* Progression */}
              <div className="card-apple p-6">
                {cardTitle('activity', 'Progression')}
                {editing ? (
                  <div className="space-y-3">
                    <label className="block">
                      <span className="block text-xs font-semibold text-ios-text3 mb-1">Assiduité (%)</span>
                      <input type="number" min="0" max="100" value={form.assiduite || ''} onChange={(e) => setForm({ ...form, assiduite: e.target.value })} className={inputClass} />
                    </label>
                    <label className="block">
                      <span className="block text-xs font-semibold text-ios-text3 mb-1">Score de progression (%)</span>
                      <input type="number" min="0" max="100" value={form.progression || ''} onChange={(e) => setForm({ ...form, progression: e.target.value })} className={inputClass} />
                    </label>
                    <button onClick={saveEdit} className="w-full py-2.5 rounded-xl text-sm font-semibold bg-arina-blue text-white hover:bg-arina-blue-dark transition-all">Enregistrer</button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div>
                      <div className="flex justify-between text-sm mb-1"><span className="text-ios-text3">Assiduité</span><span className="font-bold text-ios-text">{data.assiduite}%</span></div>
                      <div className="w-full h-3 bg-ios-fill rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${data.assiduite}%` }} /></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1"><span className="text-ios-text3">Progression</span><span className="font-bold text-ios-text">{data.progression}%</span></div>
                      <div className="w-full h-3 bg-ios-fill rounded-full overflow-hidden"><div className="h-full bg-arina-blue rounded-full transition-all" style={{ width: `${data.progression}%` }} /></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dossier complet (IDENTITÉ / FAMILIALE / JURIDIQUE / ÉTUDE / ARINA) en 2 colonnes
                 — affiché en lecture s'il contient des données, et TOUJOURS en mode édition
                 pour pouvoir remplir un dossier vide depuis la fiche. */}
            {(editing || (data.dossier && Object.keys(data.dossier).length > 0)) && (
              <div className="grid md:grid-cols-2 gap-6 items-start animate-fade-up" style={{ animationDelay: '220ms' }}>
                {/* IDENTITÉ */}
                {(editing || (data.dossier.identite && Object.values(data.dossier.identite).some((v) => v))) && (
                  <div className="card-apple p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-arina-accent to-arina-blue text-white flex items-center justify-center"><Icon name="users" className="w-4 h-4" /></span>
                      <h4 className="font-bold uppercase tracking-wide text-sm">Identité</h4>
                    </div>
                    {editing ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {[['pseudo', 'Pseudo'], ['dateNaissance', 'Date de naissance'], ['lieuNaissance', 'Lieu de naissance'], ['adresse', 'Adresse exacte'], ['contact', 'Contact'], ['situationScolaire', 'Situation scolaire'], ['loisirs', 'Loisirs']].map(([f, l]) => (
                          <label key={f} className="block">
                            <span className="block text-xs font-semibold text-ios-text3 mb-1">{l}</span>
                            <input value={dossVal('identite', f)} onChange={setDoss('identite', f)} className={inputClass} />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        {[{ l: 'Pseudo', v: data.dossier.identite.pseudo }, { l: 'Date de naissance', v: data.dossier.identite.dateNaissance }, { l: 'Lieu de naissance', v: data.dossier.identite.lieuNaissance }, { l: 'Adresse exacte', v: data.dossier.identite.adresse }, { l: 'Contact', v: data.dossier.identite.contact }, { l: 'Situation scolaire', v: data.dossier.identite.situationScolaire }, { l: 'Loisirs', v: data.dossier.identite.loisirs }].map((r, i) => (
                          <div key={i}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{r.v || '—'}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SITUATION FAMILIALE */}
                {(editing || (data.dossier.familiale && Object.values(data.dossier.familiale).some((v) => v))) && (
                  <div className="card-apple p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-arina-accent to-arina-blue-dark text-white flex items-center justify-center"><Icon name="grid" className="w-4 h-4" /></span>
                      <h4 className="font-bold uppercase tracking-wide text-sm">Situation familiale</h4>
                    </div>
                    {editing ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {[['pereNom', 'Nom du père'], ['pereProfession', 'Profession du père'], ['pereContact', 'Contact du père'], ['pereAdresse', 'Adresse du père'], ['mereNom', 'Nom de la mère'], ['mereProfession', 'Profession de la mère'], ['mereContact', 'Contact de la mère'], ['mereAdresse', 'Adresse de la mère'], ['tuteurNom', 'Nom du tuteur'], ['tuteurContact', 'Contact du tuteur'], ['tuteurAdresse', 'Adresse du tuteur'], ['nbFreresSoeurs', 'Nombre de frères et sœurs'], ['situationParents', 'Situation des parents'], ['niveauVie', 'Niveau de vie des parents']].map(([f, l]) => (
                          <label key={f} className="block">
                            <span className="block text-xs font-semibold text-ios-text3 mb-1">{l}</span>
                            <input value={dossVal('familiale', f)} onChange={setDoss('familiale', f)} className={inputClass} />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4 text-sm">
                        {[{ t: 'Père', k: ['pereNom', 'pereProfession', 'pereContact', 'pereAdresse'] }, { t: 'Mère', k: ['mereNom', 'mereProfession', 'mereContact', 'mereAdresse'] }].map((s) => (
                          <div key={s.t}>
                            <div className="text-xs font-semibold uppercase tracking-wide text-ios-text3 mb-1.5">{s.t}</div>
                            <div className="grid sm:grid-cols-4 gap-3">
                              {[{ l: 'Nom', f: s.k[0] }, { l: 'Profession', f: s.k[1] }, { l: 'Contact', f: s.k[2] }, { l: 'Adresse', f: s.k[3] }].map((r, i) => (
                                <div key={i}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{data.dossier.familiale[r.f] || '—'}</span></div>
                              ))}
                            </div>
                          </div>
                        ))}
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-ios-text3 mb-1.5">Tuteur</div>
                          <div className="grid sm:grid-cols-3 gap-3">
                            {[{ l: 'Nom', f: 'tuteurNom' }, { l: 'Contacts', f: 'tuteurContact' }, { l: 'Adresse', f: 'tuteurAdresse' }].map((r, i) => (
                              <div key={i}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{data.dossier.familiale[r.f] || '—'}</span></div>
                            ))}
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-3 pt-3 border-t border-ios-hairline">
                          {[{ l: 'Nombre de frères et sœurs', f: 'nbFreresSoeurs' }, { l: 'Situation des parents', f: 'situationParents' }, { l: 'Niveau de vie des parents', f: 'niveauVie' }].map((r, i) => (
                            <div key={i}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{data.dossier.familiale[r.f] || '—'}</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SITUATION JURIDIQUE */}
                {(editing || (data.dossier.juridique && Object.values(data.dossier.juridique).some((v) => v))) && (
                  <div className="card-apple p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center"><Icon name="file" className="w-4 h-4" /></span>
                      <h4 className="font-bold uppercase tracking-wide text-sm">Situation juridique</h4>
                    </div>
                    {editing ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {[['motifInculpation', "Motifs d'inculpation"], ['dateEcrou', "Date d'écrou"], ['dureeDetention', 'Durée de détention'], ['dateLiberation', 'Date de libération'], ['motifLiberation', 'Motifs de libération']].map(([f, l]) => (
                          <label key={f} className={f === 'motifInculpation' ? 'block sm:col-span-2' : 'block'}>
                            <span className="block text-xs font-semibold text-ios-text3 mb-1">{l}</span>
                            <input value={dossVal('juridique', f)} onChange={setDoss('juridique', f)} className={inputClass} />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        {[{ l: "Motifs d'inculpation", f: 'motifInculpation' }, { l: "Date d'écrou", f: 'dateEcrou' }, { l: 'Durée de détention', f: 'dureeDetention' }, { l: 'Date de libération', f: 'dateLiberation' }, { l: 'Motifs de libération', f: 'motifLiberation' }].map((r, i) => (
                          <div key={i} className={i === 0 ? 'sm:col-span-2' : ''}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{data.dossier.juridique[r.f] || '—'}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ÉTUDE */}
                {(editing || (data.dossier.etude && Object.values(data.dossier.etude).some((v) => v))) && (
                  <div className="card-apple p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 text-white flex items-center justify-center"><Icon name="calendar" className="w-4 h-4" /></span>
                      <h4 className="font-bold uppercase tracking-wide text-sm">Étude</h4>
                    </div>
                    {editing ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {[['classeActuelle', 'Classe actuelle'], ['etablissement', 'Établissement'], ['carriereEnvisagee', 'Carrière envisagée'], ['diplomeObtenu', 'Diplôme obtenu'], ['specialites', 'Spécialités']].map(([f, l]) => (
                          <label key={f} className={f === 'specialites' ? 'block sm:col-span-2' : 'block'}>
                            <span className="block text-xs font-semibold text-ios-text3 mb-1">{l}</span>
                            <input value={dossVal('etude', f)} onChange={setDoss('etude', f)} className={inputClass} />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        {[{ l: 'Classe actuelle', f: 'classeActuelle' }, { l: 'Établissement', f: 'etablissement' }, { l: 'Carrière envisagée', f: 'carriereEnvisagee' }, { l: 'Diplôme obtenu', f: 'diplomeObtenu' }, { l: 'Spécialités', f: 'specialites' }].map((r, i) => (
                          <div key={i} className={i === 4 ? 'sm:col-span-2' : ''}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{data.dossier.etude[r.f] || '—'}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ARINA — pleine largeur (2 colonnes) */}
                {(editing || ((data.dossier.arina && Object.values(data.dossier.arina).some((v) => v)) || data.dateEntree || data.formation)) && (
                  <div className="card-apple p-6 md:col-span-2">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-arina-gold to-amber-600 text-white flex items-center justify-center"><Icon name="star" className="w-4 h-4" /></span>
                      <h4 className="font-bold uppercase tracking-wide text-sm">ARINA</h4>
                    </div>
                    {editing ? (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <label className="block">
                          <span className="block text-xs font-semibold text-ios-text3 mb-1">Date d'entrée au centre</span>
                          <input type="date" value={dossVal('arina', 'dateEntreeCentre')} onChange={setDoss('arina', 'dateEntreeCentre')} className={inputClass} />
                        </label>
                        <label className="block">
                          <span className="block text-xs font-semibold text-ios-text3 mb-1">Formation au centre</span>
                          <input value={form.formation || ''} onChange={(e) => setForm({ ...form, formation: e.target.value })} className={inputClass} />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="block text-xs font-semibold text-ios-text3 mb-1">Recommandation du professeur</span>
                          {/* Repli de migration : un ancien dossier peut ne contenir que
                              `felicitations` — son texte doit apparaître ici (sinon la
                              sauvegarde l'effacerait). */}
                          <textarea rows={3} value={dossVal('arina', 'recommandation') || (!('recommandation' in (form.dossier?.arina || data.dossier?.arina || {})) ? (data.dossier?.arina?.felicitations || '') : '')} onChange={setDoss('arina', 'recommandation')} className={`${inputClass} resize-none`} />
                        </label>
                      </div>
                    ) : (
                      <>
                        <div className="grid sm:grid-cols-2 gap-4 text-sm">
                          {[{ l: "Date d'entrée au centre", v: data.dossier.arina?.dateEntreeCentre || data.dateEntree }, { l: 'Formation au centre', v: data.formation }, { l: "Date d'entrée (fiche)", v: data.dateEntree }].filter((r) => r.v).map((r, i) => (
                            <div key={i}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{r.v || '—'}</span></div>
                          ))}
                        </div>
                        {(() => {
                          const arina = data.dossier.arina || {};
                          // La clé `recommandation` prime dès qu'elle existe (même vide = effacée) ;
                          // `felicitations` n'est qu'un repli de migration pour les anciens dossiers.
                          const rec = 'recommandation' in arina ? arina.recommandation : (arina.felicitations || '');
                          if (!rec) return null;
                          return (
                            <div className="mt-4 rounded-xl bg-arina-warm/70 dark:bg-white/5 p-4">
                              <div className="text-xs font-semibold uppercase tracking-wide text-ios-text3 mb-2">Recommandation du professeur</div>
                              <p className="text-sm text-ios-text leading-relaxed whitespace-pre-line">{rec}</p>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                )}

                {/* Bouton d'enregistrement du dossier complet (mode édition) */}
                {editing && (
                  <div className="md:col-span-2 flex flex-wrap items-center justify-end gap-2 no-print">
                    <button onClick={() => setEditing(false)} className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-ios-fill text-ios-text hover:bg-ios-fill-2 transition-all">Annuler</button>
                    <button onClick={saveEdit} className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-arina-blue text-white hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-all">💾 Enregistrer le dossier complet</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── FORMATIONS TAB ── */}
        {tab === 'formations' && (
          <div className="card-apple p-6 animate-fade-up">
            {cardTitle('file', 'Formations')}
            <div className="space-y-4">
              {(data.formations || []).map((f, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-ios-fill rounded-2xl">
                  <div className="flex items-center gap-4">
                    <span className="w-10 h-10 rounded-xl bg-arina-warm text-arina-blue flex items-center justify-center"><AppIcon name={f.icon} className="w-5 h-5" /></span>
                    <div>
                      <div className="font-semibold text-ios-text">{f.nom}</div>
                      <div className="text-sm text-ios-text3">{f.statut}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-2 bg-ios-fill rounded-full overflow-hidden"><div className="h-full bg-arina-blue rounded-full" style={{ width: `${f.progression}%` }} /></div>
                    <span className="text-sm font-bold text-ios-text tabular">{f.progression}%</span>
                  </div>
                </div>
              ))}
              {(data.formations || []).length === 0 && <p className="text-ios-text3 text-sm">Aucune formation enregistrée</p>}
            </div>
          </div>
        )}

        {/* ── SUIVI TAB ── */}
        {tab === 'suivi' && (
          <div className="space-y-6">
            <div className="card-apple p-6 animate-fade-up">
              {cardTitle('plus', 'Ajouter un suivi')}
              <div className="flex gap-3">
                <input
                  value={newSuivi}
                  onChange={(e) => setNewSuivi(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSuivi()}
                  placeholder="Nouvelle entrée de suivi..."
                  className="flex-1 px-4 py-2.5 bg-ios-fill border border-ios-hairline rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/30"
                />
                <button onClick={addSuivi} className="px-6 py-2.5 bg-arina-blue text-white text-sm font-semibold rounded-xl hover:bg-arina-blue-dark transition-colors">Ajouter</button>
              </div>
            </div>

            <div className="card-apple p-6 animate-fade-up" style={{ animationDelay: '80ms' }}>
              {cardTitle('activity', 'Suivi individuel')}
              <div className="space-y-3">
                {suivis.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-ios-fill rounded-xl">
                    <span className="text-xs font-semibold text-ios-text3 bg-ios-card px-2 py-1 rounded-lg whitespace-nowrap border border-ios-hairline">{s.date}</span>
                    <div className="flex-1">
                      <span className="text-xs font-semibold text-arina-blue bg-arina-warm px-2 py-0.5 rounded-full">{s.type}</span>
                      <p className="text-sm text-ios-text mt-1">{s.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Notes confidentielles */}
        <div className="no-print rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 animate-fade-up">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center"><Icon name="bell" className="w-4 h-4" /></div>
            <h3 className="font-bold text-ios-text flex items-center gap-2"><Lock className="w-4 h-4 text-amber-500" /> Notes confidentielles</h3>
          </div>
          <textarea rows={3} className="w-full px-4 py-3 bg-ios-card border border-amber-500/30 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-arina-blue/30"
            placeholder="Notes réservées à l'administrateur..."
            value={data.notes} onChange={(e) => setData({ ...data, notes: e.target.value })} onBlur={(e) => saveNotes(e.target.value)} />
        </div>

        {/* ── PIED DE PAGE OFFICIEL (impression / PDF) ── */}
        <div className="mt-8 pt-6 border-t-2 border-arina-blue/30">
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
      {/* Notification de sauvegarde (base de données) */}
      <Toast toast={toast} onClose={closeToast} />
    </AdminLayout>
  );
}
