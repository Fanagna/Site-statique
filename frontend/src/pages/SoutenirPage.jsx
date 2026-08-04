import { useState } from 'react';
import {
  AlertCircle, Bitcoin, Check, Copy, Handshake, Heart, HeartHandshake, Landmark, Loader2, PartyPopper, Smartphone,
} from 'lucide-react';
import AppIcon from '../components/icons';
import FileDropzone from '../components/FileDropzone';
import { paymentMethods } from '../data/donations';
import { getVolunteerUploadUrl, submitVolunteer } from '../services/api';

const methodIcons = { smartphone: Smartphone, bitcoin: Bitcoin, landmark: Landmark };

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
  const [volunteerFile, setVolunteerFile] = useState(null);
  const [volunteerCv, setVolunteerCv] = useState(null);
  const [fileError, setFileError] = useState('');
  const [cvError, setCvError] = useState('');
  const [volSubmitting, setVolSubmitting] = useState(false);
  const [volError, setVolError] = useState('');
  const [method, setMethod] = useState('orange');
  const [copied, setCopied] = useState(null);

  const selectedMethod = paymentMethods.find((m) => m.id === method);

  const copyDetail = (value) => {
    if (navigator.clipboard) navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 2000);
  };

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
    if (!volunteerFile) e.file = 'Veuillez joindre votre lettre de motivation (PDF, DOC ou DOCX)';
    if (!volunteerCv) e.cv = 'Veuillez joindre votre CV (PDF, DOC ou DOCX)';
    setVolErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleFile = (setFile, setErr) => (f) => {
    if (!f) return;
    if (!/\.(pdf|doc|docx)$/i.test(f.name)) {
      setErr('Format non accepté — utilisez un PDF, DOC ou DOCX.');
      return;
    }
    if (f.size > 4 * 1024 * 1024) {
      setErr('Fichier trop volumineux (maximum 4 Mo).');
      return;
    }
    setErr('');
    const reader = new FileReader();
    reader.onload = () => {
      setFile({
        name: f.name,
        type: f.type || 'application/octet-stream',
        size: f.size,
        raw: f, // Fichier brut pour l'upload direct vers Vercel Blob
        data: String(reader.result).split(',')[1], // repli base64 si le stockage n'est pas configuré
      });
    };
    reader.readAsDataURL(f);
  };

  // Upload direct vers Vercel Blob (contourne la limite de 4,5 Mo des fonctions) ;
  // renvoie les infos avec l'URL publique, ou null pour un repli base64.
  const uploadAttach = async (f) => {
    if (!f?.raw) return null;
    const up = await getVolunteerUploadUrl(f.name, f.type, f.size);
    if (!up?.uploadUrl) return null;
    try {
      await fetch(up.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': f.type || 'application/octet-stream' },
        body: f.raw,
      });
      return { name: f.name, type: f.type, size: f.size, url: up.url };
    } catch {
      return null;
    }
  };
  const toFallback = (f) => (f ? { name: f.name, type: f.type, size: f.size, data: f.data } : null);

  const handleDonor = (e) => {
    e.preventDefault();
    if (!validateDonor()) return;
    setDonorSubmitted(true);
    setDonor(donorInit);
  };
  const handleVol = async (e) => {
    e.preventDefault();
    if (!validateVolunteer()) return;
    setVolError('');
    setVolSubmitting(true);
    try {
      const [fileUp, cvUp] = await Promise.all([uploadAttach(volunteerFile), uploadAttach(volunteerCv)]);
      const res = await submitVolunteer({
        ...volunteer,
        file: fileUp || toFallback(volunteerFile),
        cv: cvUp || toFallback(volunteerCv),
      });
      if (!res.ok) throw new Error(res.error);
      // Succès réel : l'admin a bien reçu la candidature
      setVolSubmitted(true);
      setVolunteer(volunteerInit);
      setVolunteerFile(null);
      setVolunteerCv(null);
      setFileError('');
      setCvError('');
    } catch (err) {
      // Échec : on garde les informations saisies pour permettre de réessayer
      setVolError(err.message || 'Une erreur est survenue, veuillez réessayer.');
    } finally {
      setVolSubmitting(false);
    }
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
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 text-white text-sm font-semibold rounded-full mb-6 border border-white/20">
            <Heart className="w-4 h-4" fill="currentColor" /> Engagez-vous
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
              <Heart className="w-5 h-5" fill="currentColor" /> Faire un don
            </button>
            <button
              onClick={() => setTab('benevole')}
              className={`flex-1 py-4 lg:py-5 text-lg font-bold transition-all flex items-center justify-center gap-2 ${
                tab === 'benevole'
                  ? 'bg-arina-gold text-white shadow-lg'
                  : 'text-arina-dark hover:bg-gray-50'
              }`}
            >
              <Handshake className="w-5 h-5" /> Devenir bénévole
            </button>
          </div>

          {/* DONOR FORM */}
          {tab === 'don' && (
            <div className="bg-arina-cream rounded-2xl shadow-xl border border-arina-warm p-6 lg:p-8">
              {donorSubmitted ? (
                <div className="text-center py-12">
                  <HeartHandshake className="w-14 h-14 mx-auto text-arina-accent mb-4" />
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
                  <h2 className="text-2xl font-serif font-bold text-arina-dark mb-2 flex items-center gap-2"><Heart className="w-6 h-6 text-arina-accent" fill="currentColor" /> Faire un don</h2>
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

                  {/* Payment method */}
                  <div className="mb-6">
                    <label className="block text-sm font-semibold text-arina-dark mb-2">Méthode de paiement</label>
                    <div className="grid sm:grid-cols-3 gap-3">
                      {paymentMethods.map((m) => {
                        const MethodIcon = methodIcons[m.icon];
                        const active = method === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setMethod(m.id)}
                            className={`text-left rounded-xl p-4 border-2 transition-all ${
                              active
                                ? 'border-arina-accent bg-arina-accent/10 shadow-md'
                                : 'border-gray-200 bg-white hover:border-arina-accent/50'
                            }`}
                          >
                            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-2 transition-colors ${
                              active ? 'bg-arina-accent text-white' : 'bg-arina-blue/10 text-arina-blue'
                            }`}>
                              <MethodIcon className="w-5 h-5" />
                            </div>
                            <div className={`font-bold text-sm ${active ? 'text-arina-accent' : 'text-arina-dark'}`}>{m.name}</div>
                            <div className="text-[11px] text-arina-gray mt-0.5">{m.badge}</div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Instructions of the selected method */}
                    <div className="mt-4 rounded-2xl border border-arina-warm bg-white overflow-hidden animate-fade-up">
                      <div className="px-5 py-4 bg-gradient-to-r from-arina-accent to-arina-blue-dark text-white flex items-start gap-3">
                        {(() => {
                          const Icon = methodIcons[selectedMethod.icon];
                          return <Icon className="w-5 h-5 shrink-0 mt-0.5" />;
                        })()}
                        <div>
                          <div className="font-bold text-sm">{selectedMethod.name}</div>
                          <div className="text-xs text-white/85 mt-0.5 leading-relaxed">{selectedMethod.description}</div>
                        </div>
                      </div>
                      <div className="p-5 space-y-4">
                        <ol className="space-y-2">
                          {selectedMethod.steps.map((s, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm text-arina-dark leading-relaxed">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-arina-blue/10 text-arina-blue text-[11px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ol>
                        <div className="space-y-2 pt-3 border-t border-gray-100">
                          {selectedMethod.details.map((d) => (
                            <div key={d.label} className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between bg-ios-fill rounded-xl px-4 py-3">
                              <div className="min-w-0">
                                <div className="text-[11px] uppercase tracking-wide text-arina-gray font-semibold">{d.label}</div>
                                {d.value ? (
                                  <div className="font-bold text-arina-dark text-sm break-all tabular">{d.value}</div>
                                ) : (
                                  <div className="text-sm text-arina-gray italic">
                                    Coordonnées à venir —{' '}
                                    <a href="mailto:rasendrazita@gmail.com" className="text-arina-blue font-semibold not-italic hover:text-arina-blue-light transition-colors">contactez-nous</a>
                                  </div>
                                )}
                              </div>
                              {d.value && (
                                <button
                                  type="button"
                                  onClick={() => copyDetail(d.value)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-arina-blue/10 text-arina-blue hover:bg-arina-blue/20 transition-colors shrink-0"
                                >
                                  {copied === d.value ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                  {copied === d.value ? 'Copié !' : 'Copier'}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
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
                      <Heart className="w-5 h-5" fill="currentColor" /> Valider mon don de {donor.amount || '...'}€
                    </button>
                    <p className="text-xs text-arina-gray text-center">
                      Don via {selectedMethod.name} · Reçu fiscal envoyé par email · Don déductible des impôts à 66%.
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
                  <PartyPopper className="w-14 h-14 mx-auto text-arina-gold mb-4" />
                  <h2 className="text-2xl font-serif font-bold text-arina-dark mb-2">Merci pour votre engagement !</h2>
                  <p className="text-arina-gray mb-6 max-w-md mx-auto">
                    Notre équipe vous contactera dans les 48h pour discuter de votre mission bénévole. Votre lettre de motivation et votre CV ont bien été transmis à l'équipe ARINA.
                  </p>
                  <button onClick={() => setVolSubmitted(false)} className="px-6 py-2.5 bg-arina-blue text-white rounded-xl font-semibold hover:bg-arina-blue-dark transition-colors">
                    Envoyer une autre candidature
                  </button>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-serif font-bold text-arina-dark mb-2 flex items-center gap-2"><Handshake className="w-6 h-6 text-arina-blue" /> Devenir bénévole</h2>
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
                        Votre motivation en quelques mots <span className="text-arina-gray font-normal">(optionnel)</span>
                      </label>
                      <textarea
                        rows={3}
                        maxLength={500}
                        placeholder="Résumez vos motivations — elles seront détaillées dans votre lettre ci-jointe..."
                        value={volunteer.motivation}
                        onChange={(e) => setVolunteer({ ...volunteer, motivation: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-arina-blue/20 focus:border-arina-blue transition-all resize-none"
                      />
                      <p className="text-xs text-arina-gray text-right mt-1">{volunteer.motivation.length}/500</p>
                    </div>

                    {/* Pièces jointes : lettre de motivation + CV */}
                    <div className="grid sm:grid-cols-2 gap-5">
                      <FileDropzone
                        label="Lettre de motivation"
                        required
                        hint="Cliquez pour joindre votre lettre"
                        file={volunteerFile}
                        error={fileError || volErrors.file}
                        onFile={handleFile(setVolunteerFile, setFileError)}
                        onRemove={() => { setVolunteerFile(null); setFileError(''); }}
                      />
                      <FileDropzone
                        label="CV"
                        required
                        hint="Cliquez pour joindre votre CV"
                        file={volunteerCv}
                        error={cvError || volErrors.cv}
                        onFile={handleFile(setVolunteerCv, setCvError)}
                        onRemove={() => { setVolunteerCv(null); setCvError(''); }}
                      />
                    </div>

                    {volError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{volError} — vos informations ont été conservées, vous pouvez réessayer.</span>
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={volSubmitting}
                      className="w-full py-4 bg-arina-gold text-white text-lg font-bold rounded-xl hover:bg-arina-gold-light transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-arina-gold"
                    >
                      {volSubmitting ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> Envoi en cours…</>
                      ) : (
                        <><Handshake className="w-5 h-5" /> Envoyer ma candidature</>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {/* Impact info */}
          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {[
              { icon: 'home', text: '10€ = un repas chaud pour 5 jeunes pendant une journée' },
              { icon: 'book', text: '25€ = un kit scolaire complet pour un jeune' },
              { icon: 'wrench', text: '50€ = une journée de formation en atelier' },
            ].map((item, i) => (
              <div key={i} className="bg-arina-cream rounded-xl p-5 text-center border border-arina-warm">
                <div className="flex justify-center mb-2"><AppIcon name={item.icon} className="w-7 h-7 text-arina-blue" /></div>
                <p className="text-sm text-arina-dark leading-relaxed font-medium">{item.text}</p>
              </div>
            ))}
          </div>

          {/* Galerie — nos actions en images */}
          <div className="mt-10">
            <div className="text-center mb-6">
              <span className="inline-block px-4 py-1.5 bg-arina-blue/10 text-arina-blue text-sm font-semibold rounded-full mb-3">
                En images
              </span>
              <h2 className="text-2xl lg:text-3xl font-serif font-bold text-arina-dark">
                Le terrain, chaque jour
              </h2>
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { src: '/images/arina34.jpg', caption: 'La vie au foyer de Tsaramandroso' },
                { src: '/images/arina35.jpg', caption: 'Nos ateliers de formation' },
                { src: '/images/arina36.jpg', caption: 'Les jeunes, au cœur de notre action' },
              ].map((img, i) => (
                <figure
                  key={i}
                  className="group relative rounded-2xl overflow-hidden shadow-md border border-arina-warm card-hover cursor-pointer"
                >
                  <img
                    src={img.src}
                    alt={img.caption}
                    className="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 px-4 py-3 bg-gradient-to-t from-black/50 to-transparent text-white text-sm font-semibold">
                    {img.caption}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
