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
      },
      logout: () => {
        console.log('[AUTH STORE] logout called')
        set({ token: null, admin: null })
      },
      isAuthenticated: () => {
        const result = !!get().token
        console.log('[AUTH STORE] isAuthenticated check:', result, 'token:', get().token?.substring(0, 20))
        return result
      },
    }),
    {
      name: 'admin-auth',
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
