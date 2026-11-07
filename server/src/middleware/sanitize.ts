import type { RequestHandler } from 'express'

const MAX_DEPTH = 20

/** Removes keys that could be interpreted as MongoDB operators or dotted paths. */
export function stripMongoOperators<T>(value: T, depth = 0): T {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = stripMongoOperators(value[i], depth + 1)
    return value
  }
  for (const key of Object.keys(value)) {
    if (key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      delete (value as Record<string, unknown>)[key]
    } else {
      const obj = value as Record<string, unknown>
      obj[key] = stripMongoOperators(obj[key], depth + 1)
    }
  }
  return value
}

export const sanitizeBody: RequestHandler = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') stripMongoOperators(req.body)
  next()
}
