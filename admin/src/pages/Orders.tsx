import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/auth'
import { useState } from 'react'
import { Search, Filter, Eye, AlertTriangle } from 'lucide-react'

interface Order {
  id: string
  status: string
  amount: number
  currency: string
  quantity: number
  createdAt: string
  updatedAt: string
  buyer: {
    handle: string
    displayName: string | null
    avatarUrl: string | null
  }
  seller: {
    handle: string
    displayName: string | null
    avatarUrl: string | null
  }
  listing: {
    id: string
    title: string
    appId: string
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
  transactions: Array<{
    id: string
    type: string
    amount: number
    status: string
    createdAt: string
  }>
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

  const { data, isLoading } = useQuery({
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

  const statusColors: Record<string, string> = {
    created: 'bg-gray-100 text-gray-800',
    paid: 'bg-blue-100 text-blue-800',
    accepted: 'bg-indigo-100 text-indigo-800',
    in_progress: 'bg-purple-100 text-purple-800',
    delivered: 'bg-cyan-100 text-cyan-800',
    completed: 'bg-green-100 text-green-800',
    disputed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
    refunded: 'bg-yellow-100 text-yellow-800',
  }

  const fetchOrderDetail = async (id: string) => {
    const order = await api<OrderDetail>(`/orders/${id}`)
    setSelectedOrder(order)
  }

  const filteredOrders = data?.orders.filter(
    (o) =>
      o.listing.title.toLowerCase().includes(search.toLowerCase()) ||
      o.buyer.handle.toLowerCase().includes(search.toLowerCase()) ||
      o.seller.handle.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
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
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="accepted">Accepted</option>
            <option value="in_progress">In Progress</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="disputed">Disputed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          Loading...
        </div>
      ) : !filteredOrders?.length ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          No orders found
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Order</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Buyer</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Seller</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Date</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 truncate max-w-[200px]">
                      {order.listing.title}
                    </p>
                    <p className="text-sm text-gray-500">#{order.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {order.buyer.avatarUrl ? (
                        <img src={order.buyer.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200" />
                      )}
                      <span className="text-sm">@{order.buyer.handle}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {order.seller.avatarUrl ? (
                        <img src={order.seller.avatarUrl} alt="" className="w-6 h-6 rounded-full" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-200" />
                      )}
                      <span className="text-sm">@{order.seller.handle}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    ${(order.amount / 100).toFixed(2)}
                    {order.quantity > 1 && (
                      <span className="text-gray-400 font-normal"> ×{order.quantity}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100'}`}>
                      {order.status.replace('_', ' ')}
                    </span>
                    {order.status === 'disputed' && (
                      <AlertTriangle className="w-4 h-4 text-red-500 inline ml-1" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => fetchOrderDetail(order.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {data && data.pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 p-4 border-t">
              {Array.from({ length: data.pagination.totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`px-3 py-1 rounded ${
                    page === i + 1
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && !resolveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold">Order Details</h2>
                  <p className="text-sm text-gray-500">#{selectedOrder.id}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[selectedOrder.status]}`}>
                  {selectedOrder.status.replace('_', ' ')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Buyer</h3>
                  <div className="flex items-center gap-2">
                    {selectedOrder.buyer.avatarUrl ? (
                      <img src={selectedOrder.buyer.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200" />
                    )}
                    <div>
                      <p className="font-medium">{selectedOrder.buyer.displayName || selectedOrder.buyer.handle}</p>
                      <p className="text-sm text-gray-500">@{selectedOrder.buyer.handle}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Seller</h3>
                  <div className="flex items-center gap-2">
                    {selectedOrder.seller.avatarUrl ? (
                      <img src={selectedOrder.seller.avatarUrl} alt="" className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200" />
                    )}
                    <div>
                      <p className="font-medium">{selectedOrder.seller.displayName || selectedOrder.seller.handle}</p>
                      <p className="text-sm text-gray-500">@{selectedOrder.seller.handle}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-medium mb-2">{selectedOrder.listing.title}</h3>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">${(selectedOrder.amount / 100).toFixed(2)}</span>
                  <span className="text-gray-500">Qty: {selectedOrder.quantity}</span>
                </div>
              </div>

              {selectedOrder.status === 'disputed' && selectedOrder.disputeReason && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <h3 className="font-medium text-red-800 mb-2">Dispute Reason</h3>
                  <p className="text-red-700">{selectedOrder.disputeReason}</p>
                </div>
              )}

              {selectedOrder.transactions?.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Transactions</h3>
                  <div className="space-y-2">
                    {selectedOrder.transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                        <span className="capitalize">{tx.type.replace('_', ' ')}</span>
                        <span className={tx.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                          {tx.amount > 0 ? '+' : ''}${(tx.amount / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Close
                </button>
                {selectedOrder.status === 'disputed' && (
                  <button
                    onClick={() => setResolveModal(true)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Resolve Dispute
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Dispute Modal */}
      {resolveModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold mb-4">Resolve Dispute</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Resolution</label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                >
                  <option value="refund_buyer">Full refund to buyer</option>
                  <option value="release_to_seller">Release funds to seller</option>
                  <option value="partial_refund">Partial refund</option>
                </select>
              </div>

              {resolution === 'partial_refund' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Refund Amount ($)
                  </label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="0.00"
                    max={selectedOrder.amount / 100}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                  rows={3}
                  placeholder="Internal notes about this resolution..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setResolveModal(false)
                  setNotes('')
                  setRefundAmount('')
                }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending || (resolution === 'partial_refund' && !refundAmount)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
