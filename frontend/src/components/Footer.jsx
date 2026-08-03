export default function Footer() {
  return (
    <footer id="footer" className="bg-arina-dark text-white">
      {/* Main footer */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
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
              Accompagner la réinsertion sociale et professionnelle des jeunes vulnérables à Madagascar depuis 2019.
            </p>
            <div className="flex gap-3">
              {['Facebook', 'Instagram', 'LinkedIn', 'YouTube'].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="w-10 h-10 bg-white/10 hover:bg-arina-gold rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-all text-xs font-medium"
                  aria-label={social}
                >
                  {social.substring(0, 2)}
                </a>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-bold mb-4">Contact</h4>
            <ul className="space-y-3 text-gray-400 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">📍</span>
                <span>123 Rue de l'Espoir,<br />Antananarivo, Madagascar</span>
              </li>
              <li className="flex items-center gap-2">
                <span>📞</span>
                <a href="tel:+261341234567" className="hover:text-arina-gold transition-colors">+261 34 12 345 67</a>
              </li>
              <li className="flex items-center gap-2">
                <span>📧</span>
                <a href="mailto:contact@arina-asso.mg" className="hover:text-arina-gold transition-colors">contact@arina-asso.mg</a>
              </li>
              <li className="flex items-start gap-2">
                <span>⏰</span>
                <span>Lun-Ven : 8h-17h</span>
              </li>
            </ul>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-white font-bold mb-4">Liens rapides</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              {['Nos actions', 'Actualités', 'Témoignages', 'Devenir bénévole', 'Faire un don'].map((link) => (
                <li key={link}>
                  <a href="#" className="hover:text-arina-gold transition-colors">{link}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="text-white font-bold mb-4">Newsletter</h4>
            <p className="text-gray-400 text-sm mb-4">
              Recevez nos actualités et histoires inspirantes.
            </p>
            <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Votre email"
                className="flex-1 px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-arina-gold transition-colors"
              />
              <button className="px-4 py-2.5 bg-arina-gold text-white rounded-lg text-sm font-semibold hover:bg-arina-gold-light transition-colors">
                OK
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">
            © 2024 ARINA. Tous droits réservés.
            <a href="/admin" className="ml-4 text-gray-600 hover:text-gray-400 transition-colors text-xs">🔒 Admin</a>
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-gray-500 text-sm">
            <a href="#" className="hover:text-white transition-colors">Mentions légales</a>
            <span className="hidden sm:inline">|</span>
            <a href="#" className="hover:text-white transition-colors">Politique de confidentialité</a>
            <span className="hidden sm:inline">|</span>
            <a href="#" className="hover:text-white transition-colors">Plan du site</a>
            <span className="hidden sm:inline">|</span>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
