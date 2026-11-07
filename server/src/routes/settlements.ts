import { Router } from 'express'
import { createSettlementSchema } from '@splitfool/shared'
import { authenticate } from '../middleware/auth.js'
import { writeGuard } from '../middleware/rateLimit.js'
import { Settlement } from '../models/index.js'
import { badRequest, notFound } from '../lib/errors.js'
import { oid, parse } from '../lib/validate.js'
import { areFriends, isMember, loadGroupForMember } from '../services/access.js'
import { recordActivity } from '../services/activity.js'
import { loadUsers } from '../services/users.js'

export const settlementsRouter = Router()
settlementsRouter.use(authenticate, writeGuard)

/** Record a payment between two people ("Settle Up"). */
settlementsRouter.post('/', async (req, res) => {
  const me = req.auth!.userId
  const data = parse(createSettlementSchema, req.body)

  if (data.from !== me && data.to !== me) {
    throw badRequest('You must be either the payer or recipient in a settlement')
  }

  let groupName: string | undefined
  if (data.groupId) {
    const group = await loadGroupForMember(data.groupId, me)
    if (!isMember(group, data.from) || !isMember(group, data.to)) {
      throw badRequest('Both participants must be members of the group')
    }
    groupName = group.name
  } else {
    // Non-group settlement: they must be friends
    const otherId = data.from === me ? data.to : data.from
    if (!(await areFriends(me, otherId))) {
      throw badRequest('You can only settle with friends')
    }
  }

  const settlement = await Settlement.create({
    groupId: data.groupId,
    from: data.from,
    to: data.to,
    amountMinor: data.amountMinor,
    currency: data.currency,
    date: data.date,
    notes: data.notes,
    createdBy: me,
  })

  await recordActivity({
    actorId: me,
    type: 'settlement_created',
    groupId: settlement.groupId,
    settlementId: settlement._id,
    visibleTo: [data.from, data.to],
    data: {
      from: data.from,
      to: data.to,
      amountMinor: settlement.amountMinor,
      currency: settlement.currency,
      groupName,
    },
  })

  res.status(201).json({ settlement })
})

/** List settlements involving the current user (or filtered by groupId). */
settlementsRouter.get('/', async (req, res) => {
  const me = req.auth!.userId
  const groupId = req.query.groupId ? oid(req.query.groupId, 'Group').toString() : undefined

  const filter: Record<string, unknown> = { deletedAt: null }
  if (groupId) {
    await loadGroupForMember(groupId, me)
    filter.groupId = groupId
  } else {
    filter.$or = [{ from: me }, { to: me }]
  }

  const settlements = await Settlement.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(50)
    .lean()

  const userIds = new Set<string>()
  for (const s of settlements) {
    userIds.add(s.from.toString())
    userIds.add(s.to.toString())
  }
  const userMap = await loadUsers(userIds)

  res.json({
    settlements: settlements.map((s) => ({
      _id: s._id.toString(),
      groupId: s.groupId?.toString(),
      from: userMap.get(s.from.toString()),
      to: userMap.get(s.to.toString()),
      amountMinor: s.amountMinor,
      currency: s.currency,
      date: s.date.toISOString(),
      notes: s.notes,
      createdAt: s.createdAt.toISOString(),
    })),
  })
})

/** Delete (void) a settlement. Only participants or creator can delete. */
settlementsRouter.delete('/:id', async (req, res) => {
  const me = req.auth!.userId
  const setlId = oid(req.params.id, 'Settlement')

  const settlement = await Settlement.findOne({ _id: setlId, deletedAt: null })
  if (!settlement) throw notFound('Settlement not found')

  const isParty = settlement.from.toString() === me || settlement.to.toString() === me
  const isCreator = settlement.createdBy.toString() === me
  if (!isParty && !isCreator) throw notFound('Settlement not found')

  settlement.deletedAt = new Date()
  await settlement.save()

  await recordActivity({
    actorId: me,
    type: 'settlement_deleted',
    groupId: settlement.groupId,
    settlementId: settlement._id,
    visibleTo: [settlement.from, settlement.to],
    data: { amountMinor: settlement.amountMinor, currency: settlement.currency },
  })

  res.json({ ok: true })
})
