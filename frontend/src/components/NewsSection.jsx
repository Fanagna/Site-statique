const news = [
  {
    title: 'Atelier menuiserie : nos jeunes fabriquent leurs premiers meubles',
    date: '02/12/2024',
    views: 150,
    category: 'Événement',
    image: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=600&q=80',
    excerpt: "Un atelier pratique qui permet aux jeunes d'acquérir des compétences techniques tout en développant leur créativité.",
  },
  {
    title: 'Visite du Ministre de la Justice au centre ARINA',
    date: '01/12/2024',
    views: 230,
    category: 'Événement',
    image: 'https://images.unsplash.com/photo-1577962917302-cd874c4e31d2?w=600&q=80',
    excerpt: "Une visite officielle qui souligne l'importance du travail accompli par l'association pour la réinsertion.",
  },
  {
    title: 'Jean, 17 ans : "ARINA m\'a redonné espoir"',
    date: '28/11/2024',
    views: 450,
    category: 'Témoignage',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&q=80',
    excerpt: "Découvrez le parcours inspirant de Jean qui, grâce à l'association, a trouvé sa voie professionnelle.",
  },
];

export default function NewsSection() {
  return (
    <section id="news" className="py-20 lg:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Section header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12">
          <div>
            <span className="inline-block px-4 py-1.5 bg-arina-blue/10 text-arina-blue text-sm font-semibold rounded-full mb-4">
              Actualités
            </span>
            <h2 className="text-3xl lg:text-4xl xl:text-5xl font-serif font-bold text-arina-dark">
              Dernières Actualités
            </h2>
          </div>
          <a href="#" className="hidden sm:inline-flex items-center gap-2 text-arina-blue font-semibold text-sm hover:text-arina-blue-light transition-colors mt-4 sm:mt-0 group">
            Voir toutes les actualités
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>

        {/* Featured article */}
        <div className="mb-8 bg-gradient-to-r from-arina-blue to-arina-blue-dark rounded-2xl overflow-hidden shadow-xl">
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-1/2">
              <img
                src={news[0].image}
                alt={news[0].title}
                className="w-full h-64 lg:h-full object-cover"
              />
            </div>
            <div className="lg:w-1/2 p-8 lg:p-10 flex flex-col justify-center">
              <span className="inline-block px-3 py-1 bg-white/20 text-white text-xs font-semibold rounded-full mb-4 w-fit">
                📰 À la une
              </span>
              <h3 className="text-2xl lg:text-3xl font-serif font-bold text-white mb-3">
                {news[0].title}
              </h3>
              <p className="text-white/80 mb-6 leading-relaxed">
                {news[0].excerpt}
              </p>
              <div className="flex items-center gap-4 text-white/70 text-sm">
                <span className="flex items-center gap-1">📅 {news[0].date}</span>
                <span className="flex items-center gap-1">👁️ {news[0].views} vues</span>
                <span className="px-2 py-0.5 bg-white/15 rounded text-xs">🏷️ {news[0].category}</span>
              </div>
              <a href="#" className="inline-flex items-center gap-2 text-arina-gold font-semibold mt-6 hover:text-arina-gold-light transition-colors group">
                Lire la suite
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* News grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {news.map((item, i) => (
            <article key={i} className="group bg-white rounded-2xl overflow-hidden shadow-md border border-gray-100 card-hover">
              <div className="relative overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-semibold text-arina-blue">
                  🏷️ {item.category}
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 text-xs text-arina-gray mb-3">
                  <span className="flex items-center gap-1">📅 {item.date}</span>
                  <span className="flex items-center gap-1">👁️ {item.views} vues</span>
                </div>
                <h3 className="font-bold text-arina-dark mb-2 leading-snug group-hover:text-arina-blue transition-colors line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-arina-gray text-sm leading-relaxed mb-4 line-clamp-2">
                  {item.excerpt}
                </p>
                <span className="inline-flex items-center gap-1 text-arina-blue font-semibold text-sm group-hover:gap-2 transition-all">
                  Lire plus
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </div>
            </article>
          ))}
        </div>

        {/* Mobile view all */}
        <div className="mt-8 text-center sm:hidden">
          <a href="#" className="inline-flex items-center gap-2 text-arina-blue font-semibold group">
            Voir toutes les actualités
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
