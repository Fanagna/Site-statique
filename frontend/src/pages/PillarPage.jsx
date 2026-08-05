import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Heart, Search } from 'lucide-react';
import AppIcon from '../components/icons';
import { pillars } from '../data/actions';
import ContentBlock from '../components/ContentBlock';
import usePageMeta from '../hooks/usePageMeta';

export default function PillarPage() {
  const { pillar } = useParams();
  const data = pillars.find((p) => p.slug === pillar);
  usePageMeta(data ? data.title : 'Nos actions', data?.shortDesc);

  if (!data) {
    return (
      <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/images/arina33.jpg')" }} />
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative z-10 text-center text-white px-6">
          <Search className="w-14 h-14 mx-auto text-white/80 mb-4" />
          <h1 className="text-3xl font-serif font-bold mb-2">Pilier introuvable</h1>
          <p className="text-white/85 mb-6">Ce pilier n'existe pas.</p>
          <Link to="/actions" className="inline-flex items-center gap-2 px-6 py-3 bg-arina-blue text-white rounded-xl font-semibold hover:bg-arina-blue-dark transition-colors shadow-lg">
            <ArrowLeft className="w-5 h-5" /> Retour aux actions
          </Link>
        </div>
      </div>
    );
  }

  const otherPillars = pillars.filter((p) => p.slug !== pillar);

  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Hero */}
      <section className={`relative bg-gradient-to-br ${data.gradient} py-16 lg:py-24 overflow-hidden`}>
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 25px 25px, white 2px, transparent 0)',
          backgroundSize: '50px 50px',
        }} />
        <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-white/80 text-sm mb-6">
            <Link to="/" className="hover:text-white transition-colors">Accueil</Link>
            <span>/</span>
            <Link to="/actions" className="hover:text-white transition-colors">Nos Actions</Link>
            <span>/</span>
            <span className="text-white font-medium">{data.title}</span>
          </nav>

          <div className="max-w-3xl">
            <AppIcon name={data.icon} className="w-12 h-12 mb-6 text-white" />
            <h1 className="text-3xl lg:text-5xl xl:text-6xl font-serif font-bold text-white mb-4">
              {data.title}
            </h1>
            <p className="text-xl text-white/90 font-serif italic mb-4">
              {data.subtitle}
            </p>
            <p className="text-lg text-white/80 leading-relaxed max-w-2xl">
              {data.description}
            </p>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="relative -mt-12 z-20">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-arina-cream rounded-2xl shadow-xl p-6 lg:p-8 grid grid-cols-2 md:grid-cols-4 gap-4 border border-arina-warm">
            {data.stats.map((stat, i) => (
              <div key={i} className="text-center p-3">
                <div className={`text-2xl lg:text-3xl font-extrabold ${data.textColor}`}>{stat.value}</div>
                <div className="text-xs text-arina-gray mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Content */}
      <article className="max-w-4xl mx-auto px-4 lg:px-8 py-12 lg:py-16">
        {data.content.map((block, i) => (
          <ContentBlock key={i} block={block} />
        ))}

        {/* Programs detail */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h3 className="text-2xl font-serif font-bold text-arina-dark mb-6 flex items-center gap-2"><ClipboardList className="w-6 h-6 text-arina-blue" /> Nos programmes</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {data.programs.map((prog, i) => (
              <div key={i} className={`${data.lightBg} border ${data.borderColor} rounded-2xl p-5`}>
                <h4 className={`font-bold text-arina-dark mb-1`}>{prog.title}</h4>
                <p className="text-sm text-arina-gray leading-relaxed">{prog.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Back + Next */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-gray-200">
          <Link
            to="/actions"
            className="inline-flex items-center gap-2 text-arina-blue font-semibold hover:text-arina-blue-light transition-colors group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Tous les piliers
          </Link>

          <Link
            to="/soutenir"
            className="inline-flex items-center gap-2 px-6 py-3 bg-arina-blue text-white font-semibold rounded-xl hover:bg-arina-blue-dark transition-colors shadow-lg"
          >
            <Heart className="w-5 h-5" fill="currentColor" /> Soutenir cette action
          </Link>
        </div>
      </article>

      {/* Other pillars */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <h2 className="text-3xl font-serif font-bold text-arina-dark text-center mb-10">
            Découvrez aussi
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {otherPillars.map((p) => (
              <Link
                key={p.slug}
                to={`/actions/${p.slug}`}
                className="group bg-arina-cream rounded-2xl shadow-md border border-arina-warm card-hover overflow-hidden"
              >
                <div className="relative h-40 overflow-hidden">
                  <img src={p.image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className={`absolute inset-0 bg-gradient-to-t ${p.gradient} opacity-10`} />
                  <div className="absolute bottom-4 left-4 text-white"><AppIcon name={p.icon} className="w-8 h-8" /></div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-arina-dark mb-1 group-hover:text-arina-blue transition-colors">{p.title}</h3>
                  <p className="text-sm text-arina-gray">{p.shortDesc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
