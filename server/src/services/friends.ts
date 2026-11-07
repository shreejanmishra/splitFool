import mongoose, { type Types } from 'mongoose'
import { Friendship, Group, Invite, User, orderPair, type UserDoc } from '../models/index.js'
import { generateToken, hashToken } from '../lib/crypto.js'
import { sendMail, templates } from '../lib/mailer.js'
import { env } from '../config/env.js'
import { logger } from '../lib/logger.js'
import { recordActivity } from './activity.js'

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000

/** Create the friendship if it doesn't exist. Returns true if it was newly created. Race-safe via the unique index. */
export async function ensureFriendship(a: string, b: string, createdBy: string): Promise<boolean> {
  if (a === b) return false
  const [userA, userB] = orderPair(a, b)
  const res = await Friendship.updateOne(
    { userA, userB },
    { $setOnInsert: { userA, userB, createdBy } },
    { upsert: true },
  ).catch((err: { code?: number }) => {
    if (err?.code === 11000) return { upsertedCount: 0 }
    throw err
  })
  return res.upsertedCount > 0
}

/** Add a user to a group if not already a member (atomic; no duplicates under concurrency). */
export async function addGroupMember(groupId: Types.ObjectId | string, userId: string): Promise<boolean> {
  const res = await Group.updateOne(
    { _id: groupId, deletedAt: null, 'members.userId': { $ne: new mongoose.Types.ObjectId(userId) } },
    { $push: { members: { userId, role: 'member', joinedAt: new Date() } } },
  )
  return res.modifiedCount > 0
}

/** Make a new group member friends with every existing member (Splitwise behavior). */
export async function befriendGroup(groupId: Types.ObjectId | string, userId: string): Promise<void> {
  const group = await Group.findById(groupId).select('members.userId').lean()
  if (!group) return
  await Promise.all(group.members.map((m) => ensureFriendship(userId, m.userId.toString(), userId)))
}

export interface InviteResult {
  inviteId: string
  /** Only returned outside production so the dev UI / tests can follow the link. */
  devToken?: string
}

/** Create an invite and email it. */
export async function createInvite(params: {
  email: string
  inviter: { _id: Types.ObjectId | string; name: string }
  groupId?: Types.ObjectId | string
  groupName?: string
}): Promise<InviteResult> {
  const token = generateToken()
  const invite = await Invite.create({
    email: params.email.toLowerCase(),
    inviterId: params.inviter._id,
    groupId: params.groupId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  })
  const link = `${env.PUBLIC_URL}/invite?token=${encodeURIComponent(token)}`
  void sendMail({
    to: params.email,
    ...templates.invite({ inviterName: params.inviter.name, groupName: params.groupName, link }),
  })
  return { inviteId: invite._id.toString(), devToken: env.NODE_ENV === 'production' ? undefined : token }
}

async function applyInvite(invite: InstanceType<typeof Invite>, user: UserDoc): Promise<void> {
  // Claim atomically so the same invite can't be applied twice.
  const claimed = await Invite.findOneAndUpdate(
    { _id: invite._id, acceptedAt: null },
    { $set: { acceptedAt: new Date(), acceptedBy: user._id } },
  )
  if (!claimed) return

  const userId = user._id.toString()
  const inviterId = invite.inviterId.toString()
  if (inviterId === userId) return

  const inviterStillExists = await User.exists({ _id: inviterId })
  if (!inviterStillExists) return

  if (await ensureFriendship(inviterId, userId, inviterId)) {
    await recordActivity({ actorId: userId, type: 'friend_added', visibleTo: [inviterId], data: { friendId: inviterId } })
  }

  if (invite.groupId) {
    const group = await Group.findOne({ _id: invite.groupId, deletedAt: null, 'members.userId': inviterId })
    if (group && (await addGroupMember(group._id, userId))) {
      await befriendGroup(group._id, userId)
      await recordActivity({
        actorId: inviterId,
        type: 'member_added',
        groupId: group._id,
        visibleTo: [...group.members.map((m) => m.userId), user._id],
        data: { groupName: group.name, memberId: userId, memberName: user.name },
      })
    }
  }
}

/**
 * Called after sign-in with a provider-verified email:
 * accept every pending invite sent to that address.
 */
export async function acceptInvitesForVerifiedEmail(user: UserDoc): Promise<void> {
  try {
    const invites = await Invite.find({
      email: user.email,
      acceptedAt: null,
      expiresAt: { $gt: new Date() },
    })
    for (const invite of invites) await applyInvite(invite, user)
  } catch (err) {
    // Never block sign-in because of invites.
    logger.error({ err, userId: user._id }, 'Failed to apply pending invites')
  }
}

/** Accept an invite by its emailed token (works even if the user signed in with a different email). */
export async function acceptInviteToken(token: string, user: UserDoc): Promise<boolean> {
  const tokenHash = hashToken(token)
  const invite = await Invite.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  })
  if (!invite) return false
  if (invite.acceptedAt) {
    return invite.acceptedBy?.toString() === user._id.toString()
  }
  await applyInvite(invite, user)
  return true
}
