import type { Types } from 'mongoose'
import { Router } from 'express'
import {
  addMemberSchema,
  createGroupSchema,
  updateGroupSchema,
} from '@splitfool/shared'
import { authenticate } from '../middleware/auth.js'
import { inviteLimiter, writeGuard } from '../middleware/rateLimit.js'
import { Group, User, type GroupDoc, type IGroup } from '../models/index.js'
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js'
import { oid, parse } from '../lib/validate.js'
import { isAdmin, isMember, loadGroupForMember, requireAdmin } from '../services/access.js'
import { groupBalances, hasOpenGroupBalance } from '../services/balances.js'
import { addGroupMember, befriendGroup, createInvite } from '../services/friends.js'
import { loadUsers, PUBLIC_USER_FIELDS, toPublicUser, type PublicUser } from '../services/users.js'
import { recordActivity } from '../services/activity.js'

export const groupsRouter = Router()
groupsRouter.use(authenticate, writeGuard)

function formatGroup(
  g: Pick<IGroup, 'name' | 'type' | 'defaultCurrency' | 'simplifyDebts' | 'createdBy' | 'createdAt' | 'updatedAt' | 'members'> & { _id: Types.ObjectId },
  userMap: Map<string, PublicUser>,
) {
  return {
    _id: g._id.toString(),
    name: g.name,
    type: g.type,
    defaultCurrency: g.defaultCurrency,
    simplifyDebts: g.simplifyDebts,
    createdBy: g.createdBy.toString(),
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
    members: g.members.map((m) => {
      const u = userMap.get(m.userId.toString())
      return {
        userId: m.userId.toString(),
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        name: u?.name ?? 'Unknown',
        email: u?.email ?? '',
        avatar: u?.avatar,
      }
    }),
  }
}

async function addExistingUserToGroup(
  group: GroupDoc,
  target: { _id: Types.ObjectId; name: string; email: string; avatar?: string },
  actorId: string,
) {
  const targetId = target._id.toString()
  if (isMember(group, targetId)) {
    throw conflict('User is already a member of this group')
  }
  await addGroupMember(group._id, targetId)
  await befriendGroup(group._id, targetId)

  await recordActivity({
    actorId,
    type: 'member_added',
    groupId: group._id,
    visibleTo: [...group.members.map((m) => m.userId), target._id],
    data: { groupName: group.name, memberId: targetId, memberName: target.name },
  })

  return toPublicUser(target)
}

/** List all groups the user is currently a member of. */
groupsRouter.get('/', async (req, res) => {
  const me = req.auth!.userId
  const groups = await Group.find({
    deletedAt: null,
    'members.userId': me,
  })
    .sort({ updatedAt: -1 })
    .lean()

  // Collect all unique member user IDs to load their public profiles
  const userIds = new Set<string>()
  for (const g of groups) {
    for (const m of g.members) {
      userIds.add(m.userId.toString())
    }
  }
  const userMap = await loadUsers(userIds)

  res.json({ groups: groups.map((g) => formatGroup(g, userMap)) })
})

/** Create a new group. The creator is added as an admin. */
groupsRouter.post('/', async (req, res) => {
  const me = req.auth!.userId
  const data = parse(createGroupSchema, req.body)

  const members: Array<{ userId: string; role: 'admin' | 'member'; joinedAt: Date }> = [
    { userId: me, role: 'admin', joinedAt: new Date() },
  ]

  // Add initial members if provided
  if (data.memberIds && data.memberIds.length > 0) {
    for (const id of data.memberIds) {
      if (id !== me && !members.some((m) => m.userId === id)) {
        members.push({ userId: id, role: 'member', joinedAt: new Date() })
      }
    }
  }

  const group = await Group.create({
    name: data.name,
    type: data.type,
    defaultCurrency: data.defaultCurrency,
    simplifyDebts: data.simplifyDebts,
    members,
    createdBy: me,
  })

  // Befriend all members together
  await Promise.all(
    members.filter((m) => m.userId !== me).map((m) => befriendGroup(group._id, m.userId)),
  )

  await recordActivity({
    actorId: me,
    type: 'group_created',
    groupId: group._id,
    visibleTo: members.map((m) => m.userId),
    data: { name: group.name },
  })

  const userMap = await loadUsers(members.map((m) => m.userId))

  res.status(201).json({ group: formatGroup(group, userMap) })
})

/** Get group detail by id. */
groupsRouter.get('/:id', async (req, res) => {
  const me = req.auth!.userId
  const group = await loadGroupForMember(oid(req.params.id, 'Group'), me)

  const userMap = await loadUsers(group.members.map((m) => m.userId))

  res.json({ group: formatGroup(group, userMap) })
})

