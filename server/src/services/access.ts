import type { Types } from 'mongoose'
import { Friendship, Group, orderPair, type GroupDoc, type IExpense } from '../models/index.js'
import { forbidden, notFound } from '../lib/errors.js'

/**
 * Load a group the user belongs to.
 * Non-members get the same 404 as a missing group, so group ids can't be probed.
 */
export async function loadGroupForMember(groupId: Types.ObjectId | string, userId: string): Promise<GroupDoc> {
  const group = await Group.findOne({ _id: groupId, deletedAt: null, 'members.userId': userId })
  if (!group) throw notFound('Group not found')
  return group
}

export function isMember(group: { members: Array<{ userId: Types.ObjectId }> }, userId: string): boolean {
  return group.members.some((m) => m.userId.toString() === userId)
}

export function isAdmin(group: { members: Array<{ userId: Types.ObjectId; role: string }> }, userId: string): boolean {
  return group.members.some((m) => m.userId.toString() === userId && m.role === 'admin')
}

export function requireAdmin(group: GroupDoc, userId: string): void {
  if (!isAdmin(group, userId)) throw forbidden('Only group admins can do that')
}

export async function areFriends(a: string, b: string): Promise<boolean> {
  if (a === b) return true
  const [userA, userB] = orderPair(a, b)
  return (await Friendship.exists({ userA, userB })) !== null
}

/** Ids of everyone the user is friends with. */
export async function friendIdsOf(userId: string): Promise<string[]> {
  const rows = await Friendship.find({ $or: [{ userA: userId }, { userB: userId }] }).select('userA userB').lean()
  return rows.map((r) => (r.userA.toString() === userId ? r.userB.toString() : r.userA.toString()))
}

/**
 * Who may see an expense:
 * - any participant (even after leaving the group), and
 * - for group expenses, every current group member.
 */
export async function canViewExpense(
  expense: Pick<IExpense, 'groupId' | 'participantIds' | 'createdBy'>,
  userId: string,
): Promise<boolean> {
  if (expense.participantIds.some((id) => id.toString() === userId)) return true
  if (expense.createdBy.toString() === userId) return true
  if (expense.groupId) {
    return (await Group.exists({ _id: expense.groupId, deletedAt: null, 'members.userId': userId })) !== null
  }
  return false
}
