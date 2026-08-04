import { Link } from 'react-router-dom';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
      {/* Photo ARINA en fond */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/arina31.jpg')" }}
      />
      <div className="absolute inset-0 hero-gradient opacity-90" />

      {/* Contenu */}
      <div className="relative z-10 text-center text-white px-6 py-20 max-w-2xl">
        <p className="text-[8rem] lg:text-[11rem] font-serif font-bold leading-none mb-2 drop-shadow-2xl">
          404
        </p>
        <h1 className="text-2xl lg:text-3xl font-serif font-bold mb-3 drop-shadow">
          Oups, cette page s'est perdue
        </h1>
        <p className="text-white/85 mb-8 text-lg leading-relaxed">
          La page que vous cherchez n'existe pas ou a été déplacée.
          Pas d'inquiétude — comme nos jeunes, on trouve toujours un chemin.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-arina-gold text-white font-semibold rounded-xl hover:bg-arina-gold-light transition-colors shadow-xl"
          >
            <Home className="w-5 h-5" /> Retour à l'accueil
          </Link>
          <Link
            to="/actualites"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/15 text-white font-semibold rounded-xl border border-white/30 backdrop-blur-sm hover:bg-white/25 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" /> Voir les actualités
          </Link>
        </div>
      </div>
    </div>
  );
}
