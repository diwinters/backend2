import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/auth'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'

interface App {
  id: string
  name: string
  slug: string
  type: 'feed' | 'module' | 'home'
  icon: string | null
  description: string | null
  config: any
  isActive: boolean
  order: number
}

export default function AppEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id

  const [form, setForm] = useState({
    name: '',
    slug: '',
    type: 'feed' as 'feed' | 'module' | 'home',
    icon: '',
    description: '',
    isActive: false,
    config: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: app, isLoading } = useQuery({
    queryKey: ['app', id],
    queryFn: () => api<App>(`/apps/${id}`),
    enabled: !!id,
  })

  useEffect(() => {
    if (app) {
      setForm({
        name: app.name,
        slug: app.slug,
        type: app.type,
        icon: app.icon || '',
        description: app.description || '',
        isActive: app.isActive,
        config: JSON.stringify(app.config, null, 2),
      })
    }
  }, [app])

  const saveMutation = useMutation({
    mutationFn: async () => {
      let config
      try {
        config = JSON.parse(form.config)
      } catch {
        throw new Error('Invalid JSON in config')
      }

      const payload = {
        name: form.name,
        slug: form.slug,
        type: form.type,
        icon: form.icon || null,
        description: form.description || null,
        isActive: form.isActive,
        config,
      }

      if (isNew) {
        await api('/apps', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      } else {
        await api(`/apps/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      }
    },
    onSuccess: () => {
      navigate('/apps')
    },
    onError: (error: Error) => {
      setErrors({ submit: error.message })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    // Validate
    const newErrors: Record<string, string> = {}
    if (!form.name.trim()) newErrors.name = 'Name is required'
    if (!form.slug.trim()) newErrors.slug = 'Slug is required'
    if (!/^[a-z0-9-]+$/.test(form.slug)) newErrors.slug = 'Slug must be lowercase letters, numbers, and hyphens'
    if (!form.config.trim()) newErrors.config = 'Config is required'
    
    try {
      JSON.parse(form.config)
    } catch {
      newErrors.config = 'Invalid JSON'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    saveMutation.mutate()
  }

  const getConfigTemplate = () => {
    switch (form.type) {
      case 'feed':
        return JSON.stringify({
          feed: 'at://did:plc:example/app.bsky.feed.generator/example',
          feedType: 'feed',
          displayMode: 'timeline', // 'timeline' | 'grid' | 'immersive'
          // For immersive mode:
          // immersiveStartPosition: 'top', // 'top' | 'latest' | 'random'
          // autoPlay: true,
        }, null, 2)
      case 'module':
        return JSON.stringify({
          layouts: [
            {
              id: 'main',
              type: 'list',
              title: 'Items',
              dataSource: 'listings',
              fields: [
                { key: 'title', type: 'text' },
                { key: 'price', type: 'currency' },
                { key: 'image', type: 'image' },
              ],
            },
          ],
          dataEndpoints: {
            listings: {
              method: 'GET',
              url: '/api/listings/app/{appId}',
            },
          },
        }, null, 2)
      case 'home':
        return JSON.stringify({
          widgets: [
            { id: 'feed-preview', type: 'feed_preview', appId: 'xxx' },
            { id: 'quick-actions', type: 'quick_actions' },
            { id: 'recent-orders', type: 'recent_orders' },
          ],
          quickActions: [
            { id: 'browse', icon: '🛒', label: 'Browse', action: { type: 'navigate_app', config: { slug: 'marketplace' } } },
          ],
        }, null, 2)
      default:
        return '{}'
    }
  }

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/apps')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? 'Create App' : 'Edit App'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl">
        <div className="bg-white rounded-xl shadow p-6 space-y-6">
          {errors.submit && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
              {errors.submit}
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="Marketplace"
              />
              {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Slug *
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="marketplace"
              />
              {errors.slug && <p className="text-sm text-red-600 mt-1">{errors.slug}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type *
              </label>
              <select
                value={form.type}
                onChange={(e) => {
                  const type = e.target.value as 'feed' | 'module' | 'home'
                  setForm({ ...form, type, config: '' })
                }}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              >
                <option value="feed">Feed (Bluesky Feed)</option>
                <option value="module">Module (Custom Layout)</option>
                <option value="home">Home (Aggregator)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Icon (Emoji)
              </label>
              <input
                type="text"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="🛒"
                maxLength={4}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              rows={2}
              placeholder="A brief description of this app..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Config (JSON) *
              </label>
              <button
                type="button"
                onClick={() => setForm({ ...form, config: getConfigTemplate() })}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Load template
              </button>
            </div>
            <textarea
              value={form.config}
              onChange={(e) => setForm({ ...form, config: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm"
              rows={12}
              placeholder="{}"
            />
            {errors.config && <p className="text-sm text-red-600 mt-1">{errors.config}</p>}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Active (visible in mobile app)
            </label>
          </div>

          <div className="flex items-center gap-4 pt-4 border-t">
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/apps')}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
