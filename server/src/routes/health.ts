import { Router } from 'express'
import { isMongoReady } from '../db/mongo.js'

export const healthRouter = Router()

healthRouter.get('/', (_req, res) => {
  const db = isMongoReady()
  res.status(db ? 200 : 503).json({ ok: db, db: db ? 'up' : 'down', time: new Date().toISOString() })
})
