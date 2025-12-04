import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/auth'
import { useState } from 'react'
import { Search, RefreshCw, Users as UsersIcon, ChevronLeft, ChevronRight, MoreVertical, Eye, Ban, Mail, UserCheck, Calendar, Wallet, ShoppingCart, X } from 'lucide-react'

interface User {
  id: string
  username: string
  displayName: string | null
  avatar: string | null
  email: string | null
  createdAt: string
  lastSeen: string | null
  wallet?: { balance: number }
  _count: {
    orders: number
  }
  seller?: {
    id: string
    status: string
    rating: number | null
  } | null
}

interface UsersResponse {
  users: User[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function UsersPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => api<UsersResponse>(`/users?page=${page}${search ? `&search=${search}` : ''}`),
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTimeAgo = (date: string | null) => {
    if (!date) return 'Never'
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
    return formatDate(date)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage platform users and their accounts
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
          <UsersIcon className="w-4 h-4" />
          {data?.pagination.total || 0} total users
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by username, display name, or email..."
            value={search}
            onChange={(e) => {setSearch(e.target.value); setPage(1)}}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Refresh */}
        <button
          onClick={() => refetch()}
          className="p-2.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading users...</p>
        </div>
      ) : !data?.users.length ? (
        <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
          <UsersIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No users found</h3>
          <p className="text-gray-500">
            {search ? 'Try adjusting your search' : 'Users will appear here when they sign up'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="w-10 px-5 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {user.avatar ? (
                        <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{user.displayName || user.username}</p>
                        <p className="text-sm text-gray-500">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {user.seller ? (
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        user.seller.status === 'approved' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {user.seller.status === 'approved' ? '🏪 Seller' : '⏳ Pending Seller'}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500">Buyer</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-gray-900 font-medium">{user._count.orders}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-gray-900 font-medium">
                      {formatCurrency(user.wallet?.balance || 0)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      {user.lastSeen && new Date(user.lastSeen).getTime() > Date.now() - 300000 && (
                        <span className="w-2 h-2 bg-emerald-500 rounded-full pulse-live" />
                      )}
                      <span className="text-sm text-gray-600">{formatTimeAgo(user.lastSeen)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-sm text-gray-500">{formatDate(user.createdAt)}</span>
                  </td>
                  <td className="px-5 py-4 relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === user.id ? null : user.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-500" />
                    </button>
                    {menuOpen === user.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-4 top-full mt-1 bg-white rounded-xl shadow-lg border border-black/5 py-1 z-20 min-w-[160px] animate-fade-in">
                          <button
                            onClick={() => { setSelectedUser(user); setMenuOpen(null) }}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Details
                          </button>
                          <button
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Send Message
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          <button
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Suspend User
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} users
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                  const pageNum = i + 1
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        page === pageNum
                          ? 'bg-blue-500 text-white'
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
                {data.pagination.totalPages > 5 && <span className="text-gray-400">...</span>}
                <button
                  onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page === data.pagination.totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">User Details</h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5">
              {/* Profile Header */}
              <div className="flex items-center gap-4 mb-6">
                {selectedUser.avatar ? (
                  <img src={selectedUser.avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-medium">
                    {selectedUser.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">{selectedUser.displayName || selectedUser.username}</h3>
                  <p className="text-gray-500">@{selectedUser.username}</p>
                  {selectedUser.email && (
                    <p className="text-sm text-gray-400">{selectedUser.email}</p>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-xl text-center">
                  <ShoppingCart className="w-5 h-5 text-blue-500 mx-auto mb-2" />
                  <p className="text-xl font-semibold text-gray-900">{selectedUser._count.orders}</p>
                  <p className="text-xs text-gray-500">Orders</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl text-center">
                  <Wallet className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xl font-semibold text-gray-900">{formatCurrency(selectedUser.wallet?.balance || 0)}</p>
                  <p className="text-xs text-gray-500">Balance</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl text-center">
                  <Calendar className="w-5 h-5 text-violet-500 mx-auto mb-2" />
                  <p className="text-xl font-semibold text-gray-900">{Math.floor((Date.now() - new Date(selectedUser.createdAt).getTime()) / 86400000)}</p>
                  <p className="text-xs text-gray-500">Days</p>
                </div>
              </div>

              {/* Info List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className="flex items-center gap-2">
                    {selectedUser.seller ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        selectedUser.seller.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {selectedUser.seller.status === 'approved' ? 'Active Seller' : 'Pending Seller'}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-600">Buyer</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Last Active</span>
                  <span className="text-sm text-gray-900">{formatTimeAgo(selectedUser.lastSeen)}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Joined</span>
                  <span className="text-sm text-gray-900">{formatDate(selectedUser.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-500">User ID</span>
                  <span className="text-xs font-mono text-gray-400">{selectedUser.id}</span>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Close
              </button>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
              >
                View Orders
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
