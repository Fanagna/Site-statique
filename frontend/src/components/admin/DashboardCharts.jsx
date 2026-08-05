import { useState, useEffect, useMemo } from 'react';
import { formatMGA, CountUp, EmptyState } from './ui';

const monthKey = (d) => {
  if (!d) return '';
  const [y, m] = String(d).split('-').map(Number);
  return y && m ? `${y}-${String(m).padStart(2, '0')}` : '';
};

/* ═══════════════════════════════════════
   Évolution sur 6 mois
   Aires dégradées + lignes avec halo lumineux + points pulsés + infobulles
   ═══════════════════════════════════════ */
export function EvolutionChart({ finances, loading }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const data = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('fr-FR', { month: 'short' }),
        revenus: 0,
        depenses: 0,
      });
    }
    (finances || []).forEach((f) => {
      const m = months.find((x) => x.key === monthKey(f.date));
      if (!m) return;
      if (f.type === 'Revenu') m.revenus += Number(f.montant) || 0;
      else m.depenses += Number(f.montant) || 0;
    });
    return months;
  }, [finances]);

  const max = useMemo(() => Math.max(...data.map((m) => Math.max(m.revenus, m.depenses)), 1), [data]);
  const totRev = data.reduce((s, m) => s + m.revenus, 0);
  const totDep = data.reduce((s, m) => s + m.depenses, 0);

  if (loading) return <div className="h-56 skeleton" />;
  if (!data.some((m) => m.revenus > 0 || m.depenses > 0)) {
    return (
      <EmptyState
        icon="trendUp"
        text="Aucune transaction sur les 6 derniers mois — l'évolution mensuelle apparaîtra ici."
      />
    );
  }
  const W = 100;
  const H = 40;
  const x = (i) => (data.length === 1 ? 0 : (i / (data.length - 1)) * W);
  const y = (v) => H - (Math.max(Number(v) || 0, 0) / max) * (H - 10) - 5;
  const mkPath = (get) => data.map((m, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(get(m)).toFixed(2)}`).join(' ');
  const revenusPath = mkPath((m) => m.revenus);
  const depensesPath = mkPath((m) => m.depenses);
  const pt = (i, v) => ({ cx: x(i).toFixed(2), cy: y(v).toFixed(2) });

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48">
        <defs>
          <linearGradient id="evoRev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2e7d32" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#2e7d32" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="evoDep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dc2626" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0.02" />
          </linearGradient>
          <filter id="evoGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1="0" x2={W} y1={(H * t).toFixed(2)} y2={(H * t).toFixed(2)} stroke="currentColor" strokeOpacity="0.06" strokeWidth="0.3" />
        ))}
        <path d={`${revenusPath} L${W},${H} L0,${H} Z`} fill="url(#evoRev)" style={{ opacity: mounted ? 1 : 0, transition: 'opacity .9s ease' }} />
        <path d={`${depensesPath} L${W},${H} L0,${H} Z`} fill="url(#evoDep)" style={{ opacity: mounted ? 1 : 0, transition: 'opacity .9s ease .1s' }} />
        <path d={revenusPath} fill="none" stroke="#2e7d32" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#evoGlow)" pathLength={1} strokeDasharray={mounted ? '1 0' : '0 1'} style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(0.22,1,0.36,1)' }} />
        <path d={depensesPath} fill="none" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#evoGlow)" pathLength={1} strokeDasharray={mounted ? '1 0' : '0 1'} style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(0.22,1,0.36,1) .18s' }} />
        {data.map((m, i) => (
          <g key={m.key}>
            {m.revenus > 0 && (
              <>
                <circle {...pt(i, m.revenus)} r="2.4" fill="#2e7d32" className="chart-ping" style={{ opacity: mounted ? 1 : 0, transition: 'opacity .3s ease' }} />
                <circle {...pt(i, m.revenus)} r="1.7" fill="#2e7d32" stroke="var(--color-ios-card)" strokeWidth="0.8" style={{ opacity: mounted ? 1 : 0, transition: `opacity .3s ease ${0.4 + i * 0.08}s` }}>
                  <title>{`${m.label} — Revenus : ${formatMGA(m.revenus)}`}</title>
                </circle>
              </>
            )}
            {m.depenses > 0 && (
              <>
                <circle {...pt(i, m.depenses)} r="2.4" fill="#dc2626" className="chart-ping" style={{ opacity: mounted ? 1 : 0, transition: 'opacity .3s ease .12s' }} />
                <circle {...pt(i, m.depenses)} r="1.7" fill="#dc2626" stroke="var(--color-ios-card)" strokeWidth="0.8" style={{ opacity: mounted ? 1 : 0, transition: `opacity .3s ease ${0.4 + i * 0.08}s` }}>
                  <title>{`${m.label} — Dépenses : ${formatMGA(m.depenses)}`}</title>
                </circle>
              </>
            )}
          </g>
        ))}
      </svg>
      <div className="flex justify-between mt-1 px-0.5">
        {data.map((m) => (
          <span key={m.key} className="text-[10px] text-ios-text3 capitalize">{m.label}</span>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-5 mt-4 text-xs font-medium text-ios-text3">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#2e7d32]" /> Revenus · <b className="tabular text-emerald-600 dark:text-emerald-400">{formatMGA(totRev)}</b></span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#dc2626]" /> Dépenses · <b className="tabular text-red-500 dark:text-red-400">{formatMGA(totDep)}</b></span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   Top 5 des dépenses (barres horizontales dégradées + % )
   ═══════════════════════════════════════ */
export function TopExpensesChart({ finances, loading }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 120);
    return () => clearTimeout(t);
  }, []);

  const data = useMemo(() => {
    const map = {};
    (finances || [])
      .filter((f) => f.type === 'Dépense')
      .forEach((f) => {
        const v = Math.max(0, Number(f.montant) || 0);
        if (v <= 0) return;
        const k = f.categorie || 'Autre';
        map[k] = (map[k] || 0) + v;
      });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [finances]);

  const total = data.reduce((s, [, v]) => s + v, 0);
  const colors = ['#E0574F', '#F59F00', '#B14A54', '#FFA18E', '#9CA3AF'];

  if (loading) return <div className="h-56 skeleton" />;
  if (total === 0) {
    return <EmptyState icon="trendDown" text="Aucune dépense enregistrée — le top 5 des dépenses apparaîtra ici." />;
  }
  return (
    <div className="space-y-4 mt-5">
      {data.map(([label, value], i) => (
        <div key={label} className="group">
          <div className="flex items-center justify-between text-sm mb-1.5 gap-2">
            <span className="text-ios-text2 truncate">{label}</span>
            <span className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-ios-fill text-ios-text3 tabular">{Math.round((value / total) * 100)}%</span>
              <span className="font-semibold tabular">{formatMGA(value)}</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-ios-fill overflow-hidden">
            <div
              title={`${label} : ${formatMGA(value)} (${Math.round((value / total) * 100)}%)`}
              className="h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:brightness-110"
              style={{ width: mounted ? `${(value / total) * 100}%` : '0%', background: `linear-gradient(90deg, ${colors[i % colors.length]}, ${colors[i % colors.length]}cc)` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════
   Répartition par catégorie (donut animé + total compté + infobulles)
   ═══════════════════════════════════════ */
export function CategoryDonut({ finances, loading }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 140);
    return () => clearTimeout(t);
  }, []);

  const colors = ['#E0574F', '#F59F00', '#B14A54', '#FFA18E', '#FFD0B3', '#9CA3AF'];
  const data = useMemo(() => {
    const map = {};
    (finances || [])
      .filter((f) => f.type === 'Dépense')
      .forEach((f) => {
        const v = Math.max(0, Number(f.montant) || 0);
        if (v <= 0) return;
        const k = f.categorie || 'Autre';
        map[k] = (map[k] || 0) + v;
      });
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    if (entries.length > 6) {
      const top = entries.slice(0, 5);
      const rest = entries.slice(5).reduce((s, [, v]) => s + v, 0);
      top.push(['Autres', rest]);
      return top;
    }
    return entries;
  }, [finances]);

  const total = data.reduce((s, [, v]) => s + v, 0);
  const R = 42;
  const C = 2 * Math.PI * R;

  if (loading) return <div className="h-56 skeleton" />;
  if (total === 0) {
    return <EmptyState icon="trendDown" text="Aucune dépense enregistrée — la répartition par catégorie apparaîtra ici." />;
  }

  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-5 mt-5">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 100 100" className="w-full h-full donut-in">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-ios-hairline)" strokeWidth="11" />
          {data.map(([label, value], i) => {
            const frac = value / total;
            const dash = frac * C;
            const offset = -acc * C;
            acc += frac;
            return (
              <circle
                key={label}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={colors[i % colors.length]}
                strokeWidth="11"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={offset}
                className="donut-slice"
                style={{ opacity: mounted ? 1 : 0, transition: `opacity .5s ease ${0.2 + i * 0.1}s` }}
              >
                <title>{`${label} : ${formatMGA(value)} (${Math.round((value / total) * 100)}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <CountUp value={total} format={formatMGA} />
          <span className="text-[10px] text-ios-text3">total dépenses</span>
        </div>
      </div>
      <div className="w-full space-y-2">
        {data.map(([label, value], i) => (
          <div key={label} className="flex items-center gap-2.5 text-sm animate-fade-up" style={{ animationDelay: `${0.3 + i * 0.07}s` }}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colors[i % colors.length] }} />
            <span className="text-ios-text2 truncate">{label}</span>
            <span className="ml-auto font-semibold tabular">{formatMGA(value)}</span>
            <span className="text-xs text-ios-text3 w-10 text-right tabular">{Math.round((value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
