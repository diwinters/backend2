import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/auth'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Grid3X3,
  Users,
  FileCheck,
  Package,
  ShoppingCart,
  LogOut,
  Settings,
  Bell,
  Search,
  ChevronDown,
  Wallet,
  Activity,
  Menu,
  X,
} from 'lucide-react'

const navigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Mini Apps', href: '/apps', icon: Grid3X3 },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Sellers', href: '/sellers', icon: Users },
  { name: 'Applications', href: '/sellers/applications', icon: FileCheck, badge: true },
  { name: 'Listings', href: '/listings', icon: Package, badge: true },
  { name: 'Orders', href: '/orders', icon: ShoppingCart },
  { name: 'Transactions', href: '/transactions', icon: Wallet },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { admin, logout } = useAuthStore()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
      month: 'short', 
      day: 'numeric' 
    })
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      {/* Top navigation bar - Apple style */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 glass border-b border-black/5">
        <div className="h-full px-4 flex items-center justify-between">
          {/* Left: Logo & Nav toggle */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden p-2 hover:bg-black/5 rounded-lg transition-colors"
            >
              {showMobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold text-[15px] hidden sm:block">Admin Console</span>
            </div>
          </div>

          {/* Center: Search */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 bg-black/5 rounded-lg text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 bg-white/80 px-1.5 py-0.5 rounded border border-gray-200">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Right: Time, Notifications, User */}
          <div className="flex items-center gap-2">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 pulse-live" />
              <span className="text-xs font-medium text-emerald-700">Live</span>
            </div>

            {/* Time */}
            <div className="hidden lg:block px-3 py-1.5 text-xs text-gray-500">
              <div className="font-medium">{formatTime(currentTime)}</div>
              <div className="text-[10px] text-gray-400">{formatDate(currentTime)}</div>
            </div>

            {/* Notifications */}
            <button className="relative p-2 hover:bg-black/5 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-1.5 hover:bg-black/5 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                  {admin?.name?.charAt(0).toUpperCase() || 'A'}
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
              </button>

              {showUserMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowUserMenu(false)} 
                  />
                  <div className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-lg border border-black/5 overflow-hidden z-50 animate-fade-in">
                    <div className="p-4 border-b border-black/5">
                      <p className="font-medium text-sm">{admin?.name || 'Administrator'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{admin?.email}</p>
                    </div>
                    <div className="p-2">
                      <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-black/5 rounded-lg transition-colors">
                        <Settings className="w-4 h-4" />
                        Settings
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`fixed top-14 left-0 bottom-0 w-64 bg-white border-r border-black/5 z-40 transform transition-transform duration-300 lg:translate-x-0 ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
              (item.href !== '/' && location.pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setShowMobileMenu(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-500 text-white shadow-md shadow-blue-500/25'
                    : 'text-gray-600 hover:bg-black/5'
                }`}
              >
                <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600'
                  }`}>
                    •
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-black/5">
          <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
            <p className="text-xs font-medium text-blue-900">System Status</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-gray-600">All systems operational</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {showMobileMenu && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:ml-64 pt-14 min-h-screen">
        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
