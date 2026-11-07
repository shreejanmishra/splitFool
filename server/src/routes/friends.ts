import { Router } from 'express'
import { acceptInviteSchema, addFriendSchema } from '@splitfool/shared'
import { authenticate } from '../middleware/auth.js'
import { inviteLimiter, writeGuard } from '../middleware/rateLimit.js'
import { Friendship, Group, Invite, User, orderPair } from '../models/index.js'
import { badRequest, conflict, notFound } from '../lib/errors.js'
import { oid, parse } from '../lib/validate.js'
import { areFriends, friendIdsOf } from '../services/access.js'
import { balanceWithFriend, userBalances } from '../services/balances.js'
import { acceptInviteToken, createInvite, ensureFriendship } from '../services/friends.js'
import { loadUsers, PUBLIC_USER_FIELDS, toPublicUser } from '../services/users.js'
import { recordActivity } from '../services/activity.js'

export const friendsRouter = Router()
friendsRouter.use(authenticate, writeGuard)

/** All friends with the net balance per currency (positive = they owe you). */
friendsRouter.get('/', async (req, res) => {
  const me = req.auth!.userId
  const [ids, ub] = await Promise.all([friendIdsOf(me), userBalances(me)])
  // People you share balances with (e.g. via a group) show up too, even if not explicitly friends.
  const all = new Set([...ids, ...ub.balances.map((b) => (b.from === me ? b.to : b.from))])
  const users = await loadUsers(all)
  const friends = [...users.values()]
    .map((u) => ({ user: u, balances: balanceWithFriend(ub, u._id) }))
    .sort((a, b) => a.user.name.localeCompare(b.user.name))
  res.json({ friends, totals: ub.totals })
})

/** Add a friend by email. Existing users are added immediately; others get an invite email. */
friendsRouter.post('/', inviteLimiter, async (req, res) => {
  const me = req.auth!.userId
  const { email } = parse(addFriendSchema, req.body)
  const normalized = email.toLowerCase()
  const meUser = await User.findById(me).select('name email').lean()
  if (!meUser) throw notFound('User not found')
  if (meUser.email === normalized) throw badRequest("You can't add yourself")

  const target = await User.findOne({ email: normalized }).select(PUBLIC_USER_FIELDS).lean()
  if (target) {
    const created = await ensureFriendship(me, target._id.toString(), me)
    if (created) {
      await recordActivity({ actorId: me, type: 'friend_added', visibleTo: [target._id], data: { friendId: target._id.toString() } })
    }
    return res.status(created ? 201 : 200).json({ status: 'added', friend: toPublicUser(target) })
  }

  const invite = await createInvite({ email: normalized, inviter: { _id: me, name: meUser.name } })
  res.status(202).json({ status: 'invited', email: normalized, ...invite })
})

/** Friend detail: profile, balances per currency, per-group breakdown, and shared groups. */
friendsRouter.get('/:id', async (req, res) => {
  const me = req.auth!.userId
  const friendId = oid(req.params.id, 'Friend').toString()
  const ub = await userBalances(me)
  const sharesBalance = ub.balances.some((b) => b.from === friendId || b.to === friendId)
  if (!(await areFriends(me, friendId)) && !sharesBalance) throw notFound('Friend not found')

  const [friend, groups] = await Promise.all([
    User.findById(friendId).select(PUBLIC_USER_FIELDS).lean(),
    Group.find({ deletedAt: null, 'members.userId': { $all: [me, friendId] } })
      .select('name type defaultCurrency')
      .lean(),
  ])
  if (!friend) throw notFound('Friend not found')

  const breakdown = ub.byContext
    .filter((b) => b.from === friendId || b.to === friendId)
    .map((b) => ({ groupId: b.groupId, currency: b.currency, amountMinor: b.from === friendId ? b.amountMinor : -b.amountMinor }))

  res.json({
    friend: toPublicUser(friend),
    balances: balanceWithFriend(ub, friendId),
    breakdown,
    groups,
  })
})

/** Remove a friend. Only allowed when you're settled up and share no groups' open debts. */
friendsRouter.delete('/:id', async (req, res) => {
  const me = req.auth!.userId
  const friendId = oid(req.params.id, 'Friend').toString()
  const [userA, userB] = orderPair(me, friendId)
  const f = await Friendship.findOne({ userA, userB })
  if (!f) throw notFound('Friend not found')

  const ub = await userBalances(me)
  if (balanceWithFriend(ub, friendId).length > 0) throw conflict('Settle up before removing this friend')

  await f.deleteOne()
  res.json({ ok: true })
})

// ─── Invites ───────────────────────────────────────────────────────────────────

export const invitesRouter = Router()
invitesRouter.use(authenticate, writeGuard)

/** Invites you've sent that are still pending. */
invitesRouter.get('/', async (req, res) => {
  const invites = await Invite.find({
    inviterId: req.auth!.userId,
    acceptedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .select('email groupId expiresAt createdAt')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()
  res.json({ invites })
})

/** Accept an invite from its emailed link. */
invitesRouter.post('/accept', inviteLimiter, async (req, res) => {
  const { token } = parse(acceptInviteSchema, req.body)
  const user = await User.findById(req.auth!.userId)
  if (!user) throw notFound('User not found')
  const ok = await acceptInviteToken(token, user)
  if (!ok) throw notFound('Invite not found or expired')
  res.json({ ok: true })
})

/** Cancel a pending invite you sent. */
invitesRouter.delete('/:id', async (req, res) => {
  const res2 = await Invite.deleteOne({ _id: oid(req.params.id, 'Invite'), inviterId: req.auth!.userId, acceptedAt: null })
  if (res2.deletedCount === 0) throw notFound('Invite not found')
  res.json({ ok: true })
})
