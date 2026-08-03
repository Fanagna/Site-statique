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
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import BeneficiaryDetailPage from './pages/admin/BeneficiaryDetailPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-white">
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
                  </Routes>
                  <Footer />
                </>
              }
            />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
