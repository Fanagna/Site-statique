import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_TABS } from './roles';
import AdminLayout from '../../components/admin/AdminLayout';
import { Icon } from '../../components/admin/icons';
import { inputClass, EmptyState } from '../../components/admin/ui';
import { timeAgo } from '../../components/admin/utils';
import {
  fetchEvents, scanBadge, fetchEventAttendances,
  fetchBeneficiaries, fetchBeneficiaryBadge,
} from '../../services/api';

/* ═══════════════════════════════════════════
   Scanner de présences par badge QR
   États d'écran (voir SPEC) :
   1. Erreur caméra      → « Impossible d'accéder à la caméra » + Réessayer
   2. Badge invalide     → « ❌ Badge non reconnu » + animation shake
   3. Compte désactivé   → « ⛔ Compte désactivé » + contact admin
   4. Double pointage    → « ✅ Vous êtes déjà pointé(e) ! » + dernier pointage
   5. Sortie sans entrée → « ❌ Vous devez d'abord scanner l'entrée » + ENTRÉE
   6. Succès             → « ✅ Pointage enregistré ! » + animation + reset 3 s
   ═══════════════════════════════════════════ */

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};
const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} à ${fmtTime(iso)}`;
};

const DIR_LABEL = { entry: 'ENTRÉE', exit: 'SORTIE' };

export default function ScanPage() {
  const { user, logout } = useAuth();

  /* ── Contexte ── */
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState('');
  const [direction, setDirection] = useState('entry'); // 'entry' | 'exit'
  const [feed, setFeed] = useState([]);
  const [children, setChildren] = useState([]);
  const [manualQuery, setManualQuery] = useState('');

  /* ── Overlay (machine à états du scan) ── */
  const [overlay, setOverlay] = useState(null); // { kind, child?, pointage?, error?, raw? }
  const [pendingExit, setPendingExit] = useState(null); // badge JSON à rescanner en ENTRÉE
  const [cameraKey, setCameraKey] = useState(0); // incrémenté → remonte la caméra (Réessayer)
  const [paused, setPaused] = useState(false);
  const busyRef = useRef(false);
  const timersRef = useRef([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => clearTimers, []);

  /* ── Chargement des données ── */
  useEffect(() => {
    (async () => {
      const evts = await fetchEvents();
      if (Array.isArray(evts) && evts.length) setEvents(evts);
      const kids = await fetchBeneficiaries();
      if (Array.isArray(kids)) setChildren(kids);
    })();
  }, []);

  /* Recharge les compteurs des événements + le fil des pointages */
  const refreshFeed = useCallback(async (evt) => {
    if (!evt) return;
    const list = await fetchEventAttendances(evt);
    if (!Array.isArray(list)) return;
    const flat = [];
    for (const g of list) {
      g.entries.forEach((at) => flat.push({ at, type: 'entry', ...g }));
      g.exits.forEach((at) => flat.push({ at, type: 'exit', ...g }));
    }
    flat.sort((a, b) => new Date(b.at) - new Date(a.at));
    setFeed(flat.slice(0, 10));
  }, []);

  const refreshEvents = useCallback(async () => {
    const evts = await fetchEvents();
    if (Array.isArray(evts)) setEvents(evts);
  }, []);

  // Date locale (journée de pointage) — même convention que le serveur (fuseau Antananarivo)
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];

  useEffect(() => {
    if (eventId) {
      refreshFeed(eventId);
      setOverlay(null);
      setPendingExit(null);
    } else {
      // Mode « Présence du jour » : on suit la session quotidienne du jour si elle existe
      const daily = events.find((e) => e.is_daily && e.event_date === todayStr);
      if (daily) refreshFeed(daily.id);
      else setFeed([]);
    }
  }, [eventId, events, refreshFeed, todayStr]);

  const dismissOverlay = useCallback(() => {
    clearTimers();
    setOverlay(null);
    setPendingExit(null);
    setPaused(false);
    busyRef.current = false;
  }, []);

  const showBrief = useCallback((overlayState, ms = 2600) => {
    setOverlay(overlayState);
    const t = window.setTimeout(() => {
      setOverlay(null);
      setPaused(false);
      busyRef.current = false;
    }, ms);
    timersRef.current.push(t);
  }, []);

  /* ── Cœur du scan : traite un contenu de badge ── */
  const handleScan = useCallback(async (raw, dirOverride) => {
    const dir = dirOverride || direction;
    if (busyRef.current) return; // anti double-scan
    busyRef.current = true;
    setPaused(true);
    setOverlay({ kind: 'processing' });

    // eventId vide → « Présence du jour » (session quotidienne auto-créée côté serveur)
    const res = await scanBadge(raw, eventId || null, dir);
    const d = res.data || {};

    if (res.ok && d.code === 'OK') {
      setOverlay({ kind: 'success', child: d.child, pointage: d.pointage, event: d.event, direction: dir });
      refreshFeed(eventId);
      refreshEvents();
      // Succès : animation de validation puis redirection automatique après 3 s
      const t = window.setTimeout(() => {
        setOverlay(null);
        setPaused(false);
        busyRef.current = false;
      }, 3000);
      timersRef.current.push(t);
      return;
    }

    switch (d.code) {
      case 'BADGE_INVALID':
        showBrief({ kind: 'badge-invalid', error: d.error });
        break;
      case 'BENEFICIARY_DISABLED':
        showBrief({ kind: 'disabled', error: d.error, raw });
        break;
      case 'ALREADY_SCANNED':
        showBrief({ kind: 'already', lastScan: d.lastScan, raw }, 3400);
        break;
      case 'EXIT_WITHOUT_ENTRY':
        setPendingExit(raw);
        setOverlay({ kind: 'no-entry', error: d.error, raw });
        // La caméra reste en pause : l'opérateur choisit ENTRÉE ou Fermer
        break;
      case 'EVENT_MISSING':
      case 'EVENT_INVALID':
        showBrief({ kind: 'badge-invalid', title: '⚠️ Événement indisponible', error: d.error || 'Événement introuvable' });
        break;
      default:
        // 5xx = erreur serveur réelle ; status 0 = base injoignable
        showBrief({
          kind: 'network',
          title: res.status >= 500 ? '❌ Erreur serveur' : '⚠️ Connexion perdue',
          error: d.error || (res.status >= 500 ? 'Le serveur a rencontré une erreur.' : 'Impossible de joindre le serveur.'),
        });
        break;
    }
  }, [direction, eventId, refreshFeed, refreshEvents, showBrief]);

  /* Scanner caméra → JSON du QR → handleScan */
  const onCameraScan = useCallback((codes) => {
    const raw = codes?.[0]?.rawValue;
    if (raw && !busyRef.current) handleScan(raw);
  }, [handleScan]);

  const onCameraError = useCallback((err) => {
    const kind = err?.kind || 'unknown';
    const msg =
      kind === 'permission-denied'
        ? 'Autorisez l’accès à la caméra dans les réglages du navigateur.'
        : kind === 'no-camera'
          ? 'Aucune caméra détectée sur cet appareil.'
          : kind === 'insecure-context'
            ? 'La caméra nécessite une connexion sécurisée (HTTPS ou localhost).'
            : 'Vérifiez que la caméra n’est pas utilisée par une autre application.';
    setOverlay({ kind: 'camera-error', detail: msg });
  }, []);

  /* Sortie sans entrée : on propose automatiquement de scanner ENTRÉE */
  const rescanAsEntry = useCallback(async () => {
    if (!pendingExit) return;
    busyRef.current = false; // la caméra est en pause : aucune course possible
    handleScan(pendingExit, 'entry');
    setPendingExit(null);
  }, [pendingExit, handleScan]);

  /* ── Pointage manuel (secours sans caméra) ── */
  const manualScan = useCallback(async (child, dirOverride) => {
    if (!child) return;
    let badgeId = child.badgeId;
    if (!badgeId) {
      const gen = await fetchBeneficiaryBadge(child.id);
      if (gen?.ok && gen.data?.badgeId) badgeId = gen.data.badgeId;
    }
    if (!badgeId) {
      setOverlay({ kind: 'network', error: 'Impossible de générer le badge de cet enfant.' });
      return;
    }
    const payload = JSON.stringify({ id: child.id, badgeId, name: `${child.prenom} ${child.nom}`.trim() });
    handleScan(payload, dirOverride);
  }, [handleScan]);

  const filteredKids = children.filter((c) =>
    `${c.prenom} ${c.nom}`.toLowerCase().includes(manualQuery.trim().toLowerCase())
  );

  const dailyEvent = events.find((e) => e.is_daily && e.event_date === todayStr);
  // En mode quotidien (aucun événement choisi), on affiche la session du jour
  const selectedEvent = eventId ? events.find((e) => String(e.id) === String(eventId)) : dailyEvent;
  // Compteur fiable : calculé côté serveur (contrairement au fil, limité à 10 entrées)
  const presentCount = selectedEvent ? Math.max(0, selectedEvent.entries - selectedEvent.exits) : 0;

  const allowedTabs = ROLE_TABS[user?.role] || ROLE_TABS.unknown;
  const can = (t) => allowedTabs.includes(t);
  const groups = [
    { group: 'Principal', items: [
      { key: 'dashboard', label: 'Tableau de bord', icon: 'grid', to: '/admin' },
      { key: 'presences', label: 'Présences', icon: 'calendar', to: '/admin/presences' },
      { key: 'scan', label: 'Scanner', icon: 'send' },
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
      activeKey="scan"
      onNavigate={() => {}}
      title="Scanner de présence"
      subtitle="Pointage quotidien par badge QR — ou par événement"
      footerNav={[{ key: 'site', label: 'Voir le site', icon: 'globe', to: '/' }]}
      user={user}
      onLogout={logout}
      actions={
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
          Scanner actif
        </span>
      }
    >
      <div className="space-y-4">
        {/* ── Barre de configuration (événement + sens) ── */}
        <div className="card-apple p-4 animate-fade-up">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">
                Session de pointage
              </label>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className={inputClass}
              >
                <option value="">🌞 Présence du jour (aujourd'hui)</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {e.event_date || 'date à définir'}{e.location ? ` · ${e.location}` : ''}
                  </option>
                ))}
              </select>
              {!eventId && (
                <p className="mt-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                  Par défaut : chaque scan est enregistré sur la présence du jour (une session automatique par jour).
                </p>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-ios-text3 mb-1.5">Sens du pointage</label>
              <div className="flex rounded-xl overflow-hidden border border-ios-hairline bg-ios-fill p-1">
                <button
                  onClick={() => setDirection('entry')}
                  className={`flex-1 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    direction === 'entry' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25' : 'text-ios-text2 hover:text-ios-text'
                  }`}
                >
                  ⬇ ENTRÉE
                </button>
                <button
                  onClick={() => setDirection('exit')}
                  className={`flex-1 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    direction === 'exit' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/25' : 'text-ios-text2 hover:text-ios-text'
                  }`}
                >
                  ⬆ SORTIE
                </button>
              </div>
            </div>
            <Link
              to="/admin/presences"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-ios-fill text-sm font-semibold text-ios-text2 hover:bg-ios-fill-2 hover:text-arina-blue transition-all mt-auto"
            >
              <Icon name="calendar" className="w-4 h-4" /> Voir les présences
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* ── Caméra / scanner ── */}
          <div className="xl:col-span-2 card-apple overflow-hidden animate-fade-up" style={{ animationDelay: '60ms' }}>
            <div className="relative bg-black">
              {/* Vue caméra — on remonte la caméra quand cameraKey change (Réessayer).
                  Active par défaut : sans événement choisi, le scan pointe la « Présence du jour ». */}
              <div key={cameraKey} className="relative h-[340px] sm:h-[420px] overflow-hidden">
                <Scanner
                  onScan={onCameraScan}
                  onError={onCameraError}
                  constraints={{ facingMode: 'environment' }}
                  components={{ finder: true, torch: true }}
                  paused={paused}
                  sound={false}
                  allowMultiple
                />
                {/* Ligne laser décorative */}
                {!paused && !overlay && (
                  <div className="absolute left-[12%] right-[12%] h-[2px] rounded-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_rgba(52,211,153,0.9)] animate-scan-line" />
                )}
                {/* Badge de la session active */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/55 backdrop-blur text-white text-[11px] font-bold shadow-lg">
                  <Icon name="calendar" className="w-3.5 h-3.5" />
                  {selectedEvent && !selectedEvent.is_daily ? selectedEvent.name : '🌞 Présence du jour'}
                </div>
              </div>
            </div>

            {/* Infos de l'événement sélectionné */}
            {selectedEvent && (
              <div className="px-4 py-3 border-t border-ios-hairline flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-ios-text2">
                <span className="font-semibold text-ios-text">{selectedEvent.name}</span>
                {selectedEvent.is_daily && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">🌞 Quotidien</span>
                )}
                {selectedEvent.event_date && <span><Icon name="calendar" className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />{selectedEvent.event_date}</span>}
                {selectedEvent.location && <span>📍 {selectedEvent.location}</span>}
                <span className="ml-auto font-bold text-emerald-600 dark:text-emerald-400">{Math.max(0, presentCount)} présent(s)</span>
              </div>
            )}
          </div>

          {/* ── Fil des derniers pointages ── */}
          <div className="card-apple overflow-hidden animate-fade-up" style={{ animationDelay: '120ms' }}>
            <div className="px-4 py-3 border-b border-ios-hairline flex items-center justify-between">
              <h3 className="text-sm font-bold">Derniers pointages</h3>
              <span className="text-[10px] text-ios-text3 uppercase tracking-wider font-semibold">{selectedEvent ? 'En direct' : '—'}</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto scroll-slim">
              {!selectedEvent ? (
                <EmptyState icon="activity" text="Scannez un badge pour démarrer la présence du jour." />
              ) : feed.length === 0 ? (
                <EmptyState icon="activity" text="Aucun pointage pour le moment. Scannez un badge !" />
              ) : (
                <ul className="divide-y divide-ios-hairline">
                  {feed.map((f, i) => (
                    <li key={`${f.id}-${f.at}-${i}`} className="px-4 py-2.5 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${f.type === 'entry' ? 'bg-emerald-500' : 'bg-orange-400'}`}>
                        {`${f.firstName?.[0] || ''}${f.lastName?.[0] || ''}`.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{f.firstName} {f.lastName}</div>
                        <div className="text-[11px] text-ios-text3">{timeAgo(f.at)}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${f.type === 'entry' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'}`}>
                        {DIR_LABEL[f.type]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ── Pointage manuel (secours) ── */}
        <div className="card-apple p-4 animate-fade-up" style={{ animationDelay: '180ms' }}>
          <details>
            <summary className="cursor-pointer select-none flex items-center gap-2 text-sm font-semibold text-ios-text2 hover:text-arina-blue transition-colors">
              <Icon name="users" className="w-4 h-4" />
              Pointage manuel sans caméra
              <span className="text-[10px] text-ios-text3 font-normal">(cliquez pour déplier)</span>
            </summary>
            <div className="mt-3 space-y-3">
              <div className="relative max-w-md">
                <Icon name="search" className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ios-text3 pointer-events-none" />
                <input
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  placeholder="Rechercher un enfant par son nom…"
                  className={`${inputClass} pl-10`}
                />
              </div>
              {filteredKids.length === 0 ? (
                <p className="text-xs text-ios-text3">Aucun enfant trouvé.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto scroll-slim">
                  {filteredKids.map((c) => (
                    <div key={c.id} className="flex items-center gap-2.5 rounded-xl border border-ios-hairline bg-ios-fill/50 px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{c.prenom} {c.nom}</div>
                        <div className="text-[10px] text-ios-text3 truncate">{c.badgeId ? c.badgeId : 'Badge non généré'}</div>
                      </div>
                      <button
                        onClick={() => manualScan(c, 'entry')}
                        disabled={busyRef.current}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                        title="Pointer une entrée"
                      >
                        ENTRÉE
                      </button>
                      <button
                        onClick={() => manualScan(c, 'exit')}
                        disabled={busyRef.current}
                        className="px-2.5 py-1.5 rounded-lg bg-orange-500 text-white text-[11px] font-bold hover:bg-orange-600 disabled:opacity-40 transition-colors"
                        title="Pointer une sortie"
                      >
                        SORTIE
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        </div>
      </div>

      {/* ═══════════════ OVERLAY de résultat ═══════════════ */}
      {overlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => overlay.kind !== 'processing' && dismissOverlay()} />
          <div className={`relative w-full max-w-sm bg-ios-card rounded-3xl shadow-2xl p-8 text-center animate-pop ${overlay.kind === 'badge-invalid' ? 'animate-shake' : ''}`}>
            {/* ── 1) Erreur caméra ── */}
            {overlay.kind === 'camera-error' && (
              <ResultCameraError detail={overlay.detail} onRetry={() => { setCameraKey((k) => k + 1); setOverlay(null); }} />
            )}

            {/* ── 2) Badge non reconnu ── */}
            {overlay.kind === 'badge-invalid' && (
              <ResultBadgeInvalid title={overlay.title} error={overlay.error} />
            )}

            {/* ── 3) Compte désactivé ── */}
            {overlay.kind === 'disabled' && <ResultDisabled />}

            {/* ── 4) Double pointage ── */}
            {overlay.kind === 'already' && <ResultAlready lastScan={overlay.lastScan} />}

            {/* ── 5) Sortie sans entrée ── */}
            {overlay.kind === 'no-entry' && (
              <ResultNoEntry onEntry={rescanAsEntry} onClose={dismissOverlay} />
            )}

            {/* ── 6) Succès ── */}
            {overlay.kind === 'success' && (
              <ResultSuccess child={overlay.child} pointage={overlay.pointage} event={overlay.event} direction={overlay.direction} />
            )}

            {/* ── Réseau / divers ── */}
            {overlay.kind === 'network' && (
              <div>
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-600 flex items-center justify-center animate-check-pop">
                  <Icon name="alertCircle" className="w-8 h-8" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold">{overlay.title || '⚠️ Connexion perdue'}</h3>
                <p className="mt-1 text-sm text-ios-text2">{overlay.error || 'Impossible de joindre le serveur.'}</p>
                <button onClick={dismissOverlay} className="mt-5 w-full py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Fermer</button>
              </div>
            )}

            {/* ── Traitement en cours ── */}
            {overlay.kind === 'processing' && (
              <div>
                <div className="w-16 h-16 mx-auto rounded-full bg-arina-warm flex items-center justify-center">
                  <div className="animate-spin w-7 h-7 border-3 border-arina-blue border-t-transparent rounded-full" />
                </div>
                <h3 className="mt-4 text-lg font-extrabold">Enregistrement…</h3>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

/* ═══════ Résultats ── sous-composants ═══════ */

/* 1) Erreur caméra + bouton Réessayer */
function ResultCameraError({ detail, onRetry }) {
  return (
    <>
      <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center animate-check-pop">
        <Icon name="alertCircle" className="w-8 h-8" />
      </div>
      <h3 className="mt-4 text-lg font-extrabold">📷 Impossible d'accéder à la caméra</h3>
      <p className="mt-1.5 text-sm text-ios-text2">{detail || 'La caméra est indisponible sur cet appareil.'}</p>
      <div className="mt-5 space-y-2">
        <button onClick={onRetry} className="w-full py-3 rounded-2xl bg-arina-blue text-white font-semibold text-sm hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-colors">
          Réessayer
        </button>
        <p className="text-[11px] text-ios-text3">Astuce : utilisez le pointage manuel ci-dessous en attendant.</p>
      </div>
    </>
  );
}

/* 2) Badge non reconnu (animation shake portée par la carte) */
function ResultBadgeInvalid({ title, error }) {
  return (
    <>
      <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center animate-check-pop">
        <Icon name="x" className="w-8 h-8" />
      </div>
      <h3 className="mt-4 text-lg font-extrabold">{title || '❌ Badge non reconnu'}</h3>
      <p className="mt-1.5 text-sm text-ios-text2">{error || 'Ce badge ne correspond à aucun bénéficiaire.'}</p>
    </>
  );
}

/* 3) Compte désactivé */
function ResultDisabled() {
  return (
    <>
      <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center animate-check-pop">
        <Icon name="shield" className="w-8 h-8" />
      </div>
      <h3 className="mt-4 text-lg font-extrabold">⛔ Compte désactivé</h3>
      <p className="mt-1.5 text-sm text-ios-text2">Ce badge appartient à un compte désactivé.</p>
      <p className="mt-1 text-xs text-ios-text3">Contactez l'administrateur du centre pour réactiver l'accès.</p>
    </>
  );
}

/* 4) Double pointage — on affiche le dernier pointage */
function ResultAlready({ lastScan }) {
  return (
    <>
      <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center animate-check-pop">
        <Icon name="check" className="w-8 h-8" />
      </div>
      <h3 className="mt-4 text-lg font-extrabold">✅ Vous êtes déjà pointé(e) !</h3>
      <div className="mt-4 mx-auto max-w-[220px] rounded-2xl bg-ios-fill px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-ios-text3">Dernier pointage</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lastScan?.type === 'entry' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600' : 'bg-orange-100 dark:bg-orange-500/15 text-orange-600'}`}>
            {DIR_LABEL[lastScan?.type] || '—'}
          </span>
        </div>
        <div className="mt-1 font-bold tabular">{fmtDateTime(lastScan?.scanned_at)}</div>
      </div>
    </>
  );
}

/* 5) Sortie sans entrée → on propose automatiquement ENTRÉE */
function ResultNoEntry({ onEntry, onClose }) {
  return (
    <>
      <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center animate-check-pop">
        <Icon name="chevronUp" className="w-8 h-8" />
      </div>
      <h3 className="mt-4 text-lg font-extrabold">❌ Vous devez d'abord scanner l'entrée</h3>
      <p className="mt-1.5 text-sm text-ios-text2">Impossible d'enregistrer une sortie sans entrée.</p>
      <div className="mt-5 space-y-2">
        <button onClick={onEntry} className="w-full py-3 rounded-2xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-colors">
          ⬇ Scanner ENTRÉE maintenant
        </button>
        <button onClick={onClose} className="w-full py-3 rounded-2xl bg-ios-fill font-semibold text-sm hover:bg-ios-fill-2 transition-colors">Fermer</button>
      </div>
    </>
  );
}

/* 6) Succès — animation de validation + redirection auto après 3 s */
function ResultSuccess({ child, pointage, event, direction }) {
  return (
    <>
      <div className="relative mx-auto w-24 h-24">
        {/* Confettis discrets */}
        <span className="absolute -top-1 left-0 w-2 h-2 rounded-full bg-emerald-400 animate-confetti" />
        <span className="absolute -top-1 right-2 w-2 h-2 rounded-full bg-arina-accent animate-confetti" style={{ animationDelay: '0.25s' }} />
        <span className="absolute top-1 left-6 w-1.5 h-1.5 rounded-full bg-amber-400 animate-confetti" style={{ animationDelay: '0.5s' }} />
        {/* Anneau qui se dessine */}
        <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
          <circle cx="50" cy="50" r="41" fill="none" stroke="#E8E6EA" strokeWidth="7" />
          <circle
            cx="50" cy="50" r="41" fill="none"
            stroke={direction === 'entry' ? '#059669' : '#EA580C'}
            strokeWidth="7" strokeLinecap="round"
            className="animate-ring"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-12 h-12 rounded-full text-white flex items-center justify-center shadow-lg animate-check-pop ${direction === 'entry' ? 'bg-emerald-500 shadow-emerald-500/40' : 'bg-orange-500 shadow-orange-500/40'}`}>
            <Icon name="check" className="w-6 h-6" strokeWidth={3} />
          </div>
        </div>
      </div>
      <h3 className="mt-3 text-lg font-extrabold text-emerald-600 dark:text-emerald-400">✅ Pointage enregistré !</h3>
      <p className="mt-1 text-base font-bold">{child?.firstName} {child?.lastName}</p>
      <p className="mt-0.5 text-xs text-ios-text3">
        {DIR_LABEL[direction]} · {fmtTime(pointage?.scanned_at)} · {event?.name}
      </p>
      {/* Barre de redirection automatique (3 s) */}
      <div className="mt-5">
        <div className="h-1.5 rounded-full bg-ios-fill overflow-hidden">
          <div className={`h-full rounded-full animate-countdown ${direction === 'entry' ? 'bg-emerald-500' : 'bg-orange-400'}`} />
        </div>
        <p className="mt-1.5 text-[11px] text-ios-text3">Redirection automatique vers le scan suivant…</p>
      </div>
    </>
  );
}
