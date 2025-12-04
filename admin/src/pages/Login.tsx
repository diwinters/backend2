import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore, api } from '../lib/auth'
import { Loader2, Shield, Lock } from 'lucide-react'

interface LoginResponse {
  token: string
  admin: {
    id: string
    email: string
    name: string
  }
}

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState<'email' | 'password' | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      setAuth(res.token, res.admin)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background gradient - Apple style */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Floating orbs for visual interest */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="glass-dark rounded-3xl p-8 shadow-2xl border border-white/10">
          {/* Logo/Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Admin Console
            </h1>
            <p className="text-white/50 mt-2 text-sm">
              Secure access to platform management
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 text-sm text-red-400 bg-red-500/10 rounded-xl border border-red-500/20 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                {error}
              </div>
            )}

            {/* Email field */}
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                required
                className={`w-full px-4 py-4 bg-white/5 border rounded-xl text-white placeholder-white/30 outline-none transition-all duration-300 ${
                  focused === 'email' 
                    ? 'border-blue-500 bg-white/10 shadow-lg shadow-blue-500/10' 
                    : 'border-white/10 hover:border-white/20'
                }`}
                placeholder="Email address"
                autoComplete="email"
              />
              <div className={`absolute right-4 top-1/2 -translate-y-1/2 transition-opacity duration-200 ${focused === 'email' ? 'opacity-100' : 'opacity-0'}`}>
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              </div>
            </div>

            {/* Password field */}
            <div className="relative">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                required
                className={`w-full px-4 py-4 bg-white/5 border rounded-xl text-white placeholder-white/30 outline-none transition-all duration-300 ${
                  focused === 'password' 
                    ? 'border-blue-500 bg-white/10 shadow-lg shadow-blue-500/10' 
                    : 'border-white/10 hover:border-white/20'
                }`}
                placeholder="Password"
                autoComplete="current-password"
              />
              <div className={`absolute right-4 top-1/2 -translate-y-1/2 transition-opacity duration-200 ${focused === 'password' ? 'opacity-100' : 'opacity-0'}`}>
                <Lock className="w-4 h-4 text-blue-400" />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 focus:ring-4 focus:ring-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-3 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-white/30 text-xs">
              Protected by enterprise-grade security
            </p>
          </div>
        </div>

        {/* Version info */}
        <p className="text-center text-white/20 text-xs mt-6">
          Mini-Apps Platform v1.0
        </p>
      </div>
    </div>
  )
}
