import { Link } from 'react-router-dom';
import { Calendar, Eye, ImageIcon, Newspaper, Tag } from 'lucide-react';
import useNews from '../hooks/useNews';
import UpdatedBadge from './UpdatedBadge';
import EditNewsButton from './EditNewsButton';

export default function NewsSection() {
  const { news } = useNews();
  if (news.length === 0) return null;

  const featuredNews = news.filter((n) => n.featured).slice(0, 1);
  const featured = featuredNews.length > 0 ? featuredNews[0] : news[0];

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
          <Link to="/actualites" className="hidden sm:inline-flex items-center gap-2 text-arina-blue font-semibold text-sm hover:text-arina-blue-light transition-colors mt-4 sm:mt-0 group">
            Voir toutes les actualités
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        {/* Featured article */}
        <div className="mb-8 bg-gradient-to-r from-arina-accent to-arina-blue-dark rounded-2xl overflow-hidden shadow-xl">
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-1/2">
              {featured.image ? (
                <img
                  src={featured.image}
                  alt={featured.title}
                  className="w-full h-64 lg:h-full object-cover"
                />
              ) : (
                <div className="w-full h-64 lg:h-full bg-gradient-to-br from-arina-accent via-arina-blue to-arina-gold flex items-center justify-center">
                  <ImageIcon className="w-16 h-16 text-white/30" />
                </div>
              )}
            </div>
            <div className="lg:w-1/2 p-8 lg:p-10 flex flex-col justify-center">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 text-white text-xs font-semibold rounded-full mb-4 w-fit">
                <Newspaper className="w-3.5 h-3.5" /> À la une
              </span>
              <h3 className="text-2xl lg:text-3xl font-serif font-bold text-white mb-3">
                {featured.title}
              </h3>
              <p className="text-white/80 mb-6 leading-relaxed">
                {featured.excerpt}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-white/70 text-sm">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {featured.date}</span>
                <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {featured.views} vues</span>
                <span className="px-2 py-0.5 bg-white/15 rounded text-xs flex items-center gap-1"><Tag className="w-3 h-3" /> {featured.category}</span>
                <UpdatedBadge updatedAt={featured.updatedAt} createdDate={featured.created_at} />
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-6">
                <Link to={`/actualites/${featured.slug}`} className="inline-flex items-center gap-2 text-arina-gold font-semibold hover:text-arina-gold-light transition-colors group">
                  Lire la suite
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
                <EditNewsButton id={featured.id} />
              </div>
            </div>
          </div>
        </div>

        {/* News grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {news.filter(n => !n.featured).slice(0, 3).map((item, i) => (
            <article key={i} className="group bg-arina-cream rounded-2xl overflow-hidden shadow-md border border-arina-warm card-hover">
              <div className="relative overflow-hidden">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    className="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-52 bg-gradient-to-br from-arina-accent via-arina-blue to-arina-gold flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-white/30" />
                  </div>
                )}
                <div className="absolute top-3 right-3 px-2.5 py-1 bg-white/90 backdrop-blur-sm rounded-lg text-xs font-semibold text-arina-blue inline-flex items-center gap-1">
                  <Tag className="w-3 h-3" /> {item.category}
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 text-xs text-arina-gray mb-3 flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {item.date}</span>
                  <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {item.views} vues</span>
                  <UpdatedBadge updatedAt={item.updatedAt} createdDate={item.created_at} />
                </div>
                <h3 className="font-bold text-arina-dark mb-2 leading-snug group-hover:text-arina-blue transition-colors line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-arina-gray text-sm leading-relaxed mb-4 line-clamp-2">
                  {item.excerpt}
                </p>
                <div className="flex items-center justify-between">
                  <Link to={`/actualites/${item.slug}`} className="inline-flex items-center gap-1 text-arina-blue font-semibold text-sm group-hover:gap-2 transition-all">
                    Lire plus
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                  <EditNewsButton id={item.id} />
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* Mobile view all */}
        <div className="mt-8 text-center sm:hidden">
          <Link to="/actualites" className="inline-flex items-center gap-2 text-arina-blue font-semibold group">
            Voir toutes les actualités
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
