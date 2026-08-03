import { Link } from 'react-router-dom';

export default function CTASection() {
  return (
    <section id="cta" className="py-20 lg:py-28 bg-gradient-to-br from-arina-blue via-arina-blue-dark to-arina-dark relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-arina-gold rounded-full blur-3xl" />
      </div>
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(circle at 25px 25px, white 2px, transparent 0)',
        backgroundSize: '50px 50px',
      }} />

      <div className="relative z-10 max-w-4xl mx-auto px-4 lg:px-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/10 text-4xl mb-8">
          💙
        </div>
        <h2 className="text-3xl lg:text-4xl xl:text-5xl font-serif font-bold text-white mb-6">
          Soutenez ARINA
        </h2>
        <p className="text-xl text-white/80 mb-10 leading-relaxed max-w-2xl mx-auto">
          &laquo; Chaque geste compte. Ensemble, offrons un avenir à ces jeunes. &raquo;
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/soutenir"
            className="w-full sm:w-auto px-8 py-4 bg-arina-gold text-white text-lg font-bold rounded-xl hover:bg-arina-gold-light transition-all shadow-xl hover:shadow-2xl pulse-gold flex items-center justify-center gap-2"
          >
            ❤️ Faire un don
          </Link>
          <Link
            to="/soutenir"
            className="w-full sm:w-auto px-8 py-4 bg-white/10 backdrop-blur-sm text-white text-lg font-semibold rounded-xl border-2 border-white/30 hover:bg-white/20 hover:border-white/50 transition-all flex items-center justify-center gap-2"
          >
            🤝 Devenir bénévole
          </Link>
          <Link
            to="/soutenir"
            className="w-full sm:w-auto px-8 py-4 bg-white/5 backdrop-blur-sm text-white text-lg font-semibold rounded-xl border-2 border-white/20 hover:bg-white/15 hover:border-white/40 transition-all flex items-center justify-center gap-2"
          >
            📧 Newsletter
          </Link>
        </div>
      </div>
    </section>
  );
}
