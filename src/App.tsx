import { type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Signup from './Signup';
import Signin from './Signin';
import ResetPassword from './ResetPassword';
import VerifyEmail from './VerifyEmail';
import AccountType from './AccountType';
import SellerProfile from './SellerProfile';
import BuyerProfile from './BuyerProfile';
import AffiliateLanding from './AffiliateLanding';
import ServiceDetail from './ServiceDetail';
import AdminDashboard from './admin/AdminDashboard';
import LandingPage from './LandingPage';
import SellerLandingPage from './SellerLandingPage';
import AboutUs from './AboutUs';
import PostService from './PostService';
import BuyerSearch from './BuyerSearch';
import BuyerSearchFiltered from './BuyerSearchFiltered';
import SellerDashboard from './SellerDashboard';
import BuyerDashboard from './BuyerDashboard';
import AffiliateDashboard from './AffiliateDashboard';
import WelcomeEmail from './WelcomeEmail';
import ResetPasswordEmail from './ResetPasswordEmail';
import PasswordUpdatedEmail from './PasswordUpdatedEmail';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/signin" replace />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/search" element={<BuyerSearch />} />
      <Route path="/search-filtered" element={<BuyerSearchFiltered />} />
      <Route path="/for-sellers" element={<SellerLandingPage />} />
      <Route path="/seller-dashboard" element={<ProtectedRoute><SellerDashboard /></ProtectedRoute>} />
      <Route path="/buyer-dashboard" element={<ProtectedRoute><BuyerDashboard /></ProtectedRoute>} />
      <Route path="/affiliate-dashboard" element={<ProtectedRoute><AffiliateDashboard /></ProtectedRoute>} />
      <Route path="/affiliate" element={<AffiliateLanding />} />
      <Route path="/service-detail" element={<ServiceDetail />} />
      <Route path="/admin-dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/about" element={<AboutUs />} />
      <Route path="/post-service" element={<ProtectedRoute><PostService /></ProtectedRoute>} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/signin" element={<Signin />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/account-type" element={<ProtectedRoute><AccountType /></ProtectedRoute>} />
      <Route path="/seller-profile" element={<ProtectedRoute><SellerProfile /></ProtectedRoute>} />
      <Route path="/buyer-profile" element={<ProtectedRoute><BuyerProfile /></ProtectedRoute>} />
      <Route path="/email-welcome" element={<WelcomeEmail />} />
      <Route path="/email-reset-password" element={<ResetPasswordEmail />} />
      <Route path="/email-password-updated" element={<PasswordUpdatedEmail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
