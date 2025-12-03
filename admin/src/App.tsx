import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Apps from './pages/Apps'
import AppEditor from './pages/AppEditor'
import Sellers from './pages/Sellers'
import SellerApplications from './pages/SellerApplications'
import Listings from './pages/Listings'
import Orders from './pages/Orders'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/apps" element={<Apps />} />
                <Route path="/apps/new" element={<AppEditor />} />
                <Route path="/apps/:id" element={<AppEditor />} />
                <Route path="/sellers" element={<Sellers />} />
                <Route path="/sellers/applications" element={<SellerApplications />} />
                <Route path="/listings" element={<Listings />} />
                <Route path="/orders" element={<Orders />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  )
}
