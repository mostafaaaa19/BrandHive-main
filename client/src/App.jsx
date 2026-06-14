import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { CartProvider, WishlistProvider } from './context/CartContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

import Navbar from './components/Navbar';
import Footer from './components/Footer';

import HomePage from './pages/HomePage';
import ExploreBrands from './pages/ExploreBrands';
import BrandPage from './pages/BrandPage';
import ListingPage from './pages/ListingPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyPage from './pages/VerifyPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import VerifyResetPage from './pages/VerifyResetPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SellerRegistration from './pages/SellerRegistration';
import SupportChat from './pages/SupportChat';
import UserDashboard from './pages/dashboards/UserDashboard';
import SellerDashboard from './pages/dashboards/SellerDashboard';
import AdminDashboard from './pages/dashboards/AdminDashboard';
import AddProductPage from './pages/seller/AddProductPage';
import SellerPendingPage from './pages/seller/SellerPendingPage';
import BazaarPage from './pages/BazaarPage';

function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-brand-navy border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) return <Navigate to="/login" state={{ from: window.location.pathname }} replace />;
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/" replace />;
  return children;
}

function Layout({ children, noFooter = false }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      {!noFooter && <Footer />}
    </>
  );
}

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, search]);

  return null;
}

function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-cream dark:bg-dark-bg">
      <div className="text-center">
        <div className="text-8xl mb-4">🐝</div>
        <h1 className="text-4xl font-display font-bold text-brand-navy dark:text-white mb-2">{t('notFound.title')}</h1>
        <p className="text-gray-500 dark:text-dark-muted mb-6">{t('notFound.message')}</p>
        <a href="/" className="btn-primary">{t('notFound.backHome')}</a>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Layout><HomePage /></Layout>} />
      <Route path="/explore" element={<Layout><ExploreBrands /></Layout>} />
      <Route path="/brands" element={<Layout><ExploreBrands /></Layout>} />
      <Route path="/brand/:slug" element={<Layout><BrandPage /></Layout>} />
      <Route path="/products" element={<Layout><ListingPage /></Layout>} />
      <Route path="/product/:slug" element={<Layout><ProductPage /></Layout>} />
      <Route path="/cart" element={<Layout noFooter><CartPage /></Layout>} />
      <Route path="/global" element={<Layout><ListingPage /></Layout>} />
      <Route path="/chat" element={<Layout noFooter><SupportChat /></Layout>} />
      <Route path="/support" element={<Navigate to="/chat" replace />} />

      {/* Auth */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify" element={<VerifyPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/verify-reset" element={<VerifyResetPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Seller registration */}
      <Route path="/sell" element={<SellerRegistration />} />

      {/* Protected: Customer */}
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <Layout><UserDashboard /></Layout>
          </ProtectedRoute>
        }
      />

      {/* Seller pending approval */}
      <Route
        path="/seller/pending"
        element={
          <ProtectedRoute>
            <Layout><SellerPendingPage /></Layout>
          </ProtectedRoute>
        }
      />

      {/* Protected: Seller */}
      <Route
        path="/seller/dashboard"
        element={
          <ProtectedRoute requiredRole="seller">
            <Layout><SellerDashboard /></Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/seller/products/add"
        element={
          <ProtectedRoute requiredRole="seller">
            <Layout><AddProductPage /></Layout>
          </ProtectedRoute>
        }
      />

      {/* Protected: Admin */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute requiredRole="admin">
            <Layout><AdminDashboard /></Layout>
          </ProtectedRoute>
        }
      />

      {/* Bazaar */}
      <Route path="/bazaar" element={<Layout><BazaarPage /></Layout>} />

      {/* Fallback */}
      <Route path="*" element={<Layout><NotFoundPage /></Layout>} />
    </Routes>
  );
}

function AppWrapper() {
  const { isDark } = useTheme();
  const { isRTL } = useLanguage();
  return (
    <>
      <ScrollToTop />
      <AppRoutes />
      <Toaster
        position={isRTL ? 'top-left' : 'top-right'}
        toastOptions={{
          duration: 3000,
          style: {
            fontFamily: isRTL ? 'Cairo, Inter, sans-serif' : 'Inter, sans-serif',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            background: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f8fafc' : '#1A2040',
          },
        }}
      />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>
                <AppWrapper />
              </WishlistProvider>
            </CartProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
