import { create } from 'zustand'
import { getApiClient } from './apiClient.js'
import type { Balance } from '@splitfool/shared'

export interface BalanceTotal {
  currency: string
  owedMinor: number
  oweMinor: number
}

export interface ContextBalance extends Balance {
  groupId: string | null
}

export interface DashboardStats {
  currency: string
  byCategory: Array<{ label: string; value: number }>
  byMonth: Array<{ label: string; value: number }>
  totals: { spentMinor: number; paidMinor: number; expenseCount: number }
}

interface StatsApiResponse {
  currency: string
  totals: { spentMinor: number; paidMinor: number; expenseCount: number }
  byCategory: Array<{ category: string; amountMinor: number }>
  byMonth: Array<{ month: string; spentMinor: number; paidMinor: number }>
}

interface BalanceState {
  /** Per-group or overall balances. */
  balances: Balance[]
  /** Simplified debts for the current group or user. */
  simplifiedDebts: Balance[]
  /** Per-context breakdown when fetching user balances. */
  byContext: ContextBalance[]
  /** Per-currency totals (owedMinor / oweMinor) when fetching user balances. */
  totals: BalanceTotal[]
  /** Aggregated spending analytics from /api/stats. */
  stats: DashboardStats | null
  loading: boolean
  error: string | null

  fetchBalances: (groupId?: string) => Promise<void>
  fetchStats: (params?: { groupId?: string; currency?: string }) => Promise<void>
  clearError: () => void
  reset: () => void
}

const initialState = {
  balances: [],
  simplifiedDebts: [],
  byContext: [],
  totals: [],
  stats: null,
  loading: false,
  error: null,
}

export const useBalanceStore = create<BalanceState>((set) => ({
  ...initialState,

  fetchBalances: async (groupId?: string) => {
    set({ loading: true, error: null })
    try {
      const api = getApiClient()
      const url = groupId ? `/api/groups/${groupId}/balances` : '/api/balances'
      const data = await api.get<{
        balances: Balance[]
        simplified: Balance[]
        byContext?: ContextBalance[]
        totals?: BalanceTotal[]
      }>(url)
      set({
        balances: data.balances ?? [],
        simplifiedDebts: data.simplified ?? [],
        byContext: data.byContext ?? [],
        totals: data.totals ?? [],
        loading: false,
      })
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
    }
  },

  fetchStats: async (params) => {
    try {
      const api = getApiClient()
      const search = new URLSearchParams()
      if (params?.groupId) search.set('groupId', params.groupId)
      if (params?.currency) search.set('currency', params.currency)
      const qs = search.toString()
      const res = await api.get<StatsApiResponse>(`/api/stats${qs ? `?${qs}` : ''}`)

      const byCategory = (res.byCategory ?? []).map((c) => ({
        label: c.category,
        value: c.amountMinor,
      }))

      const byMonth = (res.byMonth ?? []).slice(-6).map((m) => {
        const parts = m.month.split('-')
        let label = m.month
        if (parts.length === 2) {
          const d = new Date(Date.UTC(parseInt(parts[0]!, 10), parseInt(parts[1]!, 10) - 1, 1))
          label = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
        }
        return { label, value: m.spentMinor }
      })

      set({
        stats: {
          currency: res.currency,
          byCategory,
          byMonth,
          totals: res.totals ?? { spentMinor: 0, paidMinor: 0, expenseCount: 0 },
        },
      })
    } catch (err) {
      set({ error: (err as Error).message })
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}))
