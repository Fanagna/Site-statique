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
  fetchEvents, createEvent, deleteEvent, fetchEventAttendances,
  fetchBeneficiaries, fetchBeneficiaryBadge, fetchBeneficiaryBadgePdf, exportBadgesPdf,
} from '../../services/api';

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

  const [tab, setTab] = useState('evenements'); // 'evenements' | 'badges'
  const [events, setEvents] = useState([]);
  const [children, setChildren] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  /* Événement sélectionné + ses présences */
  const [selectedId, setSelectedId] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [loadingAtt, setLoadingAtt] = useState(false);

  /* Modal création */
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', event_date: new Date().toISOString().split('T')[0], location: '', description: '' });

  /* Badges */
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [qrModal, setQrModal] = useState(null); // { child, badgeId, qrCode }
  const [exporting, setExporting] = useState(false);

  const loadEvents = useCallback(async () => {
    const evts = await fetchEvents();
    if (Array.isArray(evts)) {
      setEvents(evts);
      setSelectedId((cur) => (cur && evts.some((e) => e.id === cur) ? cur : null));
    }
    setLoadingEvents(false);
  }, []);

  useEffect(() => {
    loadEvents();
    (async () => {
      const kids = await fetchBeneficiaries();
      if (Array.isArray(kids)) setChildren(kids);
    })();
  }, [loadEvents]);

  /* Présences de l'événement sélectionné */
  useEffect(() => {
    if (!selectedId) { setAttendances([]); return; }
    setLoadingAtt(true);
    (async () => {
      const list = await fetchEventAttendances(selectedId);
      if (Array.isArray(list)) setAttendances(list);
      setLoadingAtt(false);
    })();
  }, [selectedId]);

  const selectedEvent = events.find((e) => e.id === selectedId) || null;

  const saveEvent = async () => {
    if (!form.name.trim()) { showToast("❌ Le nom de l'événement est requis", 'error'); return; }
    const r = await createEvent(form);
    if (!r.ok) { showToast(`❌ Événement NON créé dans la base : ${r.error}`, 'error'); return; }
    setShowForm(false);
    setForm({ name: '', event_date: new Date().toISOString().split('T')[0], location: '', description: '' });
    await loadEvents();
    setSelectedId(r.data.id);
    showToast(`✅ Événement « ${r.data.name} » créé`);
  };

  const removeEvent = async (id) => {
    const evt = events.find((e) => e.id === id);
    const msg = evt?.is_daily
      ? `Supprimer la session « ${evt.name} » et toutes ses présences ? Elle sera recréée automatiquement au prochain scan.`
      : `Supprimer l'événement « ${evt?.name} » et toutes ses présences ?`;
    if (!confirm(msg)) return;
    const r = await deleteEvent(id);
    if (!r.ok) { showToast(`❌ Suppression NON effectuée : ${r.error}`, 'error'); return; }
    if (selectedId === id) setSelectedId(null);
    await loadEvents();
    showToast('✅ Événement supprimé');
  };

  /* ── Badges ── */
  const filteredKids = children.filter((c) => {
    const q = query.trim().toLowerCase();
    return !q || `${c.prenom} ${c.nom} ${c.badgeId || ''}`.toLowerCase().includes(q);
  });

  const toggleSelect = (id) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const allVisibleSelected = filteredKids.length > 0 && filteredKids.every((c) => selectedIds.includes(c.id));

  const toggleSelectAll = () =>
    setSelectedIds(allVisibleSelected ? [] : [...new Set([...selectedIds, ...filteredKids.map((c) => c.id)])]);

  /* Génère le PDF multi-badges (partagé par « Exporter la sélection » et « Exporter tous ») */
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

  /* Stats de l'événement sélectionné */
  const present = Math.max(0, attendances.reduce((n, g) => n + g.entries.length - g.exits.length, 0));
  const uniqueKids = attendances.length;

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
      subtitle="Événements, pointages QR et badges des enfants"
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
          {tab === 'evenements' && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-arina-blue text-white hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-all"
            >
              <Icon name="plus" className="w-4 h-4" /> Nouvel événement
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
          onClick={() => setTab('evenements')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'evenements' ? 'bg-ios-card shadow text-ios-text' : 'text-ios-text2 hover:text-ios-text'}`}
        >
          <Icon name="calendar" className="w-4 h-4 inline -mt-0.5 mr-1.5" />Événements
        </button>
        <button
          onClick={() => setTab('badges')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${tab === 'badges' ? 'bg-ios-card shadow text-ios-text' : 'text-ios-text2 hover:text-ios-text'}`}
        >
          <Icon name="download" className="w-4 h-4 inline -mt-0.5 mr-1.5" />Badges
        </button>
      </div>

      {tab === 'evenements' && (
        <div className="space-y-4">
          {/* ── Liste des événements ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {loadingEvents ? (
              <div className="card-apple p-6"><div className="skeleton h-24" /></div>
            ) : events.length === 0 ? (
              <div className="card-apple md:col-span-2 xl:col-span-3">
                <EmptyState
                  icon="calendar"
                  text="Aucun événement pour le moment. Créez votre premier événement pour pointer les présences."
                  action={<button onClick={() => setShowForm(true)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-arina-blue text-white text-sm font-semibold"><Icon name="plus" className="w-4 h-4" /> Nouvel événement</button>}
                />
              </div>
            ) : events.map((e) => {
              const presentCount = Math.max(0, e.entries - e.exits);
              const active = selectedId === e.id;
              return (
                <div
                  key={e.id}
                  className={`card-apple card-apple-hover p-4 cursor-pointer transition-all ${active ? 'ring-2 ring-arina-blue/50' : ''}`}
                  onClick={() => setSelectedId(e.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">
                        {e.name}
                        {e.is_daily && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold align-middle">🌞 Quotidien</span>
                        )}
                      </h3>
                      <div className="mt-1 text-xs text-ios-text3 space-y-0.5">
                        {e.event_date && <div><Icon name="calendar" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{fmtDate(e.event_date)}</div>}
                        {e.location && <div>📍 {e.location}</div>}
                      </div>
                    </div>
                    <button
                      onClick={(ev) => { ev.stopPropagation(); removeEvent(e.id); }}
                      className="p-1.5 rounded-lg text-ios-text3 hover:text-red-600 hover:bg-red-500/10 transition-colors flex-shrink-0"
                      title="Supprimer l'événement"
                    >
                      <Icon name="trash" className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-[11px]">
                    <span className="px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold">{e.entries} entrée{e.entries > 1 ? 's' : ''}</span>
                    <span className="px-2 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold">{e.exits} sortie{e.exits > 1 ? 's' : ''}</span>
                    <span className="px-2 py-1 rounded-full bg-arina-warm text-arina-blue font-bold">👀 {presentCount} présent{presentCount > 1 ? 's' : ''}</span>
                  </div>
                  <div className="mt-2 text-[11px] text-ios-text3">{active ? '▼ Présences affichées ci-dessous' : 'Cliquez pour voir les présences'}</div>
                </div>
              );
            })}
          </div>

          {/* ── Détail des présences de l'événement sélectionné ── */}
          {selectedEvent && (
            <div className="card-apple overflow-hidden animate-fade-up">
              <div className="px-5 py-4 border-b border-ios-hairline flex flex-wrap items-center gap-x-5 gap-y-1">
                <h3 className="font-bold">{selectedEvent.name}</h3>
                <span className="text-xs text-ios-text3">{uniqueKids} enfant{uniqueKids > 1 ? 's' : ''} pointé{uniqueKids > 1 ? 's' : ''}</span>
                <span className="ml-auto text-xs font-bold text-emerald-600 dark:text-emerald-400">{present} présent{present > 1 ? 's' : ''} en ce moment</span>
              </div>
              {loadingAtt ? (
                <div className="p-6 space-y-3"><div className="skeleton h-10" /><div className="skeleton h-10" /></div>
              ) : attendances.length === 0 ? (
                <EmptyState icon="activity" text="Aucun pointage pour cet événement. Ouvrez le scanner pour pointer les présences." action={<Link to="/admin/scan" className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-arina-blue text-white text-sm font-semibold"><Icon name="send" className="w-4 h-4" /> Ouvrir le scanner</Link>} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-ios-fill">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Enfant</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Entrée</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Sortie</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Statut</th>
                        <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-ios-text3">Badge</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ios-hairline">
                      {attendances.map((g) => {
                        const inTime = g.entries[g.entries.length - 1] || null;
                        const outTime = g.exits[g.exits.length - 1] || null;
                        const onSite = !!inTime && !outTime;
                        return (
                          <tr key={g.id} className="hover:bg-ios-fill transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {g.photo ? (
                                  <img src={g.photo} alt="" className="w-9 h-9 rounded-full object-cover" />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-arina-blue to-arina-blue-dark text-white flex items-center justify-center text-[11px] font-bold">{initials(`${g.firstName} ${g.lastName}`)}</div>
                                )}
                                <div>
                                  <div className="font-medium">{g.firstName} {g.lastName}</div>
                                  <div className="text-[11px] text-ios-text3">{g.status === 'active' ? 'Actif' : g.status === 'graduated' ? 'Diplômé' : 'Inactif'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-ios-text2 tabular">
                              {inTime ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">⬇ {new Date(inTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span> : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-ios-text2 tabular">
                              {outTime ? <span className="text-orange-500 font-semibold">⬆ {new Date(outTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span> : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${onSite ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-ios-fill text-ios-text3'}`}>
                                {onSite ? 'Sur place' : 'Parti'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-end gap-1.5">
                                <Link to={`/admin/beneficiaire/${g.id}`} className="p-2 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-warm transition-colors" title="Fiche enfant"><Icon name="eye" className="w-4 h-4" /></Link>
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
          )}
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
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un enfant…" className={`${inputClass} pl-10`} />
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
          {filteredKids.length === 0 ? (
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
                  {filteredKids.map((c) => (
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

      {/* ═══ Modal — Nouvel événement ═══ */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-md bg-ios-card rounded-3xl shadow-2xl animate-pop overflow-hidden">
            <div className="px-6 pt-6 pb-4 border-b border-ios-hairline flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-arina-warm text-arina-blue flex items-center justify-center"><Icon name="calendar" className="w-5 h-5" /></div>
              <div>
                <h3 className="font-bold">Nouvel événement</h3>
                <p className="text-xs text-ios-text3">Pour pointer les présences par badge</p>
              </div>
            </div>
            <div className="p-6 space-y-3">
              <input placeholder="Nom de l'événement (ex. Atelier menuiserie)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
              <input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} className={inputClass} />
              <input placeholder="Lieu (ex. Centre ARINA)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputClass} />
              <textarea placeholder="Description (facultatif)" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} />
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Annuler</button>
              <button onClick={saveEvent} className="flex-1 py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors">Créer</button>
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
