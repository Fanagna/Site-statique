import { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Icon } from './icons';

/* ── Formatting helpers (voir ./utils) ── */
export const inputClass = 'w-full px-3.5 py-2.5 bg-ios-fill border border-ios-hairline rounded-xl text-sm placeholder:text-ios-text3 focus:outline-none focus:ring-2 focus:ring-arina-blue/30 focus:bg-ios-card focus:border-arina-blue/30 transition-all';

/* ── Count-up animation (Apple-style numbers) ── */
function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!target) { setValue(0); return; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

export function CountUp({ value, format }) {
  const v = useCountUp(value);
  return <>{format ? format(v) : v.toLocaleString('fr-FR')}</>;
}

/* ── Empty state ── */
export function EmptyState({ icon, text, action }) {
  return (
    <div className="py-12 text-center">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-ios-fill flex items-center justify-center text-ios-text3 mb-3">
        <Icon name={icon} className="w-6 h-6" />
      </div>
      <p className="text-sm text-ios-text2 font-medium max-w-xs mx-auto">{text}</p>
      {action}
    </div>
  );
}

/* ── Sortable table header ── */
export function Th({ label, k, sort, onSort, className = '' }) {
  return (
    <th className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ios-text3 whitespace-nowrap ${className}`}>
      {k ? (
        <button onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-ios-text transition-colors">
          {label}
          {sort.key === k && <span className="text-[9px]">{sort.dir === 1 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}</span>}
        </button>
      ) : (
        label
      )}
    </th>
  );
}
