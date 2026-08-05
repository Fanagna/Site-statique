import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

/* Bouton « Modifier » visible UNIQUEMENT pour l'admin connecté.
   Ouvre directement le formulaire d'édition de l'actualité dans /admin/actualites. */
export default function EditNewsButton({ id, compact = false, className = '' }) {
  const { isAuthenticated, user } = useAuth();
  // Seuls l'admin et le président gèrent les actualités
  if (!isAuthenticated || !id) return null;
  if (user?.role && user.role !== 'admin' && user.role !== 'president') return null;

  return (
    <Link
      to={`/admin/actualites?edit=${id}`}
      className={`inline-flex items-center gap-1.5 font-semibold transition-colors ${
        compact
          ? 'p-1.5 rounded-lg text-ios-text3 hover:text-arina-blue hover:bg-arina-blue/10'
          : 'px-3 py-1.5 rounded-lg text-xs bg-arina-blue/10 text-arina-blue hover:bg-arina-blue/20'
      } ${className}`}
      title="Modifier cette actualité (admin)"
    >
      <Pencil className={compact ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'} />
      {!compact && 'Modifier'}
    </Link>
  );
}
