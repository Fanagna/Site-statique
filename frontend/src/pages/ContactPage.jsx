import { useState } from 'react';

const initialForm = { name: '', email: '', subject: '', message: '' };

const contactInfo = [
  {
    icon: '📍',
    title: 'Adresse',
    lines: [
      { text: "123 Rue de l'Espoir" },
      { text: 'Antanimena, Antananarivo' },
      { text: 'Madagascar' },
    ],
    color: 'from-blue-500 to-arina-blue',
  },
  {
    icon: '📞',
    title: 'Téléphone',
    lines: [
      { text: '+261 34 12 345 67', href: 'tel:+261341234567' },
      { text: '+261 33 98 765 43', href: 'tel:+261339876543' },
    ],
    color: 'from-green-500 to-emerald-600',
  },
  {
    icon: '📧',
    title: 'Email',
    lines: [
      { text: 'contact@arina-asso.mg', href: 'mailto:contact@arina-asso.mg' },
      { text: 'direction@arina-asso.mg', href: 'mailto:direction@arina-asso.mg' },
    ],
    color: 'from-orange-500 to-red-500',
  },
  {
    icon: '⏰',
    title: 'Horaires',
    lines: [
      { text: 'Lun - Ven : 8h00 - 17h00' },
      { text: 'Sam : 9h00 - 12h00' },
      { text: 'Dim : Fermé' },
    ],
    color: 'from-purple-500 to-violet-600',
  },
];

