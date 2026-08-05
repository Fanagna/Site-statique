import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Scale, ShieldCheck, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { fetchTransparency } from '../services/api';
import usePageMeta from '../hooks/usePageMeta';

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const fmtAr = (n) => `${(n || 0).toLocaleString('fr-FR')} Ar`;
const fmtMonth = (key) => {
  const [y, m] = String(key || '').split('-').map(Number);
  if (!y || !m) return key || '—';
  return `${MONTHS_FR[m - 1]} ${y}`;
};

export default function TransparencyPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [years, setYears] = useState([]);
  const [failed, setFailed] = useState(false);
  usePageMeta(
    'Transparence — ARINA',
    "Revenus, dépenses et répartition par donateur : ARINA rend publics ses comptes pour construire une relation de confiance durable.",
  );

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    fetchTransparency(year).then((d) => {
      if (cancelled) return;
      if (!d || !Array.isArray(d.donateurs)) { setFailed(true); return; }
      setData(d);
      setYears((prev) => {
        const ys = new Set([...prev, d.year]);
        d.mensuel.forEach((m) => { const y = Number(String(m.mois).slice(0, 4)); if (y) ys.add(y); });
        return [...ys].sort((a, b) => b - a);
      });
    });
    return () => { cancelled = true; };
  }, [year]);

  const totalDonsDonors = (data?.donateurs || []).reduce((s, d) => s + d.dons, 0);
  const totalDepDonors = (data?.donateurs || []).reduce((s, d) => s + d.depenses, 0);

  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-arina-accent via-arina-blue to-arina-dark py-16 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-80 h-80 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-72 h-72 bg-arina-gold rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 text-white text-sm font-semibold rounded-full mb-6 border border-white/20">
            <Scale className="w-4 h-4" /> Comptes ouverts
          </span>
          <h1 className="text-3xl lg:text-5xl xl:text-6xl font-serif font-bold text-white mb-6">
            Transparence
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            Chaque ariary compte. Nous publions nos comptes pour que chaque donateur sache précisément où va son soutien.
          </p>
        </div>
      </section>

      <section className="relative -mt-12 z-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          {/* Year selector */}
          <div className="bg-arina-cream rounded-2xl shadow-xl border border-arina-warm p-5 mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Wallet className="w-5 h-5 text-arina-blue" />
              <span className="font-bold text-arina-dark text-sm">Comptes de l'année</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {[new Date().getFullYear(), ...years].filter((y, i, arr) => arr.indexOf(y) === i).sort((a, b) => b - a).map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    y === year ? 'bg-arina-blue text-white shadow-lg shadow-arina-blue/25' : 'bg-white border border-gray-200 text-arina-dark hover:border-arina-blue/40'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {failed && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 text-center mb-6">
              Les données ne sont pas disponibles pour le moment — réessayez plus tard.
            </div>
          )}

          {/* KPI */}
          {data && (
            <>
              <div className="grid sm:grid-cols-3 gap-4 lg:gap-6 mb-8">
                {[
                  { label: 'Dons reçus', value: fmtAr(data.revenus), icon: TrendingUp, cls: 'from-emerald-500 to-teal-600' },
                  { label: 'Dépenses réalisées', value: fmtAr(data.depenses), icon: TrendingDown, cls: 'from-rose-500 to-red-600' },
                  { label: 'Solde', value: fmtAr(data.solde), icon: Wallet, cls: data.solde >= 0 ? 'from-arina-blue to-arina-accent' : 'from-amber-500 to-orange-600' },
                ].map((k, i) => (
                  <div key={i} className="bg-arina-cream rounded-2xl shadow-lg border border-arina-warm p-6 card-hover">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${k.cls} text-white mb-4 shadow-lg`}>
                      <k.icon className="w-6 h-6" />
                    </div>
                    <div className="text-xl lg:text-2xl font-extrabold text-arina-dark tabular">{k.value}</div>
                    <div className="text-sm text-arina-gray mt-1">{k.label}</div>
                  </div>
                ))}
              </div>

              {/* Répartition par donateur */}
              <div className="bg-arina-cream rounded-2xl shadow-lg border border-arina-warm overflow-hidden mb-8">
                <div className="px-6 py-5 border-b border-arina-warm flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-arina-blue" />
                  <h2 className="font-serif font-bold text-arina-dark">Répartition par partenaire financier — {year}</h2>
                </div>
                <div className="overflow-x-auto scroll-slim">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-arina-gray border-b border-arina-warm bg-white/50">
                        <th className="px-6 py-3 font-semibold">Partenaire</th>
                        <th className="px-6 py-3 font-semibold">Besoin financé</th>
                        <th className="px-6 py-3 font-semibold text-right">Dons reçus</th>
                        <th className="px-6 py-3 font-semibold text-right">Dépenses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-arina-warm/60">
                      {(data.donateurs || []).map((d) => (
                        <tr key={d.name} className="hover:bg-white/60 transition-colors">
                          <td className="px-6 py-4 font-semibold text-arina-dark">{d.name}</td>
                          <td className="px-6 py-4 text-arina-gray">{d.need || '—'}</td>
                          <td className="px-6 py-4 text-right font-bold text-emerald-600 tabular">{fmtAr(d.dons)}</td>
                          <td className="px-6 py-4 text-right font-semibold text-rose-600 tabular">{fmtAr(d.depenses)}</td>
                        </tr>
                      ))}
                      <tr className="bg-white/70 font-bold">
                        <td className="px-6 py-4 text-arina-dark" colSpan={2}>Total</td>
                        <td className="px-6 py-4 text-right text-emerald-700 tabular">{fmtAr(totalDonsDonors)}</td>
                        <td className="px-6 py-4 text-right text-rose-700 tabular">{fmtAr(totalDepDonors)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Série mensuelle */}
              <div className="bg-arina-cream rounded-2xl shadow-lg border border-arina-warm overflow-hidden mb-8">
                <div className="px-6 py-5 border-b border-arina-warm flex items-center gap-2.5">
                  <TrendingUp className="w-5 h-5 text-arina-blue" />
                  <h2 className="font-serif font-bold text-arina-dark">Évolution mensuelle — {year}</h2>
                </div>
                <div className="overflow-x-auto scroll-slim">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-arina-gray border-b border-arina-warm bg-white/50">
                        <th className="px-6 py-3 font-semibold">Mois</th>
                        <th className="px-6 py-3 font-semibold text-right">Dons reçus</th>
                        <th className="px-6 py-3 font-semibold text-right">Dépenses</th>
                        <th className="px-6 py-3 font-semibold text-right">Solde</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-arina-warm/60">
                      {(data.mensuel || []).map((m) => {
                        const solde = m.dons - m.depenses;
                        return (
                          <tr key={m.mois} className="hover:bg-white/60 transition-colors">
                            <td className="px-6 py-3.5 font-semibold text-arina-dark">{fmtMonth(m.mois)}</td>
                            <td className="px-6 py-3.5 text-right font-bold text-emerald-600 tabular">{fmtAr(m.dons)}</td>
                            <td className="px-6 py-3.5 text-right font-semibold text-rose-600 tabular">{fmtAr(m.depenses)}</td>
                            <td className={`px-6 py-3.5 text-right font-bold tabular ${solde >= 0 ? 'text-arina-blue' : 'text-amber-600'}`}>{fmtAr(solde)}</td>
                          </tr>
                        );
                      })}
                      {data.donsRecus?.count > 0 && (
                        <tr className="bg-white/70">
                          <td className="px-6 py-4 font-semibold text-arina-dark" colSpan={2}>
                            Dons de particuliers confirmés ({data.donsRecus.count})
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-emerald-700 tabular" colSpan={2}>{fmtAr(data.donsRecus.total)}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Note de confiance */}
              <div className="bg-gradient-to-br from-arina-blue to-arina-blue-dark rounded-2xl p-8 text-white flex flex-col sm:flex-row items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-xl font-serif font-bold mb-1.5">Nos comptes sont ouverts aux donateurs</h3>
                  <p className="text-white/80 text-sm leading-relaxed">
                    Chaque partenaire reçoit un rapport mensuel détaillé (dons, dépenses, soldes) et peut demander les justificatifs. Cette transparence totale est le socle de notre relation de confiance.
                  </p>
                </div>
                <Link
                  to="/soutenir"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-arina-blue font-bold rounded-xl hover:bg-arina-cream transition-colors shadow-lg shrink-0"
                >
                  <Heart className="w-4 h-4" fill="currentColor" /> Soutenir ARINA
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
