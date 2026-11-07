import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose'
import type { ActivityType } from '@splitfool/shared'

export interface IActivity {
  actorId: Types.ObjectId
  type: ActivityType
  groupId?: Types.ObjectId
  expenseId?: Types.ObjectId
  settlementId?: Types.ObjectId
  /** Small denormalized snapshot for rendering the feed without joins (description, amount, names…). */
  data: Record<string, unknown>
  /** Users who can see this entry in their feed. */
  visibleTo: Types.ObjectId[]
  createdAt: Date
}

export type ActivityDoc = HydratedDocument<IActivity>

const activitySchema = new Schema<IActivity>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    expenseId: { type: Schema.Types.ObjectId, ref: 'Expense' },
    settlementId: { type: Schema.Types.ObjectId, ref: 'Settlement' },
    data: { type: Schema.Types.Mixed, default: () => ({}) },
    visibleTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false },
)

activitySchema.index({ visibleTo: 1, _id: -1 })

export const Activity = mongoose.model<IActivity>('Activity', activitySchema)
