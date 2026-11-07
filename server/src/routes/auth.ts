import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { getProvider, availableProviders } from '../auth/registry.js'
import { findOrCreateUser } from '../services/userAuth.js'
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  revokeSession,
  revokeAllSessionsViaVersion,
  rotateRefreshToken,
  listSessions,
} from '../services/session.js'
import { generateState, generateCodeVerifier, codeChallenge, generateToken, hashToken } from '../lib/crypto.js'
import { verifyTurnstile } from '../lib/turnstile.js'
import { badRequest, unauthorized, forbidden, notFound } from '../lib/errors.js'
import { authenticate, requireRecentAuth } from '../middleware/auth.js'
import { authIpLimiter, tokenLimiter } from '../middleware/rateLimit.js'
import { env, isDev } from '../config/env.js'
import { User, Session } from '../models/index.js'
import { logger } from '../lib/logger.js'

export const authRouter = Router()

// ─── Available providers ───────────────────────────────────────────────────────
authRouter.get('/providers', (_req, res) => {
  res.json({ providers: availableProviders() })
})

// ─── OAuth state cookie ────────────────────────────────────────────────────────
const STATE_COOKIE = isDev ? 'sf_oauth_state' : '__Host-sf_oauth_state'

function setStateCookie(
  res: Response,
  data: { state: string; nonce: string; codeVerifier: string; platform?: string; appChallenge?: string },
) {
  res.cookie(STATE_COOKIE, JSON.stringify(data), {
    httpOnly: true,
    secure: !isDev,
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 600_000, // 10 minutes
    signed: true,
  })
}

function getStateCookie(req: Request): {
  state: string
  nonce: string
  codeVerifier: string
  platform?: string
  appChallenge?: string
} | null {
  const raw = req.signedCookies?.[STATE_COOKIE]
  if (!raw || typeof raw !== 'string') return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function clearStateCookie(res: Response) {
  res.clearCookie(STATE_COOKIE, { httpOnly: true, secure: !isDev, sameSite: 'lax', path: '/api/auth' })
}

// ─── Start OAuth ───────────────────────────────────────────────────────────────
authRouter.post('/:provider/start', authIpLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providerName = req.params.provider as string
    const provider = getProvider(providerName)
    if (!provider) return next(notFound(`Provider '${providerName}' is not available`))

    // Turnstile verification (web only)
    const platform = (req.body as Record<string, unknown>)?.platform as string | undefined
    if (platform !== 'android') {
      const turnstileToken = (req.body as Record<string, unknown>)?.turnstileToken as string | undefined
      const ok = await verifyTurnstile(turnstileToken, req.ip)
      if (!ok) return next(forbidden('Bot verification failed', 'turnstile_failed'))
    }

    const state = generateState()
    const nonce = generateState()
    const verifier = generateCodeVerifier()
    const challenge = codeChallenge(verifier)

    const redirectUri = `${env.PUBLIC_URL}/api/auth/${providerName}/callback`

    setStateCookie(res, {
      state,
      nonce,
      codeVerifier: verifier,
      platform,
      appChallenge: (req.body as Record<string, unknown>)?.appChallenge as string | undefined,
    })

    const authUrl = provider.getAuthUrl({ redirectUri, state, nonce, codeChallenge: challenge })
    res.json({ url: authUrl })
  } catch (err) {
    next(err)
  }
})

