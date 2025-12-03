import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/auth'
import { useState } from 'react'
import { Search, Star } from 'lucide-react'

interface Seller {
  id: string
  did: string
  handle: string
  displayName: string | null
  avatarUrl: string | null
  walletBalance: number
  sellerRating: number | null
  sellerReviewCount: number
  createdAt: string
  _count: {
    listings: number
    sellerOrders: number
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
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['sellers', page],
    queryFn: () => api<SellersResponse>(`/sellers?page=${page}`),
  })

  const filteredSellers = data?.sellers.filter(
    (s) =>
      s.handle.toLowerCase().includes(search.toLowerCase()) ||
      s.displayName?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sellers</h1>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search sellers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          Loading...
        </div>
      ) : !filteredSellers?.length ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          No sellers found
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Seller</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Rating</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Listings</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Orders</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Balance</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSellers.map((seller) => (
                <tr key={seller.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {seller.avatarUrl ? (
                        <img
                          src={seller.avatarUrl}
                          alt=""
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          {seller.handle.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">
                          {seller.displayName || seller.handle}
                        </p>
                        <p className="text-sm text-gray-500">@{seller.handle}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {seller.sellerRating ? (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span>{seller.sellerRating.toFixed(1)}</span>
                        <span className="text-gray-400 text-sm">({seller.sellerReviewCount})</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">No reviews</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{seller._count.listings}</td>
                  <td className="px-4 py-3 text-gray-600">{seller._count.sellerOrders}</td>
                  <td className="px-4 py-3 text-gray-600">
                    ${(seller.walletBalance / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {new Date(seller.createdAt).toLocaleDateString()}
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
    </div>
  )
}
