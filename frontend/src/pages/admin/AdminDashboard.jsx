import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  fetchBeneficiaries, createBeneficiary, updateBeneficiary, deleteBeneficiary,
  fetchFinances, createFinance, deleteFinance,
  fetchNews, deleteNews, createNews, updateNews,
} from '../../services/api';
import { allNews } from '../../data/news';

const formatMGA = (n) => n.toLocaleString('fr-FR') + ' Ar';
const today = () => new Date().toISOString().split('T')[0];
const inputClass = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [apiStatus, setApiStatus] = useState('checking');

  /* ── Data ── */
  const [benefs, setBenefs] = useState([]);
  const [benefsLoading, setBenefsLoading] = useState(true);
  const [finances, setFinances] = useState([]);
  const [financesLoading, setFinancesLoading] = useState(true);
  const [news, setNews] = useState(allNews);
  const [newsLoading, setNewsLoading] = useState(true);

  /* Benef CRUD */
  const [showBenefForm, setShowBenefForm] = useState(false);
  const [editingBenef, setEditingBenef] = useState(null);
  const [benefForm, setBenefForm] = useState({ prenom: '', nom: '', age: '', statut: 'Actif', dateEntree: today(), formation: '' });
  const [benefFilter, setBenefFilter] = useState('');

  /* Finance CRUD */
  const [showFinanceForm, setShowFinanceForm] = useState(false);
  const [financeForm, setFinanceForm] = useState({ type: 'Revenu', categorie: 'Don', montant: '', description: '', date: today() });

  /* News CRUD */
  const [showNewsForm, setShowNewsForm] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [newsForm, setNewsForm] = useState({ title: '', excerpt: '', category: 'Événement', image_url: '' });

  /* ── Load ── */
  const loadData = useCallback(async () => {
    let bFromApi = await fetchBeneficiaries();
    if (bFromApi?.length) { setBenefs(bFromApi); setApiStatus('online'); }
    else { const s = localStorage.getItem('arina_benefs'); setBenefs(s ? JSON.parse(s) : []); if (apiStatus === 'checking') setApiStatus('offline'); }
    setBenefsLoading(false);
    let fFromApi = await fetchFinances();
    if (fFromApi?.length) setFinances(fFromApi);
    else { const s = localStorage.getItem('arina_finances'); setFinances(s ? JSON.parse(s) : []); }
    setFinancesLoading(false);
    let nFromApi = await fetchNews();
    if (nFromApi?.length) setNews(nFromApi); else setNews(allNews);
    setNewsLoading(false);
  }, []);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (benefs.length) localStorage.setItem('arina_benefs', JSON.stringify(benefs)); }, [benefs]);
  useEffect(() => { if (finances.length) localStorage.setItem('arina_finances', JSON.stringify(finances)); }, [finances]);
  useEffect(() => { if (news !== allNews) localStorage.setItem('arina_news', JSON.stringify(news)); }, [news]);

  /* ── CRUD handlers ── */
  const openBenefForm = (b) => {
    if (b) { setEditingBenef(b); setBenefForm({ prenom: b.prenom, nom: b.nom, age: String(b.age), statut: b.statut, dateEntree: b.dateEntree, formation: b.formation }); }
    else { setEditingBenef(null); setBenefForm({ prenom: '', nom: '', age: '', statut: 'Actif', dateEntree: today(), formation: '' }); }
    setShowBenefForm(true);
  };
  const saveBenef = async () => {
    const d = { ...benefForm, age: Number(benefForm.age) || 0 };
    if (editingBenef) { const u = await updateBeneficiary(editingBenef.id, d); setBenefs(benefs.map(b => b.id === editingBenef.id ? (u || { ...b, ...d }) : b)); }
    else { const c = await createBeneficiary(d); setBenefs([c || { id: Date.now(), ...d }, ...benefs]); }
    setShowBenefForm(false);
  };
  const removeBenef = async (id) => { if (!confirm('Supprimer ?')) return; await deleteBeneficiary(id); setBenefs(benefs.filter(b => b.id !== id)); };
  const saveFinance = async () => {
    const d = { ...financeForm, montant: Number(financeForm.montant) || 0 };
    const c = await createFinance(d); setFinances([c || { id: Date.now(), ...d }, ...finances]);
    setShowFinanceForm(false); setFinanceForm({ type: 'Revenu', categorie: 'Don', montant: '', description: '', date: today() });
  };
  const removeFinance = async (id) => { if (!confirm('Supprimer ?')) return; await deleteFinance(id); setFinances(finances.filter(f => f.id !== id)); };
  const openNewsForm = (n) => {
    if (n) { setEditingNews(n); setNewsForm({ title: n.title || '', excerpt: n.excerpt || '', category: n.category || 'Événement', image_url: n.image_url || '' }); }
    else { setEditingNews(null); setNewsForm({ title: '', excerpt: '', category: 'Événement', image_url: '' }); }
    setShowNewsForm(true);
  };
  const saveNews = async () => {
    if (editingNews) { const u = await updateNews(editingNews.id, newsForm); setNews(news.map(n => n.id === editingNews.id ? (u || { ...n, ...newsForm }) : n)); }
    else { const c = await createNews(newsForm); setNews([c || { id: Date.now(), ...newsForm, date: today(), views: 0, slug: newsForm.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 60) }, ...news]); }
    setShowNewsForm(false);
  };
  const removeNews = async (id) => { if (!confirm('Supprimer ?')) return; await deleteNews(id); setNews(news.filter(n => n.id !== id)); };

  /* ── Computed ── */
  const totalRevenus = finances.filter(f => f.type === 'Revenu').reduce((s, f) => s + f.montant, 0);
  const totalDepenses = finances.filter(f => f.type === 'Dépense').reduce((s, f) => s + f.montant, 0);
  const solde = totalRevenus - totalDepenses;
  const nbActifs = benefs.filter(b => b.statut === 'Actif').length;
  const filteredBenefs = benefFilter ? benefs.filter(b => b.statut === benefFilter) : benefs;
  const totalViews = allNews.reduce((s, n) => s + (n.views || 0), 0);

  /* ── Tabs ── */
  const tabs = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'actualites', label: '📰 Actualités' },
    { key: 'enfants', label: '👦 Enfants' },
    { key: 'finances', label: '💰 Finances' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ═══ TOP NAVBAR ═══ */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 flex items-center justify-between h-14">
          {/* Logo + nav */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <img src="/logo-arina.jpg" alt="" className="w-8 h-8 rounded-lg object-contain shadow-sm" />
              <span className="font-bold text-arina-dark text-sm hidden sm:inline">ARINA Admin</span>
            </div>
            <nav className="hidden md:flex items-center gap-0.5">
              {tabs.map((t) => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-arina-blue text-white shadow' : 'text-arina-dark hover:bg-gray-50'}`}>
                  {t.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-arina-gray bg-gray-50 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> 3 notifications
            </span>
            <span className={`w-2 h-2 rounded-full ${apiStatus === 'online' ? 'bg-green-500' : apiStatus === 'offline' ? 'bg-yellow-500' : 'bg-gray-300 animate-pulse'}`} />
            <span className="text-xs text-arina-gray hidden sm:inline">👤 {user?.username}</span>
            <button onClick={logout} className="text-xs text-red-500 hover:text-red-700 font-medium">🚪 Déconnexion</button>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden flex border-t border-gray-100 overflow-x-auto">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 text-center py-2 text-xs font-medium whitespace-nowrap ${tab === t.key ? 'text-arina-blue border-b-2 border-arina-blue' : 'text-arina-gray'}`}>
              {t.label}
            </button>
          ))}
          <button onClick={logout} className="px-3 py-2 text-xs text-red-500 font-medium whitespace-nowrap">🚪</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 lg:p-6">

        {/* ═══════ DASHBOARD ═══════ */}
        {tab === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-xl font-serif font-bold text-arina-dark">Tableau de bord</h2>

            {/* 4 Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: '👦', label: 'ENFANTS', value: nbActifs, sub: 'actifs', extra: `+${benefs.length} total`, color: 'from-arina-gold to-arina-accent', bg: 'bg-arina-warm', link: 'enfants' },
                { icon: '💰', label: 'REVENUS', value: formatMGA(totalRevenus), sub: 'total', extra: `Solde: ${formatMGA(solde)}`, color: 'from-green-500 to-emerald-600', bg: 'bg-green-50', link: 'finances' },
                { icon: '📰', label: 'ACTUALITÉS', value: news.length, sub: 'publiées', extra: `${totalViews.toLocaleString()} vues`, color: 'from-purple-500 to-violet-600', bg: 'bg-purple-50', link: 'actualites' },
                { icon: '👁️', label: 'VUES', value: totalViews.toLocaleString(), sub: 'totales', extra: `${allNews.length} articles`, color: 'from-orange-500 to-red-500', bg: 'bg-orange-50', link: 'dashboard' },
              ].map((s, i) => (
                <div key={i} className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 card-hover ${s.link !== 'dashboard' ? 'cursor-pointer' : ''}`} onClick={() => s.link !== 'dashboard' && setTab(s.link)}>
                  <div className="flex items-start justify-between mb-3">
                    <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} text-white text-lg shadow`}>{s.icon}</div>
                  </div>
                  <div className="text-xs font-bold text-arina-gray mb-1">{s.label}</div>
                  <div className="text-xl lg:text-2xl font-extrabold text-arina-dark">{s.value}</div>
                  <div className="text-xs text-arina-gray mt-1">{s.sub} · {s.extra}</div>
                </div>
              ))}
            </div>

            {/* 2 Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Revenue line chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-arina-dark mb-4">📊 Évolution des revenus</h3>
                <div className="h-56 flex items-end gap-2 px-2">
                  {['Jan','Fév','Mar','Avr','Mai','Juin'].map((m, i) => {
                    const heights = [30, 35, 45, 40, 55, 65];
                    const h = heights[i];
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <div className="w-full bg-gradient-to-t from-arina-blue/80 to-arina-blue/20 rounded-t-md transition-all hover:from-arina-blue hover:to-arina-blue/40" style={{ height: `${h}%` }} />
                        <span className="text-[10px] text-arina-gray mt-1">{m}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Enrollment bar chart */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-arina-dark mb-4">📊 Évolution des effectifs</h3>
                <div className="h-56 flex items-end gap-2 px-2">
                  {['Jan','Fév','Mar','Avr','Mai','Juin'].map((m, i) => {
                    const heights = [22, 28, 35, 42, 50, 58];
                    const h = heights[i];
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <div className="w-full bg-gradient-to-t from-emerald-500/80 to-emerald-300/30 rounded-t-md transition-all hover:from-emerald-500" style={{ height: `${h}%` }} />
                        <span className="text-[10px] text-arina-gray mt-1">{m}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div>
              <h3 className="font-bold text-arina-dark mb-3">⚡ Actions rapides</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '📝 Nouvelle actu', action: () => { setTab('actualites'); setTimeout(() => openNewsForm(null), 100); }, color: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
                  { label: '👦 Nouvel enfant', action: () => { setTab('enfants'); setTimeout(() => openBenefForm(null), 100); }, color: 'bg-arina-blue/10 text-arina-blue hover:bg-arina-blue/20' },
                  { label: '💰 Nouveau revenu', action: () => { setTab('finances'); setFinanceForm({ type: 'Revenu', categorie: 'Don', montant: '', description: '', date: today() }); setTimeout(() => setShowFinanceForm(true), 100); }, color: 'bg-green-100 text-green-700 hover:bg-green-200' },
                  { label: '💳 Nouvelle dépense', action: () => { setTab('finances'); setFinanceForm({ type: 'Dépense', categorie: 'Alimentation', montant: '', description: '', date: today() }); setTimeout(() => setShowFinanceForm(true), 100); }, color: 'bg-red-100 text-red-700 hover:bg-red-200' },
                  { label: '📁 Tous les enfants', action: () => setTab('enfants'), color: 'bg-gray-100 text-arina-dark hover:bg-gray-200' },
                  { label: '📰 Toutes les actus', action: () => setTab('actualites'), color: 'bg-gray-100 text-arina-dark hover:bg-gray-200' },
                ].map((btn, i) => (
                  <button key={i} onClick={btn.action} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${btn.color}`}>{btn.label}</button>
                ))}
              </div>
            </div>

            {/* Recent activity */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-arina-dark mb-4">🕐 Activité récente</h3>
              <div className="space-y-2">
                {[
                  { time: '14:32', icon: '📰', text: 'Nouvelle actu : "Atelier menuiserie"', author: 'Jean', color: 'bg-purple-100 text-purple-700' },
                  { time: '12:15', icon: '👦', text: 'Enfant ajouté : Thomas M. (AR-001)', author: 'Marie', color: 'bg-arina-blue/10 text-arina-blue' },
                  { time: '10:45', icon: '💰', text: 'Reçu : Don 500 000 Ar - Fondation X', author: 'Pierre', color: 'bg-green-100 text-green-700' },
                  { time: '09:00', icon: '📝', text: 'Suivi : Jean R. - Progression positive', author: 'M. Rakoto', color: 'bg-yellow-100 text-yellow-700' },
                  { time: '08:30', icon: '💳', text: 'Dépense : 450 000 Ar - Alimentation', author: 'Sophie', color: 'bg-red-100 text-red-700' },
                ].map((act, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors">
                    <span className="text-xs text-arina-gray w-10">⏰ {act.time}</span>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${act.color} rounded-full text-xs font-medium`}>
                      {act.icon} {act.text}
                    </span>
                    <span className="text-xs text-arina-gray ml-auto">Par {act.author}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-arina-dark mb-4">🔔 Notifications</h3>
              <div className="space-y-3">
                {[
                  { color: 'text-red-500', text: '3 dons en attente de validation' },
                  { color: 'text-yellow-500', text: '2 enfants avec moins de 50% d\'assiduité' },
                  { color: 'text-green-500', text: '5 nouvelles demandes de bénévolat' },
                ].map((n, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className={`text-lg ${n.color}`}>●</span>
                    <span className="text-sm text-arina-dark">{n.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ ACTUALITÉS ═══════ */}
        {tab === 'actualites' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-serif font-bold text-arina-dark">📰 Actualités</h2>
              <button onClick={() => openNewsForm(null)} className="px-4 py-2 bg-arina-blue text-white text-sm font-semibold rounded-lg hover:bg-arina-blue-dark">+ Nouvelle</button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm"><thead className="bg-gray-50 text-left"><tr><th className="px-4 py-3 font-semibold">Titre</th><th className="px-4 py-3 font-semibold">Catégorie</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Vues</th><th className="px-4 py-3 font-semibold">Actions</th></tr></thead>
                <tbody className="divide-y divide-gray-100">{news.map((n) => (<tr key={n.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-medium text-arina-dark max-w-xs truncate">{n.title}</td><td className="px-4 py-3"><span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{n.category}</span></td><td className="px-4 py-3 text-arina-gray text-xs">{n.date}</td><td className="px-4 py-3">👁️ {n.views || 0}</td><td className="px-4 py-3"><div className="flex gap-1"><Link to={`/actualites/${n.slug || n.id}`} target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-xs bg-gray-50 rounded hover:bg-gray-100">👁️</Link><button onClick={() => openNewsForm(n)} className="px-2 py-1 text-xs bg-arina-blue/10 text-arina-blue rounded hover:bg-arina-blue/20">✏️</button><button onClick={() => removeNews(n.id)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">🗑️</button></div></td></tr>))}</tbody></table>
            </div>
          </div>
        )}

        {/* ═══════ ENFANTS ═══════ */}
        {tab === 'enfants' && (
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              {[{ label: 'Total', value: benefs.length, c: 'text-arina-blue' },{ label: 'Actifs', value: nbActifs, c: 'text-green-600' },{ label: 'Diplômés', value: benefs.filter(b=>b.statut==='Diplômé').length, c: 'text-purple-600' },{ label: 'Inactifs', value: benefs.filter(b=>b.statut==='Inactif').length, c: 'text-red-600' }].map((s,i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"><div className={`text-2xl font-extrabold ${s.c}`}>{benefsLoading?'—':s.value}</div><div className="text-xs text-arina-gray">{s.label}</div></div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <select value={benefFilter} onChange={e=>setBenefFilter(e.target.value)} className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"><option value="">Tous</option><option value="Actif">Actif</option><option value="Diplômé">Diplômé</option><option value="Inactif">Inactif</option></select>
              <button onClick={()=>openBenefForm(null)} className="px-4 py-2 bg-arina-blue text-white text-sm font-semibold rounded-lg hover:bg-arina-blue-dark ml-auto">+ Ajouter</button>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-left"><tr><th className="px-4 py-3 font-semibold">ID</th><th className="px-4 py-3 font-semibold">Nom</th><th className="px-4 py-3 font-semibold">Prénom</th><th className="px-4 py-3 font-semibold">Âge</th><th className="px-4 py-3 font-semibold">Statut</th><th className="px-4 py-3 font-semibold">Formation</th><th className="px-4 py-3 font-semibold">Actions</th></tr></thead>
                <tbody className="divide-y divide-gray-100">{filteredBenefs.map((b) => (<tr key={b.id} className="hover:bg-gray-50"><td className="px-4 py-3 text-xs text-arina-gray font-mono">AR-{String(b.id).padStart(3,'0')}</td><td className="px-4 py-3 font-medium text-arina-dark">{b.nom}</td><td className="px-4 py-3">{b.prenom}</td><td className="px-4 py-3">{b.age}</td><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${b.statut==='Actif'?'bg-green-100 text-green-700':b.statut==='Diplômé'?'bg-purple-100 text-purple-700':'bg-red-100 text-red-700'}`}>{b.statut}</span></td><td className="px-4 py-3">{b.formation}</td><td className="px-4 py-3"><div className="flex gap-1"><Link to={`/admin/beneficiaire/${b.id}`} className="px-2 py-1 text-xs bg-arina-blue/10 text-arina-blue rounded hover:bg-arina-blue/20">📋</Link><button onClick={()=>openBenefForm(b)} className="px-2 py-1 text-xs bg-arina-blue/10 text-arina-blue rounded hover:bg-arina-blue/20">✏️</button><button onClick={()=>removeBenef(b.id)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">🗑️</button></div></td></tr>))}</tbody></table></div>
            </div>
          </div>
        )}

        {/* ═══════ FINANCES ═══════ */}
        {tab === 'finances' && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              {[{ label: 'Revenus', value: formatMGA(totalRevenus), c: 'text-green-600', bg: 'bg-green-50' },{ label: 'Dépenses', value: formatMGA(totalDepenses), c: 'text-red-600', bg: 'bg-red-50' },{ label: 'Solde', value: formatMGA(solde), c: solde>=0?'text-arina-blue':'text-red-600', bg: solde>=0?'bg-arina-blue/5':'bg-red-50' }].map((s,i) => (
                <div key={i} className={`${s.bg} rounded-xl shadow-sm border border-gray-100 p-4`}><div className={`text-xl font-extrabold ${s.c}`}>{financesLoading?'—':s.value}</div><div className="text-xs text-arina-gray">{s.label}</div></div>
              ))}
            </div>
            <button onClick={()=>setShowFinanceForm(true)} className="px-4 py-2 bg-arina-blue text-white text-sm font-semibold rounded-lg hover:bg-arina-blue-dark mb-4">+ Ajouter</button>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-sm"><thead className="bg-gray-50 text-left"><tr><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Catégorie</th><th className="px-4 py-3 font-semibold">Montant</th><th className="px-4 py-3 font-semibold">Description</th><th className="px-4 py-3 font-semibold">Date</th><th></th></tr></thead>
                <tbody className="divide-y divide-gray-100">{finances.map((f) => (<tr key={f.id} className="hover:bg-gray-50"><td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.type==='Revenu'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{f.type}</span></td><td className="px-4 py-3 text-arina-dark">{f.categorie}</td><td className={`px-4 py-3 font-semibold ${f.type==='Revenu'?'text-green-600':'text-red-600'}`}>{formatMGA(f.montant)}</td><td className="px-4 py-3 text-arina-gray">{f.description}</td><td className="px-4 py-3 text-arina-gray text-xs">{f.date?new Date(f.date).toLocaleDateString('fr-FR'):''}</td><td className="px-4 py-3"><button onClick={()=>removeFinance(f.id)} className="px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">🗑️</button></td></tr>))}</tbody></table>
            </div>
          </div>
        )}

      </div>

      {/* ═══ MODALS ═══ */}
      {showBenefForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setShowBenefForm(false)}><div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}><h3 className="text-lg font-bold text-arina-dark mb-4">{editingBenef?'Modifier':'Ajouter'} un bénéficiaire</h3><div className="space-y-3"><input placeholder="Prénom" value={benefForm.prenom} onChange={e=>setBenefForm({...benefForm,prenom:e.target.value})} className={inputClass} /><input placeholder="Nom" value={benefForm.nom} onChange={e=>setBenefForm({...benefForm,nom:e.target.value})} className={inputClass} /><input type="number" placeholder="Âge" value={benefForm.age} onChange={e=>setBenefForm({...benefForm,age:e.target.value})} className={inputClass} /><select value={benefForm.statut} onChange={e=>setBenefForm({...benefForm,statut:e.target.value})} className={inputClass}><option value="Actif">Actif</option><option value="Diplômé">Diplômé</option><option value="Inactif">Inactif</option></select><input placeholder="Formation" value={benefForm.formation} onChange={e=>setBenefForm({...benefForm,formation:e.target.value})} className={inputClass} /><input type="date" value={benefForm.dateEntree} onChange={e=>setBenefForm({...benefForm,dateEntree:e.target.value})} className={inputClass} /></div><div className="flex gap-2 mt-4"><button onClick={saveBenef} className="flex-1 py-2.5 bg-arina-blue text-white font-semibold rounded-xl">Enregistrer</button><button onClick={()=>setShowBenefForm(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl">Annuler</button></div></div></div>}
      {showFinanceForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setShowFinanceForm(false)}><div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}><h3 className="text-lg font-bold text-arina-dark mb-4">Ajouter une transaction</h3><div className="space-y-3"><select value={financeForm.type} onChange={e=>setFinanceForm({...financeForm,type:e.target.value})} className={inputClass}><option value="Revenu">Revenu</option><option value="Dépense">Dépense</option></select><select value={financeForm.categorie} onChange={e=>setFinanceForm({...financeForm,categorie:e.target.value})} className={inputClass}><option value="Don">Don</option><option value="Subvention">Subvention</option><option value="Alimentation">Alimentation</option><option value="Équipement">Équipement</option><option value="Salaire">Salaire</option><option value="Autre">Autre</option></select><input type="number" placeholder="Montant (Ar)" value={financeForm.montant} onChange={e=>setFinanceForm({...financeForm,montant:e.target.value})} className={inputClass} /><input placeholder="Description" value={financeForm.description} onChange={e=>setFinanceForm({...financeForm,description:e.target.value})} className={inputClass} /><input type="date" value={financeForm.date} onChange={e=>setFinanceForm({...financeForm,date:e.target.value})} className={inputClass} /></div><div className="flex gap-2 mt-4"><button onClick={saveFinance} className="flex-1 py-2.5 bg-arina-blue text-white font-semibold rounded-xl">Enregistrer</button><button onClick={()=>setShowFinanceForm(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl">Annuler</button></div></div></div>}
      {showNewsForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={()=>setShowNewsForm(false)}><div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg" onClick={e=>e.stopPropagation()}><h3 className="text-lg font-bold text-arina-dark mb-4">{editingNews?'Modifier':'Nouvelle'} actualité</h3><div className="space-y-3"><input placeholder="Titre" value={newsForm.title} onChange={e=>setNewsForm({...newsForm,title:e.target.value})} className={inputClass} /><textarea placeholder="Extrait" rows={3} value={newsForm.excerpt} onChange={e=>setNewsForm({...newsForm,excerpt:e.target.value})} className={inputClass} /><select value={newsForm.category} onChange={e=>setNewsForm({...newsForm,category:e.target.value})} className={inputClass}><option value="Événement">Événement</option><option value="Témoignage">Témoignage</option><option value="Rapport">Rapport</option><option value="Projet">Projet</option></select><input placeholder="URL image" value={newsForm.image_url} onChange={e=>setNewsForm({...newsForm,image_url:e.target.value})} className={inputClass} /></div><div className="flex gap-2 mt-4"><button onClick={saveNews} className="flex-1 py-2.5 bg-arina-blue text-white font-semibold rounded-xl">Enregistrer</button><button onClick={()=>setShowNewsForm(false)} className="flex-1 py-2.5 bg-gray-100 rounded-xl">Annuler</button></div></div></div>}
    </div>
  );
}
