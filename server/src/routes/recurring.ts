import { Router } from 'express'
import {
  createRecurringSchema,
  updateRecurringSchema,
} from '@splitfool/shared'
import { authenticate } from '../middleware/auth.js'
import { writeGuard } from '../middleware/rateLimit.js'
import { RecurringRule } from '../models/index.js'
import { notFound } from '../lib/errors.js'
import { oid, parse } from '../lib/validate.js'
import { assertParticipantsAllowed } from '../services/expenses.js'
import { loadGroupForMember } from '../services/access.js'
import { nextOccurrence } from '../services/recurring.js'
import { recordActivity } from '../services/activity.js'

export const recurringRouter = Router()
recurringRouter.use(authenticate, writeGuard)

/** List recurring rules for a group (or all active rules for the user's groups). */
recurringRouter.get('/', async (req, res) => {
  const me = req.auth!.userId
  const groupId = req.query.groupId ? oid(req.query.groupId, 'Group').toString() : undefined

  let filter: Record<string, unknown>
  if (groupId) {
    await loadGroupForMember(groupId, me)
    filter = { groupId }
  } else {
    filter = { createdBy: me }
  }

  const rules = await RecurringRule.find(filter).sort({ createdAt: -1 }).lean()
  res.json({ rules })
})

/** Create a new recurring rule. */
recurringRouter.post('/', async (req, res) => {
  const me = req.auth!.userId
  const data = parse(createRecurringSchema, req.body)

  const group = await assertParticipantsAllowed({
    actorId: me,
    groupId: data.groupId,
    payers: data.payers,
    splits: data.splits,
  })
  if (!group) throw notFound('Group required for recurring expenses')

  const anchorDay = data.startDate.getUTCDate()

  const rule = await RecurringRule.create({
    groupId: data.groupId,
    createdBy: me,
    template: {
      description: data.description,
      category: data.category,
      currency: data.currency,
      amountMinor: data.amountMinor,
      payers: data.payers,
      splits: data.splits,
      splitMethod: data.splitMethod,
    },
    frequency: data.frequency,
    anchorDay,
    nextRunAt: data.startDate,
    active: true,
  })

  await recordActivity({
    actorId: me,
    type: 'recurring_created',
    groupId: group._id,
    visibleTo: group.members.map((m) => m.userId),
    data: { description: data.description, frequency: data.frequency },
  })

  res.status(201).json({ rule })
})

/** Update a recurring rule (e.g. active toggle, description, frequency). */
recurringRouter.patch('/:id', async (req, res) => {
  const me = req.auth!.userId
  const ruleId = oid(req.params.id, 'Recurring rule')

  const rule = await RecurringRule.findOne({ _id: ruleId, createdBy: me })
  if (!rule) throw notFound('Recurring rule not found')

  const patch = parse(updateRecurringSchema, req.body)
  if (patch.active !== undefined) rule.active = patch.active
  if (patch.description !== undefined) rule.template.description = patch.description
  if (patch.frequency !== undefined) {
    rule.frequency = patch.frequency
    // Recalculate next occurrence if rule is active
    if (rule.nextRunAt <= new Date()) {
      rule.nextRunAt = nextOccurrence(new Date(), patch.frequency, rule.anchorDay)
    }
  }

  await rule.save()
  res.json({ ok: true, rule })
})

/** Delete a recurring rule. */
recurringRouter.delete('/:id', async (req, res) => {
  const me = req.auth!.userId
  const ruleId = oid(req.params.id, 'Recurring rule')

  const res2 = await RecurringRule.deleteOne({ _id: ruleId, createdBy: me })
  if (res2.deletedCount === 0) throw notFound('Recurring rule not found')

  res.json({ ok: true })
})
