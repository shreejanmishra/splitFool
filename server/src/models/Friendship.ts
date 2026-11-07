import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose'

/**
 * A friendship between two users. Stored once per pair with userA < userB
 * (by ObjectId hex) so the unique index prevents duplicates in either direction.
 */
export interface IFriendship {
  userA: Types.ObjectId
  userB: Types.ObjectId
  createdBy: Types.ObjectId
  createdAt: Date
}

export type FriendshipDoc = HydratedDocument<IFriendship>

const friendshipSchema = new Schema<IFriendship>(
  {
    userA: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    userB: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

friendshipSchema.index({ userA: 1, userB: 1 }, { unique: true })

/** Order a pair of ids so the same friendship always maps to the same document. */
export function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

export const Friendship = mongoose.model<IFriendship>('Friendship', friendshipSchema)
