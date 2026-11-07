import { Router } from 'express'
import { cursorPaginationSchema } from '@splitfool/shared'
import { authenticate } from '../middleware/auth.js'
import { Activity } from '../models/index.js'
import { decodeCursor, encodeCursor, parse } from '../lib/validate.js'
import { loadUsers } from '../services/users.js'

export const activityRouter = Router()
activityRouter.use(authenticate)

/** Activity feed visible to the authenticated user. */
activityRouter.get('/', async (req, res) => {
  const me = req.auth!.userId
  const q = parse(cursorPaginationSchema, req.query)

  const filter: Record<string, unknown> = { visibleTo: me }

  const cursor = decodeCursor(q.cursor)
  if (cursor) {
    filter._id = { $lt: cursor.id }
  }

  const limit = q.limit
  const items = await Activity.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean()

  const hasMore = items.length > limit
  const results = hasMore ? items.slice(0, limit) : items

  const nextCursor = hasMore && results.length > 0
    ? encodeCursor(null, results[results.length - 1]!._id)
    : null

  const actorIds = results.map((a) => a.actorId.toString())
  const userMap = await loadUsers(actorIds)

  res.json({
    activities: results.map((a) => ({
      _id: a._id.toString(),
      type: a.type,
      groupId: a.groupId?.toString(),
      expenseId: a.expenseId?.toString(),
      settlementId: a.settlementId?.toString(),
      data: a.data,
      actor: userMap.get(a.actorId.toString()),
      createdAt: a.createdAt.toISOString(),
    })),
    cursor: nextCursor,
    hasMore,
  })
})
