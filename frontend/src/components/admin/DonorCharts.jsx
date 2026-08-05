import { useState, useEffect, useMemo } from 'react';
import { formatMGA, CountUp, EmptyState } from './ui';

/* Palette stable par donateur (index du donateur dans la liste triée)
   — tons professionnels harmonisés avec l'identité ARINA */
const PALETTE = ['#7A2C3E', '#B97E2B', '#2E7D32', '#2563EB', '#7C3AED', '#0D9488', '#A94438', '#9CA3AF'];
const donorIndex = (donors, name) => {
  const idx = (donors || []).findIndex((d) => String(d.name).toLowerCase() === String(name || '').toLowerCase());
  return idx === -1 ? (donors || []).length : idx;
};
export const donorColor = (donors, name) => PALETTE[donorIndex(donors, name) % PALETTE.length];

const monthKey = (d) => {
  if (!d) return '';
  const [y, m] = String(d).split('-').map(Number);
  return y && m ? `${y}-${String(m).padStart(2, '0')}` : '';
};
const MONTH_NAMES = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

/* Récap par donateur : dons / dépenses / solde (filtre annuel + mois) */
export function useDonorTotals(finances, donors) {
  return useMemo(() => {
    const map = {};
    const add = (name) => {
      const k = String(name || '').trim() || 'Sans donateur';
      if (!map[k]) map[k] = { name: k, dons: 0, depenses: 0 };
      return map[k];
    };
    (finances || []).forEach((f) => {
      const t = add(f.donor);
      const v = Number(f.montant) || 0;
      if (f.type === 'Revenu') t.dons += v;
      else t.depenses += v;
    });
    return Object.values(map).map((t) => ({ ...t, solde: t.dons - t.depenses }));
  }, [finances]);
}

