import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './layouts/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ServicesPage from './pages/ServicesPage'
import DashboardPage from './pages/DashboardPage'
import AlertRulesPage from './pages/AlertRulesPage'
import IncidentsPage from './pages/IncidentsPage'
import ProtectedRoute from './components/ProtectedRoute'

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <AuthRoute>
              <Layout />
            </AuthRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard"   element={<ProtectedRoute page="dashboard"><DashboardPage /></ProtectedRoute>} />
          <Route path="services"    element={<ProtectedRoute page="services"><ServicesPage /></ProtectedRoute>} />
          <Route path="alert-rules" element={<ProtectedRoute page="alert-rules"><AlertRulesPage /></ProtectedRoute>} />
          <Route path="incidents"   element={<ProtectedRoute page="incidents"><IncidentsPage /></ProtectedRoute>} />
          <Route path="channels"    element={<ProtectedRoute page="channels"><h1 className="text-white">Canales</h1></ProtectedRoute>} />
          <Route path="team"        element={<ProtectedRoute page="team"><h1 className="text-white">Equipo</h1></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App