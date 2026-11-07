import type { Balance } from './types.js'

/** Minimal shape needed for balance math. Settlements can be expressed this way too. */
export interface LedgerEntry {
  payers: Array<{ userId: string; amountMinor: number }>
  splits: Array<{ userId: string; amountMinor: number }>
  currency: string
}

/**
 * Split an integer amount across weights using the largest-remainder method.
 * The result always sums to exactly `amount`. Ties go to the earlier index.
 */
export function allocateProportionally(amount: number, weights: number[]): number[] {
  const total = weights.reduce((s, w) => s + w, 0)
  if (total <= 0) return weights.map(() => 0)

  const raw = weights.map((w, i) => {
    const exact = (amount * w) / total
    return { i, exact, floor: Math.floor(exact) }
  })
  let remainder = amount - raw.reduce((s, r) => s + r.floor, 0)
  const order = [...raw].sort((a, b) => b.exact - b.floor - (a.exact - a.floor) || a.i - b.i)
  for (const r of order) {
    if (remainder <= 0) break
    r.floor++
    remainder--
  }
  return raw.map((r) => r.floor)
}

/**
 * Exact net position per user per currency.
 * Positive = the user is owed money, negative = the user owes money.
 * Returned as currency → (userId → netMinor). Zero entries are dropped.
 */
export function computeNetPositions(entries: LedgerEntry[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>()
  for (const e of entries) {
    let net = out.get(e.currency)
    if (!net) out.set(e.currency, (net = new Map()))
    for (const p of e.payers) net.set(p.userId, (net.get(p.userId) ?? 0) + p.amountMinor)
    for (const s of e.splits) net.set(s.userId, (net.get(s.userId) ?? 0) - s.amountMinor)
  }
  for (const [currency, net] of out) {
    for (const [userId, v] of net) if (v === 0) net.delete(userId)
    if (net.size === 0) out.delete(currency)
  }
  return out
}

/**
 * Greedy minimum-cash-flow on exact net positions for a single currency.
 * Repeatedly settles the largest debtor against the largest creditor,
 * producing at most N−1 transfers.
 */
export function simplifyNet(net: Map<string, number>, currency: string): Balance[] {
  const creditors: Array<{ userId: string; amount: number }> = []
  const debtors: Array<{ userId: string; amount: number }> = []
  for (const [userId, amount] of net) {
    if (amount > 0) creditors.push({ userId, amount })
    else if (amount < 0) debtors.push({ userId, amount: -amount })
  }
  // Deterministic ordering: amount desc, then id asc
  const cmp = (a: { userId: string; amount: number }, b: { userId: string; amount: number }) =>
    b.amount - a.amount || (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)
  creditors.sort(cmp)
  debtors.sort(cmp)

  const result: Balance[] = []
  let ci = 0
  let di = 0
  while (ci < creditors.length && di < debtors.length) {
    const creditor = creditors[ci]!
    const debtor = debtors[di]!
    const settled = Math.min(creditor.amount, debtor.amount)
    if (settled > 0) {
      result.push({ from: debtor.userId, to: creditor.userId, amountMinor: settled, currency })
    }
    creditor.amount -= settled
    debtor.amount -= settled
    if (creditor.amount === 0) ci++
    if (debtor.amount === 0) di++
  }
  return result
}

/**
 * Simplify debts within a group for a single currency.
 *
 * @param debts  Array of individual debts (from → to, amountMinor)
 * @param currency  Currency code for the output
 * @returns Simplified set of debts (at most N−1 transfers)
 */
export function simplifyDebts(debts: Balance[], currency: string): Balance[] {
  if (debts.length === 0) return []
  const net = new Map<string, number>()
  for (const d of debts) {
    net.set(d.from, (net.get(d.from) ?? 0) - d.amountMinor)
    net.set(d.to, (net.get(d.to) ?? 0) + d.amountMinor)
  }
  return simplifyNet(net, currency)
}

/**
 * Compute raw (non-simplified) pairwise balances from a list of expenses.
 *
 * Each split recipient's share is allocated across payers in proportion to
 * what each payer paid, using largest-remainder so no cents are lost or created.
 * Bidirectional debts between the same pair are netted.
 */
export function computeBalances(expenses: LedgerEntry[]): Balance[] {
  // Key: `${from}|${to}|${currency}` → accumulated amount
  const map = new Map<string, number>()

  for (const expense of expenses) {
    const weights = expense.payers.map((p) => p.amountMinor)
    if (weights.reduce((s, w) => s + w, 0) === 0) continue

    for (const split of expense.splits) {
      const parts = allocateProportionally(split.amountMinor, weights)
      expense.payers.forEach((payer, i) => {
        const owed = parts[i]!
        if (owed === 0 || payer.userId === split.userId) return
        const key = `${split.userId}|${payer.userId}|${expense.currency}`
        map.set(key, (map.get(key) ?? 0) + owed)
      })
    }
  }

  // Net out bidirectional debts
  const netted = new Map<string, Balance>()
  for (const [key, amount] of map) {
    const [from, to, currency] = key.split('|') as [string, string, string]
    const reverseKey = `${to}|${from}|${currency}`
    const existing = netted.get(reverseKey)

    if (existing) {
      if (amount > existing.amountMinor) {
        netted.delete(reverseKey)
        netted.set(key, { from, to, amountMinor: amount - existing.amountMinor, currency })
      } else if (amount < existing.amountMinor) {
        existing.amountMinor -= amount
      } else {
        netted.delete(reverseKey)
      }
    } else {
      netted.set(key, { from, to, amountMinor: amount, currency })
    }
  }

  return [...netted.values()].filter((b) => b.amountMinor > 0)
}
