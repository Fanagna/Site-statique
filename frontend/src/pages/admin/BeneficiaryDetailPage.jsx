import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { updateBeneficiaryPhoto } from '../../services/api';

/* ── Mock enriched data ── */
const benefDetails = {
  1: { id: 1, prenom: 'Thomas', nom: 'M.', age: 17, code: 'AR-001', genre: 'Masculin', telephone: '034 12 345 67', region: 'Analamanga', niveauScolaire: '3ème',
    situationFamiliale: 'Famille monoparentale', parent: 'Mme R., commerçante', freresSoeurs: 2,
    educateur: 'M. Rakoto', dateEntree: '2024-01-15', motif: 'Sortie de prison', objectifs: 'Autonomie professionnelle, menuiserie', statut: 'Actif',
    assiduite: 85, progression: 75,
    formations: [{ nom: 'Menuiserie', statut: 'En cours', progression: 75, emoji: '🪚' }, { nom: 'Cuisine', statut: 'Terminé', progression: 90, emoji: '🍳' }],
    suivis: [
      { date: '02/12/2024', type: 'Entretien mensuel', note: 'Progression positive' },
      { date: '25/11/2024', type: 'Atelier menuiserie', note: 'Participation active' },
      { date: '18/11/2024', type: 'Suivi psychologique', note: 'Bon moral' },
    ],
    notes: '',
  },
  2: { id: 2, prenom: 'Marie', nom: 'K.', age: 16, code: 'AR-002', genre: 'Féminin', telephone: '033 98 765 43', region: 'Antananarivo', niveauScolaire: '4ème',
    situationFamiliale: 'Orpheline', parent: 'Grand-mère', freresSoeurs: 0,
    educateur: 'Mme. Ravao', dateEntree: '2024-04-20', motif: 'Vulnérabilité', objectifs: 'Formation cuisine, autonomie', statut: 'Actif',
    assiduite: 92, progression: 80,
    formations: [{ nom: 'Cuisine', statut: 'En cours', progression: 80, emoji: '🍳' }],
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
    let detail = benefDetails[id];
    if (!detail) {
      const stored = JSON.parse(localStorage.getItem('arina_benefs') || '[]');
      const b = stored.find(x => x.id === Number(id));
      if (b) {
        detail = {
          ...b, code: `AR-${String(b.id).padStart(3, '0')}`, genre: '', telephone: '', region: '', niveauScolaire: '',
          situationFamiliale: '', parent: '', freresSoeurs: 0, educateur: '', motif: '', objectifs: '',
          assiduite: 0, progression: 0, formations: [], suivis: [], notes: '',
        };
      }
    }
    if (detail) {
      setData(detail);
      setForm({ ...detail });
      setSuivis(detail.suivis || []);
    }
  }, [id]);

  if (!data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-xl font-bold text-arina-dark mb-2">Bénéficiaire introuvable</h2>
        <button onClick={() => navigate('/admin')} className="px-6 py-2.5 bg-arina-blue text-white rounded-xl font-semibold mt-4">← Retour</button>
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
      const idx = stored.findIndex(x => x.id === Number(id));
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
    const idx = stored.findIndex(x => x.id === Number(id));
    if (idx >= 0) {
      delete stored[idx].photo;
      localStorage.setItem('arina_benefs', JSON.stringify(stored));
    }
  };

  const sidebarItems = [
    { key: 'detail', label: 'Détail', icon: '👤' },
    { key: 'suivi', label: 'Suivi', icon: '📋' },
    { key: 'formations', label: 'Formations', icon: '🎓' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 hidden lg:flex">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img src="/logo-arina.jpg" alt="" className="w-9 h-9 rounded-xl object-contain shadow" />
            <div><div className="font-bold text-arina-dark text-sm">ARINA Admin</div><div className="text-xs text-arina-gray">{user?.username}</div></div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {sidebarItems.map((item) => (
            <button key={item.key} onClick={() => setTab(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${tab === item.key ? 'bg-arina-blue text-white shadow-md' : 'text-arina-dark hover:bg-gray-50'}`}>
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100 space-y-1">
          <button onClick={() => navigate('/admin')} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-arina-gray hover:text-arina-blue rounded-xl hover:bg-gray-50 transition-all">← Dashboard</button>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-all">🚪 Déconnexion</button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm text-arina-gray mb-1">
                <Link to="/admin" className="hover:text-arina-blue">Dashboard</Link><span>/</span><span className="text-arina-dark">Bénéficiaires</span><span>/</span>
              </div>
              <h1 className="text-xl font-serif font-bold text-arina-dark flex items-center gap-3">
                👤 {data.prenom} {data.nom} <span className="text-sm font-normal text-arina-gray">- {data.code}</span>
              </h1>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(!editing)} className="px-4 py-2 bg-arina-blue text-white text-sm font-semibold rounded-lg hover:bg-arina-blue-dark transition-colors">{editing ? 'Annuler' : 'Modifier'}</button>
              <button onClick={() => alert('Historique de suivi')} className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors">Suivi</button>
              <button onClick={() => { if (confirm('Supprimer ?')) navigate('/admin'); }} className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors">Supprimer</button>
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-8 space-y-6">
          {/* ── DÉTAIL TAB ── */}
          {tab === 'detail' && (
            <>
              {/* Top section: Photo + Info */}
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Photo card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
                  <div
                    onClick={handlePhotoClick}
                    className={`w-28 h-28 mx-auto rounded-full flex items-center justify-center text-4xl mb-3 cursor-pointer transition-all border-2 border-dashed hover:border-arina-blue group relative overflow-hidden ${data.photo ? 'border-arina-blue/30' : 'border-gray-300 bg-gray-100'}`}
                  >
                    {uploading ? (
                      <div className="animate-spin w-8 h-8 border-3 border-arina-blue border-t-transparent rounded-full" />
                    ) : data.photo ? (
                      <img src={data.photo} alt="Photo" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-gray-400 group-hover:text-arina-blue transition-colors">👤</span>
                        <span className="text-[10px] text-arina-gray group-hover:text-arina-blue transition-colors font-medium">Cliquer</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-full transition-all flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-bold transition-opacity">📷 Modifier</span>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                  <p className="text-sm text-arina-gray mb-1">Photo confidentielle</p>
                  {data.photo && (
                    <button onClick={removePhoto} className="text-xs text-red-500 hover:text-red-700 transition-colors">
                      🗑️ Supprimer la photo
                    </button>
                  )}
                </div>

                {/* Info card */}
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <h3 className="font-bold text-arina-dark mb-4">Informations personnelles</h3>
                  {editing ? (
                    <div className="grid sm:grid-cols-2 gap-3">
                      {['prenom','nom','age','genre','telephone','region','niveauScolaire'].map(k => (
                        <input key={k} placeholder={k} value={form[k] || ''} onChange={e => setForm({...form, [k]: e.target.value})}
                          className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                      ))}
                      <button onClick={saveEdit} className="col-span-2 mt-2 py-2.5 bg-arina-blue text-white font-semibold rounded-xl">Enregistrer</button>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      {[{l:'Nom',v:`${data.prenom} ${data.nom}`},{l:'Âge',v:`${data.age} ans`},{l:'Genre',v:data.genre},{l:'Téléphone',v:data.telephone},{l:'Région',v:data.region},{l:'Niveau scolaire',v:data.niveauScolaire}].map((r,i) => (
                        <div key={i}><span className="text-arina-gray">{r.l} :</span> <span className="font-medium text-arina-dark">{r.v || '—'}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Situation familiale */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-arina-dark mb-3">Situation familiale</h3>
                {editing ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {['situationFamiliale','parent','freresSoeurs'].map(k => (
                      <input key={k} placeholder={k} value={form[k] || ''} onChange={e => setForm({...form, [k]: e.target.value})} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                    ))}
                    <button onClick={saveEdit} className="col-span-2 mt-2 py-2.5 bg-arina-blue text-white font-semibold rounded-xl">Enregistrer</button>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    {[{l:'Situation',v:data.situationFamiliale},{l:'Parent/Tuteur',v:data.parent},{l:'Frères/sœurs',v:data.freresSoeurs}].map((r,i) => (
                      <div key={i}><span className="text-arina-gray">{r.l} :</span> <span className="font-medium text-arina-dark">{r.v || '—'}</span></div>
                    ))}
                  </div>
                )}
              </div>

              {/* Suivi ARINA */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-arina-dark mb-3">Suivi ARINA</h3>
                {editing ? (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {['educateur','dateEntree','motif','objectifs','statut'].map(k => (
                      <input key={k} placeholder={k} value={form[k] || ''} onChange={e => setForm({...form, [k]: e.target.value})} className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm" />
                    ))}
                    <button onClick={saveEdit} className="col-span-2 mt-2 py-2.5 bg-arina-blue text-white font-semibold rounded-xl">Enregistrer</button>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    {[{l:'Éducateur référent',v:data.educateur},{l:"Date d'entrée",v:data.dateEntree},{l:'Motif',v:data.motif},{l:'Objectifs',v:data.objectifs},{l:'Statut',v:data.statut,color:data.statut==='Actif'?'text-green-600':''}].map((r,i) => (
                      <div key={i}><span className="text-arina-gray">{r.l} :</span> <span className={`font-medium ${r.color||'text-arina-dark'}`}>{r.statut==='Actif'?'🟢 ':''}{r.v||'—'}</span></div>
                    ))}
                  </div>
                )}
              </div>

              {/* Progression */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-arina-dark mb-4">Progression</h3>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span className="text-arina-gray">Taux d'assiduité</span><span className="font-bold text-arina-dark">{editing ? form.assiduite || data.assiduite : data.assiduite}%</span></div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all" style={{width:`${data.assiduite}%`}} /></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1"><span className="text-arina-gray">Score de progression</span><span className="font-bold text-arina-dark">{editing ? form.progression || data.progression : data.progression}%</span></div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-arina-blue rounded-full transition-all" style={{width:`${data.progression}%`}} /></div>
                  </div>
                </div>
                {editing && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <input type="number" placeholder="Assiduité %" value={form.assiduite||''} onChange={e=>setForm({...form,assiduite:e.target.value})} className="px-3 py-2 bg-gray-50 border rounded-lg text-sm" />
                    <input type="number" placeholder="Progression %" value={form.progression||''} onChange={e=>setForm({...form,progression:e.target.value})} className="px-3 py-2 bg-gray-50 border rounded-lg text-sm" />
                    <button onClick={saveEdit} className="col-span-2 py-2.5 bg-arina-blue text-white font-semibold rounded-xl">Enregistrer</button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── FORMATIONS TAB ── */}
          {tab === 'formations' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-arina-dark mb-4">Formations</h3>
              <div className="space-y-4">
                {(data.formations || []).map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">{f.emoji}</span>
                      <div>
                        <div className="font-semibold text-arina-dark">{f.nom}</div>
                        <div className="text-sm text-arina-gray">{f.statut}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-arina-blue rounded-full" style={{width:`${f.progression}%`}} /></div>
                      <span className="text-sm font-bold text-arina-dark">{f.progression}%</span>
                    </div>
                  </div>
                ))}
                {(data.formations || []).length === 0 && <p className="text-arina-gray text-sm">Aucune formation enregistrée</p>}
              </div>
            </div>
          )}

          {/* ── SUIVI TAB ── */}
          {tab === 'suivi' && (
            <div className="space-y-6">
              {/* Add suivi */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-arina-dark mb-3">➕ Ajouter un suivi</h3>
                <div className="flex gap-3">
                  <input value={newSuivi} onChange={e=>setNewSuivi(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSuivi()} placeholder="Nouvelle entrée de suivi..." className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                  <button onClick={addSuivi} className="px-6 py-2.5 bg-arina-blue text-white text-sm font-semibold rounded-xl hover:bg-arina-blue-dark">Ajouter</button>
                </div>
              </div>

              {/* Suivi entries */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-arina-dark mb-4">📋 Suivi individuel</h3>
                <div className="space-y-3">
                  {suivis.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <span className="text-xs font-semibold text-arina-gray bg-white px-2 py-1 rounded-lg whitespace-nowrap">{s.date}</span>
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-arina-blue bg-arina-blue/10 px-2 py-0.5 rounded-full">{s.type}</span>
                        <p className="text-sm text-arina-dark mt-1">{s.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notes confidentielles (always visible at bottom) */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
            <h3 className="font-bold text-arina-dark mb-3">🔒 Notes confidentielles</h3>
            <textarea rows={3} className="w-full px-4 py-3 bg-white border border-yellow-200 rounded-xl text-sm resize-none"
              placeholder="Notes réservées à l'administrateur..."
              value={data.notes} onChange={e => setData({...data, notes: e.target.value})} />
          </div>
        </div>
      </main>
    </div>
  );
}
