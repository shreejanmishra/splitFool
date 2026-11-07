import { rateLimit, ipKeyGenerator, type Options } from 'express-rate-limit'
import type { Request, RequestHandler } from 'express'
import { MongoRateLimitStore } from '../lib/rateLimitStore.js'
import { env } from '../config/env.js'

type LimiterOptions = {
  name: string
  windowMs: number
  limit: number
  keyGenerator?: Options['keyGenerator']
  skipSuccessfulRequests?: boolean
}

function createLimiter({ name, windowMs, limit, keyGenerator, skipSuccessfulRequests }: LimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests,
    // Tests use their own per-suite stores so limits don't leak between cases.
    store: env.NODE_ENV === 'test' ? undefined : new MongoRateLimitStore(name),
    keyGenerator,
    handler: (_req, res, _next, options) => {
      res.status(options.statusCode).json({
        error: { code: 'rate_limited', message: 'Too many requests. Please slow down and try again shortly.' },
      })
    },
  })
}

const ipKey = (req: Request) => ipKeyGenerator(req.ip ?? '0.0.0.0')

/** Prefer the authenticated user; fall back to IP (IPv6 collapsed to /56). */
export const userOrIpKey = (req: Request) => (req.auth?.userId ? `u:${req.auth.userId}` : `ip:${ipKey(req)}`)

/** Broad ceiling for all API traffic from one client. */
export const globalLimiter = createLimiter({
  name: 'global',
  windowMs: 60_000,
  limit: 300,
  keyGenerator: ipKey,
})

/** Login starts/callbacks per IP: generous for humans, stops scripted floods. */
export const authIpLimiter = createLimiter({
  name: 'auth-ip',
  windowMs: 15 * 60_000,
  limit: 50,
  keyGenerator: ipKey,
})

/** Token refresh / native exchange per IP. */
export const tokenLimiter = createLimiter({
  name: 'token',
  windowMs: 15 * 60_000,
  limit: 120,
  keyGenerator: ipKey,
})

/** Authenticated write operations per user. */
export const writeLimiter = createLimiter({
  name: 'write',
  windowMs: 60_000,
  limit: 120,
  keyGenerator: userOrIpKey,
})

/** File uploads per user. */
export const uploadLimiter = createLimiter({
  name: 'upload',
  windowMs: 60 * 60_000,
  limit: 60,
  keyGenerator: userOrIpKey,
})

/** Adding friends/members by email (sends mail, reveals whether an email is registered). */
export const inviteLimiter = createLimiter({
  name: 'invite',
  windowMs: 24 * 60 * 60_000,
  limit: 50,
  keyGenerator: userOrIpKey,
})

/** Apply the write limiter to state-changing requests only (reads are covered by the global limiter). */
export const writeGuard: RequestHandler = (req, res, next) =>
  req.method === 'GET' || req.method === 'HEAD' ? next() : writeLimiter(req, res, next)