/* Donut — répartition des DONS par donateur */
export function DonorDonut({ finances, donors, loading }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 120); return () => clearTimeout(t); }, []);
  const totals = useDonorTotals(finances, donors);
  const data = useMemo(() => totals.map((t) => [t.name, t.dons]).filter(([, v]) => v > 0), [totals]);
  const total = data.reduce((s, [, v]) => s + v, 0);
  const R = 42, C = 2 * Math.PI * R;
  if (loading) return <div className="h-56 skeleton" />;
  if (total === 0) return <EmptyState icon="trendUp" text="Aucun don enregistré — la répartition par donateur apparaîtra ici." />;
  let acc = 0;
  return (
    <div className="flex flex-col items-center gap-5 mt-5">
      <div className="relative w-40 h-40 donut-in">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-ios-hairline)" strokeWidth="11" />
          {data.map(([label, value]) => {
            const frac = value / total;
            const dash = frac * C;
            const offset = -acc * C;
            acc += frac;
            return (
              <circle
                key={label}
                cx="50" cy="50" r={R} fill="none"
                stroke={donorColor(donors, label)} strokeWidth="11"
                strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={offset}
                className="donut-slice"
                style={{ transition: 'stroke-dashoffset .9s cubic-bezier(0.22,1,0.36,1), opacity .4s ease, stroke-width .25s ease, filter .25s ease', opacity: mounted ? 1 : 0 }}
              >
                <title>{`${label} : ${formatMGA(value)} (${Math.round((value / total) * 100)}%)`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold tabular"><CountUp value={total} format={formatMGA} /></span>
          <span className="text-[10px] text-ios-text3">dons</span>
        </div>
      </div>
      <div className="w-full space-y-2">
        {data.map(([label, value], i) => (
          <div key={label} className="flex items-center gap-2.5 text-sm animate-fade-up" style={{ animationDelay: `${0.25 + i * 0.07}s` }}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: donorColor(donors, label) }} />
            <span className="text-ios-text2 truncate">{label}</span>
            <span className="ml-auto font-semibold tabular"><CountUp value={value} format={formatMGA} /></span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-ios-fill text-ios-text3 w-12 text-right tabular">{Math.round((value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Barres horizontales — DÉPENSES par donateur (top 5) */
export function DonorExpenseBars({ finances, donors, loading }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 140); return () => clearTimeout(t); }, []);
  const totals = useDonorTotals(finances, donors);
  const data = useMemo(
    () => totals.map((t) => [t.name, t.depenses]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5),
    [totals],
  );
  const total = data.reduce((s, [, v]) => s + v, 0);
  if (loading) return <div className="h-56 skeleton" />;
  if (total === 0) return <EmptyState icon="trendDown" text="Aucune dépense enregistrée — le top des dépenses par donateur apparaîtra ici." />;
  return (
    <div className="space-y-4 mt-5">
      {data.map(([label, value], i) => (
        <div key={label} className="group animate-fade-up" style={{ animationDelay: `${i * 70}ms` }}>
          <div className="flex items-center justify-between text-sm mb-1.5 gap-2">
            <span className="text-ios-text2 truncate">{label}</span>
            <span className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-ios-fill text-ios-text3 tabular">{Math.round((value / total) * 100)}%</span>
              <span className="font-semibold tabular"><CountUp value={value} format={formatMGA} /></span>
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-ios-fill overflow-hidden">
            <div
              title={`${label} : ${formatMGA(value)} (${Math.round((value / total) * 100)}%)`}
              className="h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:brightness-110"
              style={{ width: mounted ? `${(value / total) * 100}%` : '0%', background: `linear-gradient(90deg, ${donorColor(donors, label)}, ${donorColor(donors, label)}cc)` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* Barres empilées — DÉPENSES mensuelles ventilées par donateur (année) */
export function DonorMonthlyStacked({ finances, donors, year, loading }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 160); return () => clearTimeout(t); }, []);
  const data = useMemo(() => {
    const months = MONTH_NAMES.map((name, i) => ({ key: `${year}-${String(i + 1).padStart(2, '0')}`, name, parts: {} }));
    (finances || [])
      .filter((f) => f.type === 'Dépense' && monthKey(f.date).startsWith(String(year)))
      .forEach((f) => {
        const m = months.find((x) => x.key === monthKey(f.date));
        if (!m) return;
        const d = String(f.donor || '').trim() || 'Sans donateur';
        m.parts[d] = (m.parts[d] || 0) + (Number(f.montant) || 0);
      });
    return months;
  }, [finances, year]);
  const max = useMemo(() => Math.max(...data.map((m) => Object.values(m.parts).reduce((s, v) => s + v, 0)), 1), [data]);
  if (loading) return <div className="h-56 skeleton" />;
  if (!data.some((m) => Object.keys(m.parts).length)) return <EmptyState icon="trendDown" text="Aucune dépense cette année — l'évolution mensuelle par donateur apparaîtra ici." />;
  const H = 40, W = 100;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44" preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1="0" x2={W} y1={(H * t).toFixed(2)} y2={(H * t).toFixed(2)} stroke="currentColor" strokeOpacity="0.07" strokeWidth="0.3" />
        ))}
        {data.map((m, i) => {
          const bw = W / 12 * 0.6;
          const bx = (i / 12) * W + (W / 12 - bw) / 2;
          let acc = 0;
          return (
            <g key={m.key} style={{ opacity: mounted ? 1 : 0, transition: `opacity .3s ease ${0.3 + i * 0.04}s` }}>
              {Object.entries(m.parts).map(([donor, v]) => {
                const h = (v / max) * (H - 6);
                const y = H - 3 - acc - h;
                acc += h;
                const c = donorColor(donors, donor);
                return (
                  <rect
                    key={donor}
                    x={bx}
                    width={bw}
                    rx="0.6"
                    fill={c}
                    opacity="0.92"
                    style={{
                      y: mounted ? y : H - 3,
                      height: mounted ? Math.max(h, 0.4) : 0,
                      transition: 'y .7s cubic-bezier(0.22,1,0.36,1), height .7s cubic-bezier(0.22,1,0.36,1)',
                    }}
                  >
                    <title>{`${m.name} — ${donor} : ${formatMGA(v)}`}</title>
                  </rect>
                );
              })}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between mt-1 px-0.5">
        {data.map((m) => <span key={m.key} className="text-[10px] text-ios-text3 capitalize">{m.name.slice(0, 3)}</span>)}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 mt-4 text-xs font-medium text-ios-text3">
        {[...new Set(data.flatMap((m) => Object.keys(m.parts)))].map((d) => (
          <span key={d} className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: donorColor(donors, d) }} /> {d}</span>
        ))}
      </div>
    </div>
  );
}
