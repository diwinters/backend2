import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/auth'
import { useState } from 'react'
import { Search, Star, RefreshCw, Filter, Users, TrendingUp, Package, DollarSign, ChevronLeft, ChevronRight, MoreVertical, Ban, CheckCircle, Eye, Mail } from 'lucide-react'

interface Seller {
  id: string
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  storeName: string | null
  storeDescription: string | null
  rating: number | null
  reviewCount: number
  createdAt: string
  user: {
    id: string
    username: string
    displayName: string | null
    avatar: string | null
    wallet?: { balance: number }
  }
  _count: {
    listings: number
    orders: number
  }
}

interface SellersResponse {
  sellers: Seller[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function Sellers() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('approved')
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sellers', page, statusFilter],
    queryFn: () => api<SellersResponse>(`/sellers?page=${page}&status=${statusFilter}`),
  })

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api(`/sellers/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sellers'] })
      setMenuOpen(null)
    },
  })

  const filteredSellers = data?.sellers.filter(
    (s) =>
      s.user.username.toLowerCase().includes(search.toLowerCase()) ||
      s.user.displayName?.toLowerCase().includes(search.toLowerCase()) ||
      s.storeName?.toLowerCase().includes(search.toLowerCase())
  )

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100)
  }

  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: '⏳' },
    approved: { label: 'Active', color: 'bg-emerald-100 text-emerald-700', icon: '✓' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: '✗' },
    suspended: { label: 'Suspended', color: 'bg-gray-100 text-gray-700', icon: '⊘' },
  }

  // Calculate summary stats
  const totalSellers = data?.pagination.total || 0
  const avgRating = filteredSellers?.filter(s => s.rating).reduce((acc, s) => acc + (s.rating || 0), 0) / (filteredSellers?.filter(s => s.rating).length || 1) || 0
  const totalListings = filteredSellers?.reduce((acc, s) => acc + s._count.listings, 0) || 0
  const totalOrders = filteredSellers?.reduce((acc, s) => acc + s._count.orders, 0) || 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Sellers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage marketplace sellers and their stores
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-100 text-violet-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{totalSellers}</p>
              <p className="text-sm text-gray-500">Total Sellers</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{avgRating.toFixed(1)}</p>
              <p className="text-sm text-gray-500">Avg Rating</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{totalListings}</p>
              <p className="text-sm text-gray-500">Listings</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{totalOrders}</p>
              <p className="text-sm text-gray-500">Total Orders</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search sellers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => {setStatusFilter(e.target.value); setPage(1)}}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="approved">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
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
          <p className="text-gray-500">Loading sellers...</p>
        </div>
      ) : !filteredSellers?.length ? (
        <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No sellers found</h3>
          <p className="text-gray-500">
            {search ? 'Try adjusting your search' : 'No sellers match this filter'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Listings</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Orders</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                <th className="w-10 px-5 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredSellers.map((seller) => (
                <tr key={seller.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {seller.user.avatar ? (
                        <img
                          src={seller.user.avatar}
                          alt=""
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-white"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-medium">
                          {seller.user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {seller.storeName || seller.user.displayName || seller.user.username}
                        </p>
                        <p className="text-sm text-gray-500">@{seller.user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[seller.status].color}`}>
                      {statusConfig[seller.status].label}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {seller.rating ? (
                      <div className="flex items-center gap-1.5">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        <span className="font-medium">{seller.rating.toFixed(1)}</span>
                        <span className="text-gray-400 text-sm">({seller.reviewCount})</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">No reviews</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-gray-900 font-medium">{seller._count.listings}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-gray-900 font-medium">{seller._count.orders}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-gray-900 font-medium">
                      {formatCurrency(seller.user.wallet?.balance || 0)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {new Date(seller.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4 relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === seller.id ? null : seller.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-500" />
                    </button>
                    {menuOpen === seller.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(null)} />
                        <div className="absolute right-4 top-full mt-1 bg-white rounded-xl shadow-lg border border-black/5 py-1 z-20 min-w-[160px] animate-fade-in">
                          <button
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Profile
                          </button>
                          <button
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            Send Message
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                          {seller.status === 'approved' ? (
                            <button
                              onClick={() => updateStatus.mutate({ id: seller.id, status: 'suspended' })}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Suspend Seller
                            </button>
                          ) : seller.status === 'suspended' ? (
                            <button
                              onClick={() => updateStatus.mutate({ id: seller.id, status: 'approved' })}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-emerald-600 hover:bg-emerald-50"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Reactivate
                            </button>
                          ) : null}
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} sellers
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
    </div>
  )
}
