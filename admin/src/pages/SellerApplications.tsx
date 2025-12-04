import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/auth'
import {
  ClipboardCheck,
  Clock,
  CheckCircle,
  XCircle,
  Building2,
  User,
  Tag,
  Globe,
  Calendar,
  FileText,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Shield,
  Sparkles,
  Loader2
} from 'lucide-react'

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
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['seller-applications', page, statusFilter],
    queryFn: () => api<ApplicationsResponse>(`/sellers/applications?status=${statusFilter}&page=${page}`),
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
        body: JSON.stringify({ reason })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-applications'] })
      setSelectedApp(null)
      setShowRejectModal(false)
      setRejectReason('')
    },
  })

  const applications: Application[] = data?.applications || []
  const totalPages = data?.pagination?.totalPages || 1
  const totalCount = data?.pagination?.total || 0

  const statusConfig = {
    pending: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Pending Review' },
    approved: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Approved' },
    rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Rejected' }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Seller Applications</h1>
          </div>
          <p className="text-[var(--text-secondary)]">
            Review and manage seller registration requests
          </p>
        </div>

        {/* Status Filter Pills */}
        <div className="flex gap-2 p-1 rounded-xl bg-[var(--bg-tertiary)]">
          {[
            { value: 'pending', label: 'Pending', icon: Clock },
            { value: 'approved', label: 'Approved', icon: CheckCircle },
            { value: 'rejected', label: 'Rejected', icon: XCircle },
            { value: '', label: 'All', icon: FileText }
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => {
                setStatusFilter(filter.value)
                setPage(1)
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === filter.value
                  ? 'bg-white dark:bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <filter.icon className="w-4 h-4" />
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="glass rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
              <span className="text-sm text-[var(--text-secondary)]">
                {totalCount} applications found
              </span>
            </div>
            <div className="w-px h-4 bg-[var(--border-primary)]"></div>
            <span className="text-sm text-[var(--text-secondary)]">
              Showing page {page} of {totalPages}
            </span>
          </div>
          {statusFilter === 'pending' && applications.length > 0 && (
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Requires attention</span>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass rounded-2xl p-6 animate-pulse">
              <div className="h-6 bg-[var(--bg-tertiary)] rounded-lg w-2/3 mb-3"></div>
              <div className="h-4 bg-[var(--bg-tertiary)] rounded-lg w-1/3 mb-4"></div>
              <div className="h-16 bg-[var(--bg-tertiary)] rounded-lg mb-4"></div>
              <div className="h-10 bg-[var(--bg-tertiary)] rounded-lg"></div>
            </div>
          ))}
        </div>
      ) : applications.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck className="w-8 h-8 text-[var(--text-tertiary)]" />
          </div>
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No applications found</h3>
          <p className="text-[var(--text-secondary)]">
            {statusFilter === 'pending' 
              ? 'All caught up! No pending applications to review.' 
              : `No ${statusFilter || ''} applications in the system.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {applications.map((app, index) => {
              const config = statusConfig[app.status]
              const StatusIcon = config.icon
              
              return (
                <div
                  key={app.id}
                  className="glass rounded-2xl p-6 hover:scale-[1.01] transition-all duration-300 cursor-pointer group"
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => setSelectedApp(app)}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center overflow-hidden">
                        {app.user.avatarUrl ? (
                          <img src={app.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-6 h-6 text-purple-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                          {app.businessName}
                        </h3>
                        <div className="flex items-center gap-1 text-sm text-[var(--text-secondary)]">
                          <User className="w-3.5 h-3.5" />
                          @{app.user.handle}
                        </div>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${config.bg}`}>
                      <StatusIcon className={`w-4 h-4 ${config.color}`} />
                      <span className={`text-xs font-medium ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-4">
                    {app.description}
                  </p>

                  {/* Meta Info */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-tertiary)] mb-4">
                    <div className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" />
                      <span className="capitalize">{app.businessType}</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-[var(--text-tertiary)]"></div>
                    <div className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span className="capitalize">{app.category}</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-[var(--text-tertiary)]"></div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(app.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Actions for Pending */}
                  {app.status === 'pending' && (
                    <div className="flex gap-2 pt-4 border-t border-[var(--border-primary)]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedApp(app)
                          setShowRejectModal(true)
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-red-600 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors text-sm font-medium"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          approveMutation.mutate(app.id)
                        }}
                        disabled={approveMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 transition-all text-sm font-medium disabled:opacity-50"
                      >
                        {approveMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-xl glass hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = i + 1
                if (totalPages > 5) {
                  if (page <= 3) pageNum = i + 1
                  else if (page >= totalPages - 2) pageNum = totalPages - 4 + i
                  else pageNum = page - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-10 h-10 rounded-xl text-sm font-medium transition-all ${
                      page === pageNum
                        ? 'bg-[var(--accent-primary)] text-white'
                        : 'glass hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-xl glass hover:bg-[var(--bg-tertiary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-[var(--text-secondary)]" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedApp && !showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div 
            className="glass-dark rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center overflow-hidden">
                    {selectedApp.user.avatarUrl ? (
                      <img src={selectedApp.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-7 h-7 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">{selectedApp.businessName}</h2>
                    <p className="text-white/60">Application Details</p>
                  </div>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusConfig[selectedApp.status].bg}`}>
                  {(() => {
                    const StatusIcon = statusConfig[selectedApp.status].icon
                    return <StatusIcon className={`w-4 h-4 ${statusConfig[selectedApp.status].color}`} />
                  })()}
                  <span className={`text-sm font-medium ${statusConfig[selectedApp.status].color}`}>
                    {statusConfig[selectedApp.status].label}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[50vh]">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                    <User className="w-4 h-4" />
                    Applicant
                  </div>
                  <p className="text-white font-medium">@{selectedApp.user.handle}</p>
                  {selectedApp.user.displayName && (
                    <p className="text-white/60 text-sm">{selectedApp.user.displayName}</p>
                  )}
                </div>
                
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                    <Tag className="w-4 h-4" />
                    Business Type
                  </div>
                  <p className="text-white font-medium capitalize">{selectedApp.businessType}</p>
                </div>
                
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                    <Sparkles className="w-4 h-4" />
                    Category
                  </div>
                  <p className="text-white font-medium capitalize">{selectedApp.category}</p>
                </div>
                
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                    <Calendar className="w-4 h-4" />
                    Submitted
                  </div>
                  <p className="text-white font-medium">
                    {new Date(selectedApp.createdAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5">
                <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                  <FileText className="w-4 h-4" />
                  Business Description
                </div>
                <p className="text-white/80 leading-relaxed">{selectedApp.description}</p>
              </div>

              {selectedApp.metadata?.website && (
                <div className="p-4 rounded-xl bg-white/5">
                  <div className="flex items-center gap-2 text-white/40 text-sm mb-2">
                    <Globe className="w-4 h-4" />
                    Website
                  </div>
                  <a 
                    href={selectedApp.metadata.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[var(--accent-primary)] hover:underline"
                  >
                    {selectedApp.metadata.website}
                  </a>
                </div>
              )}

              {/* Verification Checklist */}
              <div className="p-4 rounded-xl bg-white/5">
                <div className="flex items-center gap-2 text-white/40 text-sm mb-3">
                  <Shield className="w-4 h-4" />
                  Verification Checklist
                </div>
                <div className="space-y-2">
                  {['Valid business information', 'Complete description', 'Legitimate category'].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-white/60 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/10 flex justify-end gap-3">
              <button
                onClick={() => setSelectedApp(null)}
                className="px-5 py-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                Close
              </button>
              {selectedApp.status === 'pending' && (
                <>
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(selectedApp.id)}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 transition-all disabled:opacity-50"
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {approveMutation.isPending ? 'Approving...' : 'Approve Application'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedApp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div 
            className="glass-dark rounded-3xl max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Reject Application</h2>
                  <p className="text-white/60 text-sm">{selectedApp.businessName}</p>
                </div>
              </div>
              
              <p className="text-white/70 mb-4">
                Please provide a reason for rejecting this application. This will be shared with the applicant.
              </p>
              
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all resize-none"
                rows={4}
                placeholder="Enter rejection reason..."
              />

              {/* Quick Rejection Reasons */}
              <div className="flex flex-wrap gap-2 mt-3">
                {['Incomplete information', 'Invalid category', 'Policy violation'].map(reason => (
                  <button
                    key={reason}
                    onClick={() => setRejectReason(reason)}
                    className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    {reason}
                  </button>
                ))}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRejectModal(false)
                    setRejectReason('')
                  }}
                  className="px-5 py-2.5 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => rejectMutation.mutate({ id: selectedApp.id, reason: rejectReason })}
                  disabled={!rejectReason.trim() || rejectMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rejectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  {rejectMutation.isPending ? 'Rejecting...' : 'Reject Application'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
