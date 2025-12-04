import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../lib/auth'
import {
  ArrowLeft,
  Save,
  Loader2,
  Layers,
  Code2,
  FileJson,
  Sparkles,
  Info,
  CheckCircle,
  AlertCircle,
  Zap,
  Layout,
  Rss,
  Home,
  ToggleLeft,
  ToggleRight,
  Copy,
  Eye
} from 'lucide-react'

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
  const [jsonValid, setJsonValid] = useState(true)
  const [copied, setCopied] = useState(false)

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

  // Validate JSON as user types
  useEffect(() => {
    if (!form.config.trim()) {
      setJsonValid(true)
      return
    }
    try {
      JSON.parse(form.config)
      setJsonValid(true)
    } catch {
      setJsonValid(false)
    }
  }, [form.config])

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
          displayMode: 'timeline',
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

  const copyConfig = () => {
    navigator.clipboard.writeText(form.config)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const typeConfig = {
    feed: { icon: Rss, color: 'from-blue-500 to-cyan-500', label: 'Feed', desc: 'Display Bluesky feed content' },
    module: { icon: Layout, color: 'from-purple-500 to-pink-500', label: 'Module', desc: 'Custom layout with data sources' },
    home: { icon: Home, color: 'from-amber-500 to-orange-500', label: 'Home', desc: 'Aggregator with widgets' }
  }

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center h-64 animate-fade-in">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[var(--accent-primary)] mx-auto mb-3" />
          <p className="text-[var(--text-secondary)]">Loading app configuration...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/apps')}
            className="p-2.5 rounded-xl glass hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                {isNew ? 'Create App' : 'Edit App'}
              </h1>
            </div>
            <p className="text-[var(--text-secondary)] ml-[52px]">
              {isNew ? 'Configure a new mini-app for your platform' : `Editing ${app?.name || 'app'}`}
            </p>
          </div>
        </div>

        {/* Preview Badge */}
        {!isNew && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--bg-tertiary)]">
            <Eye className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-sm text-[var(--text-secondary)]">ID: {id?.slice(0, 8)}...</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error Alert */}
        {errors.submit && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 animate-fade-in">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* Basic Info Card */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[var(--border-primary)] flex items-center gap-2">
            <Info className="w-4 h-4 text-[var(--text-tertiary)]" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">Basic Information</span>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              {/* Name Field */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`w-full px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border ${
                    errors.name ? 'border-red-500' : 'border-[var(--border-primary)]'
                  } text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all`}
                  placeholder="Marketplace"
                />
                {errors.name && (
                  <p className="text-sm text-red-500 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Slug Field */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Slug <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]">/</span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    className={`w-full pl-8 pr-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border ${
                      errors.slug ? 'border-red-500' : 'border-[var(--border-primary)]'
                    } text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all font-mono`}
                    placeholder="marketplace"
                  />
                </div>
                {errors.slug && (
                  <p className="text-sm text-red-500 mt-1.5 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {errors.slug}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Icon Field */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Icon (Emoji)
                </label>
                <div className="flex gap-3">
                  <div className="w-14 h-14 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] flex items-center justify-center text-2xl">
                    {form.icon || '📱'}
                  </div>
                  <input
                    type="text"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all text-center text-xl"
                    placeholder="🛒"
                    maxLength={4}
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Status
                </label>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, isActive: !form.isActive })}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    form.isActive
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                      : 'bg-[var(--bg-tertiary)] border-[var(--border-primary)] text-[var(--text-secondary)]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {form.isActive ? (
                      <>
                        <Zap className="w-4 h-4" />
                        Active & Visible
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-4 h-4" />
                        Inactive
                      </>
                    )}
                  </span>
                  {form.isActive ? (
                    <ToggleRight className="w-6 h-6" />
                  ) : (
                    <ToggleLeft className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)] outline-none transition-all resize-none"
                rows={2}
                placeholder="A brief description of this app..."
              />
            </div>
          </div>
        </div>

        {/* Type Selection Card */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[var(--border-primary)] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--text-tertiary)]" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">App Type</span>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-3 gap-4">
              {(['feed', 'module', 'home'] as const).map(type => {
                const config = typeConfig[type]
                const Icon = config.icon
                const isSelected = form.type === type
                
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setForm({ ...form, type, config: '' })}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                        : 'border-[var(--border-primary)] hover:border-[var(--text-tertiary)]'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center mb-3`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <h4 className={`font-medium mb-1 ${isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-primary)]'}`}>
                      {config.label}
                    </h4>
                    <p className="text-xs text-[var(--text-tertiary)]">{config.desc}</p>
                    {isSelected && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-[var(--accent-primary)]">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Selected
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Config Editor Card */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-[var(--text-tertiary)]" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">Configuration (JSON)</span>
              {form.config && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  jsonValid 
                    ? 'bg-emerald-500/10 text-emerald-600' 
                    : 'bg-red-500/10 text-red-500'
                }`}>
                  {jsonValid ? 'Valid' : 'Invalid'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyConfig}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, config: getConfigTemplate() })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 transition-colors"
              >
                <Code2 className="w-3.5 h-3.5" />
                Load Template
              </button>
            </div>
          </div>
          
          <div className="relative">
            <textarea
              value={form.config}
              onChange={(e) => setForm({ ...form, config: e.target.value })}
              className={`w-full px-4 py-4 bg-[#1e1e2e] text-[#cdd6f4] font-mono text-sm focus:outline-none resize-none ${
                errors.config ? 'ring-2 ring-red-500' : ''
              }`}
              rows={14}
              placeholder='{"key": "value"}'
              spellCheck={false}
            />
            {errors.config && (
              <p className="absolute bottom-3 left-4 text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.config}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={() => navigate('/apps')}
            className="px-5 py-2.5 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={saveMutation.isPending || !jsonValid}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/25"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isNew ? 'Create App' : 'Save Changes'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
