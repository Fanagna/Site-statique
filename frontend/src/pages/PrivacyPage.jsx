import { Link } from 'react-router-dom';
import { Lock, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react';
import usePageMeta from '../hooks/usePageMeta';

export default function PrivacyPage() {
  usePageMeta(
    'Confidentialité & mentions légales — ARINA',
    "Politique de confidentialité et mentions légales de l'association ARINA : données collectées, finalités, droits des personnes et contact.",
  );

  const sections = [
    {
      icon: ShieldCheck,
      title: 'Politique de confidentialité',
      intro: "L'association ARINA attache une importance particulière à la protection de vos données personnelles. Cette page explique ce que nous collectons, pourquoi, et les droits dont vous disposez.",
      blocks: [
        { h: 'Données collectées', p: "Selon les formulaires utilisés, nous collectons : votre nom, votre adresse email, votre numéro de téléphone (candidature bénévole), votre âge et votre ville (témoignages), le montant de votre don (formulaire de soutien) ainsi que les pièces jointes que vous nous transmettez (lettre de motivation, CV)." },
        { h: 'Finalités', p: "Ces données servent exclusivement à : vous répondre (messages de contact), traiter votre candidature bénévole, confirmer et suivre votre don, publier votre témoignage après validation par notre équipe, et établir nos rapports de transparence. Nous n'utilisons jamais vos données à des fins commerciales." },
        { h: 'Durée de conservation', p: "Les messages et candidatures sont conservés le temps nécessaire au traitement, puis supprimés. Les témoignages publiés le restent jusqu'à leur retrait sur demande. Les données comptables liées aux dons sont conservées conformément aux obligations légales." },
        { h: 'Vos droits', p: "Vous pouvez à tout moment demander l'accès, la rectification ou la suppression de vos données, ou retirer un témoignage publié, en nous écrivant à l'adresse ci-dessous. Aucune donnée n'est revendue ni transmise à des tiers, hors obligations légales." },
        { h: 'Sécurité', p: 'Les formulaires sont protégés contre le spam (champ anti-robots, limitation du nombre d’envois). Les mots de passe de l’espace d’administration sont hachés (scrypt) et les accès sont limités par rôle.' },
      ],
    },
    {
      icon: Lock,
      title: 'Mentions légales',
      intro: "Le site arina.mg est édité par l'association ARINA (Association pour la Réinsertion et l'Insertion des Nouveaux Adultes), organisation à but non lucratif basée à Madagascar.",
      blocks: [
        { h: 'Éditeur', p: "Association ARINA — Fokontany Tsaramandroso Ambony, Commune Urbaine de Mahajanga, Madagascar. Tél : 032 77 374 89 — Email : rasendrazita@gmail.com." },
        { h: 'Hébergement', p: 'Le site est hébergé par Vercel Inc. (San Francisco, USA) ; la base de données et le stockage de fichiers sont hébergés par leurs fournisseurs respectifs (PostgreSQL managé, stockage objet).' },
        { h: 'Propriété intellectuelle', p: "Les textes, photographies et éléments graphiques du site sont la propriété d'ARINA ou de ses partenaires. Toute reproduction sans autorisation est interdite." },
        { h: 'Responsabilité', p: "Les informations publiées (chiffres, actions, témoignages) le sont de bonne foi. ARINA ne saurait être tenue responsable d'une indisponibilité temporaire du site ou d'une utilisation contraire à sa vocation." },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white pt-20">
      <section className="relative bg-gradient-to-br from-arina-accent via-arina-blue to-arina-dark py-16 lg:py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-80 h-80 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-64 h-64 bg-arina-gold rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 lg:px-8 text-center">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 text-white text-sm font-semibold rounded-full mb-6 border border-white/20">
            <ShieldCheck className="w-4 h-4" /> Confidentialité & légal
          </span>
          <h1 className="text-3xl lg:text-5xl font-serif font-bold text-white mb-6">
            Confidentialité & mentions légales
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
            La protection de vos données est une question de confiance — et la confiance est au cœur de notre action.
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 lg:px-8 space-y-10">
          {sections.map((sec) => (
            <div key={sec.title} className="bg-arina-cream rounded-2xl shadow-xl border border-arina-warm overflow-hidden">
              <div className="px-6 lg:px-8 py-6 border-b border-arina-warm flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-arina-blue text-white flex items-center justify-center flex-shrink-0">
                  <sec.icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-serif font-bold text-arina-dark">{sec.title}</h2>
                  <p className="text-sm text-arina-gray mt-0.5">{sec.intro}</p>
                </div>
              </div>
              <div className="px-6 lg:px-8 py-6 space-y-6">
                {sec.blocks.map((b) => (
                  <div key={b.h}>
                    <h3 className="font-bold text-arina-dark mb-1.5">{b.h}</h3>
                    <p className="text-sm text-arina-gray leading-relaxed">{b.p}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Contact données */}
          <div className="bg-gradient-to-br from-arina-blue to-arina-blue-dark rounded-2xl p-8 text-white">
            <h3 className="text-xl font-serif font-bold mb-4">Une question sur vos données ?</h3>
            <ul className="space-y-2.5 text-white/85 text-sm">
              <li className="flex items-center gap-2.5"><Mail className="w-4 h-4 shrink-0" /> rasendrazita@gmail.com</li>
              <li className="flex items-center gap-2.5"><Phone className="w-4 h-4 shrink-0" /> 032 77 374 89</li>
              <li className="flex items-center gap-2.5"><MapPin className="w-4 h-4 shrink-0" /> Fokontany Tsaramandroso Ambony, Mahajanga, Madagascar</li>
            </ul>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-white text-arina-blue font-bold rounded-xl hover:bg-arina-cream transition-colors shadow-lg"
            >
              <Mail className="w-4 h-4" /> Nous écrire
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
