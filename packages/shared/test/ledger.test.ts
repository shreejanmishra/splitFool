import { describe, expect, it } from 'vitest'
import {
  allocateProportionally,
  computeBalances,
  computeNetPositions,
  simplifyNet,
} from '../src/debt.js'
import { createExpenseSchema, updateExpenseSchema } from '../src/schemas.js'

const A = 'a'.repeat(24)
const B = 'b'.repeat(24)
const C = 'c'.repeat(24)

describe('allocateProportionally', () => {
  it('always sums to the amount', () => {
    for (const amount of [0, 1, 7, 100, 333, 1001]) {
      const parts = allocateProportionally(amount, [1, 1, 1])
      expect(parts.reduce((s, p) => s + p, 0)).toBe(amount)
    }
  })
  it('respects weights', () => {
    expect(allocateProportionally(100, [3, 1])).toEqual([75, 25])
  })
  it('returns zeros for zero weights', () => {
    expect(allocateProportionally(100, [0, 0])).toEqual([0, 0])
  })
})

describe('multi-payer balances are cent-exact', () => {
  it('pairwise balances match exact net positions', () => {
    // 100 paid by A (33) and B (67), split three ways (34/33/33)
    const expense = {
      currency: 'USD',
      payers: [{ userId: 'A', amountMinor: 33 }, { userId: 'B', amountMinor: 67 }],
      splits: [
        { userId: 'A', amountMinor: 34 },
        { userId: 'B', amountMinor: 33 },
        { userId: 'C', amountMinor: 33 },
      ],
    }
    const pairwise = computeBalances([expense])
    const fromPairs = new Map<string, number>()
    for (const b of pairwise) {
      fromPairs.set(b.from, (fromPairs.get(b.from) ?? 0) - b.amountMinor)
      fromPairs.set(b.to, (fromPairs.get(b.to) ?? 0) + b.amountMinor)
    }
    const exact = computeNetPositions([expense]).get('USD')!
    for (const [user, v] of exact) expect(fromPairs.get(user) ?? 0).toBe(v)
  })
})

describe('computeNetPositions + simplifyNet', () => {
  it('treats settlements as ledger entries and zeroes out', () => {
    const net = computeNetPositions([
      { currency: 'INR', payers: [{ userId: 'A', amountMinor: 300 }], splits: [
        { userId: 'A', amountMinor: 100 }, { userId: 'B', amountMinor: 100 }, { userId: 'C', amountMinor: 100 },
      ] },
      // B settles with A
      { currency: 'INR', payers: [{ userId: 'B', amountMinor: 100 }], splits: [{ userId: 'A', amountMinor: 100 }] },
    ])
    const inr = net.get('INR')!
    expect(inr.get('A')).toBe(100)
    expect(inr.has('B')).toBe(false)
    expect(inr.get('C')).toBe(-100)
    expect(simplifyNet(inr, 'INR')).toEqual([{ from: 'C', to: 'A', amountMinor: 100, currency: 'INR' }])
  })

  it('keeps currencies separate', () => {
    const net = computeNetPositions([
      { currency: 'USD', payers: [{ userId: 'A', amountMinor: 10 }], splits: [{ userId: 'B', amountMinor: 10 }] },
      { currency: 'EUR', payers: [{ userId: 'B', amountMinor: 10 }], splits: [{ userId: 'A', amountMinor: 10 }] },
    ])
    expect([...net.keys()].sort()).toEqual(['EUR', 'USD'])
  })
})

describe('expense schemas', () => {
  const base = {
    description: 'Dinner',
    currency: 'inr',
    amountMinor: 300,
    date: '2026-01-01',
    splitMethod: 'equal',
    payers: [{ userId: A, amountMinor: 300 }],
    splits: [{ userId: A, amountMinor: 100 }, { userId: B, amountMinor: 100 }, { userId: C, amountMinor: 100 }],
  }

  it('accepts a valid expense and normalizes currency', () => {
    const parsed = createExpenseSchema.parse(base)
    expect(parsed.currency).toBe('INR')
    expect(parsed.category).toBe('general')
  })

  it('rejects splits that do not add up', () => {
    const r = createExpenseSchema.safeParse({ ...base, splits: [{ userId: A, amountMinor: 100 }] })
    expect(r.success).toBe(false)
  })

  it('rejects duplicate participants', () => {
    const r = createExpenseSchema.safeParse({
      ...base,
      splits: [{ userId: A, amountMinor: 150 }, { userId: A, amountMinor: 150 }],
    })
    expect(r.success).toBe(false)
  })

  it('rejects non-ObjectId user ids', () => {
    const r = createExpenseSchema.safeParse({ ...base, payers: [{ userId: '$where', amountMinor: 300 }] })
    expect(r.success).toBe(false)
  })

  it('update schema does not inject defaults', () => {
    expect(updateExpenseSchema.parse({ description: 'x' })).toEqual({ description: 'x' })
  })
})
