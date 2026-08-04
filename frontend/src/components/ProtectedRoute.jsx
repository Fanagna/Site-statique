import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Rôles autorisés à accéder à la route (optionnel). Par défaut : tout utilisateur connecté.
export default function ProtectedRoute({ children, roles = null }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin w-10 h-10 border-4 border-arina-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // Restriction par rôle : l'admin peut tout, sinon le rôle doit être listé.
  if (roles && user?.role !== 'admin' && !(roles || []).includes(user?.role)) {
    return <Navigate to="/admin" replace />;
  }

  return children;
}
