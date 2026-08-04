const partners = [
  { name: 'Association ARINA', logo: '/logo-arina.jpg' },
  { name: 'Grandir Dignement', logo: '/images/logo-grandir-dignement.png' },
];

export default function PartnersCarousel() {
  return (
    <section className="py-16 lg:py-20 bg-arina-warm">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 bg-white/80 text-arina-blue text-sm font-semibold rounded-full mb-4">
            Nos partenaires
          </span>
          <h2 className="text-3xl font-serif font-bold text-arina-dark">
            Partenaires
          </h2>
        </div>

        {/* Partners grid with animation */}
        <div className="relative overflow-hidden">
          <div className="flex gap-6 animate-scroll">
            {[...partners, ...partners].map((partner, i) => (
              <div
                key={i}
                className="partner-logo group flex-shrink-0 w-40 h-24 bg-arina-cream rounded-xl flex items-center justify-center shadow-sm border border-arina-warm"
              >
                <img
                  src={partner.logo}
                  alt={partner.name}
                  loading="lazy"
                  className="max-w-[80%] max-h-16 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-scroll {
          animation: scroll 25s linear infinite;
          width: max-content;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
