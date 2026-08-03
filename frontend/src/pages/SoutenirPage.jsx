import { useState } from 'react';

const donorInit = { amount: '', name: '', email: '', message: '', anonymous: false };
const volunteerInit = { name: '', email: '', phone: '', skills: '', availability: '', motivation: '' };

export default function SoutenirPage() {
  const [tab, setTab] = useState('don');
  const [donor, setDonor] = useState(donorInit);
  const [volunteer, setVolunteer] = useState(volunteerInit);
  const [donorSubmitted, setDonorSubmitted] = useState(false);
  const [volSubmitted, setVolSubmitted] = useState(false);
  const [donorErrors, setDonorErrors] = useState({});
  const [volErrors, setVolErrors] = useState({});

  const validateDonor = () => {
    const e = {};
    if (!donor.amount || donor.amount < 1) e.amount = 'Montant minimum : 1€';
    if (!donor.name.trim()) e.name = 'Le nom est requis';
    if (!donor.email.trim()) e.email = "L'email est requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donor.email)) e.email = 'Email invalide';
    setDonorErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateVolunteer = () => {
    const e = {};
    if (!volunteer.name.trim()) e.name = 'Le nom est requis';
    if (!volunteer.email.trim()) e.email = "L'email est requis";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(volunteer.email)) e.email = 'Email invalide';
    if (!volunteer.motivation.trim()) e.motivation = 'Dites-nous pourquoi vous voulez aider';
    setVolErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleDonor = (e) => {
    e.preventDefault();
    if (!validateDonor()) return;
    setDonorSubmitted(true);
    setDonor(donorInit);
  };
  const handleVol = (e) => {
    e.preventDefault();
    if (!validateVolunteer()) return;
    setVolSubmitted(true);
    setVolunteer(volunteerInit);
  };

  const inputClass = (err) =>
    `w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
      err ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-arina-blue/20 focus:border-arina-blue'
    }`;

  return (
    <div className="min-h-screen bg-white pt-20">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-arina-accent via-arina-blue to-arina-dark py-16 lg:py-24 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-80 h-80 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-arina-gold rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 text-center">
          <span className="inline-block px-4 py-1.5 bg-white/15 text-white text-sm font-semibold rounded-full mb-6 border border-white/20">
            💙 Engagez-vous
          </span>
          <h1 className="text-3xl lg:text-5xl xl:text-6xl font-serif font-bold text-white mb-6">
            Soutenez ARINA
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            Chaque geste compte. Ensemble, offrons un avenir à ces jeunes.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <section className="relative -mt-10 z-20 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex bg-arina-cream rounded-2xl shadow-xl overflow-hidden border border-arina-warm mb-8">
            <button
              onClick={() => setTab('don')}
              className={`flex-1 py-4 lg:py-5 text-lg font-bold transition-all flex items-center justify-center gap-2 ${
                tab === 'don'
                  ? 'bg-arina-accent text-white shadow-lg'
                  : 'text-arina-dark hover:bg-gray-50'
              }`}
            >
              ❤️ Faire un don
            </button>
            <button
              onClick={() => setTab('benevole')}
              className={`flex-1 py-4 lg:py-5 text-lg font-bold transition-all flex items-center justify-center gap-2 ${
                tab === 'benevole'
                  ? 'bg-arina-gold text-white shadow-lg'
                  : 'text-arina-dark hover:bg-gray-50'
              }`}
            >
              🤝 Devenir bénévole
            </button>
          </div>

          {/* DONOR FORM */}
          {tab === 'don' && (
            <div className="bg-arina-cream rounded-2xl shadow-xl border border-arina-warm p-6 lg:p-8">
              {donorSubmitted ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🙏</div>
                  <h2 className="text-2xl font-serif font-bold text-arina-dark mb-2">Merci pour votre générosité !</h2>
                  <p className="text-arina-gray mb-6 max-w-md mx-auto">
                    Votre don va changer des vies. Vous recevrez un email de confirmation avec votre reçu fiscal.
                  </p>
                  <button onClick={() => setDonorSubmitted(false)} className="px-6 py-2.5 bg-arina-blue text-white rounded-xl font-semibold hover:bg-arina-blue-dark transition-colors">
                    Faire un autre don
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-serif font-bold text-arina-dark mb-2">❤️ Faire un don</h2>
                  <p className="text-arina-gray text-sm mb-6">Choisissez un montant ou saisissez le vôtre.</p>

                  {/* Quick amounts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                    {['10€', '25€', '50€', '100€'].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setDonor({ ...donor, amount: amt.replace('€', '') })}
                        className={`py-3 rounded-xl font-bold text-lg transition-all border-2 ${
                          donor.amount === amt.replace('€', '')
                            ? 'border-arina-accent bg-arina-accent/10 text-arina-accent'
                            : 'border-gray-200 text-arina-dark hover:border-arina-accent/50'
                        }`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleDonor} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                          Montant (€) <span className="text-arina-accent">*</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Montant personnalisé"
                          value={donor.amount}
                          onChange={(e) => setDonor({ ...donor, amount: e.target.value })}
                          className={inputClass(donorErrors.amount)}
                        />
                        {donorErrors.amount && <p className="text-red-500 text-xs mt-1">{donorErrors.amount}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                          Nom complet <span className="text-arina-accent">*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Votre nom"
                          value={donor.name}
                          onChange={(e) => setDonor({ ...donor, name: e.target.value })}
                          className={inputClass(donorErrors.name)}
                        />
                        {donorErrors.name && <p className="text-red-500 text-xs mt-1">{donorErrors.name}</p>}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                        Email <span className="text-arina-accent">*</span>
                      </label>
                      <input
                        type="email"
                        placeholder="votre@email.com"
                        value={donor.email}
                        onChange={(e) => setDonor({ ...donor, email: e.target.value })}
                        className={inputClass(donorErrors.email)}
                      />
                      {donorErrors.email && <p className="text-red-500 text-xs mt-1">{donorErrors.email}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-arina-dark mb-1.5">Message (optionnel)</label>
                      <textarea
                        rows={3}
                        maxLength={300}
                        placeholder="Un message d'encouragement ?"
                        value={donor.message}
                        onChange={(e) => setDonor({ ...donor, message: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue transition-all resize-none"
                      />
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={donor.anonymous}
                        onChange={(e) => setDonor({ ...donor, anonymous: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-arina-blue focus:ring-arina-blue"
                      />
                      <span className="text-sm text-arina-gray">Je souhaite rester anonyme</span>
                    </label>
                    <button
                      type="submit"
                      className="w-full py-4 bg-arina-accent text-white text-lg font-bold rounded-xl hover:bg-arina-accent-dark transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      ❤️ Valider mon don de {donor.amount || '...'}€
                    </button>
                    <p className="text-xs text-arina-gray text-center">
                      Paiement sécurisé. Reçu fiscal envoyé par email. Don déductible des impôts à 66%.
                    </p>
                  </form>
                </>
              )}
            </div>
          )}

          {/* VOLUNTEER FORM */}
          {tab === 'benevole' && (
            <div className="bg-arina-cream rounded-2xl shadow-xl border border-arina-warm p-6 lg:p-8">
              {volSubmitted ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎉</div>
                  <h2 className="text-2xl font-serif font-bold text-arina-dark mb-2">Merci pour votre engagement !</h2>
                  <p className="text-arina-gray mb-6 max-w-md mx-auto">
                    Notre équipe vous contactera dans les 48h pour discuter de votre mission bénévole.
                  </p>
                  <button onClick={() => setVolSubmitted(false)} className="px-6 py-2.5 bg-arina-blue text-white rounded-xl font-semibold hover:bg-arina-blue-dark transition-colors">
                    Envoyer une autre candidature
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-serif font-bold text-arina-dark mb-2">🤝 Devenir bénévole</h2>
                  <p className="text-arina-gray text-sm mb-6">Rejoignez notre communauté et faites la différence.</p>

                  <form onSubmit={handleVol} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                          Nom complet <span className="text-arina-accent">*</span>
                        </label>
                        <input type="text" placeholder="Votre nom" value={volunteer.name} onChange={(e) => setVolunteer({ ...volunteer, name: e.target.value })} className={inputClass(volErrors.name)} />
                        {volErrors.name && <p className="text-red-500 text-xs mt-1">{volErrors.name}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                          Email <span className="text-arina-accent">*</span>
                        </label>
                        <input type="email" placeholder="votre@email.com" value={volunteer.email} onChange={(e) => setVolunteer({ ...volunteer, email: e.target.value })} className={inputClass(volErrors.email)} />
                        {volErrors.email && <p className="text-red-500 text-xs mt-1">{volErrors.email}</p>}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-arina-dark mb-1.5">Téléphone</label>
                      <input type="tel" placeholder="+261 ..." value={volunteer.phone} onChange={(e) => setVolunteer({ ...volunteer, phone: e.target.value })} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue transition-all" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-arina-dark mb-1.5">Compétences / Domaines d'intérêt</label>
                      <select
                        value={volunteer.skills}
                        onChange={(e) => setVolunteer({ ...volunteer, skills: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue transition-all cursor-pointer"
                      >
                        <option value="">Sélectionnez...</option>
                        <option value="education">Éducation / Soutien scolaire</option>
                        <option value="menuiserie">Menuiserie / Artisanat</option>
                        <option value="cuisine">Cuisine</option>
                        <option value="informatique">Informatique</option>
                        <option value="psychologie">Psychologie / Écoute</option>
                        <option value="communication">Communication / Réseaux sociaux</option>
                        <option value="logistique">Logistique / Bricolage</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-arina-dark mb-1.5">Disponibilité</label>
                      <select
                        value={volunteer.availability}
                        onChange={(e) => setVolunteer({ ...volunteer, availability: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue transition-all cursor-pointer"
                      >
                        <option value="">Sélectionnez...</option>
                        <option value="semaine">En semaine</option>
                        <option value="weekend">Le week-end</option>
                        <option value="soir">En soirée</option>
                        <option value="ponctuel">Ponctuel</option>
                        <option value="regulier">Régulier (1x/semaine)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-arina-dark mb-1.5">
                        Pourquoi voulez-vous devenir bénévole ? <span className="text-arina-accent">*</span>
                      </label>
                      <textarea
                        rows={4}
                        maxLength={500}
                        placeholder="Parlez-nous de vos motivations..."
                        value={volunteer.motivation}
                        onChange={(e) => setVolunteer({ ...volunteer, motivation: e.target.value })}
                        className={`w-full px-4 py-3 bg-gray-50 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all resize-none ${
                          volErrors.motivation ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-arina-blue/20 focus:border-arina-blue'
                        }`}
                      />
                      {volErrors.motivation && <p className="text-red-500 text-xs mt-1">{volErrors.motivation}</p>}
                      <p className="text-xs text-arina-gray text-right mt-1">{volunteer.motivation.length}/500</p>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-4 bg-arina-gold text-white text-lg font-bold rounded-xl hover:bg-arina-gold-light transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      🤝 Envoyer ma candidature
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {/* Impact info */}
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {[
              { icon: '🏠', text: '10€ = un repas chaud pour 5 jeunes pendant une journée' },
              { icon: '📚', text: '25€ = un kit scolaire complet pour un jeune' },
              { icon: '🔧', text: '50€ = une journée de formation en atelier' },
            ].map((item, i) => (
              <div key={i} className="bg-arina-cream rounded-xl p-5 text-center border border-arina-warm">
                <div className="text-2xl mb-2">{item.icon}</div>
                <p className="text-sm text-arina-dark leading-relaxed font-medium">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
