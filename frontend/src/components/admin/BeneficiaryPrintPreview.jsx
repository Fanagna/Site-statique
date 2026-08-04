import { Printer, X } from 'lucide-react';

/* ── Aperçu A4 professionnel de la fiche bénéficiaire ──
   Rendu en mode clair, optimisé pour l'impression / export PDF.
   L'impression utilise le CSS dédié .print-preview (voir index.css). */
export default function BeneficiaryPrintPreview({ data, onClose }) {
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const Row = ({ l, v }) => (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{l}</span>
      <span className="text-[13px] font-medium text-slate-900 break-words">{v || '—'}</span>
    </div>
  );

  const Section = ({ title, children }) => (
    <section className="print-preview-block">
      <h4 className="print-preview-title">{title}</h4>
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">{children}</div>
    </section>
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/60 backdrop-blur-sm print-preview-wrap">
      {/* Barre d'outils (masquée à l'impression) */}
      <div className="no-print flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white/95 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/logo-arina.jpg" alt="" className="w-9 h-9 rounded-lg object-contain bg-arina-warm p-0.5" />
          <div className="min-w-0">
            <p className="font-bold text-slate-900 text-sm leading-tight truncate">Aperçu du dossier — {data.prenom} {data.nom}</p>
            <p className="text-xs text-slate-500">Document A4 · format prêt pour impression ou sauvegarde PDF</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-arina-blue text-white text-sm font-semibold hover:bg-arina-blue-dark shadow-lg shadow-arina-blue/20 transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" /> Imprimer / PDF
          </button>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 transition-all"
            aria-label="Fermer l'aperçu"
          >
            <X className="w-4 h-4" /> Fermer
          </button>
        </div>
      </div>

      {/* Zone de défilement (masquée à l'impression) */}
      <div className="no-print flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center print-preview-scroll">
        {/* Feuille A4 */}
        <div className="print-preview-sheet bg-white text-slate-900 shadow-2xl rounded-sm w-full max-w-[210mm] h-fit">
          {/* En-tête officiel */}
          <header className="print-preview-header">
            <div className="flex items-center justify-between gap-4 border-b-2 border-arina-blue pb-3">
              <div className="flex items-center gap-3">
                <img src="/logo-arina.jpg" alt="Logo ARINA" className="w-12 h-12 rounded-lg object-contain border border-slate-200 p-0.5" />
                <div>
                  <p className="text-lg font-extrabold tracking-wide text-arina-blue leading-none">ARINA</p>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 leading-tight">Association · Mahajanga · 2024</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-700">Dossier bénéficiaire</p>
                <p className="text-[11px] text-slate-500">N° {data.code || `AR-${String(data.id).padStart(3, '0')}`}</p>
              </div>
            </div>

            {/* Identité + photo */}
            <div className="flex items-center gap-4 mt-4">
              <div className="w-24 h-28 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                {data.photo ? (
                  <img src={data.photo} alt="Photo du bénéficiaire" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-extrabold text-slate-300">{`${(data.prenom || '?')[0]}${(data.nom || '?')[0]}`}</span>
                )}
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-slate-900 leading-tight">{data.prenom} {data.nom}</h3>
                <p className="text-sm text-slate-600 mt-1">
                  {data.age ? `${data.age} ans` : ''}
                  {data.genre ? ` · ${data.genre}` : ''}
                  {data.statut ? ` · ` : ''}
                  {data.statut && (
                    <span className="font-semibold text-arina-blue">{data.statut}</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                  {data.dateEntree && <span>Entrée : <b className="text-slate-700">{data.dateEntree}</b></span>}
                  {data.educateur && <span>Référent : <b className="text-slate-700">{data.educateur}</b></span>}
                  {data.region && <span>Région : <b className="text-slate-700">{data.region}</b></span>}
                </div>
              </div>
            </div>
          </header>

          {/* Corps du document */}
          <div className="print-preview-body">
            <Section title="Informations personnelles">
              <Row l="Nom complet" v={`${data.prenom} ${data.nom}`} />
              <Row l="Âge" v={data.age ? `${data.age} ans` : ''} />
              <Row l="Genre" v={data.genre} />
              <Row l="Téléphone" v={data.telephone} />
              <Row l="Région" v={data.region} />
              <Row l="Niveau scolaire" v={data.niveauScolaire} />
            </Section>

            <Section title="Situation familiale">
              <Row l="Situation" v={data.situationFamiliale} />
              <Row l="Parent / Tuteur" v={data.parent} />
              <Row l="Frères & sœurs" v={data.freresSoeurs} />
              <Row l="—" v="" />
            </Section>

            <Section title="Suivi ARINA">
              <Row l="Éducateur référent" v={data.educateur} />
              <Row l="Date d'entrée" v={data.dateEntree} />
              <Row l="Motif d'admission" v={data.motif} />
              <Row l="Statut" v={data.statut} />
              <Row l="Objectifs" v={data.objectifs} />
              <Row l="Formation" v={data.formation} />
            </Section>

            <Section title="Progression">
              <Row l="Taux d'assiduité" v={`${data.assiduite || 0}%`} />
              <Row l="Score de progression" v={`${data.progression || 0}%`} />
            </Section>

            {(data.dossier?.identite && Object.values(data.dossier.identite).some(Boolean)) && (
              <Section title="Dossier — Identité">
                {Object.entries(data.dossier.identite).map(([k, v]) => (
                  <Row key={k} l={k.charAt(0).toUpperCase() + k.slice(1)} v={v} />
                ))}
              </Section>
            )}

            {(data.suivis && data.suivis.length > 0) && (
              <section className="print-preview-block">
                <h4 className="print-preview-title">Historique du suivi</h4>
                <table className="w-full text-left text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-300 text-slate-500">
                      <th className="py-1.5 pr-3 font-semibold">Date</th>
                      <th className="py-1.5 pr-3 font-semibold">Type</th>
                      <th className="py-1.5 font-semibold">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.suivis.map((s, i) => (
                      <tr key={i} className="border-b border-slate-100 align-top">
                        <td className="py-1.5 pr-3 whitespace-nowrap text-slate-600">{s.date}</td>
                        <td className="py-1.5 pr-3 font-medium text-slate-800">{s.type}</td>
                        <td className="py-1.5 text-slate-700">{s.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}

            {data.dossier?.notes && (
              <section className="print-preview-block">
                <h4 className="print-preview-title">Notes</h4>
                <p className="text-[13px] text-slate-800 leading-relaxed whitespace-pre-wrap">{data.dossier.notes}</p>
              </section>
            )}
          </div>

          {/* Pied officiel */}
          <footer className="print-preview-footer">
            <div className="grid grid-cols-3 gap-4 items-end">
              <div className="text-[11px] text-slate-600">
                <p className="font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Fait à Mahajanga, le</p>
                <p className="font-bold text-slate-800">{date}</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-slate-800">Signature</p>
                <div className="w-40 mx-auto border-b-2 border-slate-400 mt-6 mb-1" />
                <p className="text-[10px] text-slate-500">Responsable ARINA</p>
              </div>
              <div className="flex justify-end">
                <div className="relative w-24 h-24 rounded-full border-2 border-arina-blue/70 text-arina-blue flex flex-col items-center justify-center text-center rotate-[-8deg] select-none">
                  <img src="/logo-arina.jpg" alt="" className="w-8 h-8 object-contain opacity-80" />
                  <div className="text-[10px] font-extrabold uppercase tracking-widest leading-tight">ARINA</div>
                  <div className="text-[7px] font-semibold uppercase tracking-wide">Association</div>
                  <div className="text-[7px] mt-0.5 font-medium">Mahajanga · 2024</div>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
