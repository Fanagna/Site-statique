import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Circle, Lock, Printer, Search, Trash2, User } from 'lucide-react';
import AppIcon from '../../components/icons';
import { useAuth } from '../../context/AuthContext';
import { fetchBeneficiaries, updateBeneficiaryPhoto } from '../../services/api';
import AdminLayout from '../../components/admin/AdminLayout';
import { Icon } from '../../components/admin/icons';
import { inputClass } from '../../components/admin/ui';

/* ── Mock enriched data (until detail API exists) ── */
const benefDetails = {
  1: { id: 1, prenom: 'Thomas', nom: 'M.', age: 17, code: 'AR-001', genre: 'Masculin', telephone: '032 77 374 89', region: 'Boeny', niveauScolaire: '3ème',
    situationFamiliale: 'Famille monoparentale', parent: 'Mme R., commerçante', freresSoeurs: 2,
    educateur: 'M. Rakoto', dateEntree: '2024-01-15', motif: 'Sortie de prison', objectifs: 'Autonomie professionnelle, menuiserie', statut: 'Actif',
    assiduite: 85, progression: 75,
    formations: [{ nom: 'Menuiserie', statut: 'En cours', progression: 75, icon: 'hammer' }, { nom: 'Cuisine', statut: 'Terminé', progression: 90, icon: 'cooking-pot' }],
    suivis: [
      { date: '02/12/2024', type: 'Entretien mensuel', note: 'Progression positive' },
      { date: '25/11/2024', type: 'Atelier menuiserie', note: 'Participation active' },
      { date: '18/11/2024', type: 'Suivi psychologique', note: 'Bon moral' },
    ],
    notes: '',
  },
  2: { id: 2, prenom: 'Marie', nom: 'K.', age: 16, code: 'AR-002', genre: 'Féminin', telephone: '034 31 722 08', region: 'Mahajanga', niveauScolaire: '4ème',
    situationFamiliale: 'Orpheline', parent: 'Grand-mère', freresSoeurs: 0,
    educateur: 'Mme. Ravao', dateEntree: '2024-04-20', motif: 'Vulnérabilité', objectifs: 'Formation cuisine, autonomie', statut: 'Actif',
    assiduite: 92, progression: 80,
    formations: [{ nom: 'Cuisine', statut: 'En cours', progression: 80, icon: 'cooking-pot' }],
    suivis: [{ date: '01/12/2024', type: 'Stage restaurant', note: 'Très bonne intégration' }],
    notes: '',
  },
};

