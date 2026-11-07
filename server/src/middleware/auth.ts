import type { RequestHandler } from 'express'
import { validateWebSession, SESSION_COOKIE, setSessionCookie, clearSessionCookie } from '../services/session.js'
import { verifyAccessToken } from '../lib/jwt.js'
import { Session } from '../models/index.js'
import { unauthorized, forbidden } from '../lib/errors.js'
import { isRecentlyAuthenticated } from '../services/session.js'

/**
 * Authenticate the request. Supports two credential types:
 * 1. Web: signed httpOnly cookie with an opaque session token.
 * 2. Android: Bearer access JWT in the Authorization header.
 *
 * Sets `req.auth` on success.
 */
export const authenticate: RequestHandler = async (req, res, next) => {
  // Try Bearer token first (Android)
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const jwt = authHeader.slice(7)
    const payload = await verifyAccessToken(jwt)
    if (!payload?.sub || !payload.sid) return next(unauthorized())
    req.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      kind: 'android',
      authTime: new Date(0), // Will be enriched below
    }
    // Enrich authTime from the session
    const session = await Session.findById(payload.sid).select('authTime').lean()
    if (session) req.auth.authTime = session.authTime
    return next()
  }

  // Web: signed cookie
  const token = req.signedCookies?.[SESSION_COOKIE]
  if (!token || typeof token !== 'string') return next(unauthorized())

  const result = await validateWebSession(token)
  if (!result) {
    // Clear the stale cookie
    clearSessionCookie(res)
    return next(unauthorized('Session expired or revoked', 'session_expired'))
  }

  // If the token was rotated, update the cookie
  if (result.newToken) {
    setSessionCookie(res, result.newToken)
  }

  req.auth = {
    userId: result.session.userId.toString(),
    sessionId: result.session._id.toString(),
    kind: 'web',
    authTime: result.session.authTime,
  }
  next()
}

/** Require the user to have signed in recently (within 10 min) for sensitive operations. */
export const requireRecentAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(unauthorized())
  if (!isRecentlyAuthenticated(req.auth.authTime)) {
    return next(forbidden('Recent sign-in required for this action', 'recent_auth_required'))
  }
  next()
}