export default function ContactPage() {
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Le nom est requis';
    if (!form.email.trim()) errs.email = "L'email est requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Email invalide';
    if (!form.subject.trim()) errs.subject = 'Le sujet est requis';
    if (!form.message.trim()) errs.message = 'Le message est requis';
    else if (form.message.trim().length < 10) errs.message = 'Minimum 10 caractères';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitted(true);
    setForm(initialForm);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Send to backend (non-blocking)
    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-arina-blue via-arina-blue-dark to-arina-dark py-16 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-80 h-80 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-arina-gold rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 bg-white/15 text-white text-sm font-semibold rounded-full mb-6 border border-white/20">
            ✉️ Nous contacter
          </span>
          <h1 className="text-3xl lg:text-5xl xl:text-6xl font-serif font-bold text-white mb-6">
            Contactez-nous
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            Une question, une suggestion, ou l'envie de vous engager ? Nous sommes à votre écoute.
          </p>
        </div>
      </section>

      {/* Contact cards + Map */}
      <section className="relative -mt-12 z-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          {/* Info cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            {contactInfo.map((info, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-xl p-6 card-hover border border-gray-100 group"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${info.color} text-white text-xl mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                  <span>{info.icon}</span>
                </div>
                <h3 className="font-bold text-arina-dark mb-2">{info.title}</h3>
                {info.lines.map((line, j) => (
                  line.href ? (
                    <a
                      key={j}
                      href={line.href}
                      className="block text-sm text-arina-gray hover:text-arina-blue transition-colors leading-relaxed"
                    >
                      {line.text}
                    </a>
                  ) : (
                    <p key={j} className="text-sm text-arina-gray leading-relaxed">{line.text}</p>
                  )
                ))}
              </div>
            ))}
          </div>

          {/* Map */}
          <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-100 h-80 lg:h-96">
            <iframe
              src="https://www.openstreetmap.org/export/embed.html?bbox=47.5100,-18.9200,47.5400,-18.9000&layer=mapnik&marker=-18.9100,47.5250"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Carte ARINA - Antananarivo"
            />
          </div>
          <p className="text-center text-xs text-arina-gray mt-2">
            📍 123 Rue de l'Espoir, Antanimena, Antananarivo, Madagascar
          </p>
        </div>
      </section>

      {/* Form + Extra info side by side */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Form */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 lg:p-8">
                <h2 className="text-2xl font-serif font-bold text-arina-dark mb-2">
                  Envoyez-nous un message
                </h2>
                <p className="text-arina-gray text-sm mb-6">
                  Nous vous répondrons dans les 48 heures.
                </p>

                {submitted ? (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="text-xl font-bold text-green-700 mb-2">Message envoyé !</h3>
                    <p className="text-green-600 mb-6">Merci de nous avoir contacté. Notre équipe vous répondra rapidement.</p>
                    <button
                      onClick={() => setSubmitted(false)}
                      className="px-6 py-2.5 bg-arina-blue text-white rounded-xl font-semibold hover:bg-arina-blue-dark transition-colors"
                    >
                      Envoyer un autre message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                          Nom complet <span className="text-arina-accent">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Votre nom"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                            errors.name ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-arina-blue/20 focus:border-arina-blue'
                          }`}
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                          Email <span className="text-arina-accent">*</span>
                        </label>
                        <input
                          type="email"
                          placeholder="votre@email.com"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                            errors.email ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-arina-blue/20 focus:border-arina-blue'
                          }`}
                        />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                        Sujet <span className="text-arina-accent">*</span>
                      </label>
                      <select
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all cursor-pointer ${
                          errors.subject ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-arina-blue/20 focus:border-arina-blue'
                        }`}
                      >
                        <option value="">Choisissez un sujet...</option>
                        <option value="don">Faire un don</option>
                        <option value="benevolat">Devenir bénévole</option>
                        <option value="partenariat">Partenariat</option>
                        <option value="information">Demande d'information</option>
                        <option value="presse">Presse / Média</option>
                        <option value="autre">Autre</option>
                      </select>
                      {errors.subject && <p className="text-red-500 text-xs mt-1">{errors.subject}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                        Message <span className="text-arina-accent">*</span>
                      </label>
                      <textarea
                        rows={6}
                        maxLength={1000}
                        placeholder="Votre message..."
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all resize-none ${
                          errors.message ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-arina-blue/20 focus:border-arina-blue'
                        }`}
                      />
                      <div className="flex justify-between items-center mt-1">
                        {errors.message ? <p className="text-red-500 text-xs">{errors.message}</p> : <span />}
                        <span className="text-xs text-arina-gray">{form.message.length}/1000</span>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-3.5 bg-arina-blue text-white text-lg font-bold rounded-xl hover:bg-arina-blue-dark transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Envoyer le message
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Right sidebar */}
            <div className="lg:col-span-2 space-y-6">
              {/* Quick contact */}
              <div className="bg-gradient-to-br from-arina-blue to-arina-blue-dark rounded-2xl p-8 text-white">
                <h3 className="text-xl font-serif font-bold mb-4">Appelez-nous</h3>
                <p className="text-white/80 text-sm mb-4">
                  Disponible du lundi au vendredi, de 8h à 17h.
                </p>
                <a
                  href="tel:+261341234567"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-arina-gold text-white font-bold rounded-xl hover:bg-arina-gold-light transition-colors shadow-lg"
                >
                  📞 +261 34 12 345 67
                </a>
              </div>

              {/* FAQ */}
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <h3 className="font-bold text-arina-dark mb-4">❓ Questions fréquentes</h3>
                <div className="space-y-4">
                  {[
                    {
                      q: 'Comment faire un don ?',
                      a: "Vous pouvez faire un don en ligne via notre page d'accueil, par virement bancaire, ou en nous contactant directement.",
                    },
                    {
                      q: 'Comment devenir bénévole ?',
                      a: "Remplissez le formulaire sur notre page d'accueil ou contactez-nous. Nous vous proposerons une mission adaptée à vos compétences.",
                    },
                    {
                      q: 'Proposez-vous des visites ?',
                      a: "Oui, nous organisons des visites sur rendez-vous. Contactez-nous pour planifier une découverte de nos activités.",
                    },
                  ].map((faq, i) => (
                    <details key={i} className="group">
                      <summary className="cursor-pointer text-sm font-semibold text-arina-dark hover:text-arina-blue transition-colors list-none flex items-center justify-between">
                        {faq.q}
                        <svg className="w-4 h-4 group-open:rotate-180 transition-transform text-arina-gray" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <p className="text-sm text-arina-gray mt-2 leading-relaxed pl-4 border-l-2 border-arina-blue/20">
                        {faq.a}
                      </p>
                    </details>
                  ))}
                </div>
              </div>

              {/* Social */}
              <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
                <h3 className="font-bold text-arina-dark mb-4">📱 Suivez-nous</h3>
                <div className="flex gap-3">
                  {[
                    { name: 'Facebook', color: 'bg-blue-600', icon: 'f' },
                    { name: 'Instagram', color: 'bg-pink-500', icon: 'in' },
                    { name: 'LinkedIn', color: 'bg-blue-700', icon: 'li' },
                    { name: 'YouTube', color: 'bg-red-600', icon: '▶' },
                  ].map((social) => (
                    <a
                      key={social.name}
                      href="#"
                      className={`w-12 h-12 ${social.color} rounded-xl flex items-center justify-center text-white font-bold text-sm hover:opacity-90 transition-opacity`}
                      aria-label={social.name}
                    >
                      {social.icon}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
