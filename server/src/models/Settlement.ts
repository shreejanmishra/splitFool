import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose'

/** A recorded payment from one user to another ("settle up"). */
export interface ISettlement {
  groupId?: Types.ObjectId
  from: Types.ObjectId
  to: Types.ObjectId
  amountMinor: number
  currency: string
  date: Date
  notes?: string
  createdBy: Types.ObjectId
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type SettlementDoc = HydratedDocument<ISettlement>

const settlementSchema = new Schema<ISettlement>(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    from: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amountMinor: { type: Number, required: true, min: 1, validate: Number.isInteger },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    date: { type: Date, required: true },
    notes: { type: String, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: Date,
  },
  { timestamps: true },
)

settlementSchema.index({ groupId: 1, deletedAt: 1, date: -1 })
settlementSchema.index({ from: 1, deletedAt: 1 })
settlementSchema.index({ to: 1, deletedAt: 1 })

export const Settlement = mongoose.model<ISettlement>('Settlement', settlementSchema)
