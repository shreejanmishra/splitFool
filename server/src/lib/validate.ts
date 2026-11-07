import mongoose from 'mongoose'
import type { z } from 'zod'
import { badRequest, notFound } from './errors.js'

/** Parse with Zod; a ZodError bubbles to the error handler as a 400. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data)
}

/** Convert a route param to an ObjectId, or 404 (don't leak whether ids are well-formed). */
export function oid(value: unknown, what = 'Resource'): mongoose.Types.ObjectId {
  if (typeof value !== 'string' || !mongoose.isValidObjectId(value) || !/^[a-f0-9]{24}$/i.test(value)) {
    throw notFound(`${what} not found`)
  }
  return new mongoose.Types.ObjectId(value)
}

/** Same as oid but for request bodies, where a bad id is the client's mistake (400). */
export function bodyOid(value: string): mongoose.Types.ObjectId {
  if (!/^[a-f0-9]{24}$/i.test(value)) throw badRequest('Invalid id')
  return new mongoose.Types.ObjectId(value)
}

// ─── Cursor pagination ─────────────────────────────────────────────────────────
// Cursor encodes the sort key of the last item: (date desc, _id desc) or (_id desc).

export function encodeCursor(date: Date | null, id: mongoose.Types.ObjectId | string): string {
  return Buffer.from(`${date ? date.getTime() : ''}|${id.toString()}`).toString('base64url')
}

export function decodeCursor(cursor?: string): { date: Date | null; id: mongoose.Types.ObjectId } | null {
  if (!cursor) return null
  const raw = Buffer.from(cursor, 'base64url').toString('utf8')
  const [ms, id] = raw.split('|')
  if (!id || !/^[a-f0-9]{24}$/i.test(id)) throw badRequest('Invalid cursor')
  const date = ms ? new Date(Number(ms)) : null
  if (date && Number.isNaN(date.getTime())) throw badRequest('Invalid cursor')
  return { date, id: new mongoose.Types.ObjectId(id) }
}

/** Mongo filter for "items after the cursor" with sort { date: -1, _id: -1 }. */
export function dateCursorFilter(c: { date: Date | null; id: mongoose.Types.ObjectId } | null) {
  if (!c?.date) return {}
  return { $or: [{ date: { $lt: c.date } }, { date: c.date, _id: { $lt: c.id } }] }
}

/** Escape a user string for safe use inside a RegExp. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
