import { lazy, Suspense, type ReactNode, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { ref as dbRef, get } from 'firebase/database';
import { Toaster } from 'sonner'; // toast notifications
import { database, isImpersonating, endImpersonation, IMPERSONATION_NAME } from './firebase';
import { AuthProvider, useAuth } from './AuthContext';
import { CategoriesProvider } from './CategoriesContext';
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
const PasswordUpdatedEmail  = lazy(() => import('./PasswordUpdatedEmail'));
const ConfirmPasswordReset  = lazy(() => import('./ConfirmPasswordReset'));
const TermsAndConditions  = lazy(() => import('./TermsAndConditions'));
const PrivacyPolicy       = lazy(() => import('./PrivacyPolicy'));
const AuthCallback        = lazy(() => import('./AuthCallback'));

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, userProfile } = useAuth();

  if (user) {
    // Admins only ever get the admin dashboard — keep them out of the
    // buyer/seller/affiliate areas even if they navigate there directly.
    if (userProfile?.role === 'admin') {
      return <Navigate to="/admin-dashboard" replace />;
    }
    // Persist account type so we know where to redirect after logout
    if (userProfile?.accountType) {
      localStorage.setItem('lastAccountType', userProfile.accountType);
    }
    return <>{children}</>;
  }

  return <Navigate to="/search" replace />;
};

const AdminRoute = ({ children }: { children: ReactNode }) => {
  const { user, userProfile } = useAuth();
  if (!user) return <Navigate to="/signin" replace />;
  if (userProfile?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Disable browser's native scroll restoration so our handler always wins,
    // including on back/forward navigation.
    window.history.scrollRestoration = 'manual';
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

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

// Applies platform-wide settings: sets the browser-tab title from the configured
// platform name and enforces Maintenance Mode (admins and the sign-in page bypass).
function PlatformGate({ children }: { children: ReactNode }) {
  const { userProfile, loading } = useAuth();
  const { pathname } = useLocation();
  const [maintenance, setMaintenance] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    get(dbRef(database, 'settings/general')).then((snap) => {
      const g = (snap.val() ?? {}) as { platformName?: string; maintenanceMode?: boolean };
      if (g.platformName?.trim()) document.title = g.platformName.trim();
      setMaintenance(Boolean(g.maintenanceMode));
    }).catch(() => {}).finally(() => setReady(true));
  }, []);

  const isAdmin = userProfile?.role === 'admin';
  const onAuthPath = pathname === '/signin' || pathname.startsWith('/auth') || pathname === '/reset-password';

  if (ready && maintenance && !loading && !isAdmin && !onAuthPath) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 text-center">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-bold text-white">We'll be right back</h1>
          <p className="text-slate-400 text-sm">Gigspace is undergoing scheduled maintenance. Please check back shortly.</p>
          <Link to="/signin" className="inline-block text-blue-400 hover:text-blue-300 text-sm transition-colors">Admin sign in →</Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

// Floating pill shown while an admin is impersonating a user. The admin's own
// session is untouched in the background — "Return to Admin" reloads onto it.
function ImpersonationBanner() {
  if (!isImpersonating) return null;
  const name = sessionStorage.getItem(IMPERSONATION_NAME) || 'user';
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-blue-600 text-white pl-4 pr-1.5 py-1.5 rounded-full shadow-2xl border border-blue-400/40 max-w-[calc(100vw-2rem)]">
      <span className="text-xs font-medium truncate">
        Impersonating <span className="font-semibold">{name}</span>
      </span>
      <button
        onClick={endImpersonation}
        className="bg-white/15 hover:bg-white/25 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors"
      >
        Return to Admin
      </button>
    </div>
  );
}

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <ReferralCapture />
      <ImpersonationBanner />
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
          <Route path="/affiliate-signup"   element={<Navigate to="/signup" replace />} />
          <Route path="/affiliate-signin"   element={<Navigate to="/signin" replace />} />
          <Route path="/affiliate-profile"  element={<ProtectedRoute><AffiliateProfile /></ProtectedRoute>} />
          <Route path="/service-detail"     element={<ServiceDetail />} />
          <Route path="/admin-dashboard"    element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/about"              element={<AboutUs />} />
          <Route path="/terms"              element={<TermsAndConditions />} />
          <Route path="/privacy"            element={<PrivacyPolicy />} />
          <Route path="/post-service"       element={<ProtectedRoute><PostService /></ProtectedRoute>} />
          <Route path="/signup"             element={<Signup />} />
          <Route path="/signin"             element={<Signin />} />
          <Route path="/reset-password"     element={<ResetPassword />} />
          <Route path="/auth/action"        element={<ConfirmPasswordReset />} />
          <Route path="/auth/callback"      element={<AuthCallback />} />
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
          <CategoriesProvider>
            <PlatformGate>
              <AppRoutes />
            </PlatformGate>
            <Toaster position="top-center" richColors theme="dark" />
          </CategoriesProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
