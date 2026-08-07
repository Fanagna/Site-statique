import { Component, Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';

/* Pages chargées à la demande : seul le code nécessaire est téléchargé. L'accueil
   reste dans le bundle initial (premier écran = LCP rapide) ; toutes les autres
   pages publiques et l'ensemble de l'espace admin (dont la bibliothèque xlsx des
   exports Excel) n'arrivent qu'à la demande — le site public reste léger et rapide. */
const NewsPage = lazy(() => import('./pages/NewsPage'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));
const TestimonialsPage = lazy(() => import('./pages/TestimonialsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ActionsPage = lazy(() => import('./pages/ActionsPage'));
const PillarPage = lazy(() => import('./pages/PillarPage'));
const SoutenirPage = lazy(() => import('./pages/SoutenirPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const NewsManagementPage = lazy(() => import('./pages/admin/NewsManagementPage'));
const BeneficiaryDetailPage = lazy(() => import('./pages/admin/BeneficiaryDetailPage'));
const ScanPage = lazy(() => import('./pages/admin/ScanPage'));
const PresencesPage = lazy(() => import('./pages/admin/PresencesPage'));
const StaffPage = lazy(() => import('./pages/admin/StaffPage'));

/* Écran de chargement minimal pendant le téléchargement d'une page */
function PageLoader() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
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

/* Remonte automatiquement en haut de page à chaque changement de route.
   Sans cela, cliquer « Lire plus » dans une liste défilée ouvrait l'article
   au milieu de la page — d'où l'impression de devoir « actualiser ». */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
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
              {/* Présences & badges QR : éducateur, président et comptable (l'admin passe toujours) */}
              <Route
                path="/admin/presences"
                element={
                  <ProtectedRoute roles={['educator', 'president', 'accountant']}>
                    <PresencesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/scan"
                element={
                  <ProtectedRoute roles={['educator', 'president', 'accountant']}>
                    <ScanPage />
                  </ProtectedRoute>
                }
              />
              {/* Personnel (éducateurs, bénévoles, permanents) : fiches + badges + présences */}
              <Route
                path="/admin/personnel"
                element={
                  <ProtectedRoute roles={['educator', 'president', 'accountant']}>
                    <StaffPage />
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
                      <Route path="/confidentialite" element={<PrivacyPage />} />
                      <Route path="/mentions-legales" element={<PrivacyPage />} />
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
