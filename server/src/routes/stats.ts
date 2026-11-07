import { Router } from 'express'
import { statsQuerySchema } from '@splitfool/shared'
import { authenticate } from '../middleware/auth.js'
import { parse } from '../lib/validate.js'
import { computeStats } from '../services/stats.js'
import { loadUsers } from '../services/users.js'

export const statsRouter = Router()
statsRouter.use(authenticate)

/** Spending statistics for charts. */
statsRouter.get('/', async (req, res) => {
  const me = req.auth!.userId
  const query = parse(statsQuerySchema, req.query)

  const stats = await computeStats(me, query)

  // In group scope, enrich member ids with user names/avatars
  let membersWithProfiles: Array<{ userId: string; name: string; email: string; avatar?: string; paidMinor: number; shareMinor: number }> = []
  if (stats.byMember.length > 0) {
    const userMap = await loadUsers(stats.byMember.map((m) => m.userId))
    membersWithProfiles = stats.byMember.map((m) => {
      const u = userMap.get(m.userId)
      return {
        userId: m.userId,
        name: u?.name ?? 'Unknown',
        email: u?.email ?? '',
        avatar: u?.avatar,
        paidMinor: m.paidMinor,
        shareMinor: m.shareMinor,
      }
    })
  }

  res.json({
    ...stats,
    byMember: membersWithProfiles.length > 0 ? membersWithProfiles : stats.byMember,
  })
})
