import { lazy, Suspense, type ReactNode, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { ErrorBoundary } from './ErrorBoundary';

// Route-based code splitting — each page is its own chunk
const Signup              = lazy(() => import('./Signup'));
const Signin              = lazy(() => import('./Signin'));
const ResetPassword       = lazy(() => import('./ResetPassword'));
const VerifyEmail         = lazy(() => import('./VerifyEmail'));
const AccountType         = lazy(() => import('./AccountType'));
const SellerProfile       = lazy(() => import('./SellerProfile'));
const BuyerProfile        = lazy(() => import('./BuyerProfile'));
const AffiliateLanding    = lazy(() => import('./AffiliateLanding'));
const AffiliateSignup     = lazy(() => import('./AffiliateSignup'));
const AffiliateSignin     = lazy(() => import('./AffiliateSignin'));
const AffiliateProfile    = lazy(() => import('./AffiliateProfile'));
const AffiliateDashboard  = lazy(() => import('./AffiliateDashboard'));
const ServiceDetail       = lazy(() => import('./ServiceDetail'));
const AdminDashboard      = lazy(() => import('./admin/AdminDashboard'));
const LandingPage         = lazy(() => import('./LandingPage'));
const SellerLandingPage   = lazy(() => import('./SellerLandingPage'));
const AboutUs             = lazy(() => import('./AboutUs'));
const PostService         = lazy(() => import('./PostService'));
const BuyerSearch         = lazy(() => import('./BuyerSearch'));
const BuyerSearchFiltered = lazy(() => import('./BuyerSearchFiltered'));
const SellerDashboard     = lazy(() => import('./SellerDashboard'));
const BuyerDashboard      = lazy(() => import('./BuyerDashboard'));
const WelcomeEmail        = lazy(() => import('./WelcomeEmail'));
const ResetPasswordEmail  = lazy(() => import('./ResetPasswordEmail'));
const PasswordUpdatedEmail = lazy(() => import('./PasswordUpdatedEmail'));

const PageLoader = () => (
  <div className="min-h-screen bg-[#0E1422] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, userProfile } = useAuth();

  if (user) {
    // Persist account type so we know where to redirect after logout
    if (userProfile?.accountType) {
      localStorage.setItem('lastAccountType', userProfile.accountType);
    }
    return <>{children}</>;
  }

  const lastType = localStorage.getItem('lastAccountType');
  const to = lastType === 'seller' ? '/for-sellers' : lastType === 'buyer' ? '/' : '/signin';
  return <Navigate to={to} replace />;
};

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, userProfile } = useAuth();
  if (!user) return <Navigate to="/signin" replace />;
  if (userProfile?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

function ReferralCapture() {
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref && ref.trim()) {
      localStorage.setItem('pendingReferral', ref.trim().toLowerCase());
    }
  }, [searchParams]);
  return null;
}

function AppRoutes() {
  return (
    <>
      <ReferralCapture />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"                   element={<LandingPage />} />
          <Route path="/search"             element={<BuyerSearch />} />
          <Route path="/search-filtered"    element={<BuyerSearchFiltered />} />
          <Route path="/for-sellers"        element={<SellerLandingPage />} />
          <Route path="/seller-dashboard"   element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
          <Route path="/buyer-dashboard"    element={<ProtectedRoute><BuyerDashboard /></ProtectedRoute>} />
          <Route path="/affiliate-dashboard" element={<ProtectedRoute><AffiliateDashboard /></ProtectedRoute>} />
          <Route path="/affiliate"          element={<AffiliateLanding />} />
          <Route path="/affiliate-signup"   element={<AffiliateSignup />} />
          <Route path="/affiliate-signin"   element={<AffiliateSignin />} />
          <Route path="/affiliate-profile"  element={<ProtectedRoute><AffiliateProfile /></ProtectedRoute>} />
          <Route path="/service-detail"     element={<ServiceDetail />} />
          <Route path="/admin-dashboard"    element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/about"              element={<AboutUs />} />
          <Route path="/post-service"       element={<ProtectedRoute><PostService /></ProtectedRoute>} />
          <Route path="/signup"             element={<Signup />} />
          <Route path="/signin"             element={<Signin />} />
          <Route path="/reset-password"     element={<ResetPassword />} />
          <Route path="/verify-email"       element={<VerifyEmail />} />
          <Route path="/account-type"       element={<ProtectedRoute><AccountType /></ProtectedRoute>} />
          <Route path="/seller-profile"     element={<ProtectedRoute><SellerProfile /></ProtectedRoute>} />
          <Route path="/buyer-profile"      element={<ProtectedRoute><BuyerProfile /></ProtectedRoute>} />
          <Route path="/email-welcome"      element={<WelcomeEmail />} />
          <Route path="/email-reset-password"   element={<ResetPasswordEmail />} />
          <Route path="/email-password-updated" element={<PasswordUpdatedEmail />} />
          <Route path="*"                   element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
