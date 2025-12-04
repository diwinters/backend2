import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/auth'
import { useState } from 'react'
import { Search, Filter, Eye, AlertTriangle, RefreshCw, ShoppingCart, ChevronLeft, ChevronRight, X, Clock, CheckCircle, Package, Truck, DollarSign } from 'lucide-react'

interface Order {
  id: string
  status: string
  totalAmount: number
  currency: string
  quantity: number
  createdAt: string
  updatedAt: string
  user: {
    username: string
    displayName: string | null
    avatar: string | null
  }
  listing: {
    id: string
    title: string
    seller: {
      user: {
        username: string
        displayName: string | null
        avatar: string | null
      }
    }
  }
}

interface OrdersResponse {
  orders: Order[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

interface OrderDetail extends Order {
  disputeReason?: string
  metadata: any
  shippingAddress?: any
  notes?: string
}

export default function Orders() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null)
  const [resolveModal, setResolveModal] = useState(false)
  const [resolution, setResolution] = useState<'refund_buyer' | 'release_to_seller' | 'partial_refund'>('refund_buyer')
  const [refundAmount, setRefundAmount] = useState('')
  const [notes, setNotes] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', status, page],
    queryFn: () => api<OrdersResponse>(`/orders?${status ? `status=${status}&` : ''}page=${page}`),
  })

  const resolveMutation = useMutation({
    mutationFn: async () => {
      await api(`/orders/${selectedOrder?.id}/resolve-dispute`, {
        method: 'POST',
        body: JSON.stringify({
          resolution,
          refundAmount: resolution === 'partial_refund' ? parseInt(refundAmount) * 100 : undefined,
          notes,
        }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      setSelectedOrder(null)
      setResolveModal(false)
      setNotes('')
      setRefundAmount('')
    },
  })

  const statusConfig: Record<string, { label: string; color: string; icon: any; bg: string }> = {
    pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
    confirmed: { label: 'Confirmed', color: 'text-blue-700', bg: 'bg-blue-100', icon: CheckCircle },
    processing: { label: 'Processing', color: 'text-violet-700', bg: 'bg-violet-100', icon: Package },
    shipped: { label: 'Shipped', color: 'text-indigo-700', bg: 'bg-indigo-100', icon: Truck },
    completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckCircle },
    disputed: { label: 'Disputed', color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle },
    cancelled: { label: 'Cancelled', color: 'text-gray-600', bg: 'bg-gray-100', icon: X },
    refunded: { label: 'Refunded', color: 'text-orange-700', bg: 'bg-orange-100', icon: DollarSign },
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100)
  }

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  const fetchOrderDetail = async (id: string) => {
    const response = await api<{ order: OrderDetail }>(`/orders/${id}`)
    setSelectedOrder(response.order)
  }

  const filteredOrders = data?.orders.filter(
    (o) =>
      o.listing.title.toLowerCase().includes(search.toLowerCase()) ||
      o.user.username.toLowerCase().includes(search.toLowerCase()) ||
      o.listing.seller.user.username.toLowerCase().includes(search.toLowerCase())
  )

  // Summary stats
  const disputedCount = data?.orders.filter(o => o.status === 'disputed').length || 0
  const totalRevenue = data?.orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.totalAmount, 0) || 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage all marketplace orders
          </p>
        </div>
        {disputedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium animate-pulse">
            <AlertTriangle className="w-4 h-4" />
            {disputedCount} dispute{disputedCount > 1 ? 's' : ''} need attention
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{data?.pagination.total || 0}</p>
              <p className="text-sm text-gray-500">Total Orders</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(totalRevenue)}</p>
              <p className="text-sm text-gray-500">Revenue</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-100 text-violet-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {data?.orders.filter(o => ['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)).length || 0}
              </p>
              <p className="text-sm text-gray-500">In Progress</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 text-red-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{disputedCount}</p>
              <p className="text-sm text-gray-500">Disputes</p>
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
            placeholder="Search orders..."
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
            <option value="">All Orders</option>
            <option value="pending">⏳ Pending</option>
            <option value="confirmed">✓ Confirmed</option>
            <option value="processing">📦 Processing</option>
            <option value="shipped">🚚 Shipped</option>
            <option value="completed">✅ Completed</option>
            <option value="disputed">⚠️ Disputed</option>
            <option value="cancelled">❌ Cancelled</option>
            <option value="refunded">💰 Refunded</option>
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
          <p className="text-gray-500">Loading orders...</p>
        </div>
      ) : !filteredOrders?.length ? (
        <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
          <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
          <p className="text-gray-500">
            {search ? 'Try adjusting your search' : 'Orders will appear here'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Buyer</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="w-10 px-5 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredOrders.map((order) => {
                const statusInfo = statusConfig[order.status] || statusConfig.pending
                const StatusIcon = statusInfo.icon
                return (
                  <tr key={order.id} className={`hover:bg-gray-50/50 transition-colors ${order.status === 'disputed' ? 'bg-red-50/30' : ''}`}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 truncate max-w-[200px]">
                        {order.listing.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">#{order.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {order.user.avatar ? (
                          <img src={order.user.avatar} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-white" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs">
                            {order.user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm text-gray-600">@{order.user.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {order.listing.seller.user.avatar ? (
                          <img src={order.listing.seller.user.avatar} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-white" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs">
                            {order.listing.seller.user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm text-gray-600">@{order.listing.seller.user.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-semibold text-gray-900">{formatCurrency(order.totalAmount)}</span>
                      {order.quantity > 1 && (
                        <span className="text-gray-400 text-sm ml-1">×{order.quantity}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">{new Date(order.createdAt).toLocaleDateString()}</p>
                      <p className="text-xs text-gray-400">{formatTimeAgo(order.createdAt)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => fetchOrderDetail(order.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} orders
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

      {/* Order Detail Modal */}
      {selectedOrder && !resolveModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Order Details</h2>
                <p className="text-sm text-gray-500 font-mono">#{selectedOrder.id}</p>
              </div>
              <div className="flex items-center gap-3">
                {(() => {
                  const statusInfo = statusConfig[selectedOrder.status] || statusConfig.pending
                  const StatusIcon = statusInfo.icon
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                      <StatusIcon className="w-4 h-4" />
                      {statusInfo.label}
                    </span>
                  )
                })()}
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-auto max-h-[calc(85vh-140px)]">
              {/* Buyer & Seller */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Buyer</p>
                  <div className="flex items-center gap-3">
                    {selectedOrder.user.avatar ? (
                      <img src={selectedOrder.user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-medium">
                        {selectedOrder.user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{selectedOrder.user.displayName || selectedOrder.user.username}</p>
                      <p className="text-sm text-gray-500">@{selectedOrder.user.username}</p>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Seller</p>
                  <div className="flex items-center gap-3">
                    {selectedOrder.listing.seller.user.avatar ? (
                      <img src={selectedOrder.listing.seller.user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-medium">
                        {selectedOrder.listing.seller.user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{selectedOrder.listing.seller.user.displayName || selectedOrder.listing.seller.user.username}</p>
                      <p className="text-sm text-gray-500">@{selectedOrder.listing.seller.user.username}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Item */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl mb-6">
                <h3 className="font-semibold text-gray-900 mb-2">{selectedOrder.listing.title}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-bold text-gray-900">{formatCurrency(selectedOrder.totalAmount)}</span>
                  <span className="text-gray-500 bg-white px-3 py-1 rounded-lg">Qty: {selectedOrder.quantity}</span>
                </div>
              </div>

              {/* Dispute Info */}
              {selectedOrder.status === 'disputed' && selectedOrder.disputeReason && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-red-800 mb-1">Dispute Reason</h4>
                      <p className="text-red-700 text-sm">{selectedOrder.disputeReason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline placeholder */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Order Timeline</p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Order Created</p>
                      <p className="text-xs text-gray-500">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Close
              </button>
              {selectedOrder.status === 'disputed' && (
                <button
                  onClick={() => setResolveModal(true)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                >
                  Resolve Dispute
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resolve Dispute Modal */}
      {resolveModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 shadow-2xl">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Resolve Dispute</h2>
              <p className="text-sm text-gray-500 mt-1">Choose how to resolve this order dispute</p>
            </div>
            
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Type</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                >
                  <option value="refund_buyer">💰 Full refund to buyer</option>
                  <option value="release_to_seller">✅ Release funds to seller</option>
                  <option value="partial_refund">📊 Partial refund</option>
                </select>
              </div>

              {resolution === 'partial_refund' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Refund Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                      placeholder="0.00"
                      max={selectedOrder.totalAmount / 100}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Max: {formatCurrency(selectedOrder.totalAmount)}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Internal Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                  rows={3}
                  placeholder="Add notes about this resolution..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
              <button
                onClick={() => {
                  setResolveModal(false)
                  setNotes('')
                  setRefundAmount('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending || (resolution === 'partial_refund' && !refundAmount)}
                className="px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resolveMutation.isPending ? 'Processing...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
