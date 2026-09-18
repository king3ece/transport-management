import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider, useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import Bookings from './pages/Bookings'
import Customers from './pages/Customers'
import Dashboard from './pages/Dashboard'
import Drivers from './pages/Drivers'
import Login from './pages/Login'
import Maintenances from './pages/Maintenances'
import RoutesPage from './pages/RoutesPage'
import Shipments from './pages/Shipments'
import Tracking from './pages/Tracking'
import Trips from './pages/Trips'
import Users from './pages/Users'
import Vehicles from './pages/Vehicles'

function RequireAuth() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner label="Vérification de la session…" />
  if (!user) return <Navigate to="/login" replace />
  return <Layout />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/suivi" element={<Tracking />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/bookings" element={<Bookings />} />
            <Route path="/shipments" element={<Shipments />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/maintenances" element={<Maintenances />} />
            <Route path="/drivers" element={<Drivers />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/users" element={<Users />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
