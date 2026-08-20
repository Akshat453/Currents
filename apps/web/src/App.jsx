import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api } from "./lib/api.js";
import { useAuthStore } from "./stores/auth.js";
import { LandingPage, HowItWorksPage, PricingPage } from "./pages/PublicPages.jsx";
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage
} from "./pages/AuthPages.jsx";
import { AppLayout } from "./components/AppLayout.jsx";
import { OperatorLayout } from "./components/OperatorLayout.jsx";
import { HomePage, StationDetailPage } from "./pages/DiscoveryPages.jsx";
import {
  ActiveSessionPage,
  BookingsPage,
  FavoritesPage,
  NotificationsPage,
  PaymentsPage,
  ProfilePage,
  SessionsPage,
  VehiclesPage,
  WalletPage
} from "./pages/AccountPages.jsx";
import {
  OperatorDashboard,
  OperatorSessionsPage,
  PricingRulesPage,
  StationsManagePage
} from "./pages/OperatorPages.jsx";
function Protected({ roles, children }) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const location = useLocation();
  if (!hydrated) return <div className="empty">Restoring your session…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
  return children;
}
export default function App() {
  const setSession = useAuthStore((s) => s.setSession);
  const setHydrated = useAuthStore((s) => s.setHydrated);
  useEffect(() => {
    api
      .post("/auth/refresh")
      .then(({ data }) => setSession(data.data))
      .catch(() => setHydrated());
  }, [setSession, setHydrated]);
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/how-it-works" element={<HowItWorksPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/app"
        element={
          <Protected roles={["user", "admin"]}>
            <AppLayout />
          </Protected>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="stations/:id" element={<StationDetailPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="sessions/:id" element={<ActiveSessionPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route
        path="/operator"
        element={
          <Protected roles={["operator", "admin"]}>
            <OperatorLayout />
          </Protected>
        }
      >
        <Route index element={<OperatorDashboard />} />
        <Route path="stations" element={<StationsManagePage />} />
        <Route path="sessions" element={<OperatorSessionsPage />} />
        <Route path="pricing" element={<PricingRulesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
