import { useState } from 'react';
import { Link } from 'react-router-dom';
import { testimonials } from '../data/testimonials';

const initialForm = { name: '', age: '', location: '', role: '', quote: '', story: '' };

export default function TestimonialsPage() {
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const featured = testimonials.filter((t) => t.featured);
  const others = testimonials.filter((t) => !t.featured);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Le nom est requis';
    if (!form.age || form.age < 10 || form.age > 99) errs.age = 'Âge invalide (10-99)';
    if (!form.quote.trim()) errs.quote = 'Le témoignage est requis';
    else if (form.quote.trim().length < 20) errs.quote = 'Minimum 20 caractères';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitted(true);
    setForm(initialForm);
  };

  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Hero Banner */}
      <section className="relative bg-gradient-to-br from-arina-accent via-arina-blue to-arina-dark py-20 lg:py-28 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-arina-gold rounded-full blur-3xl" />
        </div>
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'radial-gradient(circle at 25px 25px, white 2px, transparent 0)',
          backgroundSize: '50px 50px',
        }} />
        <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 bg-white/15 text-white text-sm font-semibold rounded-full mb-6 border border-white/20">
            💬 Paroles de jeunes
          </span>
          <h1 className="text-3xl lg:text-5xl xl:text-6xl font-serif font-bold text-white mb-6">
            Témoignages
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            Découvrez les histoires inspirantes de jeunes qui, grâce à ARINA, ont repris confiance en l'avenir.
          </p>
        </div>
      </section>

      {/* Stats strip */}
      <section className="relative -mt-12 z-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-arina-cream rounded-2xl shadow-xl p-6 lg:p-8 grid grid-cols-2 md:grid-cols-4 gap-4 border border-arina-warm">
            {[
              { value: '45+', label: 'Jeunes accompagnés' },
              { value: '6+', label: 'Témoignages reçus' },
              { value: '85%', label: "Taux d'insertion" },
              { value: '12', label: 'Partenaires' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl lg:text-3xl font-extrabold text-arina-blue">{stat.value}</div>
                <div className="text-xs text-arina-gray mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured testimonials */}
      <section className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 bg-arina-gold/20 text-arina-blue text-sm font-semibold rounded-full mb-4">
              ⭐ Témoignages à la une
            </span>
            <h2 className="text-3xl lg:text-4xl font-serif font-bold text-arina-dark">
              Ils ont repris confiance
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {featured.map((t) => {
              const expanded = expandedId === t.id;
              return (
                <article
                  key={t.id}
                  className={`group bg-arina-cream rounded-2xl shadow-lg border border-arina-warm overflow-hidden card-hover transition-all ${
                    expanded ? 'md:col-span-3' : ''
                  }`}
                >
                  <div className={`flex flex-col ${expanded ? 'lg:flex-row' : ''}`}>
                    {/* Image */}
                    <div className={`relative ${expanded ? 'lg:w-2/5' : ''}`}>
                      <img
                        src={t.image}
                        alt={t.name}
                        className={`w-full object-cover ${expanded ? 'h-80 lg:h-full' : 'h-56'}`}
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4 text-white">
                        <div className="font-bold text-lg">{t.name}</div>
                        <div className="text-sm text-white/80">{t.role}</div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className={`p-6 lg:p-8 ${expanded ? 'lg:w-3/5' : ''}`}>
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-arina-gold text-lg">&ldquo;</span>
                        <div className="h-px flex-1 bg-gray-200" />
                      </div>
                      <blockquote className="text-lg font-serif italic text-arina-dark leading-relaxed mb-4">
                        &laquo; {expanded ? t.fullStory : t.quote} &raquo;
                      </blockquote>
                      {!expanded && (
                        <button
                          onClick={() => setExpandedId(t.id)}
                          className="text-arina-blue text-sm font-semibold hover:text-arina-blue-light transition-colors"
                        >
                          Lire l'histoire complète →
                        </button>
                      )}
                      {expanded && (
                        <button
                          onClick={() => setExpandedId(null)}
                          className="text-arina-blue text-sm font-semibold hover:text-arina-blue-light transition-colors"
                        >
                          ← Réduire
                        </button>
                      )}
                      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                        <span className="text-xs text-arina-gray">📍 {t.location}</span>
                        <span className="text-xs text-arina-gray">📅 {t.date}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* All testimonials grid */}
      {others.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 lg:px-8">
            <div className="mb-10">
              <h2 className="text-3xl font-serif font-bold text-arina-dark">
                Plus de témoignages
              </h2>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {others.map((t) => {
                const expanded = expandedId === t.id;
                return (
                  <article
                    key={t.id}
                    className={`bg-arina-cream rounded-2xl shadow-md border border-arina-warm overflow-hidden card-hover transition-all ${
                      expanded ? 'md:col-span-2 lg:col-span-3' : ''
                    }`}
                  >
                    <div className={`flex flex-col ${expanded ? 'lg:flex-row' : ''}`}>
                      <div className={`relative ${expanded ? 'lg:w-1/3' : ''}`}>
                        <img
                          src={t.image}
                          alt={t.name}
                          className={`w-full object-cover ${expanded ? 'h-64 lg:h-full' : 'h-48'}`}
                          loading="lazy"
                        />
                      </div>
                      <div className={`p-6 ${expanded ? 'lg:w-2/3' : ''}`}>
                        <div className="flex items-center gap-4 mb-3">
                          <div>
                            <div className="font-bold text-arina-dark">{t.name}</div>
                            <div className="text-sm text-arina-gray">{t.role} · 📍 {t.location}</div>
                          </div>
                        </div>
                        <blockquote className="text-base font-serif italic text-arina-dark leading-relaxed mb-3">
                          &laquo; {expanded ? t.fullStory : t.quote} &raquo;
                        </blockquote>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          {t.tags.map((tag) => (
                            <span key={tag} className="px-2 py-0.5 bg-arina-blue/5 text-arina-blue text-xs rounded-full font-medium">
                              #{tag}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => setExpandedId(expanded ? null : t.id)}
                          className="text-arina-blue text-sm font-semibold hover:text-arina-blue-light transition-colors"
                        >
                          {expanded ? '← Réduire' : "Lire l'histoire complète →"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Submit testimonial form */}
      <section className="py-16 lg:py-24 bg-gradient-to-br from-arina-cream to-white">
        <div className="max-w-3xl mx-auto px-4 lg:px-8">
          <div className="text-center mb-10">
            <span className="inline-block px-4 py-1.5 bg-arina-blue/10 text-arina-blue text-sm font-semibold rounded-full mb-4">
              ✍️ Partagez votre histoire
            </span>
            <h2 className="text-3xl lg:text-4xl font-serif font-bold text-arina-dark mb-4">
              Votre témoignage compte
            </h2>
            <p className="text-arina-gray max-w-xl mx-auto">
              Vous avez été accompagné par ARINA ? Partagez votre parcours pour inspirer d'autres jeunes.
            </p>
          </div>

          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-xl font-bold text-green-700 mb-2">Merci pour votre témoignage !</h3>
              <p className="text-green-600 mb-6">Votre histoire sera publiée après validation par notre équipe.</p>
              <button
                onClick={() => setSubmitted(false)}
                className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors"
              >
                Envoyer un autre témoignage
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-arina-cream rounded-2xl shadow-xl border border-arina-warm p-6 lg:p-8 space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                    Nom complet <span className="text-arina-accent">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Jean Rakoto"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                      errors.name
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-200 focus:ring-arina-blue/20 focus:border-arina-blue'
                    }`}
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>

                {/* Age */}
                <div>
                  <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                    Âge <span className="text-arina-accent">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="Ex: 17"
                    min="10"
                    max="99"
                    value={form.age}
                    onChange={(e) => setForm({ ...form, age: e.target.value })}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                      errors.age
                        ? 'border-red-300 focus:ring-red-200'
                        : 'border-gray-200 focus:ring-arina-blue/20 focus:border-arina-blue'
                    }`}
                  />
                  {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age}</p>}
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-semibold text-arina-dark mb-1.5">Ville</label>
                  <input
                    type="text"
                    placeholder="Ex: Antananarivo"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue transition-all"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-semibold text-arina-dark mb-1.5">Activité / Métier</label>
                  <input
                    type="text"
                    placeholder="Ex: Apprenti menuisier"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue transition-all"
                  />
                </div>
              </div>

              {/* Quote (short) */}
              <div>
                <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                  Votre témoignage (résumé) <span className="text-arina-accent">*</span>
                </label>
                <textarea
                  rows={3}
                  maxLength={500}
                  placeholder="Résumez votre histoire en une ou deux phrases..."
                  value={form.quote}
                  onChange={(e) => setForm({ ...form, quote: e.target.value })}
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all resize-none ${
                    errors.quote
                      ? 'border-red-300 focus:ring-red-200'
                      : 'border-gray-200 focus:ring-arina-blue/20 focus:border-arina-blue'
                  }`}
                />
                <div className="flex justify-between items-center mt-1">
                  {errors.quote ? (
                    <p className="text-red-500 text-xs">{errors.quote}</p>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-arina-gray">{form.quote.length}/500</span>
                </div>
              </div>

              {/* Full story */}
              <div>
                <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                  Votre histoire complète
                </label>
                <textarea
                  rows={5}
                  placeholder="Racontez votre parcours en détail : d'où vous venez, comment ARINA vous a aidé, où vous en êtes aujourd'hui..."
                  value={form.story}
                  onChange={(e) => setForm({ ...form, story: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue transition-all resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3.5 bg-arina-blue text-white text-lg font-bold rounded-xl hover:bg-arina-blue-dark transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                ✉️ Envoyer mon témoignage
              </button>

              <p className="text-xs text-arina-gray text-center">
                En soumettant ce formulaire, vous acceptez que votre témoignage soit publié sur le site d'ARINA.
                Votre email ne sera pas affiché publiquement.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-16 bg-gradient-to-r from-arina-accent to-arina-blue-dark text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl lg:text-3xl font-serif font-bold mb-4">
            Inspiré par ces histoires ?
          </h2>
          <p className="text-white/80 mb-8">
            Chaque geste compte. Rejoignez-nous pour écrire le prochain chapitre de ces jeunes.
          </p>
          <Link
            to="/soutenir"
            className="inline-flex items-center gap-2 px-8 py-4 bg-arina-gold text-white text-lg font-bold rounded-xl hover:bg-arina-gold-light transition-colors shadow-xl"
          >
            ❤️ Soutenir ARINA
          </Link>
        </div>
      </section>
    </div>
  );
}
