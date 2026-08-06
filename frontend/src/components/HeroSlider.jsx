import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { heroImages } from '../data/siteImages';
import { buildImageSet } from '../utils/imageSrc';

const slides = [
  {
    title: "Donner une seconde chance\nà chaque enfant",
    subtitle: "Depuis 2024, nous accompagnons les jeunes vers un avenir meilleur grâce à l'éducation, la formation et l'insertion sociale.",
    bg: heroImages.slide1,
    ctas: [
      { label: "Découvrir nos actions", href: "#pillars", primary: false },
      { label: "Faire un don", href: "/soutenir", primary: true },
    ],
  },
  {
    title: "L'éducation,\nclé de la réussite",
    subtitle: "Nos programmes de formation professionnelle offrent aux jeunes les compétences pour construire leur avenir.",
    bg: heroImages.slide2,
    ctas: [
      { label: "Nos formations", href: "#pillars", primary: false },
      { label: "Devenir bénévole", href: "/soutenir", primary: true },
    ],
  },
  {
    title: "Ensemble,\nchangeons des vies",
    subtitle: "Rejoignez notre communauté de bénévoles et de donateurs pour offrir un avenir aux enfants vulnérables.",
    bg: heroImages.slide3,
    ctas: [
      { label: "Voir les actus", href: "#news", primary: false },
      { label: "Nous soutenir", href: "/soutenir", primary: true },
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
      {/* Background images — image-set multi-tailles (Vercel) : le navigateur
          charge la bonne résolution selon l'écran, comme sur les grands sites */}
      {slides.map((s, i) => (
        <div
          key={i}
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
          style={{
            backgroundImage: buildImageSet(s.bg, [768, 1280, 1920, 2560]),
            opacity: i === current ? 1 : 0,
            transform: `scale(${i === current ? 1 : 1.1})`,
            transition: 'opacity 1s ease, transform 6s ease',
          }}
        />
      ))}
      
      {/* Dégradé de lisibilité — plus profond en bas pour les CTA */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/55" />
      
      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(circle at 25px 25px, white 2px, transparent 0)',
        backgroundSize: '50px 50px',
      }} />

      {/* Content */}
      <div className="relative z-10 h-full flex items-center">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 bg-white/15 backdrop-blur-md rounded-full text-white/95 text-sm font-medium border border-white/25 shadow-lg">
              <Sparkles className="w-4 h-4 text-arina-gold" /> Association ARINA — Depuis 2024
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-serif font-bold text-white leading-tight mb-6 whitespace-pre-line [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]">
              {slide.title}
            </h1>
            <p className="text-lg md:text-xl text-white/90 mb-10 max-w-xl leading-relaxed [text-shadow:0_1px_12px_rgba(0,0,0,0.4)]">
              {slide.subtitle}
            </p>
            <div className="flex flex-wrap gap-4">
              {slide.ctas.map((cta, i) => (
                <Link
                  key={i}
                  to={cta.href}
                  className={`px-8 py-4 rounded-xl font-semibold text-base transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0 ${
                    cta.primary
                      ? 'btn-primary pulse-gold'
                      : 'bg-white/10 backdrop-blur-md text-white border-2 border-white/30 hover:bg-white/25 hover:border-white/50 shadow-lg'
                  }`}
                >
                  {cta.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Slider dots — pilule active animée */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-black/25 backdrop-blur-md rounded-full px-4 py-2.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`slider-dot rounded-full transition-all duration-300 ${
              i === current
                ? 'w-8 h-2.5 bg-arina-gold shadow-[0_0_12px_rgba(185,126,43,0.7)]'
                : 'w-2.5 h-2.5 bg-white/50 hover:bg-white/90 hover:scale-110'
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
