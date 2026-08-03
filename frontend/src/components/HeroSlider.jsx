import { useState, useEffect } from 'react';

const slides = [
  {
    title: "Donner une seconde chance\nà chaque enfant",
    subtitle: "Depuis 2019, nous accompagnons les jeunes vers un avenir meilleur grâce à l'éducation, la formation et l'insertion sociale.",
    bg: "https://images.unsplash.com/photo-1529390079861-591de354faf5?w=1600&q=80",
    ctas: [
      { label: "Découvrir nos actions", href: "#pillars", primary: false },
      { label: "Faire un don", href: "#cta", primary: true },
    ],
  },
  {
    title: "L'éducation,\nclé de la réussite",
    subtitle: "Nos programmes de formation professionnelle offrent aux jeunes les compétences pour construire leur avenir.",
    bg: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1600&q=80",
    ctas: [
      { label: "Nos formations", href: "#pillars", primary: false },
      { label: "Devenir bénévole", href: "#cta", primary: true },
    ],
  },
  {
    title: "Ensemble,\nchangeons des vies",
    subtitle: "Rejoignez notre communauté de bénévoles et de donateurs pour offrir un avenir aux enfants vulnérables.",
    bg: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1600&q=80",
    ctas: [
      { label: "Voir les actus", href: "#news", primary: false },
      { label: "Nous soutenir", href: "#cta", primary: true },
    ],
  },
];

export default function HeroSlider() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const slide = slides[current];

  return (
    <section className="relative h-[85vh] min-h-[600px] overflow-hidden">
      {/* Background images */}
      {slides.map((s, i) => (
        <div
          key={i}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
          style={{
            backgroundImage: `url(${s.bg})`,
            opacity: i === current ? 1 : 0,
            transform: `scale(${i === current ? 1 : 1.1})`,
            transition: 'opacity 1s ease, transform 6s ease',
          }}
        />
      ))}
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 hero-gradient" />
      
      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(circle at 25px 25px, white 2px, transparent 0)',
        backgroundSize: '50px 50px',
      }} />

      {/* Content */}
      <div className="relative z-10 h-full flex items-center">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full">
          <div className="max-w-3xl">
            <div className="inline-block mb-6 px-4 py-2 bg-white/15 backdrop-blur-sm rounded-full text-white/90 text-sm font-medium border border-white/20">
              ✨ Association ARINA — Depuis 2019
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-serif font-bold text-white leading-tight mb-6 whitespace-pre-line">
              {slide.title}
            </h1>
            <p className="text-lg md:text-xl text-white/85 mb-10 max-w-xl leading-relaxed">
              {slide.subtitle}
            </p>
            <div className="flex flex-wrap gap-4">
              {slide.ctas.map((cta, i) => (
                <a
                  key={i}
                  href={cta.href}
                  className={`px-8 py-4 rounded-lg font-semibold text-base transition-all duration-300 transform hover:-translate-y-0.5 ${
                    cta.primary
                      ? 'bg-arina-gold text-white shadow-xl hover:bg-arina-gold-light hover:shadow-2xl pulse-gold'
                      : 'bg-white/10 backdrop-blur-sm text-white border-2 border-white/30 hover:bg-white/25 hover:border-white/50'
                  }`}
                >
                  {cta.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Slider dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-3">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`slider-dot rounded-full ${
              i === current
                ? 'w-8 h-3 bg-arina-gold'
                : 'w-3 h-3 bg-white/50 hover:bg-white/80'
            }`}
            aria-label={`Slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 60C240 120 480 0 720 60C960 120 1200 0 1440 60V120H0V60Z" fill="white" />
        </svg>
      </div>
    </section>
  );
}
