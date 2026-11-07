import mongoose, { type Types } from 'mongoose'
import { User } from '../models/index.js'

export interface PublicUser {
  _id: string
  name: string
  email: string
  avatar?: string
}

/** The only user fields ever exposed to other users. */
export const PUBLIC_USER_FIELDS = '_id name email avatar'

export function toPublicUser(u: { _id: Types.ObjectId | string; name: string; email: string; avatar?: string }): PublicUser {
  return { _id: u._id.toString(), name: u.name, email: u.email, avatar: u.avatar }
}

/** Load public profiles for a set of user ids, keyed by id. */
export async function loadUsers(ids: Iterable<Types.ObjectId | string>): Promise<Map<string, PublicUser>> {
  const unique = [...new Set([...ids].map(String))].filter((id) => mongoose.isValidObjectId(id))
  if (unique.length === 0) return new Map()
  const objectIds = unique.map((id) => new mongoose.Types.ObjectId(id))
  const users = await User.find({ _id: { $in: objectIds } }).select(PUBLIC_USER_FIELDS).lean()
  return new Map(users.map((u) => [u._id.toString(), toPublicUser(u)]))
}
