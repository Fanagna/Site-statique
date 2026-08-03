const partners = [
  { name: 'UNICEF', logo: 'U' },
  { name: 'Ministère Justice', logo: 'MJ' },
  { name: 'Croix-Rouge', logo: 'CR' },
  { name: 'UE', logo: 'UE' },
  { name: 'Banque Mondiale', logo: 'BM' },
  { name: 'PNUD', logo: 'PN' },
  { name: 'UNESCO', logo: 'UN' },
  { name: 'OIM', logo: 'OI' },
];

export default function PartnersCarousel() {
  return (
    <section className="py-16 lg:py-20 bg-arina-warm">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 bg-white/80 text-arina-blue text-sm font-semibold rounded-full mb-4">
            Ils nous font confiance
          </span>
          <h2 className="text-3xl font-serif font-bold text-arina-dark">
            Nos Partenaires
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
                <span className="text-2xl font-bold text-arina-gray/50 group-hover:text-arina-blue transition-colors">
                  {partner.logo}
                </span>
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
