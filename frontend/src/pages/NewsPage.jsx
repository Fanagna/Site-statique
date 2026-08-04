import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Eye, ImageIcon, Search, Tag, X } from 'lucide-react';
import useNews from '../hooks/useNews';
import UpdatedBadge from '../components/UpdatedBadge';
import EditNewsButton from '../components/EditNewsButton';
import { categories, months, categoryColors } from '../data/news';

const ITEMS_PER_PAGE = 6;
const sortOptions = [
  { value: 'recent', label: 'Plus récentes' },
  { value: 'oldest', label: 'Plus anciennes' },
  { value: 'popular', label: 'Plus populaires' },
];

export default function NewsPage() {
  const { news } = useNews();
  // Années disponibles dérivées des actualités réelles (jamais obsolètes)
  const availableYears = useMemo(() => {
    const set = new Set(news.map((n) => n.year).filter((y) => y));
    return [...set].sort((a, b) => b - a);
  }, [news]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [page, setPage] = useState(1);

  // Build active filters for display
  const activeFilters = useMemo(() => {
    const filters = [];
    if (selectedCategory) filters.push({ type: 'category', label: selectedCategory });
    if (selectedMonth) filters.push({ type: 'month', label: selectedMonth });
    if (selectedYear) filters.push({ type: 'year', label: String(selectedYear) });
    return filters;
  }, [selectedCategory, selectedMonth, selectedYear]);

  const removeFilter = (type) => {
    if (type === 'category') setSelectedCategory('');
    if (type === 'month') setSelectedMonth('');
    if (type === 'year') setSelectedYear('');
    setPage(1);
  };

  const clearAllFilters = () => {
    setSelectedCategory('');
    setSelectedMonth('');
    setSelectedYear('');
    setSearch('');
    setPage(1);
  };

  // Filtered & sorted news
  const filteredNews = useMemo(() => {
    let result = [...news];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.excerpt || '').toLowerCase().includes(q) ||
          (n.category || '').toLowerCase().includes(q)
      );
    }

    if (selectedCategory) {
      result = result.filter((n) => n.category === selectedCategory);
    }

    if (selectedMonth) {
      result = result.filter((n) => n.month === selectedMonth);
    }

    if (selectedYear) {
      // Comparaison en chaînes : la valeur du <select> est une chaîne, l'API renvoie un nombre
      result = result.filter((n) => String(n.year) === String(selectedYear));
    }

    // Sort
    switch (sortBy) {
      case 'oldest':
        result.sort((a, b) => new Date(a.date.split('/').reverse().join('-')) - new Date(b.date.split('/').reverse().join('-')));
        break;
      case 'popular':
        result.sort((a, b) => b.views - a.views);
        break;
      case 'recent':
      default:
        result.sort((a, b) => new Date(b.date.split('/').reverse().join('-')) - new Date(a.date.split('/').reverse().join('-')));
        break;
    }

    return result;
  }, [news, search, selectedCategory, selectedMonth, selectedYear, sortBy]);

  // Pagination (page bornée : si la liste rétrécit pendant le polling, on reste sur une page valide)
  const totalPages = Math.ceil(filteredNews.length / ITEMS_PER_PAGE);
  const currentPage = Math.min(page, Math.max(1, totalPages));
  const paginatedNews = filteredNews.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter) => (val) => {
    setter(val);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {/* Page title */}
        <div className="mb-8">
          <span className="inline-block px-4 py-1.5 bg-arina-blue/10 text-arina-blue text-sm font-semibold rounded-full mb-4">
            Restez informés
          </span>
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-serif font-bold text-arina-dark">
            Actualités
          </h1>
        </div>

        {/* Search & Filters Bar */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 lg:p-6 mb-6 shadow-sm">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search input */}
            <div className="relative lg:col-span-2">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher une actualité..."
                value={search}
                onChange={(e) => handleFilterChange(setSearch)(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue transition-all"
              />
            </div>

            {/* Category */}
            <select
              value={selectedCategory}
              onChange={(e) => handleFilterChange(setSelectedCategory)(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-arina-dark focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue transition-all cursor-pointer"
            >
              <option value="">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Month */}
            <select
              value={selectedMonth}
              onChange={(e) => handleFilterChange(setSelectedMonth)(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-arina-dark focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue transition-all cursor-pointer"
            >
              <option value="">Tous les mois</option>
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            {/* Year */}
            <div className="flex gap-2">
              <select
                value={selectedYear}
                onChange={(e) => handleFilterChange(setSelectedYear)(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-arina-dark focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue transition-all cursor-pointer"
              >
                <option value="">Année</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Second row: sort */}
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-arina-gray font-medium">Trier :</span>
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-arina-dark focus:outline-none focus:ring-2 focus:ring-arina-blue/20 cursor-pointer"
              >
                {sortOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <span className="text-xs text-arina-gray ml-auto">
              {filteredNews.length} résultat{filteredNews.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Active filters */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-gray-100">
              <span className="text-xs text-arina-gray font-medium flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Filtres actifs :</span>
              {activeFilters.map((f) => (
                <button
                  key={f.type}
                  onClick={() => removeFilter(f.type)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-arina-blue/10 text-arina-blue text-xs font-medium rounded-full hover:bg-arina-blue/20 transition-colors group"
                >
                  {f.label}
                  <span className="group-hover:text-red-500 transition-colors"><X className="w-3 h-3" /></span>
                </button>
              ))}
              <button
                onClick={clearAllFilters}
                className="text-xs text-arina-accent hover:text-arina-accent-dark font-medium transition-colors ml-1"
              >
                Effacer tout
              </button>
            </div>
          )}
        </div>

        {/* News Grid */}
        {paginatedNews.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedNews.map((item) => {
              const colors = categoryColors[item.category] || categoryColors['Événement'];
              return (
                <article key={item.id} className="group bg-arina-cream rounded-2xl overflow-hidden shadow-md border border-arina-warm card-hover flex flex-col">
                  {/* Image */}
                  <div className="relative overflow-hidden">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.title}
                        className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-56 bg-gradient-to-br from-arina-accent via-arina-blue to-arina-gold flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-white/30" />
                      </div>
                    )}
                    {/* Category badge */}
                    <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 ${colors.bg} ${colors.text} rounded-lg text-xs font-semibold`}>
                      <span className={`w-2 h-2 ${colors.dot} rounded-full`} />
                      {item.category}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex flex-col flex-1">
                    <div className="flex items-center gap-3 text-xs text-arina-gray mb-3 flex-wrap">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {item.date}</span>
                      <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {item.views} vues</span>
                      <UpdatedBadge updatedAt={item.updatedAt} createdDate={item.created_at} />
                    </div>
                    <h3 className="font-bold text-arina-dark mb-2 leading-snug group-hover:text-arina-blue transition-colors line-clamp-2">
                      {item.title}
                    </h3>
                    <p className="text-arina-gray text-sm leading-relaxed mb-4 line-clamp-2 flex-1">
                      {item.excerpt}
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                      <Link
                        to={`/actualites/${item.slug}`}
                        className="inline-flex items-center gap-1 text-arina-blue font-semibold text-sm group-hover:gap-2 transition-all"
                      >
                        Lire plus
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </Link>
                      <EditNewsButton id={item.id} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <Search className="w-12 h-12 mx-auto text-arina-gray mb-4" />
            <h3 className="text-xl font-bold text-arina-dark mb-2">Aucun résultat trouvé</h3>
            <p className="text-arina-gray mb-6">Essayez de modifier vos critères de recherche.</p>
            <button
              onClick={clearAllFilters}
              className="px-6 py-2.5 bg-arina-blue text-white rounded-xl font-semibold text-sm hover:bg-arina-blue-dark transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-12 flex flex-col items-center gap-4">
            {/* Page buttons */}
            <div className="flex items-center gap-1.5">
              {/* Previous */}
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-arina-dark hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg font-medium text-sm transition-all ${
                    p === currentPage
                      ? 'bg-arina-blue text-white shadow-md'
                      : 'border border-gray-200 text-arina-dark hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}

              {/* Next */}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-arina-dark hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
              >
                ›
              </button>
            </div>

            {/* Info */}
            <p className="text-sm text-arina-gray">
              {((currentPage - 1) * ITEMS_PER_PAGE) + 1} – {Math.min(currentPage * ITEMS_PER_PAGE, filteredNews.length)} sur {filteredNews.length} résultats
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
