import { describe, expect, it } from 'vitest'
import { calculateSplit, verifySplitTotal } from '../src/split.js'
import { simplifyDebts, computeBalances } from '../src/debt.js'
import { formatMoney, parseToMinor, convertCurrency } from '../src/money.js'

// ─── Split Calculator ───────────────────────────────────────────────────────

describe('calculateSplit', () => {
  const users = ['a', 'b', 'c']

  describe('equal', () => {
    it('divides evenly', () => {
      const result = calculateSplit(9000, users, 'equal')
      expect(result).toEqual([
        { userId: 'a', amountMinor: 3000 },
        { userId: 'b', amountMinor: 3000 },
        { userId: 'c', amountMinor: 3000 },
      ])
      expect(verifySplitTotal(result, 9000)).toBe(true)
    })

    it('distributes remainder cents fairly', () => {
      const result = calculateSplit(10000, users, 'equal')
      // 10000 / 3 = 3333 remainder 1 → first person gets the extra cent
      expect(result[0]!.amountMinor).toBe(3334)
      expect(result[1]!.amountMinor).toBe(3333)
      expect(result[2]!.amountMinor).toBe(3333)
      expect(verifySplitTotal(result, 10000)).toBe(true)
    })

    it('handles single user', () => {
      const result = calculateSplit(5000, ['a'], 'equal')
      expect(result).toEqual([{ userId: 'a', amountMinor: 5000 }])
    })

    it('handles zero total', () => {
      const result = calculateSplit(0, users, 'equal')
      expect(result.every((p) => p.amountMinor === 0)).toBe(true)
    })
  })

  describe('exact', () => {
    it('uses specified amounts', () => {
      const result = calculateSplit(10000, users, 'exact', { a: 5000, b: 3000, c: 2000 })
      expect(result).toEqual([
        { userId: 'a', amountMinor: 5000 },
        { userId: 'b', amountMinor: 3000 },
        { userId: 'c', amountMinor: 2000 },
      ])
    })

    it('throws if sum does not match total', () => {
      expect(() => calculateSplit(10000, users, 'exact', { a: 5000, b: 3000, c: 1000 })).toThrow(
        /does not equal total/,
      )
    })
  })

  describe('percent', () => {
    it('splits by percentage with rounding', () => {
      const result = calculateSplit(10000, users, 'percent', { a: 50, b: 30, c: 20 })
      expect(result[0]!.amountMinor).toBe(5000)
      expect(result[1]!.amountMinor).toBe(3000)
      expect(result[2]!.amountMinor).toBe(2000)
      expect(verifySplitTotal(result, 10000)).toBe(true)
    })

    it('handles 33.33/33.33/33.34 without losing money', () => {
      const result = calculateSplit(10000, users, 'percent', { a: 33.33, b: 33.33, c: 33.34 })
      expect(verifySplitTotal(result, 10000)).toBe(true)
    })

    it('throws if percentages do not sum to 100', () => {
      expect(() => calculateSplit(10000, users, 'percent', { a: 50, b: 30, c: 10 })).toThrow(
        /sum to 100/,
      )
    })
  })

  describe('shares', () => {
    it('splits by share count', () => {
      const result = calculateSplit(10000, users, 'shares', { a: 2, b: 1, c: 1 })
      expect(result[0]!.amountMinor).toBe(5000) // 2/4
      expect(result[1]!.amountMinor).toBe(2500) // 1/4
      expect(result[2]!.amountMinor).toBe(2500) // 1/4
      expect(verifySplitTotal(result, 10000)).toBe(true)
    })

    it('handles indivisible shares without losing money', () => {
      const result = calculateSplit(100, ['a', 'b', 'c'], 'shares', { a: 1, b: 1, c: 1 })
      expect(verifySplitTotal(result, 100)).toBe(true)
      // 100/3 = 33 r1 → one person gets 34
      const amounts = result.map((p) => p.amountMinor).sort((a, b) => a - b)
      expect(amounts).toEqual([33, 33, 34])
    })
  })

  describe('edge cases', () => {
    it('throws on empty users', () => {
      expect(() => calculateSplit(1000, [], 'equal')).toThrow(/at least one/i)
    })

    it('throws on negative total', () => {
      expect(() => calculateSplit(-100, ['a'], 'equal')).toThrow(/negative/)
    })
  })
})

// ─── Debt Simplification ────────────────────────────────────────────────────

