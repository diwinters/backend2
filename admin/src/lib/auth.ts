import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Admin {
  id: string
  email: string
  name: string
  role?: string
}

interface AuthState {
  token: string | null
  admin: Admin | null
  setAuth: (token: string, admin: Admin) => void
  logout: () => void
  isAuthenticated: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      admin: null,
      setAuth: (token, admin) => {
        console.log('[AUTH STORE] setAuth called with:', { 
          tokenLength: token?.length, 
          admin: admin?.email 
        })
        set({ token, admin })
        console.log('[AUTH STORE] State after set:', { 
          hasToken: !!get().token, 
          hasAdmin: !!get().admin 
        })
        // Force save to localStorage
        try {
          localStorage.setItem('admin-auth', JSON.stringify({ state: { token, admin }, version: 0 }))
          console.log('[AUTH STORE] Manually saved to localStorage')
        } catch (e) {
          console.error('[AUTH STORE] Failed to save to localStorage:', e)
        }
      },
      logout: () => {
        console.log('[AUTH STORE] logout called')
        set({ token: null, admin: null })
        localStorage.removeItem('admin-auth')
      },
      isAuthenticated: () => {
        const result = !!get().token
        console.log('[AUTH STORE] isAuthenticated check:', result, 'token:', get().token?.substring(0, 20))
        return result
      },
    }),
    {
      name: 'admin-auth',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          console.log('[STORAGE] getItem:', name, str ? 'found' : 'not found')
          return str
        },
        setItem: (name, value) => {
          console.log('[STORAGE] setItem:', name, 'value length:', value.length)
          localStorage.setItem(name, value)
        },
        removeItem: (name) => {
          console.log('[STORAGE] removeItem:', name)
          localStorage.removeItem(name)
        },
      },
      onRehydrateStorage: () => (state) => {
        console.log('[AUTH STORE] Rehydrated from localStorage:', {
          hasToken: !!state?.token,
          hasAdmin: !!state?.admin,
          tokenPreview: state?.token?.substring(0, 20)
        })
      },
    }
  )
)

// API helper with auth
export async function api<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token

  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    useAuthStore.getState().logout()
    if (typeof window !== 'undefined') {
      window.location.href = '/admin/login'
    }
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.error || 'Request failed')
  }

  if (res.status === 204) {
    return {} as T
  }

  return res.json()
}
