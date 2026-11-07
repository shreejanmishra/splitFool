import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose'
import { GROUP_TYPES } from '@splitfool/shared'

export interface IGroupMember {
  userId: Types.ObjectId
  role: 'admin' | 'member'
  joinedAt: Date
}

export interface IGroup {
  name: string
  type: (typeof GROUP_TYPES)[number]
  defaultCurrency: string
  simplifyDebts: boolean
  members: IGroupMember[]
  createdBy: Types.ObjectId
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type GroupDoc = HydratedDocument<IGroup>

const memberSchema = new Schema<IGroupMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
)

const groupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    type: { type: String, enum: GROUP_TYPES, default: 'other' },
    defaultCurrency: { type: String, default: 'INR', uppercase: true, minlength: 3, maxlength: 3 },
    simplifyDebts: { type: Boolean, default: true },
    members: { type: [memberSchema], validate: [(v: unknown[]) => v.length <= 200, 'Too many members'] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: Date,
  },
  { timestamps: true },
)

groupSchema.index({ 'members.userId': 1, deletedAt: 1, updatedAt: -1 })

export const Group = mongoose.model<IGroup>('Group', groupSchema)
