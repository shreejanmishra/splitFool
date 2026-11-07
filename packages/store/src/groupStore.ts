import { create } from 'zustand'
import { getApiClient } from './apiClient.js'
import type { CreateGroupInput } from '@splitfool/shared'

export interface GroupMember {
  userId: string
  name: string
  email: string
  avatar?: string
  role: 'admin' | 'member'
}

export interface Group {
  _id: string
  name: string
  type: string
  defaultCurrency: string
  simplifyDebts: boolean
  members: GroupMember[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface GroupState {
  groups: Group[]
  currentGroup: Group | null
  loading: boolean
  error: string | null

  fetchGroups: () => Promise<void>
  fetchGroup: (id: string) => Promise<void>
  createGroup: (input: CreateGroupInput) => Promise<Group>
  setCurrentGroup: (group: Group | null) => void
  clearError: () => void
  reset: () => void
}

const initialState = { groups: [], currentGroup: null, loading: false, error: null }

export const useGroupStore = create<GroupState>((set) => ({
  ...initialState,

  fetchGroups: async () => {
    set({ loading: true, error: null })
    try {
      const api = getApiClient()
      const data = await api.get<{ groups: Group[] }>('/api/groups')
      set({ groups: data.groups, loading: false })
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  fetchGroup: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const api = getApiClient()
      const data = await api.get<{ group: Group }>(`/api/groups/${id}`)
      set({ currentGroup: data.group, loading: false })
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  createGroup: async (input: CreateGroupInput) => {
    const api = getApiClient()
    const data = await api.post<{ group: Group }>('/api/groups', input)
    set((state) => ({ groups: [data.group, ...state.groups] }))
    return data.group
  },

  setCurrentGroup: (group) => set({ currentGroup: group }),
  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}))
