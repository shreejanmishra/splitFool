import type { Types } from 'mongoose'
import {
  computeBalances,
  computeNetPositions,
  simplifyNet,
  type Balance,
  type LedgerEntry,
} from '@splitfool/shared'
import { Expense, Group, Settlement } from '../models/index.js'

type Id = Types.ObjectId | string

interface LeanExpense {
  groupId?: Types.ObjectId
  currency: string
  payers: Array<{ userId: Types.ObjectId; amountMinor: number }>
  splits: Array<{ userId: Types.ObjectId; amountMinor: number }>
}
interface LeanSettlement {
  groupId?: Types.ObjectId
  from: Types.ObjectId
  to: Types.ObjectId
  amountMinor: number
  currency: string
}

const EXPENSE_LEDGER_FIELDS = 'groupId currency payers splits'
const SETTLEMENT_LEDGER_FIELDS = 'groupId from to amountMinor currency'

function expenseEntry(e: LeanExpense): LedgerEntry {
  return {
    currency: e.currency,
    payers: e.payers.map((p) => ({ userId: p.userId.toString(), amountMinor: p.amountMinor })),
    splits: e.splits.map((s) => ({ userId: s.userId.toString(), amountMinor: s.amountMinor })),
  }
}

/** A settlement "from → to" is equivalent to an expense paid by `from` entirely for `to`. */
function settlementEntry(s: LeanSettlement): LedgerEntry {
  return {
    currency: s.currency,
    payers: [{ userId: s.from.toString(), amountMinor: s.amountMinor }],
    splits: [{ userId: s.to.toString(), amountMinor: s.amountMinor }],
  }
}

export interface NetPosition {
  userId: string
  currency: string
  /** Positive = owed money, negative = owes money. */
  amountMinor: number
}

function flattenNet(net: Map<string, Map<string, number>>): NetPosition[] {
  const out: NetPosition[] = []
  for (const [currency, m] of net) for (const [userId, amountMinor] of m) out.push({ userId, currency, amountMinor })
  return out
}

/** Debts within one context (a group, or all non-group expenses), honoring the simplify setting. */
function contextDebts(entries: LedgerEntry[], simplify: boolean): { raw: Balance[]; simplified: Balance[]; net: Map<string, Map<string, number>> } {
  const raw = computeBalances(entries)
  const net = computeNetPositions(entries)
  const simplified = simplify ? [...net].flatMap(([currency, m]) => simplifyNet(m, currency)) : raw
  return { raw, simplified, net }
}

// ─── Group ─────────────────────────────────────────────────────────────────────

async function groupEntries(groupIds: Id[]): Promise<Map<string, LedgerEntry[]>> {
  const [expenses, settlements] = await Promise.all([
    Expense.find({ groupId: { $in: groupIds }, deletedAt: null }).select(EXPENSE_LEDGER_FIELDS).lean<LeanExpense[]>(),
    Settlement.find({ groupId: { $in: groupIds }, deletedAt: null }).select(SETTLEMENT_LEDGER_FIELDS).lean<LeanSettlement[]>(),
  ])
  const byGroup = new Map<string, LedgerEntry[]>()
  const push = (gid: Types.ObjectId | undefined, entry: LedgerEntry) => {
    if (!gid) return
    const key = gid.toString()
    const list = byGroup.get(key)
    if (list) list.push(entry)
    else byGroup.set(key, [entry])
  }
  for (const e of expenses) push(e.groupId, expenseEntry(e))
  for (const s of settlements) push(s.groupId, settlementEntry(s))
  return byGroup
}

export interface GroupBalances {
  /** Raw pairwise debts (who owes whom from the expenses directly). */
  balances: Balance[]
  /** Suggested repayments: simplified if the group has simplifyDebts on, otherwise the raw debts. */
  simplified: Balance[]
  /** Each member's net position per currency. */
  net: NetPosition[]
}

export async function groupBalances(group: { _id: Id; simplifyDebts: boolean }): Promise<GroupBalances> {
  const entries = (await groupEntries([group._id])).get(group._id.toString()) ?? []
  const { raw, simplified, net } = contextDebts(entries, group.simplifyDebts)
  return { balances: raw, simplified, net: flattenNet(net) }
}

/** True if the user is owed or owes anything in the group, in any currency. */
export async function hasOpenGroupBalance(groupId: Id, userId: string): Promise<boolean> {
  const entries = (await groupEntries([groupId])).get(groupId.toString()) ?? []
  for (const m of computeNetPositions(entries).values()) if (m.has(userId)) return true
  return false
}

