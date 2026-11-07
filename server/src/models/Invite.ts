import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose'

/**
 * Invitation for someone without an account (or to join a group).
 * Accepted automatically when a user signs in with a provider-verified matching email,
 * or explicitly via the emailed token.
 */
export interface IInvite {
  email: string
  inviterId: Types.ObjectId
  groupId?: Types.ObjectId
  /** SHA-256 of the emailed token. */
  tokenHash: string
  expiresAt: Date
  acceptedAt?: Date
  acceptedBy?: Types.ObjectId
  createdAt: Date
}

export type InviteDoc = HydratedDocument<IInvite>

const inviteSchema = new Schema<IInvite>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254, index: true },
    inviterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    groupId: { type: Schema.Types.ObjectId, ref: 'Group' },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: Date,
    acceptedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

// Expired invites are cleaned up automatically.
inviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const Invite = mongoose.model<IInvite>('Invite', inviteSchema)
