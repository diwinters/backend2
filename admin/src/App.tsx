import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
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
import Users from './pages/Users'
import Transactions from './pages/Transactions'

function PrivateRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const token = useAuthStore((s) => s.token)
  const admin = useAuthStore((s) => s.admin)
  
  console.log('PrivateRoute check:', { isAuthenticated, hasToken: !!token, hasAdmin: !!admin })
  
  if (!isAuthenticated) {
    console.log('Not authenticated, redirecting to login')
    return <Navigate to="/login" replace />
  }
  
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<PrivateRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/apps" element={<Apps />} />
        <Route path="/apps/new" element={<AppEditor />} />
        <Route path="/apps/:id" element={<AppEditor />} />
        <Route path="/users" element={<Users />} />
        <Route path="/sellers" element={<Sellers />} />
        <Route path="/sellers/applications" element={<SellerApplications />} />
        <Route path="/listings" element={<Listings />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/transactions" element={<Transactions />} />
      </Route>
    </Routes>
  )
}
