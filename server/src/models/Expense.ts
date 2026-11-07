import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose'
import { EXPENSE_CATEGORIES, SPLIT_METHODS } from '@splitfool/shared'

export interface IParticipant {
  userId: Types.ObjectId
  amountMinor: number
}

export interface IExpense {
  groupId?: Types.ObjectId
  description: string
  category: (typeof EXPENSE_CATEGORIES)[number]
  currency: string
  amountMinor: number
  /** Rate to convert this expense's currency into the group's (or creator's) default currency, captured at creation. */
  fxRate?: number
  fxBase?: string
  date: Date
  payers: IParticipant[]
  splits: IParticipant[]
  splitMethod: (typeof SPLIT_METHODS)[number]
  splitValues?: Map<string, number>
  notes?: string
  /** Union of payer and split user ids — drives visibility and friend queries. */
  participantIds: Types.ObjectId[]
  receiptFileId?: Types.ObjectId
  receiptMime?: string
  recurringId?: Types.ObjectId
  /** `${ruleId}:${periodISO}` — unique, so a recurring period can only ever produce one expense. */
  recurringRunKey?: string
  createdBy: Types.ObjectId
  updatedBy?: Types.ObjectId
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type ExpenseDoc = HydratedDocument<IExpense>

export const participantSchema = new Schema<IParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amountMinor: { type: Number, required: true, min: 0, validate: Number.isInteger },
  },
  { _id: false },
)

const expenseSchema = new Schema<IExpense>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, enum: EXPENSE_CATEGORIES, default: 'general' },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    amountMinor: { type: Number, required: true, min: 1, validate: Number.isInteger },
    fxRate: Number,
    fxBase: String,
    date: { type: Date, required: true },
    payers: { type: [participantSchema], required: true },
    splits: { type: [participantSchema], required: true },
    splitMethod: { type: String, enum: SPLIT_METHODS, required: true },
    splitValues: { type: Map, of: Number },
    notes: { type: String, maxlength: 1000 },
    participantIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    receiptFileId: Schema.Types.ObjectId,
    receiptMime: String,
    recurringId: { type: Schema.Types.ObjectId, ref: 'RecurringRule' },
    recurringRunKey: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: Date,
  },
  { timestamps: true },
)

// Keep participantIds in sync with payers/splits.
expenseSchema.pre('validate', function () {
  const ids = new Set<string>()
  for (const p of [...this.payers, ...this.splits]) ids.add(p.userId.toString())
  this.participantIds = [...ids].map((id) => new mongoose.Types.ObjectId(id))
})

expenseSchema.index({ groupId: 1, deletedAt: 1, date: -1, _id: -1 })
expenseSchema.index({ participantIds: 1, deletedAt: 1, date: -1, _id: -1 })
expenseSchema.index({ recurringRunKey: 1 }, { unique: true, partialFilterExpression: { recurringRunKey: { $type: 'string' } } })

export const Expense = mongoose.model<IExpense>('Expense', expenseSchema)
