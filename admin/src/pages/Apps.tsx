import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/auth'
import { Plus, MoreVertical, GripVertical, Search, Grid3X3, RefreshCw, Pencil, Trash2, Eye, EyeOff, LayoutGrid, List, Filter } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'

interface App {
  id: string
  name: string
  slug: string
  type: 'feed' | 'module' | 'home'
  icon: string | null
  description: string | null
  enabled: boolean
  order: number
  _count: { listings: number }
  createdAt: string
}

export default function Apps() {
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const menuRef = useRef<HTMLElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const { data: apps, isLoading, refetch } = useQuery({
    queryKey: ['apps'],
    queryFn: () => api<App[]>('/apps'),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      await api(`/apps/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] })
    },
  })

  const deleteApp = useMutation({
    mutationFn: async (id: string) => {
      await api(`/apps/${id}`, { method: 'DELETE' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apps'] })
    },
  })

  const typeConfig = {
    feed: { label: 'Feed', color: 'bg-blue-100 text-blue-700', icon: '📰' },
    module: { label: 'Module', color: 'bg-violet-100 text-violet-700', icon: '🧩' },
    home: { label: 'Home', color: 'bg-emerald-100 text-emerald-700', icon: '🏠' },
  }

  // Filter apps
  const filteredApps = apps?.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         app.slug.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = typeFilter === 'all' || app.type === typeFilter
    return matchesSearch && matchesType
  }) || []

  const activeCount = apps?.filter(a => a.enabled).length || 0
  const totalCount = apps?.length || 0

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Mini Apps</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeCount} of {totalCount} apps active
          </p>
        </div>
        <Link
          to="/apps/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium text-sm shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          New App
        </Link>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="feed">Feed</option>
            <option value="module">Module</option>
            <option value="home">Home</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <LayoutGrid className="w-4 h-4" />
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
          <p className="text-gray-500">Loading apps...</p>
        </div>
      ) : !filteredApps.length ? (
        <div className="bg-white rounded-2xl border border-black/5 p-12 text-center">
          <Grid3X3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery || typeFilter !== 'all' ? 'No apps found' : 'No apps created yet'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchQuery || typeFilter !== 'all' 
              ? 'Try adjusting your search or filters' 
              : 'Create your first mini app to get started'}
          </p>
          {!searchQuery && typeFilter === 'all' && (
            <Link
              to="/apps/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create App
            </Link>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="bg-white rounded-2xl border border-black/5 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl">
                    {app.icon || typeConfig[app.type].icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{app.name}</h3>
                    <code className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {app.slug}
                    </code>
                  </div>
                </div>
                <button
                  onClick={() => toggleActive.mutate({ id: app.id, enabled: !app.enabled })}
                  className={`p-1.5 rounded-lg transition-colors ${
                    app.enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {app.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              {app.description && (
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{app.description}</p>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${typeConfig[app.type].color}`}>
                    {typeConfig[app.type].label}
                  </span>
                  <span className="text-xs text-gray-500">
                    {app._count.listings} listings
                  </span>
                </div>
                <Link
                  to={`/apps/${app.id}`}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Edit →
                </Link>
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
                <th className="w-10 px-4 py-4"></th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">App</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Listings</th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="w-10 px-4 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredApps.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-4 py-4">
                    <GripVertical className="w-4 h-4 text-gray-300 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                  <td className="px-4 py-4">
                    <Link to={`/apps/${app.id}`} className="flex items-center gap-3 group/link">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-lg flex-shrink-0">
                        {app.icon || typeConfig[app.type].icon}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 group-hover/link:text-blue-600 transition-colors">
                          {app.name}
                        </p>
                        {app.description && (
                          <p className="text-sm text-gray-500 truncate max-w-xs">{app.description}</p>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${typeConfig[app.type].color}`}>
                      {typeConfig[app.type].label}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <code className="text-sm text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg">
                      {app.slug}
                    </code>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-gray-600">{app._count.listings}</span>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => toggleActive.mutate({ id: app.id, enabled: !app.enabled })}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        app.enabled
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {app.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      {app.enabled ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-4 relative">
                    <div ref={menuOpen === app.id ? menuRef : null}>
                    <button
                      onClick={() => setMenuOpen(menuOpen === app.id ? null : app.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-500" />
                    </button>
                    {menuOpen === app.id && (
                      <div className="absolute right-4 top-full mt-1 bg-white rounded-xl shadow-lg border border-black/5 py-1 z-20 min-w-[140px] animate-fade-in">
                        <Link
                          to={`/apps/${app.id}`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setMenuOpen(null)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </Link>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this app? This action cannot be undone.')) {
                              deleteApp.mutate(app.id)
                            }
                            setMenuOpen(null)
                          }}
                          className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
