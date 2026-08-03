import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchBeneficiaries, createBeneficiary, updateBeneficiary, deleteBeneficiary,
  fetchFinances, createFinance, deleteFinance,
  fetchNews, deleteNews,
} from '../../services/api';
import { allNews } from '../../data/news';

/* ── Helpers ── */
const formatMGA = (n) => n.toLocaleString('fr-FR') + ' Ar';
const today = () => new Date().toISOString().split('T')[0];
const inputClass = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('beneficiaires');
  const [apiStatus, setApiStatus] = useState('checking'); // checking | online | offline

  /* Beneficiaires state */
  const [benefs, setBenefs] = useState([]);
  const [benefsLoading, setBenefsLoading] = useState(true);
  const [showBenefForm, setShowBenefForm] = useState(false);
  const [editingBenef, setEditingBenef] = useState(null);
  const [benefForm, setBenefForm] = useState({ prenom: '', nom: '', age: '', statut: 'Actif', dateEntree: today(), formation: '' });
  const [benefFilter, setBenefFilter] = useState('');

  /* Finances state */
  const [finances, setFinances] = useState([]);
  const [financesLoading, setFinancesLoading] = useState(true);
  const [showFinanceForm, setShowFinanceForm] = useState(false);
  const [financeForm, setFinanceForm] = useState({ type: 'Revenu', categorie: 'Don', montant: '', description: '', date: today() });

  /* News state */
  const [news, setNews] = useState(allNews);
  const [newsLoading, setNewsLoading] = useState(true);

  // ── Load data from API (with localStorage fallback) ──
  const loadData = useCallback(async () => {
    // Beneficiaries
    let bFromApi = await fetchBeneficiaries();
    if (bFromApi && bFromApi.length > 0) {
      setBenefs(bFromApi);
      setApiStatus('online');
    } else {
      const stored = localStorage.getItem('arina_benefs');
      setBenefs(stored ? JSON.parse(stored) : []);
      if (apiStatus === 'checking') setApiStatus('offline');
    }
    setBenefsLoading(false);

    // Finances
    let fFromApi = await fetchFinances();
    if (fFromApi && fFromApi.length > 0) {
      setFinances(fFromApi);
    } else {
      const stored = localStorage.getItem('arina_finances');
      setFinances(stored ? JSON.parse(stored) : []);
    }
    setFinancesLoading(false);

    // News
    let nFromApi = await fetchNews();
    if (nFromApi && nFromApi.length > 0) {
      setNews(nFromApi);
    }
    setNewsLoading(false);
  }, [apiStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  // Persist to localStorage as fallback
  useEffect(() => { if (benefs.length) localStorage.setItem('arina_benefs', JSON.stringify(benefs)); }, [benefs]);
  useEffect(() => { if (finances.length) localStorage.setItem('arina_finances', JSON.stringify(finances)); }, [finances]);
  useEffect(() => { if (news !== allNews) localStorage.setItem('arina_news', JSON.stringify(news)); }, [news]);

  /* ── Beneficiaires CRUD ── */
  const openBenefForm = (b) => {
    if (b) {
      setEditingBenef(b);
      setBenefForm({ prenom: b.prenom, nom: b.nom, age: String(b.age), statut: b.statut, dateEntree: b.dateEntree, formation: b.formation });
    } else {
      setEditingBenef(null);
      setBenefForm({ prenom: '', nom: '', age: '', statut: 'Actif', dateEntree: today(), formation: '' });
    }
    setShowBenefForm(true);
  };

  const saveBenef = async () => {
    const data = { ...benefForm, age: Number(benefForm.age) || 0 };
    if (editingBenef) {
      const updated = await updateBeneficiary(editingBenef.id, data);
      if (updated) {
        setBenefs(benefs.map((b) => b.id === editingBenef.id ? updated : b));
      } else {
        setBenefs(benefs.map((b) => b.id === editingBenef.id ? { ...b, ...data } : b));
      }
    } else {
      const created = await createBeneficiary(data);
      if (created) {
        setBenefs([created, ...benefs]);
      } else {
        setBenefs([{ id: Date.now(), ...data }, ...benefs]);
      }
    }
    setShowBenefForm(false);
  };

  const removeBenef = async (id) => {
    if (!window.confirm('Supprimer ce bénéficiaire ?')) return;
    const ok = await deleteBeneficiary(id);
    if (ok !== null) setBenefs(benefs.filter(b => b.id !== id));
    else setBenefs(benefs.filter(b => b.id !== id));
  };

  /* ── Finances CRUD ── */
  const saveFinance = async () => {
    const data = { ...financeForm, montant: Number(financeForm.montant) || 0 };
    const created = await createFinance(data);
    if (created) {
      setFinances([created, ...finances]);
    } else {
      setFinances([{ id: Date.now(), ...data }, ...finances]);
    }
    setShowFinanceForm(false);
    setFinanceForm({ type: 'Revenu', categorie: 'Don', montant: '', description: '', date: today() });
  };

  const removeFinance = async (id) => {
    if (!window.confirm('Supprimer cette transaction ?')) return;
    await deleteFinance(id);
    setFinances(finances.filter(f => f.id !== id));
  };

  /* ── News ── */
  const removeNews = async (id) => {
    if (!window.confirm('Supprimer cet article ?')) return;
    await deleteNews(id);
    setNews(news.filter(n => n.id !== id));
  };

  /* ── Totals ── */
  const totalRevenus = finances.filter(f => f.type === 'Revenu').reduce((s, f) => s + f.montant, 0);
  const totalDepenses = finances.filter(f => f.type === 'Dépense').reduce((s, f) => s + f.montant, 0);
  const solde = totalRevenus - totalDepenses;
  const filteredBenefs = benefFilter ? benefs.filter(b => b.statut === benefFilter) : benefs;

  const navItems = [
    { key: 'beneficiaires', label: 'Bénéficiaires', icon: '👧', count: benefs.length },
    { key: 'finances', label: 'Finances', icon: '💰', count: `${formatMGA(solde)}` },
    { key: 'actualites', label: 'Actualités', icon: '📰', count: news.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 hidden lg:flex">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <img src="/logo-arina.jpg" alt="ARINA" className="w-10 h-10 rounded-xl object-contain shadow" />
            <div>
              <div className="font-bold text-arina-dark text-sm">ARINA Admin</div>
              <div className="text-xs text-arina-gray">{user?.username}</div>
            </div>
          </div>
          {/* API status */}
          <div className="mt-3 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-green-500' : apiStatus === 'offline' ? 'bg-yellow-500' : 'bg-gray-300 animate-pulse'}`} />
            <span className="text-xs text-arina-gray">
              {apiStatus === 'online' ? 'Base de données' : apiStatus === 'offline' ? 'Mode local' : 'Connexion...'}
            </span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${tab === item.key ? 'bg-arina-blue text-white shadow-md' : 'text-arina-dark hover:bg-gray-50'}`}
            >
              <span>{item.icon}</span><span className="flex-1 text-left">{item.label}</span>
              <span className={`text-xs ${tab === item.key ? 'text-white/70' : 'text-arina-gray'}`}>{typeof item.count === 'number' ? item.count : ''}</span>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <a href="/" className="flex items-center gap-2 px-4 py-2.5 text-sm text-arina-gray hover:text-arina-blue rounded-xl hover:bg-gray-50 transition-all mb-1">← Retour au site</a>
          <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-all">🚪 Déconnexion</button>
        </div>
      </aside>

      {/* Mobile nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex">
        {navItems.map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)} className={`flex-1 flex flex-col items-center py-2.5 text-xs font-medium ${tab === item.key ? 'text-arina-blue' : 'text-arina-gray'}`}>
            <span className="text-lg">{item.icon}</span>{item.label.split(' ')[0]}
          </button>
        ))}
        <button onClick={logout} className="flex-1 flex flex-col items-center py-2.5 text-xs text-red-500 font-medium"><span className="text-lg">🚪</span>Quitter</button>
      </div>

      {/* Main */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        <div className="bg-white border-b border-gray-200 px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-serif font-bold text-arina-dark">{navItems.find(n => n.key === tab)?.label}</h1>
            <p className="text-xs text-arina-gray">Tableau de bord administrateur</p>
          </div>
          <span className="w-8 h-8 bg-arina-blue/10 rounded-full flex items-center justify-center text-arina-blue font-bold text-sm">
            {user?.username?.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="p-4 lg:p-8">

          {/* ═══ BÉNÉFICIAIRES ═══ */}
          {tab === 'beneficiaires' && (
            <div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[{ label: 'Total', value: benefs.length, color: 'text-arina-blue' },{ label: 'Actifs', value: benefs.filter(b => b.statut === 'Actif').length, color: 'text-green-600' },{ label: 'Diplômés', value: benefs.filter(b => b.statut === 'Diplômé').length, color: 'text-purple-600' },{ label: 'Inactifs', value: benefs.filter(b => b.statut === 'Inactif').length, color: 'text-red-600' }].map((s, i) => (
                  <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"><div className={`text-2xl font-extrabold ${s.color}`}>{benefsLoading ? '—' : s.value}</div><div className="text-xs text-arina-gray">{s.label}</div></div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <select value={benefFilter} onChange={(e) => setBenefFilter(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm">
                  <option value="">Tous les statuts</option><option value="Actif">Actif</option><option value="Diplômé">Diplômé</option><option value="Inactif">Inactif</option>
                </select>
                <button onClick={() => openBenefForm(null)} className="px-4 py-2 bg-arina-blue text-white text-sm font-semibold rounded-lg hover:bg-arina-blue-dark transition-colors ml-auto">+ Ajouter</button>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left"><tr><th className="px-4 py-3 font-semibold text-arina-dark">Nom</th><th className="px-4 py-3 font-semibold text-arina-dark">Prénom</th><th className="px-4 py-3 font-semibold text-arina-dark">Âge</th><th className="px-4 py-3 font-semibold text-arina-dark">Statut</th><th className="px-4 py-3 font-semibold text-arina-dark">Formation</th><th className="px-4 py-3 font-semibold text-arina-dark">Entrée</th><th className="px-4 py-3 font-semibold text-arina-dark">Actions</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredBenefs.map((b) => (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-arina-dark">{b.nom}</td><td className="px-4 py-3">{b.prenom}</td><td className="px-4 py-3">{b.age}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.statut === 'Actif' ? 'bg-green-100 text-green-700' : b.statut === 'Diplômé' ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}`}>{b.statut}</span></td>
                          <td className="px-4 py-3">{b.formation}</td><td className="px-4 py-3 text-arina-gray">{b.dateEntree ? new Date(b.dateEntree).toLocaleDateString('fr-FR') : ''}</td>
                          <td className="px-4 py-3"><div className="flex gap-1"><button onClick={() => openBenefForm(b)} className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100">✏️</button><button onClick={() => removeBenef(b.id)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">🗑️</button></div></td>
                        </tr>
                      ))}
                      {filteredBenefs.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-arina-gray">{benefsLoading ? 'Chargement...' : 'Aucun bénéficiaire'}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══ FINANCES ═══ */}
          {tab === 'finances' && (
            <div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[{ label: 'Revenus', value: formatMGA(totalRevenus), color: 'text-green-600', bg: 'bg-green-50' },{ label: 'Dépenses', value: formatMGA(totalDepenses), color: 'text-red-600', bg: 'bg-red-50' },{ label: 'Solde', value: formatMGA(solde), color: solde >= 0 ? 'text-arina-blue' : 'text-red-600', bg: solde >= 0 ? 'bg-arina-blue/5' : 'bg-red-50' }].map((s, i) => (
                  <div key={i} className={`${s.bg} rounded-xl p-4 border border-gray-100`}><div className={`text-xl lg:text-2xl font-extrabold ${s.color}`}>{financesLoading ? '—' : s.value}</div><div className="text-xs text-arina-gray">{s.label}</div></div>
                ))}
              </div>
              <button onClick={() => setShowFinanceForm(true)} className="px-4 py-2 bg-arina-blue text-white text-sm font-semibold rounded-lg hover:bg-arina-blue-dark transition-colors mb-4">+ Ajouter transaction</button>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left"><tr><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Catégorie</th><th className="px-4 py-3 font-semibold">Montant</th><th className="px-4 py-3 font-semibold">Description</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold"></th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {finances.map((f) => (
                        <tr key={f.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.type === 'Revenu' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{f.type}</span></td>
                          <td className="px-4 py-3 text-arina-dark">{f.categorie}</td>
                          <td className={`px-4 py-3 font-semibold ${f.type === 'Revenu' ? 'text-green-600' : 'text-red-600'}`}>{formatMGA(f.montant)}</td>
                          <td className="px-4 py-3 text-arina-gray">{f.description}</td>
                          <td className="px-4 py-3 text-arina-gray text-xs">{f.date ? new Date(f.date).toLocaleDateString('fr-FR') : ''}</td>
                          <td className="px-4 py-3"><button onClick={() => removeFinance(f.id)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">🗑️</button></td>
                        </tr>
                      ))}
                      {finances.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-arina-gray">{financesLoading ? 'Chargement...' : 'Aucune transaction'}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══ ACTUALITÉS ═══ */}
          {tab === 'actualites' && (
            <div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left"><tr><th className="px-4 py-3 font-semibold">Titre</th><th className="px-4 py-3 font-semibold">Catégorie</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Vues</th><th className="px-4 py-3 font-semibold">Actions</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {news.map((n) => (
                        <tr key={n.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-arina-dark max-w-xs truncate">{n.title}</td>
                          <td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 text-arina-dark rounded-full text-xs">{n.category}</span></td>
                          <td className="px-4 py-3 text-arina-gray text-xs">{n.date}</td>
                          <td className="px-4 py-3">👁️ {n.views || 0}</td>
                          <td className="px-4 py-3"><div className="flex gap-1"><a href={`/actualites/${n.slug || n.id}`} target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-xs bg-gray-50 text-arina-dark rounded hover:bg-gray-100">👁️</a><button onClick={() => removeNews(n.id)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">🗑️</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Beneficiaire Modal */}
      {showBenefForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowBenefForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-arina-dark mb-4">{editingBenef ? 'Modifier' : 'Ajouter'} un bénéficiaire</h3>
            <div className="space-y-3">
              <input placeholder="Prénom" value={benefForm.prenom} onChange={(e) => setBenefForm({ ...benefForm, prenom: e.target.value })} className={inputClass} />
              <input placeholder="Nom" value={benefForm.nom} onChange={(e) => setBenefForm({ ...benefForm, nom: e.target.value })} className={inputClass} />
              <input type="number" placeholder="Âge" value={benefForm.age} onChange={(e) => setBenefForm({ ...benefForm, age: e.target.value })} className={inputClass} />
              <select value={benefForm.statut} onChange={(e) => setBenefForm({ ...benefForm, statut: e.target.value })} className={inputClass}><option value="Actif">Actif</option><option value="Diplômé">Diplômé</option><option value="Inactif">Inactif</option></select>
              <input placeholder="Formation" value={benefForm.formation} onChange={(e) => setBenefForm({ ...benefForm, formation: e.target.value })} className={inputClass} />
              <input type="date" value={benefForm.dateEntree} onChange={(e) => setBenefForm({ ...benefForm, dateEntree: e.target.value })} className={inputClass} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveBenef} className="flex-1 py-2.5 bg-arina-blue text-white font-semibold rounded-xl hover:bg-arina-blue-dark transition-colors">Enregistrer</button>
              <button onClick={() => setShowBenefForm(false)} className="flex-1 py-2.5 bg-gray-100 text-arina-dark font-semibold rounded-xl hover:bg-gray-200 transition-colors">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Finance Modal */}
      {showFinanceForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowFinanceForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-arina-dark mb-4">Ajouter une transaction</h3>
            <div className="space-y-3">
              <select value={financeForm.type} onChange={(e) => setFinanceForm({ ...financeForm, type: e.target.value })} className={inputClass}><option value="Revenu">Revenu</option><option value="Dépense">Dépense</option></select>
              <select value={financeForm.categorie} onChange={(e) => setFinanceForm({ ...financeForm, categorie: e.target.value })} className={inputClass}><option value="Don">Don</option><option value="Subvention">Subvention</option><option value="Alimentation">Alimentation</option><option value="Équipement">Équipement</option><option value="Salaire">Salaire</option><option value="Autre">Autre</option></select>
              <input type="number" placeholder="Montant (Ar)" value={financeForm.montant} onChange={(e) => setFinanceForm({ ...financeForm, montant: e.target.value })} className={inputClass} />
              <input placeholder="Description" value={financeForm.description} onChange={(e) => setFinanceForm({ ...financeForm, description: e.target.value })} className={inputClass} />
              <input type="date" value={financeForm.date} onChange={(e) => setFinanceForm({ ...financeForm, date: e.target.value })} className={inputClass} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveFinance} className="flex-1 py-2.5 bg-arina-blue text-white font-semibold rounded-xl hover:bg-arina-blue-dark transition-colors">Enregistrer</button>
              <button onClick={() => setShowFinanceForm(false)} className="flex-1 py-2.5 bg-gray-100 text-arina-dark font-semibold rounded-xl hover:bg-gray-200 transition-colors">Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
