import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/auth'
import { useState } from 'react'
import { CheckCircle, XCircle, Search, Filter, RefreshCw, Package, Eye, X, ChevronLeft, ChevronRight, Star, ImageOff, LayoutGrid, List, AlertCircle } from 'lucide-react'

interface Listing {
  id: string
  title: string
  description: string
  type: 'product' | 'experience' | 'room' | 'service'
  price: number
  currency: string
  images: string[]
  status: 'pending' | 'active' | 'rejected' | 'inactive'
  createdAt: string
  seller: {
    id: string
    storeName: string | null
    user: {
      username: string
      displayName: string | null
      avatar: string | null
    }
    rating: number | null
  }
  app: {
    name: string
    slug: string
  }
}

interface ListingsResponse {
  listings: Listing[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function Listings() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('pending')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['listings', status, page],
    queryFn: () => api<ListingsResponse>(`/listings?status=${status}&page=${page}`),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api(`/listings/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/listings/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] })
      setRejectingId(null)
      setRejectReason('')
    },
  })

  const typeConfig = {
    product: { label: 'Product', color: 'bg-blue-100 text-blue-700', icon: '📦' },
    experience: { label: 'Experience', color: 'bg-violet-100 text-violet-700', icon: '✨' },
    room: { label: 'Room', color: 'bg-emerald-100 text-emerald-700', icon: '🏠' },
    service: { label: 'Service', color: 'bg-orange-100 text-orange-700', icon: '🔧' },
  }

  const statusConfig = {
    pending: { label: 'Pending Review', color: 'bg-amber-100 text-amber-700' },
    active: { label: 'Active', color: 'bg-emerald-100 text-emerald-700' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
    inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-600' },
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100)
  }

  const filteredListings = data?.listings.filter(
    (l) =>
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.seller.user.username.toLowerCase().includes(search.toLowerCase())
  )

  const pendingCount = status === 'pending' ? data?.pagination.total : 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Listings</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and manage marketplace listings
          </p>
        </div>
        {status === 'pending' && pendingCount && pendingCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
            <AlertCircle className="w-4 h-4" />
            {pendingCount} pending review
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search listings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={status}
            onChange={(e) => {setStatus(e.target.value); setPage(1)}}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="pending">⏳ Pending Review</option>
            <option value="active">✓ Active</option>
            <option value="rejected">✗ Rejected</option>
            <option value="inactive">○ Inactive</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <List className="w-4 h-4" />
          </button>
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
          <p className="text-gray-500">Loading listings...</p>
        </div>
      ) : !filteredListings?.length ? (
        <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No listings found</h3>
          <p className="text-gray-500">
            {search ? 'Try adjusting your search' : `No ${status} listings at the moment`}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredListings.map((listing) => (
            <div key={listing.id} className="bg-white rounded-2xl border border-black/5 overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all">
              {/* Image */}
              <div className="relative aspect-[4/3] bg-gray-100">
                {listing.images[0] ? (
                  <>
                    <img
                      src={listing.images[0]}
                      alt={listing.title}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => setPreviewImage(listing.images[0])}
                      className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Eye className="w-6 h-6 text-white" />
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageOff className="w-8 h-8 text-gray-300" />
                  </div>
                )}
                {/* Type Badge */}
                <span className={`absolute top-3 left-3 px-2 py-1 rounded-lg text-xs font-medium ${typeConfig[listing.type].color} backdrop-blur-sm`}>
                  {typeConfig[listing.type].icon} {typeConfig[listing.type].label}
                </span>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 line-clamp-1">{listing.title}</h3>
                  <span className="text-lg font-bold text-gray-900">
                    {formatCurrency(listing.price)}
                  </span>
                </div>
                
                <p className="text-gray-500 text-sm line-clamp-2 mb-3 h-10">{listing.description}</p>
                
                {/* Seller Info */}
                <div className="flex items-center gap-2 text-sm mb-3">
                  {listing.seller.user.avatar ? (
                    <img src={listing.seller.user.avatar} alt="" className="w-6 h-6 rounded-full object-cover ring-2 ring-white" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs">
                      {listing.seller.user.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-gray-600 truncate">@{listing.seller.user.username}</span>
                  {listing.seller.rating && (
                    <span className="flex items-center gap-0.5 text-amber-600">
                      <Star className="w-3 h-3 fill-current" />
                      {listing.seller.rating.toFixed(1)}
                    </span>
                  )}
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  {status === 'pending' ? (
                    <>
                      <button
                        onClick={() => approveMutation.mutate(listing.id)}
                        disabled={approveMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => setRejectingId(listing.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`flex-1 text-center px-3 py-2 rounded-xl text-sm font-medium ${statusConfig[listing.status].color}`}>
                        {statusConfig[listing.status].label}
                      </span>
                      <span className="text-xs text-gray-400">
                        {listing.app.name}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Listing</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">App</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                {status === 'pending' && <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredListings.map((listing) => (
                <tr key={listing.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {listing.images[0] ? (
                        <img src={listing.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                          <ImageOff className="w-5 h-5 text-gray-300" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{listing.title}</p>
                        <p className="text-sm text-gray-500 line-clamp-1">{listing.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeConfig[listing.type].color}`}>
                      {typeConfig[listing.type].label}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="font-semibold text-gray-900">{formatCurrency(listing.price)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-gray-600">@{listing.seller.user.username}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-gray-500">{listing.app.name}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig[listing.status].color}`}>
                      {statusConfig[listing.status].label}
                    </span>
                  </td>
                  {status === 'pending' && (
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveMutation.mutate(listing.id)}
                          disabled={approveMutation.isPending}
                          className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setRejectingId(listing.id)}
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-gray-500">
            Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} listings
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

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Reject Listing</h2>
              <button
                onClick={() => { setRejectingId(null); setRejectReason('') }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all resize-none"
                rows={4}
                placeholder="Explain why this listing is being rejected..."
              />
              <p className="text-xs text-gray-500 mt-2">This message will be sent to the seller.</p>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => { setRejectingId(null); setRejectReason('') }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectingId, reason: rejectReason })}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject Listing'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={previewImage}
            alt=""
            className="max-w-[90vw] max-h-[90vh] rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
