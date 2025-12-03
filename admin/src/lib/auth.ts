import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Admin {
  id: string
  email: string
  name: string
  role: string
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
      setAuth: (token, admin) => set({ token, admin }),
      logout: () => set({ token: null, admin: null }),
      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'admin-auth',
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
    window.location.href = '/admin/login'
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
