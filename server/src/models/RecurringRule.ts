import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose'
import { EXPENSE_CATEGORIES, RECURRING_FREQUENCIES, SPLIT_METHODS } from '@splitfool/shared'
import { participantSchema, type IParticipant } from './Expense.js'

export interface IRecurringRule {
  groupId: Types.ObjectId
  createdBy: Types.ObjectId
  template: {
    description: string
    category: (typeof EXPENSE_CATEGORIES)[number]
    currency: string
    amountMinor: number
    payers: IParticipant[]
    splits: IParticipant[]
    splitMethod: (typeof SPLIT_METHODS)[number]
  }
  frequency: (typeof RECURRING_FREQUENCIES)[number]
  /** Day-of-month anchor for monthly/yearly rules, so Jan 31 → Feb 28 → Mar 31. */
  anchorDay: number
  nextRunAt: Date
  lastRunKey?: string
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export type RecurringRuleDoc = HydratedDocument<IRecurringRule>

const recurringSchema = new Schema<IRecurringRule>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    template: {
      type: new Schema(
        {
          description: { type: String, required: true, maxlength: 200 },
          category: { type: String, enum: EXPENSE_CATEGORIES, default: 'general' },
          currency: { type: String, required: true },
          amountMinor: { type: Number, required: true, min: 1 },
          payers: [participantSchema],
          splits: [participantSchema],
          splitMethod: { type: String, enum: SPLIT_METHODS, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    frequency: { type: String, enum: RECURRING_FREQUENCIES, required: true },
    anchorDay: { type: Number, min: 1, max: 31, required: true },
    nextRunAt: { type: Date, required: true },
    lastRunKey: String,
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
)

recurringSchema.index({ active: 1, nextRunAt: 1 })

export const RecurringRule = mongoose.model<IRecurringRule>('RecurringRule', recurringSchema)
