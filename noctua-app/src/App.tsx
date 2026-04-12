import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './layouts/Layout'

function Dashboard() {
  return <h1 className="text-2xl font-bold text-white">Dashboard</h1>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="services" element={<h1 className="text-white">Servicios</h1>} />
          <Route path="alert-rules" element={<h1 className="text-white">Reglas de alerta</h1>} />
          <Route path="incidents" element={<h1 className="text-white">Incidentes</h1>} />
          <Route path="channels" element={<h1 className="text-white">Canales</h1>} />
          <Route path="team" element={<h1 className="text-white">Equipo</h1>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App