// ─── OAuth callback ────────────────────────────────────────────────────────────
authRouter.get('/:provider/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providerName = req.params.provider as string
    const provider = getProvider(providerName)
    if (!provider) return next(notFound())

    const code = req.query.code as string | undefined
    const state = req.query.state as string | undefined
    const error = req.query.error as string | undefined
    if (error) return next(badRequest(`Provider returned error: ${error}`))
    if (!code || !state) return next(badRequest('Missing code or state'))

    const stateCookie = getStateCookie(req)
    clearStateCookie(res)

    if (!stateCookie || stateCookie.state !== state) {
      return next(forbidden('Invalid OAuth state', 'oauth_state_mismatch'))
    }

    const redirectUri = `${env.PUBLIC_URL}/api/auth/${providerName}/callback`
    const profile = await provider.exchangeCode({
      code,
      redirectUri,
      codeVerifier: stateCookie.codeVerifier,
      nonce: stateCookie.nonce,
    })

    const user = await findOrCreateUser(profile)
    const authTime = new Date()

    // Native (Android) flow: issue a one-time code and redirect to the app
    if (stateCookie.platform === 'android') {
      const oneTimeCode = generateToken()
      // Store in a temporary session-like document (reuse NativeCode collection)
      await NativeCodeStore.create({
        codeHash: hashToken(oneTimeCode),
        userId: user._id.toString(),
        sessionVersion: user.sessionVersion,
        authTime,
        appChallengeHash: stateCookie.appChallenge ? hashToken(stateCookie.appChallenge) : undefined,
        ua: req.headers['user-agent'],
        ip: req.ip,
        expiresAt: new Date(Date.now() + 60_000), // 60s TTL
      })

      const redirectUrl = new URL(env.ANDROID_REDIRECT_URI)
      redirectUrl.searchParams.set('code', oneTimeCode)
      return res.redirect(redirectUrl.toString())
    }

    // Web flow: create session and set cookie
    const { tokens } = await createSession({
      userId: user._id.toString(),
      kind: 'web',
      sessionVersion: user.sessionVersion,
      authTime,
      ua: req.headers['user-agent'],
      ip: req.ip,
    })

    setSessionCookie(res, tokens.sessionToken!)
    res.redirect(env.PUBLIC_URL)
  } catch (err) {
    logger.error({ err, provider: req.params.provider }, 'OAuth callback error')
    // Redirect to app with error instead of showing raw JSON
    res.redirect(`${env.PUBLIC_URL}/login?error=auth_failed`)
  }
})

// ─── Native code exchange ──────────────────────────────────────────────────────

import mongoose, { Schema } from 'mongoose'

interface INativeCode {
  codeHash: string
  userId: string
  sessionVersion: number
  authTime: Date
  appChallengeHash?: string
  ua?: string
  ip?: string
  expiresAt: Date
}

const nativeCodeSchema = new Schema<INativeCode>({
  codeHash: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  sessionVersion: { type: Number, required: true },
  authTime: { type: Date, required: true },
  appChallengeHash: String,
  ua: String,
  ip: String,
  expiresAt: { type: Date, required: true },
})
nativeCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const NativeCodeStore = mongoose.model<INativeCode>('NativeCode', nativeCodeSchema)

const exchangeSchema = z.object({
  code: z.string().min(1),
  appVerifier: z.string().min(1),
})

authRouter.post('/native/exchange', tokenLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = exchangeSchema.parse(req.body)

    const doc = await NativeCodeStore.findOneAndDelete({ codeHash: hashToken(body.code) })
    if (!doc) return next(unauthorized('Invalid or expired code', 'invalid_code'))

    if (doc.expiresAt < new Date()) return next(unauthorized('Code expired', 'code_expired'))

    // Verify app challenge binding
    if (doc.appChallengeHash) {
      if (hashToken(body.appVerifier) !== doc.appChallengeHash) {
        return next(forbidden('App verifier mismatch', 'verifier_mismatch'))
      }
    }

    const { tokens } = await createSession({
      userId: doc.userId,
      kind: 'android',
      sessionVersion: doc.sessionVersion,
      authTime: doc.authTime,
      ua: doc.ua,
      ip: doc.ip,
    })

    res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
  } catch (err) {
    next(err)
  }
})

// ─── Token refresh (Android) ──────────────────────────────────────────────────
authRouter.post('/refresh', tokenLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string }
    if (!refreshToken) return next(badRequest('Missing refreshToken'))

    const result = await rotateRefreshToken(refreshToken)
    if (!result) return next(unauthorized('Invalid or expired refresh token', 'refresh_failed'))

    res.json({ accessToken: result.accessToken, refreshToken: result.refreshToken })
  } catch (err) {
    next(err)
  }
})

