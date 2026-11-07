import type { Types } from 'mongoose'
import { formatMoney } from '@splitfool/shared'
import { Expense, Group, User, type ExpenseDoc, type GroupDoc, type IExpense } from '../models/index.js'
import { badRequest } from '../lib/errors.js'
import { sendMail, templates } from '../lib/mailer.js'
import { env } from '../config/env.js'
import { logger } from '../lib/logger.js'
import { areFriends, isMember, loadGroupForMember } from './access.js'
import { getRate } from './fx.js'
import { recordActivity } from './activity.js'

type Participant = { userId: string; amountMinor: number }

/**
 * Check who may appear on an expense:
 * - Group expense: the actor and every payer/split user must be current group members.
 * - Non-group expense: the actor must be involved, and everyone else must be the actor's friend.
 */
export async function assertParticipantsAllowed(params: {
  actorId: string
  groupId?: Types.ObjectId | string
  payers: Participant[]
  splits: Participant[]
}): Promise<GroupDoc | null> {
  const ids = new Set([...params.payers, ...params.splits].map((p) => p.userId))

  if (params.groupId) {
    const group = await loadGroupForMember(params.groupId, params.actorId)
    for (const id of ids) if (!isMember(group, id)) throw badRequest('Everyone on the expense must be a group member')
    return group
  }

  if (!ids.has(params.actorId)) throw badRequest('You must be involved in a non-group expense')
  if (ids.size < 2) throw badRequest('An expense needs at least two people')
  for (const id of ids) {
    if (!(await areFriends(params.actorId, id))) throw badRequest('You can only split with friends')
  }
  return null
}

/** Capture the FX rate to the group (or creator's) default currency at creation time. */
async function captureFx(currency: string, group: GroupDoc | null, actorId: string) {
  let base = group?.defaultCurrency
  if (!base) base = (await User.findById(actorId).select('defaultCurrency').lean())?.defaultCurrency ?? 'INR'
  const rate = await getRate(currency, base)
  return rate ? { fxRate: rate, fxBase: base } : {}
}

export interface NewExpense {
  groupId?: string
  description: string
  category: IExpense['category']
  currency: string
  amountMinor: number
  date: Date
  payers: Participant[]
  splits: Participant[]
  splitMethod: IExpense['splitMethod']
  splitValues?: Record<string, number>
  notes?: string
}

/** Validate access, create the expense, record activity and notify participants. */
export async function createExpense(
  actorId: string,
  input: NewExpense,
  extra: { recurringId?: Types.ObjectId; recurringRunKey?: string } = {},
): Promise<ExpenseDoc> {
  const group = await assertParticipantsAllowed({ actorId, groupId: input.groupId, payers: input.payers, splits: input.splits })
  const fx = await captureFx(input.currency, group, actorId)

  const expense = await Expense.create({
    ...input,
    ...fx,
    ...extra,
    createdBy: actorId,
  })

  await recordActivity({
    actorId,
    type: 'expense_created',
    groupId: expense.groupId,
    expenseId: expense._id,
    visibleTo: group ? group.members.map((m) => m.userId) : expense.participantIds,
    data: {
      description: expense.description,
      amountMinor: expense.amountMinor,
      currency: expense.currency,
      groupName: group?.name,
      recurring: Boolean(extra.recurringId),
    },
  })

  void notifyExpenseAdded(expense, actorId).catch((err) => logger.error({ err }, 'notifyExpenseAdded failed'))
  return expense
}

async function notifyExpenseAdded(expense: ExpenseDoc, actorId: string): Promise<void> {
  const recipientIds = expense.participantIds.map(String).filter((id) => id !== actorId)
  if (recipientIds.length === 0) return
  const [actor, recipients] = await Promise.all([
    User.findById(actorId).select('name').lean(),
    User.find({
      _id: { $in: recipientIds },
      'notificationPrefs.email': true,
      'notificationPrefs.expenseAdded': true,
    })
      .select('email name')
      .lean(),
  ])
  const link = `${env.PUBLIC_URL}/expenses/${expense._id.toString()}`
  await Promise.all(
    recipients.map((r) => {
      const share = expense.splits.find((s) => s.userId.toString() === r._id.toString())?.amountMinor ?? 0
      return sendMail({
        to: r.email,
        ...templates.expenseAdded({
          actorName: actor?.name ?? 'Someone',
          description: expense.description,
          amount: formatMoney(expense.amountMinor, expense.currency),
          yourShare: formatMoney(share, expense.currency),
          link,
        }),
      })
    }),
  )
}

/** Members' ids for activity visibility on an existing expense. */
export async function expenseAudience(expense: Pick<IExpense, 'groupId' | 'participantIds'>): Promise<Types.ObjectId[]> {
  if (!expense.groupId) return expense.participantIds
  const group = await Group.findById(expense.groupId).select('members.userId').lean()
  return [...(group?.members.map((m) => m.userId) ?? []), ...expense.participantIds]
}
