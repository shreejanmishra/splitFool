import type { Types } from 'mongoose'
import type { StatsQuery } from '@splitfool/shared'
import { Expense, User } from '../models/index.js'
import { loadGroupForMember } from './access.js'
import { convertWith, getRates } from './fx.js'

interface LeanStatExpense {
  _id: Types.ObjectId
  category: string
  currency: string
  amountMinor: number
  date: Date
  payers: Array<{ userId: Types.ObjectId; amountMinor: number }>
  splits: Array<{ userId: Types.ObjectId; amountMinor: number }>
}

export interface Stats {
  currency: string
  scope: 'personal' | 'group'
  range: { from: string; to: string }
  totals: { spentMinor: number; paidMinor: number; expenseCount: number }
  byCategory: Array<{ category: string; amountMinor: number }>
  byMonth: Array<{ month: string; spentMinor: number; paidMinor: number }>
  /** Group scope only: what each member paid vs. their share. */
  byMember: Array<{ userId: string; paidMinor: number; shareMinor: number }>
  /** Expenses skipped because no FX rate was available for their currency. */
  excludedCount: number
}

const monthKey = (d: Date) => d.toISOString().slice(0, 7)

/**
 * Spending stats for charts.
 * - Personal scope: the user's own share (what they consumed) and what they paid.
 * - Group scope: group totals, plus per-member paid/share.
 * Amounts are converted to one display currency using today's rates.
 */
export async function computeStats(userId: string, q: StatsQuery): Promise<Stats> {
  const to = q.to ?? new Date()
  const from = q.from ?? new Date(Date.UTC(to.getUTCFullYear() - 1, to.getUTCMonth() + 1, 1))

  let currency = q.currency
  const filter: Record<string, unknown> = { deletedAt: null, date: { $gte: from, $lte: to } }
  let scope: Stats['scope'] = 'personal'

  if (q.groupId) {
    const group = await loadGroupForMember(q.groupId, userId)
    filter.groupId = group._id
    currency ??= group.defaultCurrency
    scope = 'group'
  } else {
    filter.participantIds = userId
  }
  currency ??= (await User.findById(userId).select('defaultCurrency').lean())?.defaultCurrency ?? 'INR'

  const expenses = await Expense.find(filter)
    .select('category currency amountMinor date payers splits')
    .sort({ date: 1 })
    .limit(20_000)
    .lean<LeanStatExpense[]>()

  const needsFx = expenses.some((e) => e.currency !== currency)
  const rates = needsFx ? await getRates(currency) : null

  const cat = new Map<string, number>()
  const month = new Map<string, { spentMinor: number; paidMinor: number }>()
  const member = new Map<string, { paidMinor: number; shareMinor: number }>()
  let spent = 0
  let paid = 0
  let count = 0
  let excluded = 0

  for (const e of expenses) {
    const conv = (v: number) => convertWith(rates, v, e.currency, currency!)
    if (conv(1_000_000) === null) {
      excluded++
      continue
    }
    count++
    const mine = (list: LeanStatExpense['splits']) =>
      list.filter((p) => p.userId.toString() === userId).reduce((s, p) => s + p.amountMinor, 0)

    const spentHere = conv(scope === 'group' ? e.amountMinor : mine(e.splits))!
    const paidHere = conv(scope === 'group' ? e.amountMinor : mine(e.payers))!

    spent += spentHere
    paid += paidHere
    cat.set(e.category, (cat.get(e.category) ?? 0) + spentHere)
    const m = month.get(monthKey(e.date)) ?? { spentMinor: 0, paidMinor: 0 }
    m.spentMinor += spentHere
    m.paidMinor += paidHere
    month.set(monthKey(e.date), m)

    if (scope === 'group') {
      for (const p of e.payers) {
        const row = member.get(p.userId.toString()) ?? { paidMinor: 0, shareMinor: 0 }
        row.paidMinor += conv(p.amountMinor)!
        member.set(p.userId.toString(), row)
      }
      for (const s of e.splits) {
        const row = member.get(s.userId.toString()) ?? { paidMinor: 0, shareMinor: 0 }
        row.shareMinor += conv(s.amountMinor)!
        member.set(s.userId.toString(), row)
      }
    }
  }

  // Fill empty months so line charts have a continuous x-axis.
  const months: Stats['byMonth'] = []
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1))
  while (cursor <= to && months.length < 120) {
    const key = monthKey(cursor)
    months.push({ month: key, ...(month.get(key) ?? { spentMinor: 0, paidMinor: 0 }) })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return {
    currency,
    scope,
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: { spentMinor: spent, paidMinor: paid, expenseCount: count },
    byCategory: [...cat]
      .map(([category, amountMinor]) => ({ category, amountMinor }))
      .filter((c) => c.amountMinor > 0)
      .sort((a, b) => b.amountMinor - a.amountMinor),
    byMonth: months,
    byMember: [...member].map(([uid, v]) => ({ userId: uid, ...v })),
    excludedCount: excluded,
  }
}