// ─── Dev login (development only) ─────────────────────────────────────────────
if (isDev) {
  const devLoginSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1).default('Dev User'),
  })

  authRouter.post('/dev/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = devLoginSchema.parse(req.body)

      const user = await findOrCreateUser({
        provider: 'dev',
        providerSub: `dev-${body.email}`,
        email: body.email,
        emailVerified: true,
        name: body.name,
      })

      const authTime = new Date()
      const platform = req.body?.platform

      if (platform === 'android') {
        const { tokens } = await createSession({
          userId: user._id.toString(),
          kind: 'android',
          sessionVersion: user.sessionVersion,
          authTime,
          ua: req.headers['user-agent'],
          ip: req.ip,
        })
        return res.json({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
      }

      const { tokens } = await createSession({
        userId: user._id.toString(),
        kind: 'web',
        sessionVersion: user.sessionVersion,
        authTime,
        ua: req.headers['user-agent'],
        ip: req.ip,
      })
      setSessionCookie(res, tokens.sessionToken!)
      res.json({ ok: true, userId: user._id })
    } catch (err) {
      next(err)
    }
  })
}

// ─── Logout ────────────────────────────────────────────────────────────────────
authRouter.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeSession(req.auth!.sessionId)
    if (req.auth!.kind === 'web') clearSessionCookie(res)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

authRouter.post('/logout-all', authenticate, requireRecentAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await revokeAllSessionsViaVersion(req.auth!.userId)
    if (req.auth!.kind === 'web') clearSessionCookie(res)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ─── Sessions list / revoke ────────────────────────────────────────────────────
authRouter.get('/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await listSessions(req.auth!.userId)
    res.json({
      sessions: sessions.map((s) => ({
        id: s._id,
        kind: s.kind,
        device: s.device,
        lastUsedAt: s.lastUsedAt,
        createdAt: s.createdAt,
        current: s._id.toString() === req.auth!.sessionId,
      })),
    })
  } catch (err) {
    next(err)
  }
})

authRouter.delete('/sessions/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.auth!.userId })
    if (!session) return next(notFound('Session not found'))
    await revokeSession(session._id.toString())
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// ─── Me (current user) ────────────────────────────────────────────────────────
authRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.auth!.userId).select('-sessionVersion -__v')
    if (!user) return next(unauthorized())
    res.json({ user })
  } catch (err) {
    next(err)
  }
})

authRouter.patch('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { updateProfileSchema } = await import('@splitfool/shared')
    const patch = updateProfileSchema.parse(req.body)

    const user = await User.findById(req.auth!.userId)
    if (!user) return next(unauthorized())

    if (patch.name !== undefined) user.name = patch.name
    if (patch.defaultCurrency !== undefined) user.defaultCurrency = patch.defaultCurrency
    if (patch.notificationPrefs !== undefined) {
      if (patch.notificationPrefs.email !== undefined) user.notificationPrefs.email = patch.notificationPrefs.email
      if (patch.notificationPrefs.expenseAdded !== undefined) user.notificationPrefs.expenseAdded = patch.notificationPrefs.expenseAdded
      if (patch.notificationPrefs.weeklySummary !== undefined) user.notificationPrefs.weeklySummary = patch.notificationPrefs.weeklySummary
    }

    await user.save()
    res.json({ ok: true, user })
  } catch (err) {
    next(err)
  }
})

// ─── Google RISC (Cross-Account Protection) ────────────────────────────────────
authRouter.post('/risc', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Google sends SET (Security Event Token) as a JWT in the request body
    // For now we accept the event and revoke all sessions for the affected user.
    // Full RISC JWT verification requires registering with Google's RISC API.
    const token = req.body as {
      events?: Record<
        string,
        { subject?: { subject_type?: string; iss?: string; sub?: string } }
      >
    }

    if (!token.events) {
      res.status(202).json({ ok: true })
      return
    }

    for (const [eventType, event] of Object.entries(token.events)) {
      const sub = event?.subject?.sub
      if (!sub) continue

      logger.info({ eventType, sub }, 'RISC event received')

      // Find all auth identities for this Google sub and revoke their sessions
      const { AuthIdentity } = await import('../models/index.js')
      const identities = await AuthIdentity.find({ provider: 'google', providerSub: sub })
      for (const identity of identities) {
        await revokeAllSessionsViaVersion(identity.userId.toString())
        logger.info({ userId: identity.userId, eventType }, 'Sessions revoked via RISC')
      }
    }

    res.status(202).json({ ok: true })
  } catch (err) {
    next(err)
  }
})
