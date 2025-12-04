import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/auth'
import { Link } from 'react-router-dom'
import {
  Grid3X3,
  Users,
  Package,
  ShoppingCart,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  DollarSign,
  Clock,
  CheckCircle,
  Activity,
  RefreshCw,
  ChevronRight,
  UserPlus,
  AlertTriangle,
} from 'lucide-react'

interface StatsResponse {
  success: boolean
  data: {
    apps: { total: number; active: number }
    sellers: { total: number; pending: number; active: number }
    listings: { total: number; pending: number; active: number }
    orders: { total: number; active: number; completed: number; disputed: number; growth: number }
    users: { total: number; activeToday: number }
    revenue: { total: number; transactionCount: number; daily: { date: string; revenue: number; orders: number }[] }
    metrics: { completionRate: number }
    recent: {
      orders: { id: string; status: string; totalAmount: number; createdAt: string; user: { username: string }; listing: { title: string } }[]
      sellerApplications: { id: string; createdAt: string; user: { username: string } }[]
    }
    timestamp: string
  }
}

export default function Dashboard() {
  const { data: statsResponse, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api<StatsResponse>('/admin/stats'),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const stats = statsResponse?.data

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700',
      confirmed: 'bg-blue-100 text-blue-700',
      processing: 'bg-purple-100 text-purple-700',
      shipped: 'bg-indigo-100 text-indigo-700',
      completed: 'bg-emerald-100 text-emerald-700',
      disputed: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-700',
    }
    return colors[status] || 'bg-gray-100 text-gray-700'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (isError || !stats) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Failed to load statistics</h3>
          <p className="text-gray-500 mt-1">Please check the server connection</p>
          <button 
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {new Date(dataUpdatedAt).toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Alert Banner */}
      {(stats.orders.disputed > 0 || stats.sellers.pending > 0 || stats.listings.pending > 0) && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 rounded-2xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-900">Action Required</p>
              <div className="flex flex-wrap gap-3 mt-2">
                {stats.orders.disputed > 0 && (
                  <Link to="/orders?status=disputed" className="text-sm text-amber-700 hover:text-amber-900 flex items-center gap-1">
                    {stats.orders.disputed} disputed orders <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
                {stats.sellers.pending > 0 && (
                  <Link to="/sellers/applications" className="text-sm text-amber-700 hover:text-amber-900 flex items-center gap-1">
                    {stats.sellers.pending} pending sellers <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
                {stats.listings.pending > 0 && (
                  <Link to="/listings?status=pending" className="text-sm text-amber-700 hover:text-amber-900 flex items-center gap-1">
                    {stats.listings.pending} pending listings <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenue */}
        <div className="metric-card group">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+12.5%</span>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Total Revenue</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatCurrency(stats.revenue.total)}</p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{stats.revenue.transactionCount} transactions</p>
          </div>
        </div>

        {/* Total Orders */}
        <div className="metric-card group">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div className={`flex items-center gap-1 text-sm font-medium ${stats.orders.growth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {stats.orders.growth >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span>{stats.orders.growth >= 0 ? '+' : ''}{stats.orders.growth}%</span>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Total Orders</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats.orders.total)}</p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{stats.orders.active} active · {stats.orders.completed} completed</p>
          </div>
        </div>

        {/* Active Users */}
        <div className="metric-card group">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full pulse-live" />
              <span className="text-xs text-gray-500">Live</span>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{formatNumber(stats.users.total)}</p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{stats.users.activeToday} active today</p>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="metric-card group">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div className="text-sm font-medium text-gray-500">Rate</div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Completion Rate</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.metrics.completionRate}%</p>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${stats.metrics.completionRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/apps" className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/5 hover:shadow-md transition-all group">
          <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600">
            <Grid3X3 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-semibold text-gray-900">{stats.apps.active}</p>
            <p className="text-sm text-gray-500">Active Apps</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
        </Link>

        <Link to="/sellers" className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/5 hover:shadow-md transition-all group">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-semibold text-gray-900">{stats.sellers.active}</p>
            <p className="text-sm text-gray-500">Active Sellers</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-500 transition-colors" />
        </Link>

        <Link to="/listings" className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/5 hover:shadow-md transition-all group">
          <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600">
            <Package className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-semibold text-gray-900">{stats.listings.active}</p>
            <p className="text-sm text-gray-500">Active Listings</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-purple-500 transition-colors" />
        </Link>

        <Link to="/orders?status=active" className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/5 hover:shadow-md transition-all group">
          <div className="p-2.5 rounded-lg bg-orange-50 text-orange-600">
            <Activity className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-2xl font-semibold text-gray-900">{stats.orders.active}</p>
            <p className="text-sm text-gray-500">Active Orders</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
        </Link>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Recent Orders</h3>
            <Link to="/orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.recent.orders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No orders yet</p>
              </div>
            ) : (
              stats.recent.orders.map((order) => (
                <div key={order.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{order.listing?.title || 'Unknown item'}</p>
                      <p className="text-xs text-gray-500 mt-0.5">@{order.user?.username || 'Unknown'}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm font-medium text-gray-900">{formatCurrency(order.totalAmount)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                        <span className="text-xs text-gray-400">{formatTimeAgo(order.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pending Seller Applications */}
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Seller Applications</h3>
            <Link to="/sellers/applications" className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              Review all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {stats.recent.sellerApplications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <UserPlus className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No pending applications</p>
              </div>
            ) : (
              stats.recent.sellerApplications.map((seller) => (
                <div key={seller.id} className="px-5 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium">
                      {seller.user?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">@{seller.user?.username || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{formatTimeAgo(seller.createdAt)}</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    Pending Review
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
