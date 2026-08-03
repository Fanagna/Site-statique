const stats = [
  { value: '30', suffix: '+', label: 'Jeunes accompagnés', sub: '+5 ce mois', icon: '👧', color: 'from-arina-gold to-arina-accent' },
  { value: '85', suffix: '%', label: "Taux d'insertion", sub: 'en moyenne', icon: '📈', color: 'from-green-500 to-emerald-600' },
  { value: '12', suffix: '', label: 'Partenaires', sub: 'actifs', icon: '🤝', color: 'from-purple-500 to-violet-600' },
  { value: '5', suffix: '+', label: "Années d'action", sub: "d'expérience", icon: '⭐', color: 'from-arina-gold to-arina-gold-light' },
];

export default function StatsSection() {
  return (
    <section className="relative -mt-16 z-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="animate-stat bg-arina-cream rounded-2xl p-6 lg:p-7 shadow-xl card-hover border border-arina-warm"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} text-white text-xl mb-4 shadow-lg`}>
                <span>{stat.icon}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl lg:text-4xl font-extrabold text-arina-dark">{stat.value}</span>
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
