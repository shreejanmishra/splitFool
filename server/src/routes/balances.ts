import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { userBalances } from '../services/balances.js'
import { loadUsers } from '../services/users.js'

export const balancesRouter = Router()
balancesRouter.use(authenticate)

/** Overall balances for the authenticated user across all groups and friends. */
balancesRouter.get('/', async (req, res) => {
  const me = req.auth!.userId
  const ub = await userBalances(me)

  // Load public info for all users involved in balances
  const userIds = new Set<string>()
  for (const b of ub.balances) {
    userIds.add(b.from)
    userIds.add(b.to)
  }
  const userMap = await loadUsers(userIds)

  res.json({
    balances: ub.balances.map((b) => ({
      ...b,
      fromUser: userMap.get(b.from),
      toUser: userMap.get(b.to),
    })),
    simplified: ub.simplified.map((b) => ({
      ...b,
      fromUser: userMap.get(b.from),
      toUser: userMap.get(b.to),
    })),
    byContext: ub.byContext,
    totals: ub.totals,
  })
})
