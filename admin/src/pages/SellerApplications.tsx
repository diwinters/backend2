import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/auth'
import { useState } from 'react'
import { CheckCircle, XCircle, Loader2, Eye } from 'lucide-react'

interface Application {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  businessName: string
  businessType: string
  description: string
  category: string
  metadata: any
  createdAt: string
  user: {
    id: string
    did: string
    handle: string
    displayName: string | null
    avatarUrl: string | null
    _count: { buyerOrders: number }
  }
}

interface ApplicationsResponse {
  applications: Application[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export default function SellerApplications() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['seller-applications', page],
    queryFn: () => api<ApplicationsResponse>(`/sellers/applications?status=pending&page=${page}`),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api(`/sellers/applications/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-applications'] })
      setSelectedApp(null)
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/sellers/applications/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-applications'] })
      setSelectedApp(null)
      setShowRejectModal(false)
      setRejectReason('')
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Seller Applications</h1>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
        </div>
      ) : !data?.applications.length ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          No pending applications
        </div>
      ) : (
        <div className="space-y-4">
          {data.applications.map((app) => (
            <div key={app.id} className="bg-white rounded-xl shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  {app.user.avatarUrl ? (
                    <img
                      src={app.user.avatarUrl}
                      alt=""
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      {app.user.handle.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900">{app.businessName}</h3>
                    <p className="text-sm text-gray-500">
                      @{app.user.handle} • {app.businessType} • {app.category}
                    </p>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{app.description}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Applied {new Date(app.createdAt).toLocaleDateString()} •{' '}
                      {app.user._count.buyerOrders} previous orders
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedApp(app)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    title="View details"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(app.id)}
                    disabled={approveMutation.isPending}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                    title="Approve"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedApp(app)
                      setShowRejectModal(true)
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Reject"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 pt-4">
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
        </div>
      )}

      {/* Detail Modal */}
      {selectedApp && !showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">{selectedApp.businessName}</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Applicant</label>
                  <p>@{selectedApp.user.handle}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Business Type</label>
                  <p className="capitalize">{selectedApp.businessType}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Category</label>
                  <p className="capitalize">{selectedApp.category}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-gray-700">{selectedApp.description}</p>
                </div>
                {selectedApp.metadata?.website && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Website</label>
                    <a href={selectedApp.metadata.website} target="_blank" rel="noopener" className="text-primary-600 hover:underline">
                      {selectedApp.metadata.website}
                    </a>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => setSelectedApp(null)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Reject
                </button>
                <button
                  onClick={() => approveMutation.mutate(selectedApp.id)}
                  disabled={approveMutation.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Reject Application</h2>
              <p className="text-gray-600 mb-4">
                Please provide a reason for rejecting {selectedApp.businessName}'s application.
              </p>
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
                    setShowRejectModal(false)
                    setRejectReason('')
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => rejectMutation.mutate({ id: selectedApp.id, reason: rejectReason })}
                  disabled={!rejectReason.trim() || rejectMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