export default function BeneficiaryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('detail');
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [suivis, setSuivis] = useState([]);
  const [newSuivi, setNewSuivi] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const hydrate = (b) => {
      const detail = {
        ...b, code: `AR-${String(b.id).padStart(3, '0')}`, genre: '', telephone: '', region: '', niveauScolaire: '',
        situationFamiliale: '', parent: '', freresSoeurs: 0, educateur: '', motif: '', objectifs: '',
        assiduite: 0, progression: 0, formations: [], suivis: [], notes: '',
        dossier: b.dossier || {},
      };
      setData(detail);
      setForm({ ...detail });
      setSuivis(detail.suivis || []);
    };

    (async () => {
      // Priorité : API (dossier complet) — puis localStorage — puis mock
      const fromApi = await fetchBeneficiaries();
      if (cancelled) return;
      if (Array.isArray(fromApi) && fromApi.length) {
        const b = fromApi.find((x) => String(x.id) === String(id));
        if (b) { hydrate(b); return; }
      }
      let detail = benefDetails[id];
      if (!detail) {
        const stored = JSON.parse(localStorage.getItem('arina_benefs') || '[]');
        const b = stored.find((x) => x.id === Number(id));
        if (b) { hydrate(b); return; }
      }
      if (detail) {
        setData(detail);
        setForm({ ...detail });
        setSuivis(detail.suivis || []);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (!data) return (
    <div className="min-h-screen bg-ios-bg flex items-center justify-center px-4">
      <div className="text-center">
        <Search className="w-12 h-12 mx-auto text-ios-text3 mb-4" />
        <h2 className="text-xl font-bold text-ios-text mb-2">Bénéficiaire introuvable</h2>
        <button onClick={() => navigate('/admin')} className="inline-flex items-center gap-2 px-6 py-2.5 bg-arina-blue text-white rounded-xl font-semibold mt-4"><ArrowLeft className="w-4 h-4" /> Retour</button>
      </div>
    </div>
  );

  const saveEdit = () => {
    setData({ ...data, ...form });
    setEditing(false);
  };

  const addSuivi = () => {
    if (!newSuivi.trim()) return;
    setSuivis([{ date: new Date().toLocaleDateString('fr-FR'), type: 'Suivi', note: newSuivi }, ...suivis]);
    setNewSuivi('');
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
    reader.onload = () => {
      const base64 = reader.result;
      const updated = { ...data, photo: base64 };
      setData(updated);
      setForm({ ...form, photo: base64 });
      // Persist photo
      const stored = JSON.parse(localStorage.getItem('arina_benefs') || '[]');
      const idx = stored.findIndex((x) => x.id === Number(id));
      if (idx >= 0) {
        stored[idx].photo = base64;
        localStorage.setItem('arina_benefs', JSON.stringify(stored));
      }
      // Try API
      updateBeneficiaryPhoto(id, base64).catch(() => {});
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    const updated = { ...data };
    delete updated.photo;
    setData(updated);
    setForm({ ...form, photo: undefined });
    const stored = JSON.parse(localStorage.getItem('arina_benefs') || '[]');
    const idx = stored.findIndex((x) => x.id === Number(id));
    if (idx >= 0) {
      delete stored[idx].photo;
      localStorage.setItem('arina_benefs', JSON.stringify(stored));
    }
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
          <button onClick={() => { if (confirm('Supprimer ce bénéficiaire ?')) navigate('/admin'); }} className="no-print px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-all">Supprimer</button>
        </>
      }
    >
      <div className="print-area space-y-6">
        {/* ── EN-TÊTE DE FICHE (imprimable) ── */}
        <div className="print-header card-apple overflow-hidden">
          <div className="bg-gradient-to-r from-arina-accent via-arina-blue to-arina-blue-dark px-6 py-6 text-white flex flex-col sm:flex-row items-center gap-6">
            <div className="w-28 h-28 lg:w-32 lg:h-32 rounded-2xl overflow-hidden bg-white/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0 shadow-xl">
              {data.photo ? (
                <img src={data.photo} alt="Photo" className="w-full h-full object-cover" />
              ) : (
                <User className="w-14 h-14 text-white/80" />
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-white/70">Association ARINA — Dossier bénéficiaire</div>
              <h2 className="text-2xl lg:text-3xl font-bold tracking-tight mt-1">{data.prenom} {data.nom}</h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold border border-white/30">{data.code}</span>
                <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-semibold border border-white/30">{data.age} ans</span>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${data.statut === 'Actif' ? 'bg-emerald-500/30 border-emerald-200/60' : data.statut === 'Diplômé' ? 'bg-purple-500/30 border-purple-200/60' : 'bg-gray-500/30 border-gray-200/60'}`}>
                  {data.statut}
                </span>
              </div>
            </div>
            <img src="/logo-arina.jpg" alt="ARINA" className="hidden sm:block w-16 h-16 rounded-2xl object-contain bg-white/90 p-1.5 shadow-lg" />
          </div>
        </div>

        {/* ── DÉTAIL TAB ── */}
        {tab === 'detail' && (
          <>
            <div className="grid lg:grid-cols-3 gap-6 animate-fade-up">
              {/* Photo card */}
              <div className="card-apple p-6 text-center">
                <div
                  onClick={handlePhotoClick}
                  className={`w-28 h-28 mx-auto rounded-full flex items-center justify-center text-4xl mb-3 cursor-pointer transition-all border-2 border-dashed hover:border-arina-blue group relative overflow-hidden ${data.photo ? 'border-arina-blue/30' : 'border-ios-hairline bg-ios-fill'}`}
                >
                  {uploading ? (
                    <div className="animate-spin w-8 h-8 border-3 border-arina-blue border-t-transparent rounded-full" />
                  ) : data.photo ? (
                    <img src={data.photo} alt="Photo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <User className="w-10 h-10 text-gray-400 group-hover:text-arina-blue transition-colors" />
                      <span className="text-[10px] text-ios-text3 group-hover:text-arina-blue transition-colors font-medium">Cliquer</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-full transition-all flex items-center justify-center">
                    <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-bold transition-opacity flex items-center gap-1"><Camera className="w-4 h-4" /> Modifier</span>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                <p className="text-sm text-ios-text3 mb-1">Photo confidentielle</p>
                {data.photo && (
                  <button onClick={removePhoto} className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Supprimer la photo</button>
                )}
              </div>

              {/* Info card */}
              <div className="lg:col-span-2 card-apple p-6">
                {cardTitle('users', 'Informations personnelles')}
                {editing ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {['prenom', 'nom', 'age', 'genre', 'telephone', 'region', 'niveauScolaire'].map((k) => (
                      <input key={k} placeholder={k} value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={inputClass} />
                    ))}
                    <button onClick={saveEdit} className="col-span-2 mt-2 py-2.5 bg-arina-blue text-white font-semibold rounded-xl">Enregistrer</button>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    {[{ l: 'Nom', v: `${data.prenom} ${data.nom}` }, { l: 'Âge', v: `${data.age} ans` }, { l: 'Genre', v: data.genre }, { l: 'Téléphone', v: data.telephone }, { l: 'Région', v: data.region }, { l: 'Niveau scolaire', v: data.niveauScolaire }].map((r, i) => (
                      <div key={i}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{r.v || '—'}</span></div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 animate-fade-up" style={{ animationDelay: '80ms' }}>
              {/* Situation familiale */}
              <div className="card-apple p-6">
                {cardTitle('users', 'Situation familiale')}
                {editing ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {['situationFamiliale', 'parent', 'freresSoeurs'].map((k) => (
                      <input key={k} placeholder={k} value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={inputClass} />
                    ))}
                    <button onClick={saveEdit} className="col-span-2 mt-2 py-2.5 bg-arina-blue text-white font-semibold rounded-xl">Enregistrer</button>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    {[{ l: 'Situation', v: data.situationFamiliale }, { l: 'Parent/Tuteur', v: data.parent }, { l: 'Frères/sœurs', v: data.freresSoeurs }].map((r, i) => (
                      <div key={i}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{r.v || '—'}</span></div>
                    ))}
                  </div>
                )}
              </div>

              {/* Suivi ARINA */}
              <div className="card-apple p-6">
                {cardTitle('activity', 'Suivi ARINA')}
                {editing ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {['educateur', 'dateEntree', 'motif', 'objectifs', 'statut'].map((k) => (
                      <input key={k} placeholder={k} value={form[k] || ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={inputClass} />
                    ))}
                    <button onClick={saveEdit} className="col-span-2 mt-2 py-2.5 bg-arina-blue text-white font-semibold rounded-xl">Enregistrer</button>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    {[{ l: 'Éducateur référent', v: data.educateur }, { l: "Date d'entrée", v: data.dateEntree }, { l: 'Motif', v: data.motif }, { l: 'Objectifs', v: data.objectifs }, { l: 'Statut', v: data.statut, color: data.statut === 'Actif' ? 'text-green-600 dark:text-green-400' : '' }].map((r, i) => (
                      <div key={i}><span className="text-ios-text3">{r.l} :</span> <span className={`font-medium ${r.color || 'text-ios-text'}`}>{r.statut === 'Actif' && <Circle className="w-2.5 h-2.5 inline-block fill-current text-green-500 mr-1" />}{r.v || '—'}</span></div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Progression */}
            <div className="card-apple p-6 animate-fade-up" style={{ animationDelay: '160ms' }}>
              {cardTitle('activity', 'Progression')}
              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-ios-text3">Taux d'assiduité</span><span className="font-bold text-ios-text">{editing ? form.assiduite || data.assiduite : data.assiduite}%</span></div>
                  <div className="w-full h-3 bg-ios-fill rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${data.assiduite}%` }} /></div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-ios-text3">Score de progression</span><span className="font-bold text-ios-text">{editing ? form.progression || data.progression : data.progression}%</span></div>
                  <div className="w-full h-3 bg-ios-fill rounded-full overflow-hidden"><div className="h-full bg-arina-blue rounded-full transition-all" style={{ width: `${data.progression}%` }} /></div>
                </div>
              </div>
              {editing && (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <input type="number" placeholder="Assiduité %" value={form.assiduite || ''} onChange={(e) => setForm({ ...form, assiduite: e.target.value })} className={inputClass} />
                  <input type="number" placeholder="Progression %" value={form.progression || ''} onChange={(e) => setForm({ ...form, progression: e.target.value })} className={inputClass} />
                  <button onClick={saveEdit} className="col-span-2 py-2.5 bg-arina-blue text-white font-semibold rounded-xl">Enregistrer</button>
                </div>
              )}
            </div>

            {/* Dossier complet (IDENTITÉ / FAMILIALE / JURIDIQUE / ÉTUDE / ARINA) en 2 colonnes */}
            {data.dossier && (Object.keys(data.dossier).length > 0) && (
              <div className="grid md:grid-cols-2 gap-6 items-start animate-fade-up" style={{ animationDelay: '220ms' }}>
                {/* IDENTITÉ */}
                {(data.dossier.identite && Object.values(data.dossier.identite).some((v) => v)) && (
                  <div className="card-apple p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 text-white flex items-center justify-center"><Icon name="users" className="w-4 h-4" /></span>
                      <h4 className="font-bold uppercase tracking-wide text-sm">Identité</h4>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      {[{ l: 'Pseudo', v: data.dossier.identite.pseudo }, { l: 'Date de naissance', v: data.dossier.identite.dateNaissance }, { l: 'Lieu de naissance', v: data.dossier.identite.lieuNaissance }, { l: 'Adresse exacte', v: data.dossier.identite.adresse }, { l: 'Contact', v: data.dossier.identite.contact }, { l: 'Situation scolaire', v: data.dossier.identite.situationScolaire }, { l: 'Loisirs', v: data.dossier.identite.loisirs }].map((r, i) => (
                        <div key={i}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{r.v || '—'}</span></div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SITUATION FAMILIALE */}
                {(data.dossier.familiale && Object.values(data.dossier.familiale).some((v) => v)) && (
                  <div className="card-apple p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-arina-accent to-arina-blue-dark text-white flex items-center justify-center"><Icon name="grid" className="w-4 h-4" /></span>
                      <h4 className="font-bold uppercase tracking-wide text-sm">Situation familiale</h4>
                    </div>
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
                  </div>
                )}

                {/* SITUATION JURIDIQUE */}
                {(data.dossier.juridique && Object.values(data.dossier.juridique).some((v) => v)) && (
                  <div className="card-apple p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center"><Icon name="file" className="w-4 h-4" /></span>
                      <h4 className="font-bold uppercase tracking-wide text-sm">Situation juridique</h4>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      {[{ l: "Motifs d'inculpation", f: 'motifInculpation' }, { l: "Date d'écrou", f: 'dateEcrou' }, { l: 'Durée de détention', f: 'dureeDetention' }, { l: 'Date de libération', f: 'dateLiberation' }, { l: 'Motifs de libération', f: 'motifLiberation' }].map((r, i) => (
                        <div key={i} className={i === 0 ? 'sm:col-span-2' : ''}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{data.dossier.juridique[r.f] || '—'}</span></div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ÉTUDE */}
                {(data.dossier.etude && Object.values(data.dossier.etude).some((v) => v)) && (
                  <div className="card-apple p-6">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-500 text-white flex items-center justify-center"><Icon name="calendar" className="w-4 h-4" /></span>
                      <h4 className="font-bold uppercase tracking-wide text-sm">Étude</h4>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      {[{ l: 'Classe actuelle', f: 'classeActuelle' }, { l: 'Établissement', f: 'etablissement' }, { l: 'Carrière envisagée', f: 'carriereEnvisagee' }, { l: 'Diplôme obtenu', f: 'diplomeObtenu' }, { l: 'Spécialités', f: 'specialites' }].map((r, i) => (
                        <div key={i} className={i === 4 ? 'sm:col-span-2' : ''}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{data.dossier.etude[r.f] || '—'}</span></div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ARINA — pleine largeur (2 colonnes) */}
                {((data.dossier.arina && Object.values(data.dossier.arina).some((v) => v)) || data.dateEntree || data.formation) && (
                  <div className="card-apple p-6 md:col-span-2">
                    <div className="flex items-center gap-2.5 mb-4">
                      <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-arina-gold to-amber-600 text-white flex items-center justify-center"><Icon name="star" className="w-4 h-4" /></span>
                      <h4 className="font-bold uppercase tracking-wide text-sm">ARINA</h4>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      {[{ l: "Date d'entrée au centre", v: data.dossier.arina?.dateEntreeCentre || data.dateEntree }, { l: 'Formation au centre', v: data.formation }, { l: "Date d'entrée (fiche)", v: data.dateEntree }].filter((r) => r.v).map((r, i) => (
                        <div key={i}><span className="text-ios-text3">{r.l} :</span> <span className="font-medium text-ios-text">{r.v || '—'}</span></div>
                      ))}
                    </div>
                    {data.dossier.arina?.felicitations && (
                      <div className="mt-4 rounded-xl bg-arina-warm/70 dark:bg-white/5 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-ios-text3 mb-2">Félicitations et encouragements</div>
                        <p className="text-sm text-ios-text leading-relaxed whitespace-pre-line">{data.dossier.arina.felicitations}</p>
                      </div>
                    )}
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
            value={data.notes} onChange={(e) => setData({ ...data, notes: e.target.value })} />
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
    </AdminLayout>
  );
}
