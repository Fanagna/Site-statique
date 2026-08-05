import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Handshake } from 'lucide-react';

const navLinks = [
  { label: 'Accueil', href: '/' },
  { label: 'Nos Actions', href: '/actions' },
  { label: 'Actualités', href: '/actualites' },
  { label: 'Témoignages', href: '/temoignages' },
  { label: 'Transparence', href: '/transparence' },
  { label: 'Contact', href: '/contact' },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState('FR');
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Effet « verre dépoli » dès que l'on quitte le haut de page
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path.startsWith('/#')) return false;
    return location.pathname.startsWith(path);
  };

  const linkClass = (path) =>
    `link-underline px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      isActive(path) ? 'text-arina-blue is-active' : 'text-arina-dark/80 hover:text-arina-blue'
    }`;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/85 backdrop-blur-xl shadow-[0_1px_0_rgba(0,0,0,0.06),0_8px_30px_-6px_rgba(74,30,43,0.12)]'
          : 'bg-white/75 backdrop-blur-md shadow-sm'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/logo-arina.jpg"
              alt="ARINA Association"
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl object-contain shadow-lg group-hover:scale-105 group-hover:shadow-xl transition-all duration-300"
            />
            <div className="hidden sm:block">
              <div className="text-sm font-extrabold tracking-tight text-arina-blue leading-tight">ARINA</div>
              <div className="text-[10px] text-arina-gray leading-tight uppercase tracking-[0.14em]">Association</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.label} to={link.href} className={linkClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Lang switcher */}
            <button
              onClick={() => setLang(lang === 'FR' ? 'EN' : 'FR')}
              className="text-xs font-semibold text-arina-blue bg-arina-blue/5 hover:bg-arina-blue/10 px-2.5 py-1.5 rounded-lg transition-colors"
              aria-label="Changer de langue"
            >
              {lang}
            </button>

            {/* Donate button */}
            <Link
              to="/soutenir"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 btn-primary text-white text-sm font-semibold rounded-lg"
            >
              <Heart className="w-4 h-4" fill="currentColor" /> Don
            </Link>

            {/* Volunteer button */}
            <Link
              to="/soutenir"
              className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 bg-white text-arina-dark text-sm font-semibold rounded-lg border border-gray-200 hover:border-arina-accent/50 hover:text-arina-blue transition-all shadow-sm hover:shadow-md"
            >
              <Handshake className="w-4 h-4 text-arina-gold" /> Bénévole
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2.5 text-arina-dark hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              {menuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ${
          menuOpen ? 'max-h-96 border-t border-gray-100 bg-white/95 backdrop-blur-xl' : 'max-h-0'
        }`}
      >
        <div className="px-4 py-4 space-y-1 bg-transparent">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              to={link.href}
              onClick={() => setMenuOpen(false)}
              className={`block px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                isActive(link.href)
                  ? 'text-arina-blue bg-arina-blue/5'
                  : 'text-arina-dark/80 hover:text-arina-blue hover:bg-arina-blue/5'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-3 px-4 sm:hidden">
            <Link to="/soutenir" onClick={() => setMenuOpen(false)} className="flex-1 text-center px-4 py-2.5 btn-primary text-white text-sm font-semibold rounded-lg">
              <Heart className="w-4 h-4 inline-block mr-1" fill="currentColor" /> Don
            </Link>
            <Link to="/soutenir" onClick={() => setMenuOpen(false)} className="flex-1 text-center px-4 py-2.5 bg-white border border-gray-200 text-arina-dark text-sm font-semibold rounded-lg">
              <Handshake className="w-4 h-4 inline-block mr-1 text-arina-gold" /> Bénévole
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
