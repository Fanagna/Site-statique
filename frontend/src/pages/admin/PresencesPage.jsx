import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_TABS } from './roles';
import AdminLayout from '../../components/admin/AdminLayout';
import Toast from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { Icon } from '../../components/admin/icons';
import { inputClass, EmptyState } from '../../components/admin/ui';
import { fmtDate, initials } from '../../components/admin/utils';
import {
  fetchBeneficiaries, fetchBeneficiaryBadge, fetchBeneficiaryBadgePdf, exportBadgesPdf,
  fetchPresencesByDate, createPresencePointage, updatePresencePointage, deletePresencePointage,
} from '../../services/api';

/* Date locale (YYYY-MM-DD) — même convention que le serveur (Antananarivo) */
const todayLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
const nowHHMM = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};
const hourOf = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : String(d.getHours()).padStart(2, '0');
};
const DIR_LABEL = { entry: 'Entrée', exit: 'Sortie' };

/* Télécharge une URL Blob avec le nom de fichier voulu */
function downloadBlobUrl(url, filename) {
  if (!url) return false;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

export default function PresencesPage() {
  const { user, logout } = useAuth();
  const { toast, showToast, closeToast } = useToast();

  const [tab, setTab] = useState('presences'); // 'presences' | 'badges'

  /* ── Présences : filtres + données du jour ── */
  const [date, setDate] = useState(todayLocal());
  const [nameQuery, setNameQuery] = useState('');
  const [hourFilter, setHourFilter] = useState('');
  const [data, setData] = useState(null); // { date, event, children }
  const [loading, setLoading] = useState(true);

  /* ── Modals CRUD ── */
  const [addModal, setAddModal] = useState(null); // { child, type }
  const [editModal, setEditModal] = useState(null); // { child, pointage }
  const [addTime, setAddTime] = useState(nowHHMM());
  const [editTime, setEditTime] = useState(nowHHMM());
  const [saving, setSaving] = useState(false);

  /* ── Badges (onglet) ── */
  const [children, setChildren] = useState([]);
  const [badgeQuery, setBadgeQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [qrModal, setQrModal] = useState(null); // { child, badgeId, qrCode }
  const [exporting, setExporting] = useState(false);

  /* Charge les présences de la date sélectionnée */
  const loadPresences = useCallback(async (d) => {
    setLoading(true);
    const res = await fetchPresencesByDate(d);
    if (res) setData(res);
    else setData((cur) => (cur && cur.date === d ? cur : null));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPresences(date);
  }, [date, loadPresences]);

  /* Liste complète des enfants (onglet Badges) */
  useEffect(() => {
    (async () => {
      const kids = await fetchBeneficiaries();
      if (Array.isArray(kids)) setChildren(kids);
    })();
  }, []);

  /* ── CRUD des pointages ── */

  const reload = () => loadPresences(date);

  const openAdd = (child, type) => {
    setAddModal({ child, type });
    setAddTime(nowHHMM());
  };

  const openEdit = (pointage, child) => {
    setEditModal({ child, pointage });
    setEditTime(fmtTime(pointage.scanned_at) !== '—' ? fmtTime(pointage.scanned_at) : nowHHMM());
  };

  const saveAdd = async () => {
    if (!addModal || saving) return;
    if (!addTime) { showToast('❌ Indiquez une heure', 'error'); return; }
    setSaving(true);
    const r = await createPresencePointage(date, {
      beneficiaryId: addModal.child.id, type: addModal.type, time: addTime,
    });
    setSaving(false);
    if (!r.ok) { showToast(`❌ Pointage NON enregistré : ${r.error}`, 'error'); return; }
    setAddModal(null);
    await reload();
    showToast(`✅ ${DIR_LABEL[addModal.type]} de ${addModal.child.prenom} ${addModal.child.nom} à ${addTime} enregistrée`);
  };

  const saveEdit = async () => {
    if (!editModal || saving) return;
    if (!editTime) { showToast('❌ Indiquez une heure', 'error'); return; }
    setSaving(true);
    const r = await updatePresencePointage(editModal.pointage.id, { type: editModal.pointage.type, time: editTime });
    setSaving(false);
    if (!r.ok) { showToast(`❌ Modification NON enregistrée : ${r.error}`, 'error'); return; }
    setEditModal(null);
    await reload();
    showToast(`✅ Pointage de ${editModal.child.prenom} ${editModal.child.nom} corrigé à ${editTime}`);
  };

  const removePointage = async (pointage, child) => {
    const who = `${child.prenom} ${child.nom}`;
    const when = fmtTime(pointage.scanned_at);
    if (!confirm(`Supprimer le pointage ${DIR_LABEL[pointage.type]} de ${who} à ${when} ?`)) return;
    const r = await deletePresencePointage(pointage.id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée : ${r.error}`, 'error'); return; }
    await reload();
    showToast(`🗑️ Pointage ${DIR_LABEL[pointage.type]} de ${who} supprimé`);
  };

  /* ── Filtres de la liste ── */
  const allChildren = data?.children || [];
  const filtered = allChildren.filter((c) => {
    const q = nameQuery.trim().toLowerCase();
    if (q && !`${c.prenom} ${c.nom}`.toLowerCase().includes(q)) return false;
    if (hourFilter) {
      const hh = hourFilter.slice(0, 2);
      const has = [...c.entries, ...c.exits].some((p) => hourOf(p.scanned_at) === hh);
      if (!has) return false;
    }
    return true;
  });

  const activeChildren = allChildren.filter((c) => c.statut === 'Actif');
  const onSite = activeChildren.filter((c) => c.entries.length > c.exits.length).length;
  const absent = activeChildren.filter((c) => c.entries.length === 0).length;

  const statusOf = (c) => {
    // Un enfant non actif (diplômé / inactif) sans pointage n'est pas « absent » :
    // il n'est simplement pas concerné par la feuille de présence du jour.
    if (c.entries.length === 0 && c.exits.length === 0) {
      return c.statut === 'Actif'
        ? { label: 'Absent', cls: 'bg-ios-fill text-ios-text3' }
        : { label: '—', cls: 'bg-ios-fill/60 text-ios-text3' };
    }
    if (c.entries.length > c.exits.length) return { label: 'Sur place', cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
    return { label: 'Parti', cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' };
  };

  const hasFilters = nameQuery.trim() !== '' || hourFilter !== '';
  const resetFilters = () => { setNameQuery(''); setHourFilter(''); };

  /* ── Badges ── */
  const filteredBadgeKids = children.filter((c) => {
    const q = badgeQuery.trim().toLowerCase();
    return !q || `${c.prenom} ${c.nom} ${c.badgeId || ''}`.toLowerCase().includes(q);
  });

  const toggleSelect = (id) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const allVisibleSelected = filteredBadgeKids.length > 0 && filteredBadgeKids.every((c) => selectedIds.includes(c.id));

  const toggleSelectAll = () =>
    setSelectedIds(allVisibleSelected ? [] : [...new Set([...selectedIds, ...filteredBadgeKids.map((c) => c.id)])]);

  const generateBadgesPdf = async (ids, count, label) => {
    setExporting(true);
    showToast('⏳ Génération du PDF des badges…');
    const url = await exportBadgesPdf(ids);
    setExporting(false);
    if (!downloadBlobUrl(url, 'badges-arina.pdf')) {
      showToast('❌ Impossible de générer le PDF (base injoignable ?)', 'error');
      return;
    }
    showToast(`✅ ${count} badge${count > 1 ? 's' : ''} exporté${count > 1 ? 's' : ''}${label ? ` (${label})` : ''}`);
  };

  const exportSelected = async () => {
    if (!selectedIds.length) { showToast('Sélectionnez au moins un enfant', 'error'); return; }
    await generateBadgesPdf(selectedIds, selectedIds.length, 'format carte de crédit');
  };

  const exportAllBadges = async () => {
    if (!children.length) { showToast('Aucun enfant enregistré — ajoutez d\'abord des enfants', 'error'); return; }
    await generateBadgesPdf(children.map((c) => c.id), children.length, 'tous les enfants');
  };

  const downloadBadgePdf = async (child) => {
    showToast('⏳ Génération du badge…');
    const url = await fetchBeneficiaryBadgePdf(child.id);
    const badgeId = child.badgeId || `ARINA-${child.id}`;
    if (!downloadBlobUrl(url, `badge-${badgeId}.pdf`)) {
      showToast('❌ Impossible de générer le PDF (base injoignable ?)', 'error');
      return;
    }
    showToast(`✅ Badge de ${child.prenom} ${child.nom} généré`);
  };

  const openQr = async (child) => {
    const r = await fetchBeneficiaryBadge(child.id);
    if (!r.ok || !r.data) { showToast(`❌ Impossible de générer le QR : ${r.error}`, 'error'); return; }
    setQrModal({ child, badgeId: r.data.badgeId, qrCode: r.data.qrCode });
  };

  const allowedTabs = ROLE_TABS[user?.role] || ROLE_TABS.unknown;
  const can = (t) => allowedTabs.includes(t);
  const groups = [
    { group: 'Principal', items: [
      { key: 'dashboard', label: 'Tableau de bord', icon: 'grid', to: '/admin' },
      { key: 'presences', label: 'Présences', icon: 'calendar' },
      { key: 'scan', label: 'Scanner', icon: 'send', to: '/admin/scan' },
      ...(can('enfants') ? [{ key: 'enfants', label: 'Enfants', icon: 'users', to: '/admin?tab=enfants' }] : []),
    ] },
    { group: 'Communication', items: [
      ...(can('messages') ? [{ key: 'messages', label: 'Messages', icon: 'mail', to: '/admin?tab=messages' }] : []),
      ...(can('volunteers') ? [{ key: 'volunteers', label: 'Candidatures', icon: 'users', to: '/admin?tab=volunteers' }] : []),
      ...(can('testimonials') ? [{ key: 'testimonials', label: 'Témoignages', icon: 'star', to: '/admin?tab=testimonials' }] : []),
    ] },
  ];

  return (
    <AdminLayout
      groups={groups}
      activeKey="presences"
      onNavigate={() => {}}
      title="Présences & badges"
      subtitle="Liste des enfants, entrées/sorties et badges QR"
      footerNav={[{ key: 'site', label: 'Voir le site', icon: 'globe', to: '/' }]}
      user={user}
      onLogout={logout}
      actions={
        <>
          <Link
            to="/admin/scan"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-ios-fill text-ios-text2 hover:bg-ios-fill-2 hover:text-arina-blue transition-all"
            title="Ouvrir le scanner de présence"
          >
            <Icon name="send" className="w-4 h-4" /> Scanner
          </Link>
          {tab === 'badges' && (
            <button
              onClick={exportSelected}
              disabled={!selectedIds.length || exporting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-arina-blue text-white hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Icon name="download" className="w-4 h-4" />
              {exporting ? 'Génération…' : `Exporter ${selectedIds.length || ''} badge${selectedIds.length > 1 ? 's' : ''}`}
            </button>
          )}
        </>
      }
    >
      {/* Onglets internes */}
      <div className="flex gap-1 rounded-2xl bg-ios-fill p-1 w-fit mb-4 animate-fade-up">
        <button
          onClick={() => setTab('presences')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'presences' ? 'bg-ios-card shadow text-ios-text' : 'text-ios-text2 hover:text-ios-text'}`}
        >
          <Icon name="activity" className="w-4 h-4 inline -mt-0.5 mr-1.5" />Présences
        </button>
        <button
          onClick={() => setTab('badges')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'badges' ? 'bg-ios-card shadow text-ios-text' : 'text-ios-text2 hover:text-ios-text'}`}
        >
          <Icon name="qrCode" className="w-4 h-4 inline -mt-0.5 mr-1.5" />Badges
        </button>
      </div>

      {tab === 'presences' && (
        <div className="space-y-4">
          {/* ── Barre de filtres : date, heure, nom ── */}
          <div className="card-apple p-4 animate-fade-up">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">
                  <Icon name="calendar" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Date
                </label>
                <input
                  type="date"
                  value={date}
                  max={todayLocal()}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">
                  <Icon name="clock" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Heure (filtre)
                </label>
                <input
                  type="time"
                  value={hourFilter}
                  onChange={(e) => setHourFilter(e.target.value)}
                  className={inputClass}
                  title="Afficher les enfants pointés à cette heure"
                />
                <p className="mt-1 text-[11px] text-ios-text3">Filtre sur l'heure des pointages — ex. 08:00 affiche les pointages entre 08h00 et 08h59.</p>
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">
                  <Icon name="search" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Nom
                </label>
                <input
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  placeholder="Rechercher un enfant…"
                  className={inputClass}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDate(todayLocal())}
                  className="px-3.5 py-2.5 rounded-xl bg-ios-fill text-xs font-semibold text-ios-text2 hover:bg-ios-fill-2 hover:text-arina-blue transition-all"
                  title="Revenir à aujourd'hui"
                >
                  <Icon name="refreshCw" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Aujourd'hui
                </button>
                {hasFilters && (
                  <button
                    onClick={resetFilters}
                    className="px-3.5 py-2.5 rounded-xl bg-ios-fill text-xs font-semibold text-red-500 hover:bg-red-500/10 transition-all"
                  >
                    <Icon name="x" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Effacer
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Résumé de la journée ── */}
          <div className="flex flex-wrap items-center gap-2 animate-fade-up">
            <span className="px-3 py-1.5 rounded-full bg-ios-fill text-xs font-bold text-ios-text2">
              <Icon name="users" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{activeChildren.length} enfants actifs
            </span>
            <span className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <Icon name="check" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{onSite} sur place
            </span>
            <span className="px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-xs font-bold">
              <Icon name="x" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{absent} absent{absent > 1 ? 's' : ''}
            </span>
            {hourFilter && (
              <span className="px-3 py-1.5 rounded-full bg-arina-warm text-arina-blue text-xs font-bold">
                <Icon name="clock" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Heure : {hourFilter}
              </span>
            )}
          </div>

          {/* ── Tableau des enfants (CRUD entrées/sorties) ── */}
          <div className="card-apple overflow-hidden animate-fade-up">
            <div className="px-5 py-4 border-b border-ios-hairline flex flex-wrap items-center gap-x-5 gap-y-1">
              <h3 className="font-bold">Feuille de présence — {fmtDate(date)}</h3>
              <span className="text-xs text-ios-text3">{filtered.length} enfant{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}</span>
              {data?.event ? (
                <span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">🌞 Session quotidienne</span>
              ) : (
                <span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full bg-ios-fill text-ios-text3">Aucun pointage ce jour</span>
              )}
            </div>
            {loading && !data ? (
              <div className="p-6 space-y-3"><div className="skeleton h-10" /><div className="skeleton h-10" /><div className="skeleton h-10" /></div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon="users"
                text={hasFilters ? 'Aucun enfant ne correspond aux filtres.' : 'Aucun enfant enregistré. Ajoutez d\'abord des enfants depuis l\'onglet Enfants.'}
                action={hasFilters ? <button onClick={resetFilters} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ios-fill text-sm font-semibold text-ios-text2 hover:bg-ios-fill-2 transition-colors"><Icon name="x" className="w-4 h-4" /> Effacer les filtres</button> : undefined}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ios-fill">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Enfant</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Entrées</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Sorties</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Statut</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ios-hairline">
                    {filtered.map((c) => {
                      const st = statusOf(c);
                      const pointage = (p, kind) => (
                        <span key={p.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold tabular shadow-sm">
                          <span className={kind === 'entry' ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-500'}>
                            {kind === 'entry' ? '⬇' : '⬆'} {fmtTime(p.scanned_at)}
                          </span>
                          <button
                            onClick={() => openEdit(p, c)}
                            className="text-ios-text3 hover:text-arina-blue transition-colors"
                            title={`Modifier ce ${DIR_LABEL[kind].toLowerCase()}`}
                          >
                            <Icon name="edit" className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => removePointage(p, c)}
                            className="text-ios-text3 hover:text-red-600 transition-colors"
                            title={`Supprimer ce ${DIR_LABEL[kind].toLowerCase()}`}
                          >
                            <Icon name="trash" className="w-3 h-3" />
                          </button>
                        </span>
                      );
                      return (
                        <tr key={c.id} className="hover:bg-ios-fill transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {c.photo ? (
                                <img src={c.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-arina-blue to-arina-blue-dark text-white flex items-center justify-center text-[11px] font-bold">{initials(`${c.prenom} ${c.nom}`)}</div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium truncate">{c.prenom} {c.nom}</div>
                                <div className="text-[11px] text-ios-text3 truncate">
                                  {c.statut}
                                  {c.badgeId ? ` · ${c.badgeId}` : ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {c.entries.length === 0
                                ? <span className="text-xs text-ios-text3">—</span>
                                : c.entries.map((p) => pointage(p, 'entry'))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {c.exits.length === 0
                                ? <span className="text-xs text-ios-text3">—</span>
                                : c.exits.map((p) => pointage(p, 'exit'))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${st.cls}`}>{st.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end items-center gap-1.5">
                              <button
                                onClick={() => openAdd(c, 'entry')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 transition-colors"
                                title={`Ajouter une entrée pour ${c.prenom} ${c.nom}`}
                              >
                                <Icon name="plus" className="w-3 h-3" /> Entrée
                              </button>
                              <button
                                onClick={() => openAdd(c, 'exit')}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500 text-white text-[11px] font-bold hover:bg-orange-600 transition-colors"
                                title={`Ajouter une sortie pour ${c.prenom} ${c.nom}`}
                              >
                                <Icon name="plus" className="w-3 h-3" /> Sortie
                              </button>
                              <Link
                                to={`/admin/beneficiaire/${c.id}`}
                                className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors"
                                title="Fiche enfant"
                              >
                                <Icon name="eye" className="w-4 h-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'badges' && (
        <>
        <div className="card-apple p-4 mb-3 flex items-start gap-3 animate-fade-up">
          <div className="w-9 h-9 rounded-xl bg-arina-warm text-arina-blue flex items-center justify-center flex-shrink-0"><Icon name="qrCode" className="w-5 h-5" /></div>
          <p className="text-xs text-ios-text2 leading-relaxed">
            <span className="font-semibold text-ios-text">Chaque enfant a son badge QR personnel.</span>{' '}
            Le badge est créé automatiquement à l'inscription (n° stable, ex. ARINA-0001-AB12) et réutilisé partout :
            QR sur écran, badge PDF à imprimer, et pointage de présence au scanner — tous les jours, sans événement.
          </p>
        </div>
        <div className="card-apple overflow-hidden animate-fade-up">
          <div className="px-4 py-3 border-b border-ios-hairline flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Icon name="search" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-text3 pointer-events-none" />
              <input value={badgeQuery} onChange={(e) => setBadgeQuery(e.target.value)} placeholder="Rechercher un enfant…" className={`${inputClass} pl-10`} />
            </div>
            <div className="flex items-center gap-2 text-xs text-ios-text3">
              <span>{selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}</span>
              <button
                onClick={exportAllBadges}
                disabled={!children.length || exporting}
                className="px-3.5 py-2 rounded-xl bg-ios-fill text-ios-text2 text-xs font-semibold hover:bg-ios-fill-2 disabled:opacity-40 transition-all"
                title="Exporter les badges de tous les enfants enregistrés"
              >
                <Icon name="users" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Exporter tous
              </button>
              <button
                onClick={exportSelected}
                disabled={!selectedIds.length || exporting}
                className="px-3.5 py-2 rounded-xl bg-arina-blue text-white text-xs font-semibold hover:bg-arina-blue-dark disabled:opacity-40 transition-all"
              >
                <Icon name="download" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />
                {exporting ? 'Génération…' : 'Exporter en PDF (4/page)'}
              </button>
            </div>
          </div>
          {filteredBadgeKids.length === 0 ? (
            <EmptyState icon="users" text="Aucun enfant trouvé." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ios-fill">
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-ios-hairline text-arina-blue focus:ring-arina-blue accent-arina-blue"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Enfant</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">N° de badge</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ios-hairline">
                  {filteredBadgeKids.map((c) => (
                    <tr key={c.id} className="hover:bg-ios-fill transition-colors">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          className="w-4 h-4 rounded border-ios-hairline text-arina-blue focus:ring-arina-blue accent-arina-blue"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {c.photo ? (
                            <img src={c.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-arina-blue to-arina-blue-dark text-white flex items-center justify-center text-[11px] font-bold">{initials(`${c.prenom} ${c.nom}`)}</div>
                          )}
                          <div>
                            <div className="font-medium">{c.prenom} {c.nom}</div>
                            <div className="text-[11px] text-ios-text3">{c.statut}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.badgeId ? (
                          <span className="px-2.5 py-1 rounded-full bg-arina-warm text-arina-blue text-xs font-bold tabular">{c.badgeId}</span>
                        ) : (
                          <span className="text-xs text-ios-text3">Non généré — cliquez sur QR</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button onClick={() => openQr(c)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-arina-blue/10 text-arina-blue text-xs font-semibold hover:bg-arina-blue/20 transition-colors" title="Voir le QR code">
                            QR
                          </button>
                          <button onClick={() => downloadBadgePdf(c)} className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors" title="Télécharger le badge PDF">
                            <Icon name="download" className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
      )}

      {/* ═══ Modal — Ajouter un pointage (entrée / sortie) ═══ */}
      {addModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAddModal(null)} />
          <div className="relative w-full max-w-sm bg-ios-card rounded-3xl shadow-2xl animate-pop overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-ios-hairline flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${addModal.type === 'entry' ? 'bg-emerald-600' : 'bg-orange-500'}`}>
                <Icon name={addModal.type === 'entry' ? 'chevronDown' : 'chevronUp'} className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">Ajouter un pointage</h3>
                <p className="text-xs text-ios-text3">{addModal.child.prenom} {addModal.child.nom} · {fmtDate(date)}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">Type de pointage</label>
                <div className="flex rounded-xl overflow-hidden border border-ios-hairline bg-ios-fill p-1">
                  <button
                    onClick={() => setAddModal({ ...addModal, type: 'entry' })}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${addModal.type === 'entry' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25' : 'text-ios-text2 hover:text-ios-text'}`}
                  >
                    ⬇ Entrée
                  </button>
                  <button
                    onClick={() => setAddModal({ ...addModal, type: 'exit' })}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${addModal.type === 'exit' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25' : 'text-ios-text2 hover:text-ios-text'}`}
                  >
                    ⬆ Sortie
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">Heure</label>
                <input type="time" value={addTime} onChange={(e) => setAddTime(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setAddModal(null)} disabled={saving} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Annuler</button>
              <button onClick={saveAdd} disabled={saving} className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors disabled:opacity-40">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal — Modifier un pointage ═══ */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditModal(null)} />
          <div className="relative w-full max-w-sm bg-ios-card rounded-3xl shadow-2xl animate-pop overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-ios-hairline flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white ${editModal.pointage.type === 'entry' ? 'bg-emerald-600' : 'bg-orange-500'}`}>
                <Icon name={editModal.pointage.type === 'entry' ? 'chevronDown' : 'chevronUp'} className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">Modifier le pointage</h3>
                <p className="text-xs text-ios-text3">{editModal.child.prenom} {editModal.child.nom} · {fmtDate(date)}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">Type de pointage</label>
                <div className="flex rounded-xl overflow-hidden border border-ios-hairline bg-ios-fill p-1">
                  <button
                    onClick={() => setEditModal({ ...editModal, pointage: { ...editModal.pointage, type: 'entry' } })}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${editModal.pointage.type === 'entry' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25' : 'text-ios-text2 hover:text-ios-text'}`}
                  >
                    ⬇ Entrée
                  </button>
                  <button
                    onClick={() => setEditModal({ ...editModal, pointage: { ...editModal.pointage, type: 'exit' } })}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${editModal.pointage.type === 'exit' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25' : 'text-ios-text2 hover:text-ios-text'}`}
                  >
                    ⬆ Sortie
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">Heure</label>
                <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setEditModal(null)} disabled={saving} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Annuler</button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors disabled:opacity-40">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal — QR code d'un badge ═══ */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setQrModal(null)} />
          <div className="relative w-full max-w-sm bg-ios-card rounded-3xl shadow-2xl animate-pop overflow-hidden text-center">
            <div className="px-6 pt-6 pb-2">
              <div className="w-14 h-14 mx-auto rounded-full bg-arina-warm text-arina-blue flex items-center justify-center text-lg font-bold">
                {initials(`${qrModal.child.prenom} ${qrModal.child.nom}`)}
              </div>
              <h3 className="mt-3 font-bold">{qrModal.child.prenom} {qrModal.child.nom}</h3>
              <p className="text-xs text-ios-text3">Badge {qrModal.badgeId}</p>
            </div>
            <div className="p-6">
              <div className="w-44 h-44 mx-auto rounded-2xl bg-white border border-ios-hairline p-2 shadow-inner">
                <img src={qrModal.qrCode} alt={`QR code badge ${qrModal.badgeId}`} className="w-full h-full object-contain" />
              </div>
              <p className="mt-3 text-[11px] text-ios-text3">Imprimez ce QR code ou téléchargez le badge PDF complet.</p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setQrModal(null)} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Fermer</button>
              <button
                onClick={() => { setQrModal(null); downloadBadgePdf(qrModal.child); }}
                className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors"
              >
                <Icon name="download" className="w-4 h-4 inline -mt-0.5 mr-1" /> Badge PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={closeToast} />
    </AdminLayout>
  );
}