/** Update group settings (name, defaultCurrency, simplifyDebts, etc.). Requires admin. */
groupsRouter.patch('/:id', async (req, res) => {
  const me = req.auth!.userId
  const group = await loadGroupForMember(oid(req.params.id, 'Group'), me)
  requireAdmin(group, me)

  const data = parse(updateGroupSchema, req.body)
  if (data.name !== undefined) group.name = data.name
  if (data.type !== undefined) group.type = data.type
  if (data.defaultCurrency !== undefined) group.defaultCurrency = data.defaultCurrency
  if (data.simplifyDebts !== undefined) group.simplifyDebts = data.simplifyDebts

  await group.save()

  await recordActivity({
    actorId: me,
    type: 'group_updated',
    groupId: group._id,
    visibleTo: group.members.map((m) => m.userId),
    data: { name: group.name },
  })

  res.json({ ok: true, group })
})

/** Add a member to a group by userId or email. */
groupsRouter.post('/:id/members', inviteLimiter, async (req, res) => {
  const me = req.auth!.userId
  const group = await loadGroupForMember(oid(req.params.id, 'Group'), me)
  const input = parse(addMemberSchema, req.body)

  const meUser = await User.findById(me).select('name email').lean()
  if (!meUser) throw notFound('User not found')

  if (input.userId) {
    const targetId = oid(input.userId, 'User')
    const targetUser = await User.findById(targetId).select(PUBLIC_USER_FIELDS).lean()
    if (!targetUser) throw notFound('User not found')

    const member = await addExistingUserToGroup(group, targetUser, me)
    return res.status(201).json({ status: 'added', member })
  }

  // Adding by email
  const email = input.email!.toLowerCase()
  if (email === meUser.email) throw badRequest("You are already in this group")

  const target = await User.findOne({ email }).select(PUBLIC_USER_FIELDS).lean()
  if (target) {
    const member = await addExistingUserToGroup(group, target, me)
    return res.status(201).json({ status: 'added', member })
  }

  // Not registered yet -> create group invite
  const invite = await createInvite({
    email,
    inviter: { _id: me, name: meUser.name },
    groupId: group._id,
    groupName: group.name,
  })

  res.status(202).json({ status: 'invited', email, ...invite })
})

/** Remove a member from the group. Requires admin (or self leaving). Must have settled balance. */
groupsRouter.delete('/:id/members/:userId', async (req, res) => {
  const me = req.auth!.userId
  const group = await loadGroupForMember(oid(req.params.id, 'Group'), me)
  const targetId = oid(req.params.userId, 'User').toString()

  if (!isMember(group, targetId)) {
    throw notFound('Member not found in group')
  }

  const isSelf = me === targetId
  if (!isSelf && !isAdmin(group, me)) {
    throw forbidden('Only admins can remove other members')
  }

  // Must not have an open balance in the group
  if (await hasOpenGroupBalance(group._id, targetId)) {
    throw conflict(
      isSelf
        ? 'You must settle all debts in this group before leaving'
        : 'Member must settle all debts before being removed',
    )
  }

  // If removing an admin, ensure at least one admin remains unless group is empty
  const isTargetAdmin = isAdmin(group, targetId)
  const remainingAdmins = group.members.filter((m) => m.role === 'admin' && m.userId.toString() !== targetId)
  if (isTargetAdmin && remainingAdmins.length === 0 && group.members.length > 1) {
    // Promote the next oldest member to admin
    const nextMember = group.members.find((m) => m.userId.toString() !== targetId)
    if (nextMember) nextMember.role = 'admin'
  }

  group.members = group.members.filter((m) => m.userId.toString() !== targetId) as any
  await group.save()

  await recordActivity({
    actorId: me,
    type: 'member_removed',
    groupId: group._id,
    visibleTo: group.members.map((m) => m.userId),
    data: { groupName: group.name, memberId: targetId },
  })

  res.json({ ok: true })
})

/** Balances & simplified debts for this group. */
groupsRouter.get('/:id/balances', async (req, res) => {
  const me = req.auth!.userId
  const group = await loadGroupForMember(oid(req.params.id, 'Group'), me)
  const balances = await groupBalances(group)
  res.json(balances)
})

/** Soft-delete a group. Requires admin and all members must be settled up. */
groupsRouter.delete('/:id', async (req, res) => {
  const me = req.auth!.userId
  const group = await loadGroupForMember(oid(req.params.id, 'Group'), me)
  requireAdmin(group, me)

  // Check if any member has an open balance
  const b = await groupBalances(group)
  if (b.balances.length > 0) {
    throw conflict('All group debts must be settled before deleting the group')
  }

  group.deletedAt = new Date()
  await group.save()

  await recordActivity({
    actorId: me,
    type: 'group_deleted',
    groupId: group._id,
    visibleTo: group.members.map((m) => m.userId),
    data: { name: group.name },
  })

  res.json({ ok: true })
})
