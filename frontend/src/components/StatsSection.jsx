import AppIcon from './icons';

const stats = [
  { value: '30', suffix: '+', label: 'Jeunes accompagnés', sub: '+5 ce mois', icon: 'user', color: 'from-arina-gold to-arina-accent' },
  { value: '85', suffix: '%', label: "Taux d'insertion", sub: 'en moyenne', icon: 'trending-up', color: 'from-arina-accent to-arina-blue' },
  { value: '1', suffix: '', label: 'Partenaire', sub: 'Grandir Dignement', icon: 'handshake', color: 'from-violet-400 to-purple-500' },
  { value: '2', suffix: '', label: "Années d'action", sub: 'depuis 2024', icon: 'star', color: 'from-arina-gold to-arina-gold-light' },
];

export default function StatsSection() {
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
                <span className="text-3xl lg:text-4xl font-extrabold tracking-tight text-arina-dark">{stat.value}</span>
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
