import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { pinoHttp } from 'pino-http'
import { allowedOrigins, env, isProd } from './config/env.js'
import { logger } from './lib/logger.js'
import { globalLimiter } from './middleware/rateLimit.js'
import { csrfProtection, CSRF_HEADER } from './middleware/csrf.js'
import { sanitizeBody } from './middleware/sanitize.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'
import { healthRouter } from './routes/health.js'
import { authRouter } from './routes/auth.js'
import { friendsRouter, invitesRouter } from './routes/friends.js'
import { groupsRouter } from './routes/groups.js'
import { expensesRouter } from './routes/expenses.js'
import { settlementsRouter } from './routes/settlements.js'
import { balancesRouter } from './routes/balances.js'
import { activityRouter } from './routes/activity.js'
import { statsRouter } from './routes/stats.js'
import { fxRouter } from './routes/fx.js'
import { recurringRouter } from './routes/recurring.js'
import { runDueRecurring } from './services/recurring.js'
import { initProviders } from './auth/registry.js'

export function createApp(): Express {
  initProviders()

  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', env.TRUST_PROXY)
  // Flat query strings only (no ?a[b]=c objects) — removes a class of injection tricks.
  app.set('query parser', 'simple')

  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }))

  app.use(
    helmet({
      // The API only serves JSON; lock everything down.
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      strictTransportSecurity: isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
    }),
  )

  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', CSRF_HEADER],
      maxAge: 600,
    }),
  )

  app.use(express.json({ limit: '100kb' }))
  app.use(express.urlencoded({ extended: false, limit: '20kb' }))
  app.use(cookieParser(env.COOKIE_SECRET))
  app.use(sanitizeBody)

  const api = express.Router()
  api.use('/health', healthRouter)

  api.get('/cron/recurring', async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization
      if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
        res.status(401).json({ error: { code: 'unauthorized', message: 'Unauthorized cron request' } })
        return
      }
      const result = await runDueRecurring()
      res.json({ ok: true, ...result })
    } catch (err) {
      next(err)
    }
  })

  api.use(globalLimiter)
  api.use(csrfProtection)
  api.use('/auth', authRouter)
  api.use('/friends', friendsRouter)
  api.use('/invites', invitesRouter)
  api.use('/groups', groupsRouter)
  api.use('/expenses', expensesRouter)
  api.use('/settlements', settlementsRouter)
  api.use('/balances', balancesRouter)
  api.use('/activity', activityRouter)
  api.use('/stats', statsRouter)
  api.use('/fx', fxRouter)
  api.use('/recurring', recurringRouter)

  app.use('/api', api)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