// ─── User (across all groups and friends) ──────────────────────────────────────

export interface ContextBalance extends Balance {
  /** Group id, or null for non-group expenses between friends. */
  groupId: string | null
}

export interface UserBalances {
  /** Debts involving the user, netted per friend per currency across all contexts. */
  balances: Balance[]
  /** Same as balances (kept for client compatibility). */
  simplified: Balance[]
  /** Per-context breakdown (for "in group X you owe Y"). */
  byContext: ContextBalance[]
  /** Totals per currency. */
  totals: Array<{ currency: string; owedMinor: number; oweMinor: number }>
}

/**
 * Balances for one user, Splitwise-style:
 * - Inside each group, use the group's suggested repayments (simplified if enabled),
 *   so that "settle up" payments to a different member line up correctly.
 * - Outside groups, use raw pairwise debts.
 * Then net everything per (friend, currency).
 */
export async function userBalances(userId: string): Promise<UserBalances> {
  const [myExpenses, mySettlements, memberGroups] = await Promise.all([
    Expense.find({ participantIds: userId, deletedAt: null })
      .select(EXPENSE_LEDGER_FIELDS)
      .lean<LeanExpense[]>(),
    Settlement.find({
      $or: [{ from: userId }, { to: userId }],
      deletedAt: null,
    })
      .select(SETTLEMENT_LEDGER_FIELDS)
      .lean<LeanSettlement[]>(),
    Group.find({ 'members.userId': userId, deletedAt: null }).select('_id').lean(),
  ])

  const groupIdSet = new Set<string>([
    ...myExpenses.map((e) => e.groupId).filter(Boolean).map(String),
    ...mySettlements.map((s) => s.groupId).filter(Boolean).map(String),
    ...memberGroups.map((g) => g._id.toString()),
  ])
  const groupIds = [...groupIdSet]
  const [groups, entriesByGroup] = await Promise.all([
    Group.find({ _id: { $in: groupIds } }).select('simplifyDebts').lean(),
    groupEntries(groupIds),
  ])

  const byContext: ContextBalance[] = []
  const involvesMe = (b: Balance) => b.from === userId || b.to === userId

  for (const g of groups) {
    const entries = entriesByGroup.get(g._id.toString()) ?? []
    const { simplified } = contextDebts(entries, g.simplifyDebts)
    for (const b of simplified) if (involvesMe(b)) byContext.push({ ...b, groupId: g._id.toString() })
  }

  const nonGroup = [
    ...myExpenses.filter((e) => !e.groupId).map(expenseEntry),
    ...mySettlements.filter((s) => !s.groupId).map(settlementEntry),
  ]
  for (const b of computeBalances(nonGroup)) if (involvesMe(b)) byContext.push({ ...b, groupId: null })

  // Net per (friend, currency): positive = friend owes me.
  const perFriend = new Map<string, number>()
  for (const b of byContext) {
    const friend = b.from === userId ? b.to : b.from
    const sign = b.to === userId ? 1 : -1
    const key = `${friend}|${b.currency}`
    perFriend.set(key, (perFriend.get(key) ?? 0) + sign * b.amountMinor)
  }

  const balances: Balance[] = []
  const totalsMap = new Map<string, { owedMinor: number; oweMinor: number }>()
  for (const [key, amount] of perFriend) {
    if (amount === 0) continue
    const [friend, currency] = key.split('|') as [string, string]
    balances.push(
      amount > 0
        ? { from: friend, to: userId, amountMinor: amount, currency }
        : { from: userId, to: friend, amountMinor: -amount, currency },
    )
    const t = totalsMap.get(currency) ?? { owedMinor: 0, oweMinor: 0 }
    if (amount > 0) t.owedMinor += amount
    else t.oweMinor += -amount
    totalsMap.set(currency, t)
  }

  return {
    balances,
    simplified: balances,
    byContext,
    totals: [...totalsMap].map(([currency, t]) => ({ currency, ...t })),
  }
}

/** Net balance between the user and one friend, per currency (positive = friend owes user). */
export function balanceWithFriend(ub: UserBalances, friendId: string): Array<{ currency: string; amountMinor: number }> {
  return ub.balances
    .filter((b) => b.from === friendId || b.to === friendId)
    .map((b) => ({ currency: b.currency, amountMinor: b.to === friendId ? -b.amountMinor : b.amountMinor }))
}
