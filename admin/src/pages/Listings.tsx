import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/auth'
import { useState } from 'react'
import { CheckCircle, XCircle, Search, Filter } from 'lucide-react'

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
    handle: string
    displayName: string | null
    avatarUrl: string | null
    sellerRating: number | null
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
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data, isLoading } = useQuery({
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

  const typeColors = {
    product: 'bg-blue-100 text-blue-800',
    experience: 'bg-purple-100 text-purple-800',
    room: 'bg-green-100 text-green-800',
    service: 'bg-orange-100 text-orange-800',
  }

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    inactive: 'bg-gray-100 text-gray-800',
  }

  const filteredListings = data?.listings.filter(
    (l) =>
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      l.seller.handle.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Listings</h1>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="rejected">Rejected</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          Loading...
        </div>
      ) : !filteredListings?.length ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          No listings found
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => (
            <div key={listing.id} className="bg-white rounded-xl shadow overflow-hidden">
              {listing.images[0] && (
                <img
                  src={listing.images[0]}
                  alt={listing.title}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 line-clamp-1">{listing.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[listing.type]}`}>
                    {listing.type}
                  </span>
                </div>
                
                <p className="text-gray-600 text-sm line-clamp-2 mb-3">{listing.description}</p>
                
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="font-bold text-lg">
                    ${(listing.price / 100).toFixed(2)}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[listing.status]}`}>
                    {listing.status}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  {listing.seller.avatarUrl ? (
                    <img src={listing.seller.avatarUrl} alt="" className="w-5 h-5 rounded-full" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-200" />
                  )}
                  <span>@{listing.seller.handle}</span>
                  <span>•</span>
                  <span>{listing.app.name}</span>
                </div>

                {status === 'pending' && (
                  <div className="flex gap-2 pt-3 border-t">
                    <button
                      onClick={() => approveMutation.mutate(listing.id)}
                      disabled={approveMutation.isPending}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingId(listing.id)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: data.pagination.totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i + 1)}
              className={`px-3 py-1 rounded ${
                page === i + 1
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Reject Listing</h2>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
              rows={4}
              placeholder="Reason for rejection..."
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setRejectingId(null)
                  setRejectReason('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate({ id: rejectingId, reason: rejectReason })}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
