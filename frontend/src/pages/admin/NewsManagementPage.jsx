import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchNews, createNews, updateNews, deleteNews } from '../../services/api';
import { allNews, categories } from '../../data/news';
import { ROLE_TABS } from './roles';
import AdminLayout from '../../components/admin/AdminLayout';
import Toast from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { Icon } from '../../components/admin/icons';
import UpdatedBadge from '../../components/UpdatedBadge';
import { inputClass, EmptyState, Th } from '../../components/admin/ui';
import { fmtDate, timeAgo } from '../../components/admin/utils';

const PAGE_SIZE = 8;

const statusMeta = {
  published: { label: 'Publié', cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  draft: { label: 'Brouillon', cls: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  archived: { label: 'Archivé', cls: 'bg-gray-100 dark:bg-white/10 text-ios-text2' },
};

const catStyles = {
  'Événement': 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'Témoignage': 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400',
  'Rapport': 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Projet': 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

const statusOf = (n) => n.status || 'published';

/* Page numbers with ellipsis: [1] … [4][5][6] … [12] */
function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total]);
  for (let i = current - 1; i <= current + 1; i++) if (i > 1 && i < total) set.add(i);
  const sorted = [...set].sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export default function NewsManagementPage() {
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── Data ── */
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState('checking');

  /* ── Filters (pending vs applied) ── */
  const [pending, setPending] = useState({ q: '', status: '', category: '', recent: '' });
  const [applied, setApplied] = useState({ q: '', status: '', category: '', recent: '' });
  const [sort, setSort] = useState({ key: 'created_at', dir: -1 });
  const [page, setPage] = useState(1);

  /* ── Form modal ── */
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', excerpt: '', category: 'Événement', status: 'published', image_url: '', content: '', featured: false });
  const [imageDragOver, setImageDragOver] = useState(false);
  const { toast, showToast, closeToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nFromApi = await fetchNews();
      if (cancelled) return;
      if (nFromApi !== null) {
        setApiStatus('online');
        setNews(nFromApi.length ? nFromApi : []);
      } else {
        setApiStatus('offline');
        const s = localStorage.getItem('arina_news');
        setNews(s ? JSON.parse(s) : allNews);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (news.length) localStorage.setItem('arina_news', JSON.stringify(news));
  }, [news]);

  /* Auto-open the creation form when arriving via ?new=1 (quick action) */
  const [editRequested, setEditRequested] = useState(null);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      // Bouton « Modifier » du site public → ouvrir le formulaire pour cet article
      setEditRequested(editId);
      setSearchParams({}, { replace: true });
    } else if (searchParams.get('new') === '1') {
      setEditing(null);
      setForm({ title: '', excerpt: '', category: 'Événement', status: 'published', image_url: '', content: '', featured: false });
      setShowForm(true);
      // Clean the param so a reload does not reopen the modal
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Quand les données arrivent, ouvrir le formulaire d'édition demandé */
  useEffect(() => {
    if (!editRequested) return;
    const target = news.find((n) => String(n.id) === editRequested);
    if (target) {
      openForm(target);
      setEditRequested(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news, editRequested]);

  useEffect(() => { setPage(1); }, [applied]);

  const contentToText = (c) =>
    Array.isArray(c)
      ? c.filter((b) => b.type === 'paragraph').map((b) => b.text).join('\n\n')
      : typeof c === 'string' ? c : '';

  const openForm = (n) => {
    if (n) {
      setEditing(n);
      setForm({
        title: n.title || '',
        excerpt: n.excerpt || '',
        category: n.category || 'Événement',
        status: statusOf(n),
        image_url: n.image_url || '',
        content: contentToText(n.content),
        featured: !!n.featured,
      });
    } else {
      setEditing(null);
      setForm({ title: '', excerpt: '', category: 'Événement', status: 'published', image_url: '', content: '', featured: false });
    }
    setShowForm(true);
  };

  const applyImageFile = (f) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(f.type)) {
      alert('Format non accepté — utilisez JPG, PNG, WebP ou GIF.');
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      alert('Image trop volumineuse (maximum 2 Mo).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, image_url: String(reader.result) }));
    reader.readAsDataURL(f);
  };

  const handleImageChange = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    applyImageFile(f);
  };

  const saveNews = async () => {
    const d = { ...form };
    // Sauvegarde STRICTE : l'actualité ne compte comme enregistrée que si elle a
    // réellement atteint la base de données. Sinon erreur claire + formulaire ouvert.
    const r = editing ? await updateNews(editing.id, d) : await createNews(d);
    if (!r.ok) {
      showToast(`❌ ${editing ? 'Modification' : 'Création'} NON enregistrée dans la base : ${r.error}`, 'error');
      return;
    }
    if (editing) {
      setNews(news.map((n) => (n.id === editing.id ? r.data : n)));
      showToast(`✅ Actualité « ${r.data.title} » modifiée et enregistrée dans la base`);
    } else {
      setNews([r.data, ...news]);
      showToast(`✅ Actualité « ${r.data.title} » créée et enregistrée dans la base`);
    }
    setShowForm(false);
  };

  const removeNews = async (id) => {
    if (!confirm('Supprimer cette actualité ?')) return;
    const r = await deleteNews(id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    setNews(news.filter((n) => n.id !== id));
    showToast('✅ Actualité supprimée de la base de données');
  };

  const togglePublish = async (n) => {
    const next = statusOf(n) === 'published' ? 'draft' : 'published';
    const r = await updateNews(n.id, {
      title: n.title, excerpt: n.excerpt, category: n.category, image_url: n.image_url, status: next, content: typeof n.content === 'string' ? n.content : '', featured: !!n.featured,
    });
    if (!r.ok) { showToast(`❌ Changement de statut NON enregistré dans la base : ${r.error}`, 'error'); return; }
    setNews(news.map((x) => (x.id === n.id ? r.data : x)));
    showToast(next === 'published' ? '✅ Actualité publiée sur le site' : '✅ Actualité dépubliée (brouillon)');
  };

  const toggleFeatured = async (n) => {
    const next = !n.featured;
    const r = await updateNews(n.id, {
      title: n.title, excerpt: n.excerpt, category: n.category, image_url: n.image_url, status: statusOf(n),
      content: typeof n.content === 'string' ? n.content : '', featured: next,
    });
    if (!r.ok) { showToast(`❌ Mise en avant NON enregistrée dans la base : ${r.error}`, 'error'); return; }
    setNews(news.map((x) => (x.id === n.id ? r.data : x)));
    showToast(next ? '✅ Actualité mise à la une' : '✅ Actualité retirée de la une');
  };

  /* ── Derived ── */
  const counts = useMemo(() => ({
    total: news.length,
    published: news.filter((n) => statusOf(n) === 'published').length,
    draft: news.filter((n) => statusOf(n) === 'draft').length,
    archived: news.filter((n) => statusOf(n) === 'archived').length,
  }), [news]);

  const filtered = useMemo(() => {
    let arr = news;
    if (applied.status) arr = arr.filter((n) => statusOf(n) === applied.status);
    if (applied.category) arr = arr.filter((n) => (n.category || '') === applied.category);
    if (applied.q.trim()) {
      const q = applied.q.trim().toLowerCase();
      arr = arr.filter((n) => `${n.title} ${n.excerpt || ''}`.toLowerCase().includes(q));
    }
    if (applied.recent) {
      const limit = applied.recent === '24h' ? 24 : applied.recent === '48h' ? 48 : 168; // h (7 jours)
      arr = arr.filter((n) => {
        const u = n.updatedAt || n.updated_at;
        if (!u) return false;
        const t = new Date(u).getTime();
        return !Number.isNaN(t) && Date.now() - t <= limit * 3600000;
      });
    }
    return arr;
  }, [news, applied]);

  const dateVal = (n) => {
    const d = n.created_at || n.date;
    if (!d) return 0;
    const m = String(d).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();
    return new Date(d).getTime() || 0;
  };

  /* Valeur de date de mise à jour (ISO ou autre), pour le tri par « Maj » */
  const updatedVal = (n) => {
    const u = n.updatedAt || n.updated_at;
    if (!u) return 0;
    const t = new Date(u).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    return [...filtered].sort((a, b) => {
      const x = a[sort.key] ?? a.date ?? a.created_at;
      const y = b[sort.key] ?? b.date ?? b.created_at;
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir;
      if (sort.key === 'created_at' || sort.key === 'date') return (dateVal(a) - dateVal(b)) * sort.dir;
      if (sort.key === 'updated_at') return (updatedVal(a) - updatedVal(b)) * sort.dir;
      return String(x ?? '').localeCompare(String(y ?? ''), 'fr') * sort.dir;
    });
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(startIdx, startIdx + PAGE_SIZE);
  const displayFrom = sorted.length ? startIdx + 1 : 0;
  const displayTo = Math.min(startIdx + PAGE_SIZE, sorted.length);

  const applyFilters = () => { setApplied(pending); };
  const resetFilters = () => { setPending({ q: '', status: '', category: '', recent: '' }); setApplied({ q: '', status: '', category: '', recent: '' }); };

  /* Barre latérale filtrée par rôle (source unique : ./roles) — le président ne
     voit plus les onglets Enfants/Finances qu'il n'a pas le droit d'ouvrir. */
  const allowedTabs = ROLE_TABS[user?.role] || ROLE_TABS.unknown;
  const can = (t) => allowedTabs.includes(t);
  const groups = [
    { group: 'Principal', items: [
      { key: 'dashboard', label: 'Tableau de bord', icon: 'grid', to: '/admin' },
      { key: 'actualites', label: 'Actualités', icon: 'file' },
      ...(can('enfants') ? [{ key: 'enfants', label: 'Enfants', icon: 'users', to: '/admin?tab=enfants' }] : []),
      ...(can('finances') ? [{ key: 'finances', label: 'Finances', icon: 'wallet', to: '/admin?tab=finances' }] : []),
    ] },
    { group: 'Communication', items: [
      ...(can('messages') ? [{ key: 'messages', label: 'Messages', icon: 'mail', to: '/admin?tab=messages' }] : []),
      ...(can('volunteers') ? [{ key: 'volunteers', label: 'Candidatures', icon: 'users', to: '/admin?tab=volunteers' }] : []),
    ] },
  ];

  const statChip = (label, value, statusKey, color) => (
    <button
      onClick={() => {
        setPending((p) => ({ ...p, status: statusKey }));
        setApplied((a) => ({ ...a, status: statusKey }));
        setPage(1);
      }}
      className={`card-apple card-apple-hover p-4 text-left ${applied.status === statusKey ? 'ring-2 ring-arina-blue/50' : ''}`}
    >
      <div className={`text-2xl font-extrabold tabular ${color}`}>{loading ? '—' : value}</div>
      <div className="text-xs text-ios-text3 mt-0.5">{label}</div>
    </button>
  );

  return (
    <AdminLayout
      groups={groups}
      activeKey="actualites"
      onNavigate={() => {}}
      title="Gestion des actualités"
      subtitle="Créez, publiez et organisez vos articles"
      footerNav={[{ key: 'site', label: 'Voir le site', icon: 'globe', to: '/' }]}
      user={user}
      onLogout={logout}
      actions={
        <button
          onClick={() => openForm(null)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-arina-blue text-white hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-all"
        >
          <Icon name="plus" className="w-4 h-4" /> Nouvelle actualité
        </button>
      }
    >
      <div className="space-y-4">
        {apiStatus === 'offline' && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2.5 animate-fade-up">
            <Icon name="activity" className="w-4 h-4 flex-shrink-0" />
            <span>Mode local — les articles proviennent de ce navigateur. Déployez sur Vercel pour lire votre base PostgreSQL.</span>
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-up">
          {statChip('Toutes les actualités', counts.total, '', 'text-ios-text')}
          {statChip('Publiées', counts.published, 'published', 'text-emerald-600 dark:text-emerald-400')}
          {statChip('Brouillons', counts.draft, 'draft', 'text-amber-600 dark:text-amber-400')}
          {statChip('Archivées', counts.archived, 'archived', 'text-ios-text2')}
        </div>

        {/* Filter bar */}
        <div className="card-apple p-4 animate-fade-up" style={{ animationDelay: '60ms' }}>
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Icon name="search" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-text3 pointer-events-none" />
              <input
                value={pending.q}
                onChange={(e) => setPending({ ...pending, q: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                placeholder="Rechercher un titre ou un extrait…"
                className={`${inputClass} pl-10`}
              />
            </div>
            <select
              value={pending.status}
              onChange={(e) => setPending({ ...pending, status: e.target.value })}
              className={`${inputClass} lg:w-44`}
            >
              <option value="">Tous les statuts</option>
              <option value="published">Publié</option>
              <option value="draft">Brouillon</option>
              <option value="archived">Archivé</option>
            </select>
            <select
              value={pending.category}
              onChange={(e) => setPending({ ...pending, category: e.target.value })}
              className={`${inputClass} lg:w-44`}
            >
              <option value="">Toutes les catégories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={pending.recent}
              onChange={(e) => setPending({ ...pending, recent: e.target.value })}
              className={`${inputClass} lg:w-44`}
            >
              <option value="">Toutes les dates de maj</option>
              <option value="24h">Modifiées il y a &lt; 24 h</option>
              <option value="48h">Modifiées il y a &lt; 48 h</option>
              <option value="7d">Modifiées cette semaine</option>
            </select>
            <button onClick={applyFilters} className="px-5 py-2.5 rounded-xl bg-arina-blue text-white text-sm font-semibold hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-all">
              Appliquer
            </button>
            <button onClick={resetFilters} className="px-5 py-2.5 rounded-xl bg-ios-fill text-ios-text text-sm font-semibold hover:bg-ios-fill-2 transition-all">
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="card-apple overflow-hidden animate-fade-up" style={{ animationDelay: '120ms' }}>
          {loading ? (
            <div className="p-6 space-y-4"><div className="skeleton h-10" /><div className="skeleton h-10" /><div className="skeleton h-10" /></div>
          ) : pageItems.length === 0 ? (
            <EmptyState
              icon="file"
              text={news.length === 0 ? 'Aucune actualité pour le moment. Publiez votre premier article !' : 'Aucun article ne correspond à vos filtres.'}
              action={<button onClick={() => openForm(null)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-arina-blue text-white text-sm font-semibold"><Icon name="plus" className="w-4 h-4" /> Nouvelle actualité</button>}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ios-fill">
                    <tr>
                      <Th label="Titre" k="title" sort={sort} onSort={(k) => setSort({ key: k, dir: sort.key === k ? -sort.dir : 1 })} />
                      <Th label="Catégorie" k="category" sort={sort} onSort={(k) => setSort({ key: k, dir: sort.key === k ? -sort.dir : 1 })} />
                      <Th label="Statut" k="status" sort={sort} onSort={(k) => setSort({ key: k, dir: sort.key === k ? -sort.dir : 1 })} />
                      <Th label="Vues" k="views" sort={sort} onSort={(k) => setSort({ key: k, dir: sort.key === k ? -sort.dir : 1 })} />
                      <Th label="Date" k="created_at" sort={sort} onSort={(k) => setSort({ key: k, dir: sort.key === k ? -sort.dir : 1 })} />
                      <Th label="Maj" k="updated_at" sort={sort} onSort={(k) => setSort({ key: k, dir: sort.key === k ? -sort.dir : 1 })} />
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ios-hairline">
                    {pageItems.map((n) => {
                      const st = statusMeta[statusOf(n)] || statusMeta.published;
                      const cat = n.category || 'Article';
                      return (
                        <tr key={n.id} className="hover:bg-ios-fill transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {n.image_url ? (
                                <img src={n.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-arina-warm text-arina-blue flex items-center justify-center flex-shrink-0"><Icon name="file" className="w-4 h-4" /></div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {n.featured && <Icon name="star" className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                  <div className="font-medium text-ios-text truncate max-w-[260px]">{n.title}</div>
                                </div>
                                <div className="text-[11px] text-ios-text3 truncate max-w-[280px]">{n.excerpt || ''}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${catStyles[cat] || 'bg-gray-100 dark:bg-white/10 text-ios-text2'}`}>{cat}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                          </td>
                          <td className="px-4 py-3 tabular text-ios-text2 whitespace-nowrap"><Icon name="eye" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{n.views || 0}</td>
                          <td className="px-4 py-3 text-xs text-ios-text3 whitespace-nowrap">{fmtDate(n.date || n.created_at)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-xs text-ios-text3">{fmtDate(n.updatedAt || n.updated_at)}</div>
                            <div className="mt-1"><UpdatedBadge updatedAt={n.updatedAt} createdDate={n.created_at} /></div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1.5">
                              <Link to={`/actualites/${n.slug || n.id}`} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors" title="Voir sur le site"><Icon name="eye" className="w-4 h-4" /></Link>
                              <button onClick={() => openForm(n)} className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors" title="Modifier"><Icon name="edit" className="w-4 h-4" /></button>
                              <button
                                onClick={() => togglePublish(n)}
                                className={`p-2 rounded-lg transition-colors ${statusOf(n) === 'published' ? 'text-ios-text3 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/15' : 'text-ios-text3 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/15'}`}
                                title={statusOf(n) === 'published' ? 'Dépublier (brouillon)' : 'Publier'}
                              >
                                <Icon name={statusOf(n) === 'published' ? 'chevronDown' : 'send'} className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => toggleFeatured(n)}
                                className={`p-2 rounded-lg transition-colors ${n.featured ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/15' : 'text-ios-text3 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/15'}`}
                                title={n.featured ? 'Retirer de la une' : 'Mettre à la une'}
                              >
                                <Icon name="star" className="w-4 h-4" />
                              </button>
                              <button onClick={() => removeNews(n.id)} className="p-2 rounded-lg text-ios-text3 hover:text-red-600 hover:bg-red-500/10 transition-colors" title="Supprimer"><Icon name="trash" className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-ios-hairline">
                <span className="text-xs text-ios-text3">
                  Affichage : <span className="font-semibold text-ios-text2">{displayFrom}-{displayTo}</span> sur <span className="font-semibold text-ios-text2">{sorted.length}</span>
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-ios-text2 hover:bg-ios-fill disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
                    title="Page précédente"
                  >
                    <Icon name="chevronLeft" className="w-4 h-4" />
                  </button>
                  {pageList(currentPage, totalPages).map((p, i) =>
                    p === '…' ? (
                      <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-ios-text3">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                          p === currentPage ? 'bg-arina-blue text-white shadow-md shadow-arina-blue/25' : 'text-ios-text2 hover:bg-ios-fill'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-ios-text2 hover:bg-ios-fill disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
                    title="Page suivante"
                  >
                    <Icon name="chevronRight" className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Recent news side note */}
        <p className="text-xs text-ios-text3 px-1">
          Dernière publication : {news.length ? `${timeAgo(news[0].created_at || news[0].date)} · ${news[0].title}` : '—'}
        </p>
      </div>

      {/* ═══ Modal ── New / Edit ── ═══ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-2xl bg-ios-card rounded-3xl shadow-2xl animate-pop overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-ios-hairline flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center"><Icon name="file" className="w-5 h-5" /></div>
              <div>
                <h3 className="font-bold">{editing ? 'Modifier' : 'Nouvelle'} actualité</h3>
                <p className="text-xs text-ios-text3">Article public</p>
              </div>
            </div>
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto scroll-slim">
              <input placeholder="Titre de l'article" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputClass} />
              <textarea placeholder="Extrait (résumé affiché sur le site)" rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className={inputClass} />
              <textarea
                placeholder="Contenu de l'article (paragraphes séparés par une ligne vide)"
                rows={6}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className={inputClass}
              />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className={inputClass}>
                  <option value="published">Publié</option>
                  <option value="draft">Brouillon</option>
                  <option value="archived">Archivé</option>
                </select>
              </div>
              {/* Image de l'article */}
              <div>
                <label className="block text-sm font-semibold text-ios-text mb-1.5">Image de l'article</label>
                <label
                  className={`relative flex items-center justify-center rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden ${
                    imageDragOver
                      ? 'border-arina-accent bg-arina-accent/10 ring-2 ring-arina-accent/30'
                      : form.image_url
                        ? 'border-arina-blue/40'
                        : 'border-ios-hairline bg-ios-fill hover:border-arina-blue/40'
                  }`}
                  onDragOver={(e) => { e.preventDefault(); setImageDragOver(true); }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (e.currentTarget.contains(e.relatedTarget)) return;
                    setImageDragOver(false);
                  }}
                  onDrop={(e) => { e.preventDefault(); setImageDragOver(false); applyImageFile(e.dataTransfer.files?.[0]); }}
                >
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  {form.image_url ? (
                    <>
                      <img src={form.image_url} alt="" className="w-full h-40 object-cover" />
                      <span className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-black/60 text-white text-xs font-semibold backdrop-blur-sm">Changer</span>
                      <span className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] font-semibold backdrop-blur-sm">Déposer une image pour remplacer</span>
                    </>
                  ) : (
                    <div className={`flex flex-col items-center gap-2 py-10 ${imageDragOver ? 'text-arina-accent' : 'text-ios-text3'}`}>
                      <Icon name="camera" className="w-6 h-6" />
                      <span className="text-sm font-medium">{imageDragOver ? 'Déposez l\'image ici' : 'Cliquez ou glissez-déposez une image'}</span>
                      <span className="text-xs">JPG, PNG, WebP, GIF — max 2 Mo</span>
                    </div>
                  )}
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    placeholder="…ou collez une URL d'image"
                    value={form.image_url.startsWith('data:') ? '' : form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    className={inputClass}
                  />
                  {form.image_url.startsWith('data:') && (
                    <button type="button" onClick={() => setForm({ ...form, image_url: '' })} className="px-3 py-2.5 rounded-xl bg-ios-fill text-ios-text text-xs font-semibold hover:bg-ios-fill-2 transition-colors shrink-0">
                      Retirer
                    </button>
                  )}
                </div>
              </div>

              {/* À la une */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="w-4 h-4 rounded border-ios-hairline text-arina-blue focus:ring-arina-blue"
                />
                <span className="text-sm text-ios-text font-medium">Mettre à la une <span className="text-ios-text3 font-normal">(affiché en avant sur le site)</span></span>
              </label>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Annuler</button>
              <button onClick={saveNews} className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors">Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {/* Notification de sauvegarde (base de données) */}
      <Toast toast={toast} onClose={closeToast} />
    </AdminLayout>
  );
}
