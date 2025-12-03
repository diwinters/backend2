import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/auth'
import { Plus, MoreVertical, GripVertical, ExternalLink } from 'lucide-react'
import { useState } from 'react'

interface App {
  id: string
  name: string
  slug: string
  type: 'feed' | 'module' | 'home'
  icon: string | null
  description: string | null
  isActive: boolean
  order: number
  _count: { listings: number }
}

export default function Apps() {
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const { data: apps, isLoading } = useQuery({
    queryKey: ['apps'],
    queryFn: () => api<App[]>('/apps'),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      await api(`/apps/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive }),
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

  const typeColors = {
    feed: 'bg-blue-100 text-blue-800',
    module: 'bg-purple-100 text-purple-800',
    home: 'bg-green-100 text-green-800',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Apps</h1>
        <Link
          to="/apps/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          New App
        </Link>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">
          Loading...
        </div>
      ) : !apps?.length ? (
        <div className="bg-white rounded-xl shadow p-8 text-center">
          <p className="text-gray-500 mb-4">No apps created yet</p>
          <Link
            to="/apps/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Create your first app
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="w-10 px-4 py-3"></th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Slug</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Listings</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {apps.map((app) => (
                <tr key={app.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={`/apps/${app.id}`} className="font-medium text-gray-900 hover:text-primary-600">
                      {app.icon && <span className="mr-2">{app.icon}</span>}
                      {app.name}
                    </Link>
                    {app.description && (
                      <p className="text-sm text-gray-500 truncate max-w-xs">{app.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeColors[app.type]}`}>
                      {app.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      {app.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {app._count.listings}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive.mutate({ id: app.id, isActive: !app.isActive })}
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        app.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {app.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === app.id ? null : app.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      <MoreVertical className="w-4 h-4 text-gray-500" />
                    </button>
                    {menuOpen === app.id && (
                      <div className="absolute right-4 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 z-10 min-w-[120px]">
                        <Link
                          to={`/apps/${app.id}`}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this app?')) {
                              deleteApp.mutate(app.id)
                            }
                            setMenuOpen(null)
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                        >
                          Delete
                        </button>
                      </div>
                    )}
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
