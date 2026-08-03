import { useParams, Link, useLocation } from 'react-router-dom';
import { allNews, categoryColors } from '../data/news';
import ContentBlock from '../components/ContentBlock';

export default function ArticlePage() {
  const { slug } = useParams();
  const location = useLocation();
  const article = allNews.find((n) => n.slug === slug);

  if (!article) {
    return (
      <div className="min-h-screen pt-24 pb-16 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📄</div>
          <h1 className="text-2xl font-serif font-bold text-arina-dark mb-2">Article introuvable</h1>
          <p className="text-arina-gray mb-6">L'article que vous recherchez n'existe pas ou a été déplacé.</p>
          <Link
            to="/actualites"
            className="inline-flex items-center gap-2 px-6 py-3 bg-arina-blue text-white rounded-xl font-semibold hover:bg-arina-blue-dark transition-colors"
          >
            ← Retour aux actualités
          </Link>
        </div>
      </div>
    );
  }

  const colors = categoryColors[article.category] || categoryColors['Événement'];
  const relatedArticles = allNews
    .filter((n) => n.id !== article.id && n.category === article.category)
    .slice(0, 3);

  const currentUrl = window.location.origin + location.pathname;
  const shareUrl = encodeURIComponent(currentUrl);
  const shareTitle = encodeURIComponent(article.title);

  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Hero Image */}
      <div className="relative h-[50vh] min-h-[400px] overflow-hidden">
        <img
          src={article.image}
          alt={article.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
        
        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-12">
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-white/80 text-sm mb-3">
              <Link to="/" className="hover:text-white transition-colors">Accueil</Link>
              <span>/</span>
              <Link to="/actualites" className="hover:text-white transition-colors">Actualités</Link>
              <span>/</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 ${colors.bg} ${colors.text} rounded-full text-xs font-semibold`}>
                <span className={`w-2 h-2 ${colors.dot} rounded-full`} />
                {article.category}
              </span>
            </nav>
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-serif font-bold text-white leading-tight mb-4">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm">
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {article.date}
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                {article.views} vues
              </span>
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {article.readTime} de lecture
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Article body */}
      <article className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        {/* Metadata bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-8 border-b border-gray-200 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-arina-blue/10 rounded-full flex items-center justify-center text-arina-blue font-bold text-sm">
              {article.author.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-semibold text-arina-dark">{article.author}</div>
              <div className="text-xs text-arina-gray">Auteur</div>
            </div>
          </div>
          
          {/* Share buttons */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-arina-gray mr-1">Partager :</span>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              aria-label="Partager sur Facebook"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a
              href={`https://twitter.com/intent/tweet?url=${shareUrl}&text=${shareTitle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-black text-white hover:bg-gray-800 transition-colors"
              aria-label="Partager sur X"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-700 text-white hover:bg-blue-800 transition-colors"
              aria-label="Partager sur LinkedIn"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <button
              onClick={() => navigator.clipboard.writeText(currentUrl)}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-arina-dark hover:bg-gray-200 transition-colors text-sm"
              aria-label="Copier le lien"
              title="Copier le lien"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content blocks */}
        <div>
          {article.content.map((block, i) => (
            <ContentBlock key={i} block={block} />
          ))}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2 mt-12 pt-8 border-t border-gray-200">
          <span className="text-sm text-arina-gray mr-1">Tags :</span>
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full hover:bg-arina-blue/10 hover:text-arina-blue transition-colors cursor-pointer"
            >
              #{tag}
            </span>
          ))}
        </div>

        {/* CTA Banner */}
        <div className="mt-10 bg-gradient-to-r from-arina-accent to-arina-blue-dark rounded-2xl p-8 text-center text-white">
          <h3 className="text-xl font-serif font-bold mb-2">Vous avez aimé cet article ?</h3>
          <p className="text-white/80 mb-6">Soutenez nos actions pour continuer à changer des vies.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/soutenir"
              className="px-6 py-3 bg-arina-gold text-white font-semibold rounded-xl hover:bg-arina-gold-light transition-colors shadow-lg"
            >
              ❤️ Faire un don
            </Link>
            <Link
              to="/soutenir"
              className="px-6 py-3 bg-white/15 text-white font-semibold rounded-xl border border-white/30 hover:bg-white/25 transition-colors"
            >
              🤝 Devenir bénévole
            </Link>
          </div>
        </div>

        {/* Back link */}
        <div className="mt-8 text-center">
          <Link
            to="/actualites"
            className="inline-flex items-center gap-2 text-arina-blue font-semibold hover:text-arina-blue-light transition-colors group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Retour aux actualités
          </Link>
        </div>
      </article>

      {/* Related articles */}
      {relatedArticles.length > 0 && (
        <section className="bg-gray-50 py-16">
          <div className="max-w-7xl mx-auto px-4 lg:px-8">
            <div className="mb-8">
              <span className="inline-block px-4 py-1.5 bg-arina-blue/10 text-arina-blue text-sm font-semibold rounded-full mb-3">
                À lire aussi
              </span>
              <h2 className="text-3xl font-serif font-bold text-arina-dark">
                Articles similaires
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedArticles.map((item) => {
                const c = categoryColors[item.category] || categoryColors['Événement'];
                return (
                  <Link
                    key={item.id}
                    to={`/actualites/${item.slug}`}
                    className="group bg-arina-cream rounded-2xl overflow-hidden shadow-md border border-arina-warm card-hover"
                  >
                    <div className="relative overflow-hidden">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 ${c.bg} ${c.text} rounded-lg text-xs font-semibold`}>
                        <span className={`w-2 h-2 ${c.dot} rounded-full`} />
                        {item.category}
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex items-center gap-3 text-xs text-arina-gray mb-2">
                        <span>{item.date}</span>
                        <span>👁️ {item.views} vues</span>
                      </div>
                      <h3 className="font-bold text-arina-dark leading-snug group-hover:text-arina-blue transition-colors line-clamp-2 text-sm">
                        {item.title}
                      </h3>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
