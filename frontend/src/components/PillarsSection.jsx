const pillars = [
  {
    icon: '🏠',
    title: 'Hébergement\nsécurisé',
    description: 'Des foyers d\'accueil chaleureux et protecteurs où chaque jeune trouve un environnement stable pour se reconstruire.',
    color: 'from-emerald-500 to-teal-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    accentColor: 'text-emerald-600',
  },
  {
    icon: '🧠',
    title: 'Soutien\nPsychosocial',
    description: 'Reconstruction psychologique et morale à travers un accompagnement personnalisé par des professionnels.',
    color: 'from-blue-500 to-indigo-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    accentColor: 'text-blue-600',
  },
  {
    icon: '🔧',
    title: 'Formation\nProfessionnelle',
    description: 'Menuiserie, cuisine, agriculture... Des métiers concrets pour une insertion professionnelle durable.',
    color: 'from-orange-500 to-red-500',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    accentColor: 'text-orange-600',
  },
  {
    icon: '🤝',
    title: 'Insertion\nSociale',
    description: "Aide à l'emploi, au logement et à l'intégration dans la société pour une autonomie complète.",
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    accentColor: 'text-purple-600',
  },
];

export default function PillarsSection() {
  return (
    <section id="pillars" className="py-20 lg:py-28 bg-gradient-to-b from-white to-arina-cream">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-14 lg:mb-18">
          <span className="inline-block px-4 py-1.5 bg-arina-blue/10 text-arina-blue text-sm font-semibold rounded-full mb-4">
            Nos Missions
          </span>
          <h2 className="text-3xl lg:text-4xl xl:text-5xl font-serif font-bold text-arina-dark mb-4">
            Nos 4 Piliers d'Action
          </h2>
          <p className="text-arina-gray max-w-2xl mx-auto text-lg">
            Une approche globale pour accompagner chaque jeune vers l'autonomie et la réinsertion.
          </p>
        </div>

        {/* Pillars grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {pillars.map((pillar, i) => (
            <div
              key={i}
              className={`group relative ${pillar.bgColor} rounded-2xl p-8 border ${pillar.borderColor} card-hover cursor-pointer`}
            >
              {/* Icon */}
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br ${pillar.color} text-white text-2xl mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                <span>{pillar.icon}</span>
              </div>
              
              {/* Title */}
              <h3 className="text-xl font-bold text-arina-dark mb-3 whitespace-pre-line leading-tight">
                {pillar.title}
              </h3>
              
              {/* Description */}
              <p className="text-arina-gray leading-relaxed text-sm mb-6">
                {pillar.description}
              </p>
              
              {/* Link */}
              <span className={`inline-flex items-center gap-1 text-sm font-semibold ${pillar.accentColor} group-hover:gap-2 transition-all`}>
                En savoir plus
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </span>

              {/* Decorative corner */}
              <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl ${pillar.color} opacity-5 rounded-tr-2xl rounded-bl-full`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
