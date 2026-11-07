import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'
import mongoose from 'mongoose'
import { HttpError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'
import { isProd } from '../config/env.js'

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } })
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (res.headersSent) return

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } })
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    })
    return
  }
  if (err instanceof mongoose.Error.CastError || err instanceof mongoose.Error.ValidationError) {
    logger.warn({ err: err.message, stack: err.stack, path: req.path }, 'Mongoose cast/validation error')
    res.status(400).json({ error: { code: 'bad_request', message: 'Invalid identifier or value', details: err.message } })
    return
  }
  // body-parser errors (malformed JSON, payload too large)
  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500 && err.expose) {
    res.status(err.status).json({ error: { code: err.type ?? 'bad_request', message: err.message } })
    return
  }

  logger.error({ err, path: req.path }, 'Unhandled error')
  res.status(500).json({
    error: { code: 'internal_error', message: isProd ? 'Something went wrong' : String(err?.message ?? err) },
  })
}
