import type { RequestHandler } from 'express'
import { allowedOrigins } from '../config/env.js'
import { forbidden } from '../lib/errors.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
export const CSRF_HEADER = 'x-sf-request'

function requestOrigin(origin?: string, referer?: string): string | undefined {
  if (origin && origin !== 'null') return origin
  if (!referer) return undefined
  try {
    return new URL(referer).origin
  } catch {
    return undefined
  }
}

/**
 * CSRF defense for cookie-authenticated requests (defense in depth on top of SameSite=Lax):
 *  1. Origin (or Referer) must be an allowed origin.
 *  2. A custom header must be present. Browsers can't add it cross-origin without a CORS preflight,
 *     which our CORS policy rejects for unknown origins.
 * Requests authenticated with a Bearer token (Android app) carry no ambient credentials and are skipped.
 */
export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next()
  if (req.headers.authorization?.startsWith('Bearer ')) return next()

  const origin = requestOrigin(req.headers.origin, req.headers.referer)
  if (!origin || !allowedOrigins.has(origin)) {
    return next(forbidden('Request origin not allowed', 'csrf_origin'))
  }
  if (req.headers[CSRF_HEADER] !== '1') {
    return next(forbidden('Missing CSRF header', 'csrf_header'))
  }
  next()
}
