import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_TABS } from './roles';
import AdminLayout from '../../components/admin/AdminLayout';
import Toast from '../../components/admin/Toast';
import { useToast } from '../../hooks/useToast';
import { Icon } from '../../components/admin/icons';
import { inputClass, EmptyState } from '../../components/admin/ui';
import { fmtDate, initials, optimizeImage, readFileAsDataURL } from '../../components/admin/utils';
import {
  fetchStaff, createStaff, updateStaff, deleteStaff,
  fetchStaffBadge, fetchStaffBadgePdf, exportStaffBadgesPdf,
  fetchStaffPresencesByDate, createStaffPresencePointage, updateStaffPresencePointage, deleteStaffPresencePointage,
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
// Catégories de personnel suggérées (champ libre possible via datalist)
const STAFF_ROLES = ['Éducateur', 'Bénévole', 'Permanent'];

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

export default function StaffPage() {
  const { user, logout } = useAuth();
  const { toast, showToast, closeToast } = useToast();
  // La gestion des fiches est réservée à l'admin et au président (vérifié aussi côté API)
  const canManage = user?.role === 'admin' || user?.role === 'president';

  const [tab, setTab] = useState('personnel'); // 'personnel' | 'presences' | 'badges'

  /* ── Personnel : liste + CRUD ── */
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffQuery, setStaffQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [savingStaff, setSavingStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ prenom: '', nom: '', role: 'Éducateur', photo: '', actif: true });

  /* ── Présences : filtres + données de la date ── */
  const [date, setDate] = useState(todayLocal());
  const [nameQuery, setNameQuery] = useState('');
  const [hourFilter, setHourFilter] = useState('');
  const [data, setData] = useState(null); // { date, event, staff }
  const [loading, setLoading] = useState(true);

  /* ── Modals pointages CRUD ── */
  const [addModal, setAddModal] = useState(null); // { member, type }
  const [editModal, setEditModal] = useState(null); // { member, pointage }
  const [addTime, setAddTime] = useState(nowHHMM());
  const [editTime, setEditTime] = useState(nowHHMM());
  const [saving, setSaving] = useState(false);

  /* ── Badges (onglet) ── */
  const [badgeQuery, setBadgeQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [qrModal, setQrModal] = useState(null); // { member, badgeId, qrCode }
  const [exporting, setExporting] = useState(false);

  /* Charge la liste du personnel */
  const loadStaff = useCallback(async () => {
    const list = await fetchStaff();
    if (Array.isArray(list)) setStaffList(list);
    setStaffLoading(false);
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  /* Charge les présences de la date sélectionnée */
  const loadPresences = useCallback(async (d) => {
    setLoading(true);
    const res = await fetchStaffPresencesByDate(d);
    if (res) setData(res);
    else setData((cur) => (cur && cur.date === d ? cur : null));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPresences(date);
  }, [date, loadPresences]);

  const reload = () => loadPresences(date);

  /* ── CRUD des fiches ── */
  const openForm = (m) => {
    if (m) {
      setEditingStaff(m);
      setStaffForm({ prenom: m.prenom, nom: m.nom, role: m.role || 'Éducateur', photo: m.photo || '', actif: m.actif !== false });
    } else {
      setEditingStaff(null);
      setStaffForm({ prenom: '', nom: '', role: 'Éducateur', photo: '', actif: true });
    }
    setFormOpen(true);
  };

  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(f.type)) { alert('Format non accepté — utilisez JPG, PNG, WebP ou GIF.'); return; }
    if (f.size > 15 * 1024 * 1024) { alert('Photo trop volumineuse (maximum 15 Mo).'); return; }
    const optimized = await optimizeImage(f, { maxDim: 1200, quality: 0.9 });
    if (optimized) { setStaffForm((prev) => ({ ...prev, photo: optimized })); return; }
    const raw = await readFileAsDataURL(f);
    setStaffForm((prev) => ({ ...prev, photo: raw }));
  };

  const saveStaff = async () => {
    if (savingStaff) return;
    if (!staffForm.prenom.trim() || !staffForm.nom.trim()) { showToast('❌ Prénom et nom requis', 'error'); return; }
    setSavingStaff(true);
    const r = editingStaff ? await updateStaff(editingStaff.id, staffForm) : await createStaff(staffForm);
    setSavingStaff(false);
    if (!r.ok) { showToast(`❌ ${editingStaff ? 'Modification' : 'Ajout'} NON enregistré dans la base : ${r.error}`, 'error'); return; }
    if (editingStaff) setStaffList(staffList.map((s) => (s.id === editingStaff.id ? r.data : s)));
    else setStaffList([r.data, ...staffList]);
    showToast(`✅ ${r.data.prenom} ${r.data.nom} ${editingStaff ? 'modifié' : 'ajouté'} — badge ${r.data.badgeId || 'créé'} enregistré`);
    setFormOpen(false);
    setEditingStaff(null);
    setStaffForm({ prenom: '', nom: '', role: 'Éducateur', photo: '', actif: true });
  };

  const removeStaff = async (m) => {
    if (!confirm(`Retirer ${m.prenom} ${m.nom} du personnel ?`)) return;
    const r = await deleteStaff(m.id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée dans la base : ${r.error}`, 'error'); return; }
    setStaffList(staffList.filter((s) => s.id !== m.id));
    showToast(`🗑️ ${m.prenom} ${m.nom} retiré du personnel`);
  };

  /* ── CRUD des pointages ── */
  const openAdd = (member, type) => {
    setAddModal({ member, type });
    setAddTime(nowHHMM());
  };

  const openEdit = (pointage, member) => {
    setEditModal({ member, pointage });
    setEditTime(fmtTime(pointage.scanned_at) !== '—' ? fmtTime(pointage.scanned_at) : nowHHMM());
  };

  const saveAdd = async () => {
    if (!addModal || saving) return;
    if (!addTime) { showToast('❌ Indiquez une heure', 'error'); return; }
    setSaving(true);
    const r = await createStaffPresencePointage(date, {
      staffId: addModal.member.id, type: addModal.type, time: addTime,
    });
    setSaving(false);
    if (!r.ok) { showToast(`❌ Pointage NON enregistré : ${r.error}`, 'error'); return; }
    setAddModal(null);
    await reload();
    showToast(`✅ ${DIR_LABEL[addModal.type]} de ${addModal.member.prenom} ${addModal.member.nom} à ${addTime} enregistrée`);
  };

  const saveEdit = async () => {
    if (!editModal || saving) return;
    if (!editTime) { showToast('❌ Indiquez une heure', 'error'); return; }
    setSaving(true);
    const r = await updateStaffPresencePointage(editModal.pointage.id, { type: editModal.pointage.type, time: editTime });
    setSaving(false);
    if (!r.ok) { showToast(`❌ Modification NON enregistrée : ${r.error}`, 'error'); return; }
    setEditModal(null);
    await reload();
    showToast(`✅ Pointage de ${editModal.member.prenom} ${editModal.member.nom} corrigé à ${editTime}`);
  };

  const removePointage = async (pointage, member) => {
    const who = `${member.prenom} ${member.nom}`;
    const when = fmtTime(pointage.scanned_at);
    if (!confirm(`Supprimer le pointage ${DIR_LABEL[pointage.type]} de ${who} à ${when} ?`)) return;
    const r = await deleteStaffPresencePointage(pointage.id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée : ${r.error}`, 'error'); return; }
    await reload();
    showToast(`🗑️ Pointage ${DIR_LABEL[pointage.type]} de ${who} supprimé`);
  };

  /* ── Filtres de la liste du personnel ── */
  const filteredStaff = staffList.filter((s) => {
    const q = staffQuery.trim().toLowerCase();
    return !q || `${s.prenom} ${s.nom} ${s.role || ''} ${s.badgeId || ''}`.toLowerCase().includes(q);
  });

  /* ── Filtres de la feuille de présence ── */
  const allMembers = data?.staff || [];
  const filtered = allMembers.filter((c) => {
    const q = nameQuery.trim().toLowerCase();
    if (q && !`${c.prenom} ${c.nom}`.toLowerCase().includes(q)) return false;
    if (hourFilter) {
      const hh = hourFilter.slice(0, 2);
      const has = [...c.entries, ...c.exits].some((p) => hourOf(p.scanned_at) === hh);
      if (!has) return false;
    }
    return true;
  });

  const activeMembers = allMembers.filter((c) => c.actif);
  const onSite = activeMembers.filter((c) => c.entries.length > c.exits.length).length;
  const absent = activeMembers.filter((c) => c.entries.length === 0).length;

  const statusOf = (c) => {
    if (c.entries.length === 0 && c.exits.length === 0) {
      return c.actif
        ? { label: 'Absent', cls: 'bg-ios-fill text-ios-text3' }
        : { label: '—', cls: 'bg-ios-fill/60 text-ios-text3' };
    }
    if (c.entries.length > c.exits.length) return { label: 'Sur place', cls: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' };
    return { label: 'Parti', cls: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' };
  };

  const hasFilters = nameQuery.trim() !== '' || hourFilter !== '';
  const resetFilters = () => { setNameQuery(''); setHourFilter(''); };

  /* ── Badges ── */
  const filteredBadgeStaff = staffList.filter((c) => {
    const q = badgeQuery.trim().toLowerCase();
    return !q || `${c.prenom} ${c.nom} ${c.badgeId || ''}`.toLowerCase().includes(q);
  });

  const toggleSelect = (id) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const allVisibleSelected = filteredBadgeStaff.length > 0 && filteredBadgeStaff.every((c) => selectedIds.includes(c.id));

  const toggleSelectAll = () =>
    setSelectedIds(allVisibleSelected ? [] : [...new Set([...selectedIds, ...filteredBadgeStaff.map((c) => c.id)])]);

  const generateBadgesPdf = async (ids, count, label) => {
    setExporting(true);
    showToast('⏳ Génération du PDF des badges…');
    const url = await exportStaffBadgesPdf(ids);
    setExporting(false);
    if (!downloadBlobUrl(url, 'badges-personnel-arina.pdf')) {
      showToast('❌ Impossible de générer le PDF (base injoignable ?)', 'error');
      return;
    }
    showToast(`✅ ${count} badge${count > 1 ? 's' : ''} exporté${count > 1 ? 's' : ''}${label ? ` (${label})` : ''}`);
  };

  const exportSelected = async () => {
    if (!selectedIds.length) { showToast('Sélectionnez au moins un membre', 'error'); return; }
    await generateBadgesPdf(selectedIds, selectedIds.length, 'format carte de crédit');
  };

  const exportAllBadges = async () => {
    if (!staffList.length) { showToast('Aucun membre enregistré — ajoutez d\'abord du personnel', 'error'); return; }
    await generateBadgesPdf(staffList.map((c) => c.id), staffList.length, 'tout le personnel');
  };

  const downloadBadgePdf = async (member) => {
    showToast('⏳ Génération du badge…');
    const url = await fetchStaffBadgePdf(member.id);
    const badgeId = member.badgeId || `STAFF-${member.id}`;
    if (!downloadBlobUrl(url, `badge-${badgeId}.pdf`)) {
      showToast('❌ Impossible de générer le PDF (base injoignable ?)', 'error');
      return;
    }
    showToast(`✅ Badge de ${member.prenom} ${member.nom} généré`);
  };

  const openQr = async (member) => {
    const r = await fetchStaffBadge(member.id);
    if (!r.ok || !r.data) { showToast(`❌ Impossible de générer le QR : ${r.error}`, 'error'); return; }
    setQrModal({ member, badgeId: r.data.badgeId, qrCode: r.data.qrCode });
  };

  const allowedTabs = ROLE_TABS[user?.role] || ROLE_TABS.unknown;
  const can = (t) => allowedTabs.includes(t);
  const groups = [
    { group: 'Principal', items: [
      { key: 'dashboard', label: 'Tableau de bord', icon: 'grid', to: '/admin' },
      { key: 'personnel', label: 'Personnel', icon: 'briefcase' },
      { key: 'presences', label: 'Présences', icon: 'calendar', to: '/admin/presences' },
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
      activeKey="personnel"
      onNavigate={() => {}}
      title="Personnel"
      subtitle="Éducateurs, bénévoles et permanents — fiches, présences et badges QR"
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
          {canManage && tab === 'personnel' && (
            <button
              onClick={() => openForm(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-arina-blue text-white hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-all"
            >
              <Icon name="plus" className="w-4 h-4" /> Ajouter un membre
            </button>
          )}
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
          onClick={() => setTab('personnel')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'personnel' ? 'bg-ios-card shadow text-ios-text' : 'text-ios-text2 hover:text-ios-text'}`}
        >
          <Icon name="briefcase" className="w-4 h-4 inline -mt-0.5 mr-1.5" />Personnel
        </button>
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

      {/* ═══ Onglet Personnel : liste + CRUD ═══ */}
      {tab === 'personnel' && (
        <div className="card-apple overflow-hidden animate-fade-up">
          <div className="px-4 py-3 border-b border-ios-hairline flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Icon name="search" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-text3 pointer-events-none" />
              <input value={staffQuery} onChange={(e) => setStaffQuery(e.target.value)} placeholder="Rechercher un membre…" className={`${inputClass} pl-10`} />
            </div>
            <span className="text-xs text-ios-text3">{filteredStaff.length} membre{filteredStaff.length > 1 ? 's' : ''}</span>
          </div>
          {staffLoading && staffList.length === 0 ? (
            <div className="p-6 space-y-3"><div className="skeleton h-10" /><div className="skeleton h-10" /><div className="skeleton h-10" /></div>
          ) : filteredStaff.length === 0 ? (
            <EmptyState
              icon="briefcase"
              text={staffQuery ? 'Aucun membre ne correspond à la recherche.' : 'Aucun membre enregistré. Ajoutez le personnel (éducateurs, bénévoles, permanents).'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-ios-fill">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Membre</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Rôle</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Statut</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">N° de badge</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ios-hairline">
                  {filteredStaff.map((s) => (
                    <tr key={s.id} className="hover:bg-ios-fill transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {s.photo ? (
                            <img src={s.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-arina-blue to-arina-blue-dark text-white flex items-center justify-center text-[11px] font-bold">{initials(`${s.prenom} ${s.nom}`)}</div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium truncate">{s.prenom} {s.nom}</div>
                            <div className="text-[11px] text-ios-text3 truncate">#STAFF-{String(s.id).padStart(4, '0')}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full bg-ios-fill text-ios-text2 text-xs font-semibold">{s.role || 'Permanent'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.actif ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-500'}`}>
                          {s.actif ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {s.badgeId ? (
                          <span className="px-2.5 py-1 rounded-full bg-arina-warm text-arina-blue text-xs font-bold tabular">{s.badgeId}</span>
                        ) : (
                          <span className="text-xs text-ios-text3">Non généré</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end items-center gap-1.5">
                          {canManage && (
                            <>
                              <button onClick={() => openForm(s)} className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors" title={`Modifier ${s.prenom} ${s.nom}`}>
                                <Icon name="edit" className="w-4 h-4" />
                              </button>
                              <button onClick={() => removeStaff(s)} className="p-2 rounded-lg text-ios-text3 hover:text-red-600 hover:bg-red-500/10 transition-colors" title={`Retirer ${s.prenom} ${s.nom}`}>
                                <Icon name="trash" className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button onClick={() => openQr(s)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-arina-blue/10 text-arina-blue text-xs font-semibold hover:bg-arina-blue/20 transition-colors" title="Voir le QR code">
                            QR
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
      )}

      {/* ═══ Onglet Présences : feuille du jour ═══ */}
      {tab === 'presences' && (
        <div className="space-y-4">
          {/* Barre de filtres : date, heure, nom */}
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
                  title="Afficher les membres pointés à cette heure"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">
                  <Icon name="search" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Nom
                </label>
                <input
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  placeholder="Rechercher un membre…"
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

          {/* Résumé de la journée */}
          <div className="flex flex-wrap items-center gap-2 animate-fade-up">
            <span className="px-3 py-1.5 rounded-full bg-ios-fill text-xs font-bold text-ios-text2">
              <Icon name="briefcase" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{activeMembers.length} membre{activeMembers.length > 1 ? 's' : ''} actif{activeMembers.length > 1 ? 's' : ''}
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

          {/* Tableau des membres (CRUD entrées/sorties) */}
          <div className="card-apple overflow-hidden animate-fade-up">
            <div className="px-5 py-4 border-b border-ios-hairline flex flex-wrap items-center gap-x-5 gap-y-1">
              <h3 className="font-bold">Présence du personnel — {fmtDate(date)}</h3>
              <span className="text-xs text-ios-text3">{filtered.length} membre{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}</span>
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
                icon="briefcase"
                text={hasFilters ? 'Aucun membre ne correspond aux filtres.' : 'Aucun membre enregistré. Ajoutez du personnel depuis l\'onglet Personnel.'}
                action={hasFilters ? <button onClick={resetFilters} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ios-fill text-sm font-semibold text-ios-text2 hover:bg-ios-fill-2 transition-colors"><Icon name="x" className="w-4 h-4" /> Effacer les filtres</button> : undefined}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-ios-fill">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Membre</th>
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
                                  {c.role}
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

      {/* ═══ Onglet Badges ═══ */}
      {tab === 'badges' && (
        <>
        <div className="card-apple p-4 mb-3 flex items-start gap-3 animate-fade-up">
          <div className="w-9 h-9 rounded-xl bg-arina-warm text-arina-blue flex items-center justify-center flex-shrink-0"><Icon name="badgeCheck" className="w-5 h-5" /></div>
          <p className="text-xs text-ios-text2 leading-relaxed">
            <span className="font-semibold text-ios-text">Chaque membre a son badge QR personnel (STAFF-XXXX).</span>{' '}
            Le badge est créé automatiquement à l'ajout (n° stable, ex. STAFF-0001-AB12) et réutilisé partout :
            QR sur écran, badge PDF à imprimer, et pointage de présence au scanner — comme les bénéficiaires.
          </p>
        </div>
        <div className="card-apple overflow-hidden animate-fade-up">
          <div className="px-4 py-3 border-b border-ios-hairline flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Icon name="search" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-text3 pointer-events-none" />
              <input value={badgeQuery} onChange={(e) => setBadgeQuery(e.target.value)} placeholder="Rechercher un membre…" className={`${inputClass} pl-10`} />
            </div>
            <div className="flex items-center gap-2 text-xs text-ios-text3">
              <span>{selectedIds.length} sélectionné{selectedIds.length > 1 ? 's' : ''}</span>
              <button
                onClick={exportAllBadges}
                disabled={!staffList.length || exporting}
                className="px-3.5 py-2 rounded-xl bg-ios-fill text-ios-text2 text-xs font-semibold hover:bg-ios-fill-2 disabled:opacity-40 transition-all"
                title="Exporter les badges de tout le personnel"
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
          {filteredBadgeStaff.length === 0 ? (
            <EmptyState icon="briefcase" text="Aucun membre trouvé." />
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
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Membre</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">N° de badge</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ios-hairline">
                  {filteredBadgeStaff.map((c) => (
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
                            <div className="text-[11px] text-ios-text3">{c.role}</div>
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

      {/* ═══ Modal — Fiche personnel (ajout / modification) ═══ */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !savingStaff && setFormOpen(false)} />
          <div className="relative w-full max-w-md bg-ios-card rounded-3xl shadow-2xl animate-pop overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-ios-hairline flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-arina-warm text-arina-blue flex items-center justify-center">
                <Icon name="briefcase" className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">{editingStaff ? 'Modifier le membre' : 'Ajouter un membre'}</h3>
                <p className="text-xs text-ios-text3">Éducateur · Bénévole · Permanent — badge STAFF créé automatiquement</p>
              </div>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto scroll-slim">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">Prénom</label>
                  <input value={staffForm.prenom} onChange={(e) => setStaffForm({ ...staffForm, prenom: e.target.value })} placeholder="ex. Miora" className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">Nom</label>
                  <input value={staffForm.nom} onChange={(e) => setStaffForm({ ...staffForm, nom: e.target.value })} placeholder="ex. Rakoto" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">Rôle / catégorie</label>
                <input
                  list="staff-roles-list"
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
                  placeholder="Éducateur, Bénévole, Permanent…"
                  className={inputClass}
                />
                <datalist id="staff-roles-list">
                  {STAFF_ROLES.map((r) => <option key={r} value={r} />)}
                </datalist>
                <p className="mt-1 text-[11px] text-ios-text3">Liste suggérée — vous pouvez saisir une autre catégorie.</p>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">Photo</label>
                <div className="flex items-center gap-3">
                  {staffForm.photo ? (
                    <img src={staffForm.photo} alt="" className="w-14 h-14 rounded-xl object-cover border border-ios-hairline" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-ios-fill text-ios-text3 flex items-center justify-center text-[10px] font-semibold">Aucune</div>
                  )}
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-ios-fill text-xs font-semibold text-ios-text2 hover:bg-ios-fill-2 hover:text-arina-blue transition-all">
                    <Icon name="upload" className="w-4 h-4" />
                    {staffForm.photo ? 'Changer' : 'Ajouter'}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onPhoto} className="hidden" />
                  </label>
                  {staffForm.photo && (
                    <button onClick={() => setStaffForm({ ...staffForm, photo: '' })} className="text-[11px] font-semibold text-red-500 hover:underline">Retirer</button>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-3 rounded-xl bg-ios-fill/60 px-4 py-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={staffForm.actif}
                  onChange={(e) => setStaffForm({ ...staffForm, actif: e.target.checked })}
                  className="w-4 h-4 rounded accent-arina-blue"
                />
                <span className="text-sm font-medium">Membre actif — badge scannable pour la présence</span>
              </label>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setFormOpen(false)} disabled={savingStaff} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Annuler</button>
              <button onClick={saveStaff} disabled={savingStaff} className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors disabled:opacity-40">
                {savingStaff ? 'Enregistrement…' : editingStaff ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Modal — Ajouter un pointage ═══ */}
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
                <p className="text-xs text-ios-text3">{addModal.member.prenom} {addModal.member.nom} · {fmtDate(date)}</p>
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
                <p className="text-xs text-ios-text3">{editModal.member.prenom} {editModal.member.nom} · {fmtDate(date)}</p>
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
                {initials(`${qrModal.member.prenom} ${qrModal.member.nom}`)}
              </div>
              <h3 className="mt-3 font-bold">{qrModal.member.prenom} {qrModal.member.nom}</h3>
              <p className="text-xs text-ios-text3">Badge {qrModal.badgeId} · {qrModal.member.role}</p>
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
                onClick={() => { setQrModal(null); downloadBadgePdf(qrModal.member); }}
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
