import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './layouts/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ServicesPage from './pages/ServicesPage'
import DashboardPage from './pages/DashboardPage'
import AlertRulesPage from './pages/AlertRulesPage'
import IncidentsPage from './pages/IncidentsPage'
import ProfilePage from './pages/ProfilePage'
import ChannelsPage from './pages/ChannelsPage'
import ProtectedRoute from './components/ProtectedRoute'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import TeamPage from './pages/TeamPage'
import AcceptInvitationPage from './pages/AcceptInvitationPage'
import ActivityPage from "./pages/ActivityPage"
import HistorialPage from "./pages/HistorialPage"
import ServiceDetailPage from './pages/ServiceDetailPage'


function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"             element={<LoginPage />} />
        <Route path="/register"          element={<RegisterPage />} />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/forgot-password"   element={<ForgotPasswordPage />} />
        <Route
          path="/"
          element={
            <AuthRoute>
              <Layout />
            </AuthRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard"      element={<ProtectedRoute page="dashboard"><DashboardPage /></ProtectedRoute>} />
          <Route path="services"       element={<ProtectedRoute page="services"><ServicesPage /></ProtectedRoute>} />
          <Route path="historial" element={<ProtectedRoute page="historial"><HistorialPage /></ProtectedRoute>} />
          <Route path="activity" element={<ProtectedRoute page="activity"><ActivityPage /></ProtectedRoute>} />
          <Route path="services/:id"   element={<ProtectedRoute page="services"><ServiceDetailPage /></ProtectedRoute>} />
          <Route path="alert-rules"    element={<ProtectedRoute page="alert-rules"><AlertRulesPage /></ProtectedRoute>} />
          <Route path="incidents"      element={<ProtectedRoute page="incidents"><IncidentsPage /></ProtectedRoute>} />
          <Route path="channels"       element={<ProtectedRoute page="channels"><ChannelsPage /></ProtectedRoute>} />
          <Route path="team"           element={<ProtectedRoute page="team"><TeamPage /></ProtectedRoute>} />
          <Route path="profile"        element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App