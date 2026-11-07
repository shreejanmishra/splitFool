import { create } from 'zustand'
import { getApiClient } from './apiClient.js'

export interface AuthUser {
  _id: string
  name: string
  email: string
  avatar?: string
  defaultCurrency: string
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null

  /** Fetch the current user from /api/auth/me. */
  fetchMe: () => Promise<void>
  /** Dev-only: log in with email/name. */
  devLogin: (email: string, name: string) => Promise<void>
  /** Log out and clear state. */
  logout: () => Promise<void>
  /** Log out all sessions. */
  logoutAll: () => Promise<void>
  /** Clear the error. */
  clearError: () => void
  /** Reset the store. */
  reset: () => void
}

const initialState = { user: null, loading: false, error: null }

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,

  fetchMe: async () => {
    set({ loading: true, error: null })
    try {
      const api = getApiClient()
      const data = await api.get<{ user: AuthUser }>('/api/auth/me')
      set({ user: data.user, loading: false })
    } catch (err) {
      set({ user: null, loading: false, error: (err as Error).message })
    }
  },

  devLogin: async (email: string, name: string) => {
    set({ loading: true, error: null })
    try {
      const api = getApiClient()
      await api.post('/api/auth/dev/login', { email, name })
      const data = await api.get<{ user: AuthUser }>('/api/auth/me')
      set({ user: data.user, loading: false })
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
      throw err
    }
  },

  logout: async () => {
    try {
      const api = getApiClient()
      await api.post('/api/auth/logout')
    } catch {
      // Ignore errors on logout
    }
    set(initialState)
  },

  logoutAll: async () => {
    try {
      const api = getApiClient()
      await api.post('/api/auth/logout-all')
    } catch {
      // Ignore
    }
    set(initialState)
  },

  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}))
