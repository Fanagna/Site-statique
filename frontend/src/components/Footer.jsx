import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, Lock } from 'lucide-react';

/* Icônes réseaux sociaux (SVG inline — marques non fournies par lucide-react) */
const socialIcons = {
  Facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  Instagram: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </>
  ),
  LinkedIn: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4V9h4v1.5A6 6 0 0 1 16 8z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
  YouTube: (
    <>
      <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
      <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
    </>
  ),
};

export default function Footer() {
  return (
    <footer id="footer" className="bg-arina-dark text-white">
      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {/* About */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/logo-arina.jpg"
                alt="ARINA Association"
                className="w-10 h-10 rounded-xl object-contain"
              />
              <div>
                <div className="text-lg font-bold text-white">ARINA</div>
                <div className="text-xs text-gray-400">Association</div>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
              Accompagner la réinsertion sociale et professionnelle des jeunes vulnérables à Madagascar depuis 2024.
            </p>
            <div className="flex gap-2.5">
              {[
                { name: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61578156467842' },
                { name: 'Instagram', href: 'https://instagram.com' },
                { name: 'LinkedIn', href: 'https://linkedin.com' },
                { name: 'YouTube', href: 'https://youtube.com' },
              ].map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="w-10 h-10 bg-white/10 hover:bg-arina-gold rounded-xl flex items-center justify-center text-white/70 hover:text-white transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  aria-label={s.name}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {socialIcons[s.name]}
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-bold mb-4">Contact</h4>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Fokontany Tsaramandroso Ambony,<br />Commune Urbaine de Mahajanga, Madagascar</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0" />
                <a href="tel:+261327737489" className="hover:text-arina-gold transition-colors">032 77 374 89</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0" />
                <a href="mailto:rasendrazita@gmail.com" className="hover:text-arina-gold transition-colors">rasendrazita@gmail.com</a>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                <span>Lun-Ven : 8h-17h</span>
              </li>
            </ul>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-white font-bold mb-4">Liens rapides</h4>
            <ul className="space-y-2.5 text-gray-400 text-sm">
              {[
                { label: 'Nos actions', to: '/actions' },
                { label: 'Actualités', to: '/actualites' },
                { label: 'Témoignages', to: '/temoignages' },
                { label: 'Devenir bénévole', to: '/soutenir' },
                { label: 'Faire un don', to: '/soutenir' },
              ].map((link) => (
                <li key={link.label}>
                  <Link to={link.to} className="hover:text-arina-gold transition-colors">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            © 2024 ARINA. Tous droits réservés.
            <a href="/admin" className="ml-4 text-gray-600 hover:text-gray-400 transition-colors text-xs"><Lock className="w-3 h-3 inline-block mr-0.5" />Admin</a>
          </p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-gray-500 text-sm">
            <Link to="/mentions-legales" className="hover:text-white transition-colors">Mentions légales</Link>
            <span className="hidden sm:inline">|</span>
            <Link to="/confidentialite" className="hover:text-white transition-colors">Politique de confidentialité</Link>
            <span className="hidden sm:inline">|</span>
            <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
