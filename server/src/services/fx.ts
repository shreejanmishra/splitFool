import { CURRENCIES, convertCurrency } from '@splitfool/shared'
import { FxRate } from '../models/index.js'
import { env } from '../config/env.js'
import { logger } from '../lib/logger.js'

/** Fetches latest rates for a base currency. Returns null on failure. Swappable for tests. */
export type FxFetcher = (base: string) => Promise<{ date: string; rates: Record<string, number> } | null>

const frankfurterFetcher: FxFetcher = async (base) => {
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}`, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    const body = (await res.json()) as { date?: string; rates?: Record<string, unknown> }
    if (!body.rates || typeof body.date !== 'string') return null
    const rates: Record<string, number> = {}
    for (const [code, v] of Object.entries(body.rates)) {
      if (/^[A-Z]{3}$/.test(code) && typeof v === 'number' && Number.isFinite(v) && v > 0) rates[code] = v
    }
    return { date: body.date, rates }
  } catch (err) {
    logger.warn({ err, base }, 'FX fetch failed')
    return null
  }
}

// Tests never hit the network unless they inject a fetcher.
let fetcher: FxFetcher = env.NODE_ENV === 'test' ? async () => null : frankfurterFetcher

export function setFxFetcher(f: FxFetcher): void {
  fetcher = f
}

const todayUtc = () => new Date().toISOString().slice(0, 10)

/** In-flight fetches, so a burst of requests triggers only one upstream call per base. */
const inflight = new Map<string, Promise<Record<string, number> | null>>()

/**
 * Rates for `base`: rates[X] = how many X one unit of base buys. Includes base itself (= 1).
 * Uses today's cached snapshot, fetches once a day, and falls back to the latest cached day.
 */
export async function getRates(base: string): Promise<Record<string, number> | null> {
  base = base.toUpperCase()
  const today = todayUtc()

  const cached = await FxRate.findOne({ base }).sort({ date: -1 }).lean()
  const fresh = cached && cached.fetchedAt.toISOString().slice(0, 10) === today
  if (cached && fresh) return withBase(base, cached.rates)

  let pending = inflight.get(base)
  if (!pending) {
    pending = (async () => {
      const result = await fetcher(base)
      if (!result) return null
      await FxRate.updateOne(
        { base, date: result.date },
        { $set: { rates: result.rates, fetchedAt: new Date() } },
        { upsert: true },
      ).catch((err: { code?: number }) => {
        if (err?.code !== 11000) throw err
      })
      return result.rates
    })().finally(() => inflight.delete(base))
    inflight.set(base, pending)
  }

  const rates = await pending
  if (rates) return withBase(base, rates)
  return cached ? withBase(base, cached.rates) : null
}

function withBase(base: string, rates: Map<string, number> | Record<string, number>): Record<string, number> {
  const obj = rates instanceof Map ? Object.fromEntries(rates) : { ...rates }
  obj[base] = 1
  return obj
}

/** Rate to multiply a major-unit amount in `from` to get major units in `to`. Null if unknown. */
export async function getRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1
  const rates = await getRates(to)
  const r = rates?.[from]
  return r ? 1 / r : null
}

/** Convert minor units using a rates table based on `to` (from getRates(to)). Null if the rate is missing. */
export function convertWith(rates: Record<string, number> | null, amountMinor: number, from: string, to: string): number | null {
  if (from === to) return amountMinor
  if (!rates || !rates[from]) return null
  return convertCurrency(amountMinor, from, to, rates)
}

export function supportedCurrencies() {
  return Object.values(CURRENCIES)
}
