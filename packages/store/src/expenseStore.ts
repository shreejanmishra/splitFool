import { create } from 'zustand'
import { getApiClient } from './apiClient.js'
import type { CreateExpenseInput, SplitMethod, Participant } from '@splitfool/shared'

export interface Expense {
  _id: string
  groupId?: string
  description: string
  category: string
  currency: string
  amountMinor: number
  date: string
  payers: Participant[]
  splits: Participant[]
  splitMethod: SplitMethod
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface ExpenseState {
  expenses: Expense[]
  loading: boolean
  error: string | null
  cursor: string | null
  hasMore: boolean

  fetchExpenses: (groupId?: string, cursor?: string) => Promise<void>
  createExpense: (input: CreateExpenseInput) => Promise<Expense>
  deleteExpense: (id: string) => Promise<void>
  clearError: () => void
  reset: () => void
}

const initialState = { expenses: [], loading: false, error: null, cursor: null, hasMore: true }

export const useExpenseStore = create<ExpenseState>((set) => ({
  ...initialState,

  fetchExpenses: async (groupId?: string, cursor?: string) => {
    set({ loading: true, error: null })
    try {
      const api = getApiClient()
      const params = new URLSearchParams()
      if (groupId) params.set('groupId', groupId)
      if (cursor) params.set('cursor', cursor)
      const url = `/api/expenses?${params.toString()}`
      const data = await api.get<{ expenses: Expense[]; cursor: string | null; hasMore: boolean }>(url)

      set((state) => ({
        expenses: cursor ? [...state.expenses, ...data.expenses] : data.expenses,
        cursor: data.cursor,
        hasMore: data.hasMore,
        loading: false,
      }))
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  createExpense: async (input: CreateExpenseInput) => {
    const api = getApiClient()
    const data = await api.post<{ expense: Expense }>('/api/expenses', input)
    set((state) => ({ expenses: [data.expense, ...state.expenses] }))
    return data.expense
  },

  deleteExpense: async (id: string) => {
    const api = getApiClient()
    await api.delete(`/api/expenses/${id}`)
    set((state) => ({ expenses: state.expenses.filter((e) => e._id !== id) }))
  },

  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}))
