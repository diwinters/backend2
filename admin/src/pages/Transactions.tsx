import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/auth'
import { useState } from 'react'
import { Search, RefreshCw, Wallet, ChevronLeft, ChevronRight, Filter, ArrowUpRight, ArrowDownLeft, DollarSign, TrendingUp, CreditCard, AlertCircle } from 'lucide-react'

interface Transaction {
  id: string
  type: 'deposit' | 'withdrawal' | 'payment' | 'refund' | 'payout' | 'fee'
  amount: number
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  description: string | null
  createdAt: string
  user: {
    id: string
    username: string
    displayName: string | null
    avatar: string | null
  }
  order?: {
    id: string
    listing: {
      title: string
    }
  } | null
}

interface TransactionsResponse {
  transactions: Transaction[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  summary?: {
    totalVolume: number
    totalFees: number
    pendingPayouts: number
  }
}

export default function TransactionsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['transactions', page, typeFilter, statusFilter],
    queryFn: () => api<TransactionsResponse>(`/wallet/transactions?page=${page}${typeFilter ? `&type=${typeFilter}` : ''}${statusFilter ? `&status=${statusFilter}` : ''}`),
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount / 100)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const typeConfig: Record<string, { label: string; color: string; icon: any; bg: string }> = {
    deposit: { label: 'Deposit', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: ArrowDownLeft },
    withdrawal: { label: 'Withdrawal', color: 'text-red-700', bg: 'bg-red-100', icon: ArrowUpRight },
    payment: { label: 'Payment', color: 'text-blue-700', bg: 'bg-blue-100', icon: CreditCard },
    refund: { label: 'Refund', color: 'text-orange-700', bg: 'bg-orange-100', icon: ArrowDownLeft },
    payout: { label: 'Payout', color: 'text-violet-700', bg: 'bg-violet-100', icon: ArrowUpRight },
    fee: { label: 'Fee', color: 'text-gray-700', bg: 'bg-gray-100', icon: DollarSign },
  }

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
    completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-100' },
    failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-100' },
    cancelled: { label: 'Cancelled', color: 'text-gray-600', bg: 'bg-gray-100' },
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Transactions</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor all financial transactions on the platform
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(data?.summary?.totalVolume || 0)}</p>
              <p className="text-sm text-gray-500">Total Volume</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(data?.summary?.totalFees || 0)}</p>
              <p className="text-sm text-gray-500">Platform Fees</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-black/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(data?.summary?.pendingPayouts || 0)}</p>
              <p className="text-sm text-gray-500">Pending Payouts</p>
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
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => {setTypeFilter(e.target.value); setPage(1)}}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="">All Types</option>
            <option value="deposit">Deposits</option>
            <option value="withdrawal">Withdrawals</option>
            <option value="payment">Payments</option>
            <option value="refund">Refunds</option>
            <option value="payout">Payouts</option>
            <option value="fee">Fees</option>
          </select>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {setStatusFilter(e.target.value); setPage(1)}}
          className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>

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
          <p className="text-gray-500">Loading transactions...</p>
        </div>
      ) : !data?.transactions?.length ? (
        <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
          <Wallet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
          <p className="text-gray-500">
            {typeFilter || statusFilter ? 'Try adjusting your filters' : 'Transactions will appear here'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-black/5 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transaction</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.transactions.map((tx) => {
                const typeInfo = typeConfig[tx.type] || typeConfig.fee
                const statusInfo = statusConfig[tx.status] || statusConfig.pending
                const TypeIcon = typeInfo.icon
                const isCredit = ['deposit', 'refund'].includes(tx.type)
                
                return (
                  <tr key={tx.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900 truncate max-w-[200px]">
                        {tx.description || tx.order?.listing.title || typeInfo.label}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 font-mono">#{tx.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {tx.user.avatar ? (
                          <img src={tx.user.avatar} alt="" className="w-7 h-7 rounded-full object-cover ring-2 ring-white" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs">
                            {tx.user.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm text-gray-600">@{tx.user.username}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo.bg} ${typeInfo.color}`}>
                        <TypeIcon className="w-3 h-3" />
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`font-semibold ${isCredit ? 'text-emerald-600' : 'text-gray-900'}`}>
                        {isCredit ? '+' : '-'}{formatCurrency(Math.abs(tx.amount))}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-600">{formatDate(tx.createdAt)}</p>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} transactions
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
