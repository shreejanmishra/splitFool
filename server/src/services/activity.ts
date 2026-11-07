import mongoose, { type Types } from 'mongoose'
import type { ActivityType } from '@splitfool/shared'
import { Activity } from '../models/index.js'
import { logger } from '../lib/logger.js'

type Id = Types.ObjectId | string

export interface ActivityInput {
  actorId: Id
  type: ActivityType
  visibleTo: Iterable<Id>
  groupId?: Id
  expenseId?: Id
  settlementId?: Id
  data?: Record<string, unknown>
}

/**
 * Record a feed entry. Failures are logged, never thrown —
 * the activity feed must not be able to break the action itself.
 */
export async function recordActivity(input: ActivityInput): Promise<void> {
  try {
    const visible = new Set([...input.visibleTo].map(String))
    visible.add(input.actorId.toString())
    await Activity.create({
      actorId: input.actorId,
      type: input.type,
      groupId: input.groupId,
      expenseId: input.expenseId,
      settlementId: input.settlementId,
      data: input.data ?? {},
      visibleTo: [...visible].map((id) => new mongoose.Types.ObjectId(id)),
    })
  } catch (err) {
    logger.error({ err, type: input.type }, 'Failed to record activity')
  }
}