describe('simplifyDebts', () => {
  it('simplifies a triangle into 2 transactions', () => {
    // A owes B 100, B owes C 100, A owes C 100
    const debts = [
      { from: 'A', to: 'B', amountMinor: 10000, currency: 'INR' },
      { from: 'B', to: 'C', amountMinor: 10000, currency: 'INR' },
      { from: 'A', to: 'C', amountMinor: 10000, currency: 'INR' },
    ]
    const simplified = simplifyDebts(debts, 'INR')
    // A's net: -20000, B's net: 0, C's net: +20000
    // So A → C 20000 (one transaction)
    expect(simplified).toHaveLength(1)
    expect(simplified[0]).toEqual({ from: 'A', to: 'C', amountMinor: 20000, currency: 'INR' })
  })

  it('handles empty debts', () => {
    expect(simplifyDebts([], 'USD')).toEqual([])
  })

  it('handles balanced debts (no net owed)', () => {
    const debts = [
      { from: 'A', to: 'B', amountMinor: 5000, currency: 'USD' },
      { from: 'B', to: 'A', amountMinor: 5000, currency: 'USD' },
    ]
    const simplified = simplifyDebts(debts, 'USD')
    expect(simplified).toHaveLength(0)
  })

  it('simplifies 4-person debts correctly', () => {
    const debts = [
      { from: 'A', to: 'B', amountMinor: 1000, currency: 'USD' },
      { from: 'A', to: 'C', amountMinor: 2000, currency: 'USD' },
      { from: 'B', to: 'D', amountMinor: 3000, currency: 'USD' },
      { from: 'C', to: 'D', amountMinor: 1000, currency: 'USD' },
    ]
    const simplified = simplifyDebts(debts, 'USD')
    // Verify net balances are preserved
    const totalOwed = simplified.reduce((sum, d) => sum + d.amountMinor, 0)
    // Net: A=-3000, B=-2000, C=-(-1000)=+1000, D=+4000
    // Max transactions: 3 (N-1)
    expect(simplified.length).toBeLessThanOrEqual(3)
    // Verify total money movement is correct
    expect(totalOwed).toBe(5000) // total net debts: 3000+2000 = 5000
  })
})

// ─── Balance Computation ────────────────────────────────────────────────────

describe('computeBalances', () => {
  it('computes who owes whom from a simple expense', () => {
    const balances = computeBalances([
      {
        payers: [{ userId: 'A', amountMinor: 9000 }],
        splits: [
          { userId: 'A', amountMinor: 3000 },
          { userId: 'B', amountMinor: 3000 },
          { userId: 'C', amountMinor: 3000 },
        ],
        currency: 'INR',
      },
    ])
    // B owes A 3000, C owes A 3000
    expect(balances).toHaveLength(2)
    const bToA = balances.find((b) => b.from === 'B' && b.to === 'A')
    const cToA = balances.find((b) => b.from === 'C' && b.to === 'A')
    expect(bToA?.amountMinor).toBe(3000)
    expect(cToA?.amountMinor).toBe(3000)
  })

  it('nets out bidirectional debts', () => {
    const balances = computeBalances([
      {
        payers: [{ userId: 'A', amountMinor: 6000 }],
        splits: [
          { userId: 'A', amountMinor: 3000 },
          { userId: 'B', amountMinor: 3000 },
        ],
        currency: 'INR',
      },
      {
        payers: [{ userId: 'B', amountMinor: 4000 }],
        splits: [
          { userId: 'A', amountMinor: 2000 },
          { userId: 'B', amountMinor: 2000 },
        ],
        currency: 'INR',
      },
    ])
    // B owes A 3000, A owes B 2000 → net: B owes A 1000
    expect(balances).toHaveLength(1)
    expect(balances[0]!.from).toBe('B')
    expect(balances[0]!.to).toBe('A')
    expect(balances[0]!.amountMinor).toBe(1000)
  })
})

// ─── Money Utils ────────────────────────────────────────────────────────────

describe('formatMoney', () => {
  it('formats USD correctly', () => {
    expect(formatMoney(12345, 'USD')).toBe('$123.45')
  })

  it('formats INR correctly', () => {
    expect(formatMoney(100050, 'INR')).toBe('₹1,000.50')
  })

  it('formats JPY (0 decimal places)', () => {
    expect(formatMoney(500, 'JPY')).toBe('¥500')
  })

  it('handles zero', () => {
    expect(formatMoney(0, 'USD')).toBe('$0.00')
  })
})

describe('parseToMinor', () => {
  it('converts dollar string to cents', () => {
    expect(parseToMinor('123.45', 'USD')).toBe(12345)
  })

  it('rounds correctly', () => {
    // 1.005 * 100 = 100.49999... in IEEE 754, so Math.round gives 100
    expect(parseToMinor('1.005', 'USD')).toBe(100)
    // 2.5 * 100 = 250.0 exactly
    expect(parseToMinor('2.5', 'USD')).toBe(250)
    // 99.99 * 100 = 9999.0 exactly
    expect(parseToMinor('99.99', 'USD')).toBe(9999)
  })

  it('returns NaN for invalid input', () => {
    expect(parseToMinor('abc', 'USD')).toBeNaN()
  })
})

describe('convertCurrency', () => {
  const rates = { USD: 1.1, EUR: 1.0, INR: 92.0 }

  it('converts USD to EUR', () => {
    const result = convertCurrency(11000, 'USD', 'EUR', rates) // $110.00
    // $110 / 1.1 = €100 → 10000 minor
    expect(result).toBe(10000)
  })

  it('converts EUR to INR', () => {
    const result = convertCurrency(10000, 'EUR', 'INR', rates) // €100
    // €100 * 92 = ₹9200 → 920000 minor
    expect(result).toBe(920000)
  })

  it('same currency returns same amount', () => {
    expect(convertCurrency(5000, 'USD', 'USD', rates)).toBe(5000)
  })

  it('throws for missing rate', () => {
    expect(() => convertCurrency(1000, 'USD', 'GBP', rates)).toThrow(/Missing exchange rate/)
  })
})
