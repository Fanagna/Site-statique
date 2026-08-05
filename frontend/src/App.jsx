import { Component, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import NewsPage from './pages/NewsPage';
import ArticlePage from './pages/ArticlePage';
import TestimonialsPage from './pages/TestimonialsPage';
import ContactPage from './pages/ContactPage';
import ActionsPage from './pages/ActionsPage';
import PillarPage from './pages/PillarPage';
import SoutenirPage from './pages/SoutenirPage';
import NotFoundPage from './pages/NotFoundPage';

/* Pages admin chargées à la demande : l'espace admin (et la bibliothèque xlsx
   des exports Excel) n'est téléchargé que lorsqu'on y accède — le site public
   reste ainsi rapide et léger. */
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const NewsManagementPage = lazy(() => import('./pages/admin/NewsManagementPage'));
const BeneficiaryDetailPage = lazy(() => import('./pages/admin/BeneficiaryDetailPage'));

/* Écran de chargement minimal pendant le téléchargement d'une page admin */
function PageLoader() {
  return (
    <div className="min-h-screen bg-ios-bg flex items-center justify-center">
      <div className="animate-spin w-9 h-9 border-3 border-arina-blue border-t-transparent rounded-full" />
    </div>
  );
}

/* Garde-fou : si un morceau de code (chunk) échoue à charger, on affiche un écran
   de secours avec bouton « Recharger » au lieu d'une page blanche. */
class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-ios-bg flex flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-lg font-bold text-ios-text">Une erreur est survenue lors du chargement.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 bg-arina-blue text-white rounded-xl font-semibold hover:bg-arina-blue-dark transition-colors"
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-white">
          <RouteErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* Admin routes (no Navbar/Footer) */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              {/* Actualités : réservées à l'admin et au président */}
              <Route
                path="/admin/actualites"
                element={
                  <ProtectedRoute roles={['president']}>
                    <NewsManagementPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/beneficiaire/:id"
                element={
                  <ProtectedRoute>
                    <BeneficiaryDetailPage />
                  </ProtectedRoute>
                }
              />

              {/* Public routes */}
              <Route
                path="*"
                element={
                  <>
                    <Navbar />
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/actualites" element={<NewsPage />} />
                      <Route path="/actualites/:slug" element={<ArticlePage />} />
                      <Route path="/temoignages" element={<TestimonialsPage />} />
                      <Route path="/contact" element={<ContactPage />} />
                      <Route path="/actions" element={<ActionsPage />} />
                      <Route path="/actions/:pillar" element={<PillarPage />} />
                      <Route path="/soutenir" element={<SoutenirPage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                    <Footer />
                  </>
                }
              />
              </Routes>
            </Suspense>
          </RouteErrorBoundary>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
