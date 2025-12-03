import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/auth'
import {
  Grid3X3,
  Users,
  Package,
  ShoppingCart,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'

interface Stats {
  apps: { total: number; active: number }
  sellers: { total: number; pending: number }
  listings: { total: number; pending: number }
  orders: { total: number; active: number; disputed: number }
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api<Stats>('/apps'), // TODO: Create dedicated stats endpoint
    retry: false,
  })

  // Placeholder stats for now
  const placeholderStats = {
    apps: { total: 5, active: 3 },
    sellers: { total: 120, pending: 8 },
    listings: { total: 450, pending: 15 },
    orders: { total: 1250, active: 45, disputed: 3 },
  }

  const displayStats = placeholderStats

  const cards = [
    {
      name: 'Active Apps',
      value: `${displayStats.apps.active}/${displayStats.apps.total}`,
      icon: Grid3X3,
      color: 'bg-blue-500',
      href: '/apps',
    },
    {
      name: 'Sellers',
      value: displayStats.sellers.total,
      subtext: `${displayStats.sellers.pending} pending`,
      icon: Users,
      color: 'bg-green-500',
      href: '/sellers',
    },
    {
      name: 'Listings',
      value: displayStats.listings.total,
      subtext: `${displayStats.listings.pending} pending`,
      icon: Package,
      color: 'bg-purple-500',
      href: '/listings',
    },
    {
      name: 'Orders',
      value: displayStats.orders.total,
      subtext: `${displayStats.orders.active} active`,
      icon: ShoppingCart,
      color: 'bg-orange-500',
      href: '/orders',
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => (
          <a
            key={card.name}
            href={card.href}
            className="bg-white rounded-xl shadow p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.name}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                {card.subtext && (
                  <p className="text-sm text-gray-400 mt-1">{card.subtext}</p>
                )}
              </div>
              <div className={`${card.color} p-3 rounded-lg`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Alerts */}
      {displayStats.orders.disputed > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="font-medium text-red-800">
                {displayStats.orders.disputed} disputed orders need attention
              </p>
              <a href="/orders?status=disputed" className="text-sm text-red-600 hover:underline">
                View disputes →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Actions</h2>
          <div className="space-y-3">
            <a
              href="/sellers/applications"
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <span className="text-gray-700">Seller Applications</span>
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-medium">
                {displayStats.sellers.pending}
              </span>
            </a>
            <a
              href="/listings?status=pending"
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
            >
              <span className="text-gray-700">Pending Listings</span>
              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm font-medium">
                {displayStats.listings.pending}
              </span>
            </a>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Active Orders</span>
              <span className="font-medium">{displayStats.orders.active}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Completion Rate</span>
              <span className="font-medium text-green-600">94.5%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Avg. Rating</span>
              <span className="font-medium">4.7 ⭐</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
