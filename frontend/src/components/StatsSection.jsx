import { useState, useEffect } from 'react';
import AppIcon from './icons';
import { fetchStats } from '../services/api';

/* Valeurs par défaut affichées tant que l'API ne répond pas (ou si la base est vide) */
const FALLBACK = {
  young_accompanied: 30,
  insertion_rate: 85,
  partners: 1,
  years_active: 2,
};

export default function StatsSection() {
  const [live, setLive] = useState(null);

  // Statistiques RÉELLES calculées depuis la base (bénéficiaires, donateurs…) —
  // plus de chiffres codés en dur qui se décalent de la réalité.
  // Dès que l'API répond, ses valeurs font foi (même à 0 sur une base neuve :
  // c'est la réalité — le fallback ne sert que si l'API est injoignable).
  useEffect(() => {
    let cancelled = false;
    fetchStats().then((s) => {
      if (cancelled || !s) return;
      if (typeof s.young_accompanied === 'number' && typeof s.insertion_rate === 'number') setLive(s);
    });
    return () => { cancelled = true; };
  }, []);

  const stats = [
    { value: (live?.young_accompanied ?? FALLBACK.young_accompanied).toString(), suffix: '+', label: 'Jeunes accompagnés', sub: 'à travers nos programmes', icon: 'user', color: 'from-arina-gold to-arina-accent' },
    { value: (live?.insertion_rate ?? FALLBACK.insertion_rate).toString(), suffix: '%', label: "Taux d'insertion", sub: 'vers l’emploi ou la formation', icon: 'trending-up', color: 'from-arina-accent to-arina-blue' },
    { value: (live?.partners ?? FALLBACK.partners).toString(), suffix: '', label: 'Partenaires', sub: 'qui financent nos actions', icon: 'handshake', color: 'from-violet-400 to-purple-500' },
    { value: (live?.years_active ?? FALLBACK.years_active).toString(), suffix: '', label: "Années d'action", sub: 'depuis 2024', icon: 'star', color: 'from-arina-gold to-arina-gold-light' },
  ];

  return (
    <section className="relative -mt-16 z-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="animate-stat bg-white/95 backdrop-blur rounded-2xl p-6 lg:p-7 shadow-soft-lg card-hover border border-arina-warm/70"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} text-white mb-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <AppIcon name={stat.icon} className="w-6 h-6" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl lg:text-4xl font-extrabold tracking-tight text-arina-dark tabular">{stat.value}</span>
                <span className="text-xl lg:text-2xl font-bold text-arina-blue">{stat.suffix}</span>
              </div>
              <div className="text-sm font-semibold text-arina-dark mt-1">{stat.label}</div>
              <div className="text-xs text-arina-gray mt-0.5">{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
