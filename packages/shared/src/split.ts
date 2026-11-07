import type { Participant, SplitMethod } from './types.js'
import { allocateProportionally } from './debt.js'

/**
 * Calculate splits for an expense.
 *
 * All money is in integer minor units (cents/paise).
 * When a split doesn't divide evenly, leftover units are distributed
 * one-at-a-time to participants in order, so totals always add up exactly.
 *
 * @param totalMinor   Total amount in minor units
 * @param userIds      Participant user IDs
 * @param method       How to split
 * @param values       Per-user values (exact amounts, percentages, or share counts).
 *                     Not needed for 'equal'.
 * @returns Array of Participants with their amountMinor
 */
export function calculateSplit(
  totalMinor: number,
  userIds: string[],
  method: SplitMethod,
  values?: Record<string, number>,
): Participant[] {
  if (userIds.length === 0) throw new Error('At least one participant is required')
  if (totalMinor < 0) throw new Error('Total cannot be negative')
  if (!Number.isInteger(totalMinor)) throw new Error('Total must be an integer (minor units)')

  switch (method) {
    case 'equal':
      return splitEqual(totalMinor, userIds)
    case 'exact':
      return splitExact(totalMinor, userIds, values ?? {})
    case 'percent':
      return splitPercent(totalMinor, userIds, values ?? {})
    case 'shares':
      return splitShares(totalMinor, userIds, values ?? {})
    default:
      throw new Error(`Unknown split method: ${method}`)
  }
}

function splitEqual(totalMinor: number, userIds: string[]): Participant[] {
  const n = userIds.length
  const base = Math.floor(totalMinor / n)
  let remainder = totalMinor - base * n

  return userIds.map((userId) => ({
    userId,
    amountMinor: base + (remainder-- > 0 ? 1 : 0),
  }))
}

function splitExact(
  totalMinor: number,
  userIds: string[],
  values: Record<string, number>,
): Participant[] {
  const result: Participant[] = userIds.map((userId) => {
    const amount = values[userId]
    if (amount === undefined) throw new Error(`Missing exact amount for user ${userId}`)
    if (!Number.isInteger(amount)) throw new Error(`Exact amount must be integer for user ${userId}`)
    return { userId, amountMinor: amount }
  })

  const sum = result.reduce((acc, p) => acc + p.amountMinor, 0)
  if (sum !== totalMinor) {
    throw new Error(`Exact split sum (${sum}) does not equal total (${totalMinor})`)
  }

  return result
}

function splitPercent(
  totalMinor: number,
  userIds: string[],
  values: Record<string, number>,
): Participant[] {
  let totalPercent = 0
  for (const userId of userIds) {
    const pct = values[userId]
    if (pct === undefined || pct < 0) throw new Error(`Missing or negative percent for user ${userId}`)
    totalPercent += pct
  }
  if (Math.abs(totalPercent - 100) > 0.01) {
    throw new Error(`Percentages must sum to 100, got ${totalPercent}`)
  }

  const weights = userIds.map((userId) => values[userId]!)
  const amounts = allocateProportionally(totalMinor, weights)
  return userIds.map((userId, i) => ({ userId, amountMinor: amounts[i]! }))
}

function splitShares(
  totalMinor: number,
  userIds: string[],
  values: Record<string, number>,
): Participant[] {
  let totalShares = 0
  for (const userId of userIds) {
    const share = values[userId]
    if (share === undefined || share < 0) throw new Error(`Missing or negative shares for user ${userId}`)
    if (!Number.isInteger(share)) throw new Error(`Shares must be integers for user ${userId}`)
    totalShares += share
  }
  if (totalShares === 0) throw new Error('Total shares cannot be zero')

  const weights = userIds.map((userId) => values[userId]!)
  const amounts = allocateProportionally(totalMinor, weights)
  return userIds.map((userId, i) => ({ userId, amountMinor: amounts[i]! }))
}

/**
 * Verify that an array of participants sums to exactly the expected total.
 */
export function verifySplitTotal(participants: Participant[], expectedTotal: number): boolean {
  return participants.reduce((sum, p) => sum + p.amountMinor, 0) === expectedTotal
}
