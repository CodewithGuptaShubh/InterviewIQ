import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell.jsx";
import { ProtectedRoute } from "./routes/ProtectedRoute.jsx";
import { AnalyticsPage } from "./pages/AnalyticsPage.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { InterviewPage } from "./pages/InterviewPage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { PricingPage } from "./pages/PricingPage.jsx";
import { ProfilePage } from "./pages/ProfilePage.jsx";
import { ReportPage } from "./pages/ReportPage.jsx";
import { ResumePage } from "./pages/ResumePage.jsx";
import { SignupPage } from "./pages/SignupPage.jsx";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="resume" element={<ResumePage />} />
        <Route path="interview" element={<InterviewPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="reports/:id" element={<ReportPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
