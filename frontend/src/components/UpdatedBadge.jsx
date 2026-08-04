import { RefreshCw } from 'lucide-react';

/* Badge « Mis à jour » — visible quand l'actualité a été modifiée par l'admin récemment.
   updatedAt : date ISO reçue de l'API (backend). */
export default function UpdatedBadge({ updatedAt, createdDate, className = '' }) {
  if (!updatedAt) return null;

  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return null;

  // Ne montrer le badge que si la modification est postérieure à la création (sinon c'est juste un article neuf)
  if (createdDate) {
    const created = new Date(createdDate);
    if (!Number.isNaN(created.getTime()) && updated.getTime() - created.getTime() < 60 * 1000) {
      return null;
    }
  }

  const hours = (Date.now() - updated.getTime()) / 3600000;
  const isFresh = hours <= 48; // modifié dans les 48 dernières heures
  if (!isFresh) return null;

  const label = hours < 1
    ? `Mis à jour il y a ${Math.max(1, Math.floor(hours * 60))} min`
    : hours < 24
      ? `Mis à jour il y a ${Math.floor(hours)} h`
      : 'Mis à jour hier';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 ${className}`}
      title={updated.toLocaleString('fr-FR')}
    >
      <RefreshCw className="w-3 h-3" />
      {label}
    </span>
  );
}
