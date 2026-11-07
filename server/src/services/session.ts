import type { Response } from 'express'
import { Session, User, type SessionDoc } from '../models/index.js'
import { generateToken, hashToken } from '../lib/crypto.js'
import { signAccessToken } from '../lib/jwt.js'
import { logger } from '../lib/logger.js'
import { isProd } from '../config/env.js'

// ─── Timeouts (OWASP-aligned) ─────────────────────────────────────────────────
const IDLE_MS = 30 * 24 * 60 * 60_000 // 30 days
const ABSOLUTE_MS = 90 * 24 * 60 * 60_000 // 90 days
const ROTATION_MS = 24 * 60 * 60_000 // 24 hours
const GRACE_MS = 60_000 // 60 seconds
const RECENT_AUTH_MS = 10 * 60_000 // 10 minutes

export const SESSION_COOKIE = isProd ? '__Host-sf_session' : 'sf_session'

// ─── Create ────────────────────────────────────────────────────────────────────

export type CreateSessionInput = {
  userId: string
  kind: 'web' | 'android'
  sessionVersion: number
  authTime: Date
  ua?: string
  ip?: string
}

export type SessionTokens = {
  accessToken?: string
  refreshToken?: string
  sessionToken?: string
}

/**
 * Create a new session (both web and android).
 * - Web: returns the raw session token to be set as a cookie.
 * - Android: returns an access JWT + refresh token.
 */
export async function createSession(input: CreateSessionInput): Promise<{ session: SessionDoc; tokens: SessionTokens }> {
  const token = generateToken()
  const now = new Date()

  const session = await Session.create({
    userId: input.userId,
    kind: input.kind,
    tokenHash: hashToken(token),
    familyId: generateToken(),
    sessionVersion: input.sessionVersion,
    rotatedAt: now,
    authTime: input.authTime,
    idleExpiresAt: new Date(now.getTime() + IDLE_MS),
    absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_MS),
    device: { ua: input.ua, ip: input.ip },
    lastUsedAt: now,
  })

  if (input.kind === 'web') {
    return { session, tokens: { sessionToken: token } }
  }
  const accessToken = await signAccessToken(input.userId, session._id.toString())
  return { session, tokens: { accessToken, refreshToken: token } }
}

// ─── Validate (web) ───────────────────────────────────────────────────────────

/**
 * Look up and validate a web session token.
 * Handles rotation (new token every 24h) and grace-window fallback.
 * Returns the session and a new token if rotation occurred, or null if invalid.
 */
export async function validateWebSession(
  token: string,
): Promise<{ session: SessionDoc; newToken?: string } | null> {
  const hash = hashToken(token)
  const now = new Date()

  // Try current token first
  let session = await Session.findOne({ tokenHash: hash, kind: 'web' })

  if (!session) {
    // Check if this is a recently-rotated token within the grace window
    session = await Session.findOne({ prevTokenHash: hash, kind: 'web' })
    if (!session) return null
    // Grace window: the old token still works briefly after rotation
    if (now.getTime() - session.rotatedAt.getTime() > GRACE_MS) {
      // Reuse of an old token outside grace → possible theft. Kill the family.
      logger.warn({ familyId: session.familyId, userId: session.userId }, 'Session reuse detected, revoking family')
      await Session.deleteMany({ familyId: session.familyId })
      return null
    }
    // Within grace window; use the session but don't rotate again
    await touchSession(session, now)
    return { session }
  }

  // Check expiry
  if (now > session.idleExpiresAt || now > session.absoluteExpiresAt) {
    await session.deleteOne()
    return null
  }

  // Check sessionVersion
  const user = await User.findById(session.userId).select('sessionVersion').lean()
  if (!user || user.sessionVersion > session.sessionVersion) {
    await session.deleteOne()
    return null
  }

  // Rotate if due
  if (now.getTime() - session.rotatedAt.getTime() >= ROTATION_MS) {
    const newToken = generateToken()
    session.prevTokenHash = session.tokenHash
    session.tokenHash = hashToken(newToken)
    session.rotatedAt = now
    await touchSession(session, now)
    return { session, newToken }
  }

  // Just touch
  await touchSession(session, now)
  return { session }
}

// ─── Validate (android refresh) ───────────────────────────────────────────────

/**
 * Validate and rotate a refresh token (android).
 * Refresh tokens rotate on every use. Reuse → revoke the whole family.
 */
export async function rotateRefreshToken(
  token: string,
): Promise<{ session: SessionDoc; accessToken: string; refreshToken: string } | null> {
  const hash = hashToken(token)
  const now = new Date()

  const session = await Session.findOne({ tokenHash: hash, kind: 'android' })

  if (!session) {
    // Check if it's a reused old token
    const reused = await Session.findOne({ prevTokenHash: hash, kind: 'android' })
    if (reused) {
      logger.warn({ familyId: reused.familyId, userId: reused.userId }, 'Refresh token reuse detected, revoking family')
      await Session.deleteMany({ familyId: reused.familyId })
    }
    return null
  }

  if (now > session.idleExpiresAt || now > session.absoluteExpiresAt) {
    await session.deleteOne()
    return null
  }

  const user = await User.findById(session.userId).select('sessionVersion').lean()
  if (!user || user.sessionVersion > session.sessionVersion) {
    await session.deleteOne()
    return null
  }

  // Rotate
  const newToken = generateToken()
  session.prevTokenHash = session.tokenHash
  session.tokenHash = hashToken(newToken)
  session.rotatedAt = now
  await touchSession(session, now)

  const accessToken = await signAccessToken(session.userId.toString(), session._id.toString())
  return { session, accessToken, refreshToken: newToken }
}

// ─── Cookie helpers ────────────────────────────────────────────────────────────

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: ABSOLUTE_MS,
    signed: true,
  })
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  })
}

// ─── Revocation ────────────────────────────────────────────────────────────────

export async function revokeSession(sessionId: string): Promise<void> {
  await Session.deleteOne({ _id: sessionId })
}

export async function revokeAllSessions(userId: string): Promise<number> {
  const result = await Session.deleteMany({ userId })
  return result.deletedCount
}

export async function revokeAllSessionsViaVersion(userId: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $inc: { sessionVersion: 1 } })
  await Session.deleteMany({ userId })
}

// ─── Recent auth check ────────────────────────────────────────────────────────

export function isRecentlyAuthenticated(authTime: Date): boolean {
  return Date.now() - authTime.getTime() < RECENT_AUTH_MS
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

async function touchSession(session: SessionDoc, now: Date): Promise<void> {
  session.idleExpiresAt = new Date(Math.min(now.getTime() + IDLE_MS, session.absoluteExpiresAt.getTime()))
  session.lastUsedAt = now
  await session.save()
}

// ─── List sessions ─────────────────────────────────────────────────────────────

export async function listSessions(userId: string) {
  return Session.find({ userId }).sort({ lastUsedAt: -1 }).lean()
}
