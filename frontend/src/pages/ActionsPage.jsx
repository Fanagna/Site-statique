import { Link } from 'react-router-dom';
import { pillars } from '../data/actions';

export default function ActionsPage() {
  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-arina-blue via-arina-blue-dark to-[#0D3B4F] py-16 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-80 h-80 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-arina-gold rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 bg-white/15 text-white text-sm font-semibold rounded-full mb-6 border border-white/20">
            🎯 Notre mission
          </span>
          <h1 className="text-3xl lg:text-5xl xl:text-6xl font-serif font-bold text-white mb-6">
            Nos Actions
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            Une approche globale en 4 piliers pour accompagner chaque jeune vers l'autonomie et la réinsertion durable.
          </p>
        </div>
      </section>

      {/* 4 Pillars overview */}
      <section className="py-16 lg:py-24 bg-gradient-to-b from-white to-arina-cream">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-arina-blue/10 text-arina-blue text-sm font-semibold rounded-full mb-4">
              Nos 4 Piliers
            </span>
            <h2 className="text-3xl lg:text-4xl font-serif font-bold text-arina-dark mb-4">
              Une prise en charge complète
            </h2>
            <p className="text-arina-gray max-w-2xl mx-auto">
              Chaque pilier répond à un besoin essentiel du parcours de réinsertion. 
              Découvrez en détail comment nous agissons au quotidien.
            </p>
          </div>

          <div className="space-y-6 lg:space-y-8">
            {pillars.map((pillar, i) => (
              <div
                key={pillar.slug}
                className={`group relative overflow-hidden rounded-3xl shadow-lg border ${pillar.borderColor} transition-all duration-300 hover:shadow-2xl`}
              >
                <div className={`flex flex-col ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}>
                  {/* Image side */}
                  <div className="lg:w-2/5 relative overflow-hidden">
                    <img
                      src={pillar.image}
                      alt={pillar.title}
                      className="w-full h-64 lg:h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="lazy"
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${pillar.gradient} opacity-40`} />
                    <div className="absolute bottom-6 left-6 text-white">
                      <span className="text-4xl">{pillar.icon}</span>
                    </div>
                  </div>

                  {/* Content side */}
                  <div className={`lg:w-3/5 p-8 lg:p-12 ${pillar.lightBg} flex flex-col justify-center`}>
                    <div className="flex items-center gap-3 mb-4">
                      <span className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${pillar.gradient} text-white text-xl shadow-lg`}>
                        {pillar.icon}
                      </span>
                      <div>
                        <h3 className={`text-2xl lg:text-3xl font-serif font-bold text-arina-dark`}>
                          {pillar.title}
                        </h3>
                        <p className={`text-sm ${pillar.textColor} font-medium`}>{pillar.subtitle}</p>
                      </div>
                    </div>

                    <p className="text-arina-gray leading-relaxed mb-6">
                      {pillar.description}
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                      {pillar.stats.map((stat, j) => (
                        <div key={j} className="bg-white/80 backdrop-blur-sm rounded-xl p-3 text-center shadow-sm">
                          <div className={`text-xl font-extrabold ${pillar.textColor}`}>{stat.value}</div>
                          <div className="text-xs text-arina-gray">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Programs */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {pillar.programs.map((prog, j) => (
                        <span key={j} className={`inline-block px-3 py-1.5 ${pillar.lightBg} border ${pillar.borderColor} rounded-lg text-xs font-semibold ${pillar.textColor}`}>
                          {prog.title}
                        </span>
                      ))}
                    </div>

                    <Link
                      to={`/actions/${pillar.slug}`}
                      className={`inline-flex items-center gap-2 self-start px-6 py-3 ${pillar.btnColor} text-white font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl group/link`}
                    >
                      Découvrir en détail
                      <svg className="w-5 h-5 group-hover/link:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Global impact */}
      <section className="py-16 bg-arina-dark text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl lg:text-3xl font-serif font-bold mb-6">
            Un impact mesurable
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '45', label: 'Jeunes accompagnés en 2024' },
              { value: '85%', label: "Taux d'insertion" },
              { value: '18', label: 'Diplômés cette année' },
              { value: '12', label: 'Partenaires actifs' },
            ].map((stat, i) => (
              <div key={i} className="p-4">
                <div className="text-3xl font-extrabold text-arina-gold">{stat.value}</div>
                <div className="text-sm text-gray-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
