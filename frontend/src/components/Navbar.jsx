import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { label: 'Accueil', href: '/' },
  { label: 'Nos Actions', href: '/actions' },
  { label: 'Actualités', href: '/actualites' },
  { label: 'Témoignages', href: '/temoignages' },
  { label: 'Contact', href: '/contact' },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState('FR');
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path.startsWith('/#')) return false; // hash links don't get active state
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <img
              src="/logo-arina.jpg"
              alt="ARINA Association"
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl object-contain shadow-lg group-hover:scale-105 transition-transform"
            />
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-arina-blue leading-tight">ARINA</div>
              <div className="text-[10px] text-arina-gray leading-tight">Association</div>
            </div>
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                to={link.href}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  isActive(link.href)
                    ? 'text-arina-blue bg-arina-blue/5'
                    : 'text-arina-dark/80 hover:text-arina-blue hover:bg-arina-blue/5'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2 lg:gap-3">
            {/* Search */}
            <button className="p-2.5 text-arina-gray hover:text-arina-blue hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Lang switcher */}
            <button
              onClick={() => setLang(lang === 'FR' ? 'EN' : 'FR')}
              className="text-xs font-semibold text-arina-blue bg-arina-blue/5 hover:bg-arina-blue/10 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              {lang}
            </button>

            {/* Donate button */}
            <Link
              to="/soutenir"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-arina-accent text-white text-sm font-semibold rounded-lg hover:bg-red-500 transition-all shadow-md hover:shadow-lg"
            >
              ❤️ Don
            </Link>

            {/* Volunteer button */}
            <Link
              to="/soutenir"
              className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 bg-arina-gold text-white text-sm font-semibold rounded-lg hover:bg-arina-gold-light transition-all shadow-md hover:shadow-lg"
            >
              🤝 Bénévole
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2.5 text-arina-dark hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Menu"
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
          menuOpen ? 'max-h-96 border-t border-gray-100' : 'max-h-0'
        }`}
      >
        <div className="px-4 py-4 space-y-1 bg-white">
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
            <Link to="/soutenir" className="flex-1 text-center px-4 py-2.5 bg-arina-accent text-white text-sm font-semibold rounded-lg">
              ❤️ Don
            </Link>
            <Link to="/soutenir" className="flex-1 text-center px-4 py-2.5 bg-arina-gold text-white text-sm font-semibold rounded-lg md:hidden">
              🤝 Bénévole
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
