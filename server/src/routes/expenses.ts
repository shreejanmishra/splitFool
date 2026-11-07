import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import {
  createCommentSchema,
  createExpenseSchema,
  expenseTotalsIssues,
  listExpensesQuerySchema,
  updateExpenseSchema,
} from '@splitfool/shared'
import { authenticate } from '../middleware/auth.js'
import { uploadLimiter, writeGuard } from '../middleware/rateLimit.js'
import { Comment, Expense, Group, User } from '../models/index.js'
import { badRequest, forbidden, notFound } from '../lib/errors.js'
import { dateCursorFilter, decodeCursor, encodeCursor, escapeRegex, oid, parse } from '../lib/validate.js'
import { canViewExpense, loadGroupForMember } from '../services/access.js'
import { assertParticipantsAllowed, createExpense, expenseAudience } from '../services/expenses.js'
import { deleteReceipt, openReceipt, storeReceipt, MAX_RECEIPT_BYTES } from '../services/receipts.js'
import { loadUsers, toPublicUser } from '../services/users.js'
import { recordActivity } from '../services/activity.js'

export const expensesRouter = Router()
expensesRouter.use(authenticate, writeGuard)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RECEIPT_BYTES },
})

/** List expenses with cursor pagination and optional groupId / friendId filters. */
expensesRouter.get('/', async (req, res) => {
  const me = req.auth!.userId
  const q = parse(listExpensesQuerySchema, req.query)

  const filter: Record<string, unknown> = { deletedAt: null }

  if (q.groupId) {
    await loadGroupForMember(q.groupId, me)
    filter.groupId = q.groupId
  } else if (q.friendId) {
    const friendId = oid(q.friendId, 'Friend').toString()
    filter.participantIds = { $all: [me, friendId] }
    filter.groupId = null
  } else {
    // All expenses visible to me (either I'm a participant or it's in one of my groups)
    const myGroups = await Group.find({ 'members.userId': me, deletedAt: null }).select('_id').lean()
    const myGroupIds = myGroups.map((g) => g._id)
    filter.$or = [
      { participantIds: me },
      { groupId: { $in: myGroupIds } },
    ]
  }

  if (q.q) {
    filter.description = { $regex: escapeRegex(q.q), $options: 'i' }
  }

  const cursor = decodeCursor(q.cursor)
  if (cursor) {
    Object.assign(filter, dateCursorFilter(cursor))
  }

  const limit = q.limit
  const items = await Expense.find(filter)
    .sort({ date: -1, _id: -1 })
    .limit(limit + 1)
    .lean()

  const hasMore = items.length > limit
  const results = hasMore ? items.slice(0, limit) : items

  const nextCursor = hasMore && results.length > 0
    ? encodeCursor(results[results.length - 1]!.date, results[results.length - 1]!._id)
    : null

  // Collect all user IDs involved
  const allUserIds = new Set<string>()
  for (const e of results) {
    for (const p of e.payers) allUserIds.add(p.userId.toString())
    for (const s of e.splits) allUserIds.add(s.userId.toString())
    allUserIds.add(e.createdBy.toString())
  }
  const userMap = await loadUsers(allUserIds)

  const formatted = results.map((e) => ({
    _id: e._id.toString(),
    groupId: e.groupId?.toString(),
    description: e.description,
    category: e.category,
    currency: e.currency,
    amountMinor: e.amountMinor,
    date: e.date.toISOString(),
    payers: e.payers.map((p) => ({
      userId: p.userId.toString(),
      amountMinor: p.amountMinor,
      user: userMap.get(p.userId.toString()),
    })),
    splits: e.splits.map((s) => ({
      userId: s.userId.toString(),
      amountMinor: s.amountMinor,
      user: userMap.get(s.userId.toString()),
    })),
    splitMethod: e.splitMethod,
    hasReceipt: Boolean(e.receiptFileId),
    createdBy: e.createdBy.toString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }))

  res.json({
    expenses: formatted,
    cursor: nextCursor,
    hasMore,
  })
})

/** Create an expense. */
expensesRouter.post('/', async (req, res) => {
  const me = req.auth!.userId
  const data = parse(createExpenseSchema, req.body)

  const expense = await createExpense(me, {
    groupId: data.groupId,
    description: data.description,
    category: data.category,
    currency: data.currency,
    amountMinor: data.amountMinor,
    date: data.date,
    payers: data.payers,
    splits: data.splits,
    splitMethod: data.splitMethod,
    splitValues: data.splitValues,
    notes: data.notes,
  })

  res.status(201).json({ expense })
})

/** Get expense detail including comments and receipt info. */
expensesRouter.get('/:id', async (req, res) => {
  const me = req.auth!.userId
  const expId = oid(req.params.id, 'Expense')

  const expense = await Expense.findOne({ _id: expId, deletedAt: null }).lean()
  if (!expense) throw notFound('Expense not found')

  if (!(await canViewExpense(expense, me))) {
    throw notFound('Expense not found')
  }

  // Load participants & creator profiles
  const allUserIds = new Set<string>([
    ...expense.payers.map((p) => p.userId.toString()),
    ...expense.splits.map((s) => s.userId.toString()),
    expense.createdBy.toString(),
  ])

  // Also load comments
  const comments = await Comment.find({ expenseId: expense._id }).sort({ createdAt: 1 }).lean()
  for (const c of comments) allUserIds.add(c.userId.toString())

  const userMap = await loadUsers(allUserIds)

  res.json({
    expense: {
      ...expense,
      _id: expense._id.toString(),
      groupId: expense.groupId?.toString(),
      payers: expense.payers.map((p) => ({
        userId: p.userId.toString(),
        amountMinor: p.amountMinor,
        user: userMap.get(p.userId.toString()),
      })),
      splits: expense.splits.map((s) => ({
        userId: s.userId.toString(),
        amountMinor: s.amountMinor,
        user: userMap.get(s.userId.toString()),
      })),
      hasReceipt: Boolean(expense.receiptFileId),
      creator: userMap.get(expense.createdBy.toString()),
    },
    comments: comments.map((c) => ({
      _id: c._id.toString(),
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      user: userMap.get(c.userId.toString()),
    })),
  })
})

/** Update an expense. Only participants or group members can edit. */
expensesRouter.patch('/:id', async (req, res) => {
  const me = req.auth!.userId
  const expId = oid(req.params.id, 'Expense')

  const expense = await Expense.findOne({ _id: expId, deletedAt: null })
  if (!expense) throw notFound('Expense not found')
  if (!(await canViewExpense(expense, me))) throw notFound('Expense not found')

  const patch = parse(updateExpenseSchema, req.body)

  const merged = {
    amountMinor: patch.amountMinor ?? expense.amountMinor,
    payers: patch.payers ?? expense.payers.map((p) => ({ userId: p.userId.toString(), amountMinor: p.amountMinor })),
    splits: patch.splits ?? expense.splits.map((s) => ({ userId: s.userId.toString(), amountMinor: s.amountMinor })),
  }

  const issues = expenseTotalsIssues(merged)
  if (issues.length > 0) {
    throw badRequest(issues[0])
  }

  // Re-verify participant permissions
  await assertParticipantsAllowed({
    actorId: me,
    groupId: expense.groupId,
    payers: merged.payers,
    splits: merged.splits,
  })

  if (patch.description !== undefined) expense.description = patch.description
  if (patch.category !== undefined) expense.category = patch.category
  if (patch.currency !== undefined) expense.currency = patch.currency
  if (patch.amountMinor !== undefined) expense.amountMinor = patch.amountMinor
  if (patch.date !== undefined) expense.date = patch.date
  if (patch.payers !== undefined) expense.payers = patch.payers as any
  if (patch.splits !== undefined) expense.splits = patch.splits as any
  if (patch.splitMethod !== undefined) {
    expense.splitMethod = patch.splitMethod
    if ((patch.splitMethod === 'equal' || patch.splitMethod === 'exact') && patch.splitValues === undefined) {
      expense.splitValues = undefined
    }
  }
  if (patch.splitValues !== undefined) expense.splitValues = patch.splitValues as any
  if (patch.notes !== undefined) expense.notes = patch.notes

  expense.updatedBy = oid(me, 'User')
  await expense.save()

  const audience = await expenseAudience(expense)
  await recordActivity({
    actorId: me,
    type: 'expense_updated',
    groupId: expense.groupId,
    expenseId: expense._id,
    visibleTo: audience,
    data: {
      description: expense.description,
      amountMinor: expense.amountMinor,
      currency: expense.currency,
    },
  })

  res.json({ ok: true, expense })
})

/** Soft-delete an expense. */
expensesRouter.delete('/:id', async (req, res) => {
  const me = req.auth!.userId
  const expId = oid(req.params.id, 'Expense')

  const expense = await Expense.findOne({ _id: expId, deletedAt: null })
  if (!expense) throw notFound('Expense not found')
  if (!(await canViewExpense(expense, me))) throw notFound('Expense not found')

  // Clean up receipt if any
  if (expense.receiptFileId) {
    await deleteReceipt(expense.receiptFileId)
    expense.receiptFileId = undefined
    expense.receiptMime = undefined
  }

  expense.deletedAt = new Date()
  expense.updatedBy = oid(me, 'User')
  await expense.save()

  const audience = await expenseAudience(expense)
  await recordActivity({
    actorId: me,
    type: 'expense_deleted',
    groupId: expense.groupId,
    expenseId: expense._id,
    visibleTo: audience,
    data: { description: expense.description },
  })

  res.json({ ok: true })
})

// ─── Receipts ──────────────────────────────────────────────────────────────────

/** Upload or replace a receipt for an expense. */
expensesRouter.post('/:id/receipt', uploadLimiter, upload.single('receipt'), async (req: Request, res: Response) => {
  const me = req.auth!.userId
  const expId = oid(req.params.id, 'Expense')

  const expense = await Expense.findOne({ _id: expId, deletedAt: null })
  if (!expense) throw notFound('Expense not found')
  if (!(await canViewExpense(expense, me))) throw notFound('Expense not found')

  if (!req.file || !req.file.buffer) {
    throw badRequest('No file uploaded')
  }

  // Delete previous receipt if any
  if (expense.receiptFileId) {
    await deleteReceipt(expense.receiptFileId)
  }

  const stored = await storeReceipt(req.file.buffer, {
    expenseId: expense._id.toString(),
    uploadedBy: me,
  })

  expense.receiptFileId = stored.fileId
  expense.receiptMime = stored.mime
  await expense.save()

  res.status(201).json({ ok: true, fileId: stored.fileId.toString(), mime: stored.mime })
})

/** Download / view the receipt file. */
expensesRouter.get('/:id/receipt', async (req: Request, res: Response) => {
  const me = req.auth!.userId
  const expId = oid(req.params.id, 'Expense')

  const expense = await Expense.findOne({ _id: expId, deletedAt: null })
  if (!expense || !expense.receiptFileId) throw notFound('Receipt not found')
  if (!(await canViewExpense(expense, me))) throw notFound('Receipt not found')

  const mime = expense.receiptMime || 'application/octet-stream'
  res.setHeader('Content-Type', mime)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (mime === 'application/pdf') {
    res.setHeader('Content-Disposition', 'attachment; filename="receipt.pdf"')
  } else {
    res.setHeader('Content-Disposition', 'inline; filename="receipt.webp"')
  }

  const stream = openReceipt(expense.receiptFileId)
  stream.on('error', () => {
    if (!res.headersSent) res.status(404).json({ error: { code: 'not_found', message: 'Receipt file not found' } })
  })
  stream.pipe(res)
})

/** Delete a receipt from an expense. */
expensesRouter.delete('/:id/receipt', async (req, res) => {
  const me = req.auth!.userId
  const expId = oid(req.params.id, 'Expense')

  const expense = await Expense.findOne({ _id: expId, deletedAt: null })
  if (!expense || !expense.receiptFileId) throw notFound('Receipt not found')
  if (!(await canViewExpense(expense, me))) throw notFound('Receipt not found')

  await deleteReceipt(expense.receiptFileId)
  expense.receiptFileId = undefined
  expense.receiptMime = undefined
  await expense.save()

  res.json({ ok: true })
})

// ─── Comments ──────────────────────────────────────────────────────────────────

/** List comments for an expense. */
expensesRouter.get('/:id/comments', async (req, res) => {
  const me = req.auth!.userId
  const expId = oid(req.params.id, 'Expense')

  const expense = await Expense.findOne({ _id: expId, deletedAt: null }).lean()
  if (!expense) throw notFound('Expense not found')
  if (!(await canViewExpense(expense, me))) throw notFound('Expense not found')

  const comments = await Comment.find({ expenseId: expId }).sort({ createdAt: 1 }).lean()
  const users = await loadUsers(comments.map((c) => c.userId))

  res.json({
    comments: comments.map((c) => ({
      _id: c._id.toString(),
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      user: users.get(c.userId.toString()),
    })),
  })
})

/** Add a comment on an expense. */
expensesRouter.post('/:id/comments', async (req, res) => {
  const me = req.auth!.userId
  const expId = oid(req.params.id, 'Expense')

  const expense = await Expense.findOne({ _id: expId, deletedAt: null })
  if (!expense) throw notFound('Expense not found')
  if (!(await canViewExpense(expense, me))) throw notFound('Expense not found')

  const data = parse(createCommentSchema, req.body)

  const comment = await Comment.create({
    expenseId: expId,
    userId: me,
    body: data.body,
  })

  const meUser = await User.findById(me).select('name email avatar').lean()

  const audience = await expenseAudience(expense)
  await recordActivity({
    actorId: me,
    type: 'comment_added',
    groupId: expense.groupId,
    expenseId: expense._id,
    visibleTo: audience,
    data: { description: expense.description, commentSnippet: data.body.slice(0, 50) },
  })

  res.status(201).json({
    comment: {
      _id: comment._id.toString(),
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      user: meUser ? toPublicUser(meUser) : undefined,
    },
  })
})

/** Delete a comment. Only the comment author or expense creator can delete. */
expensesRouter.delete('/:id/comments/:commentId', async (req, res) => {
  const me = req.auth!.userId
  const expId = oid(req.params.id, 'Expense')
  const commentId = oid(req.params.commentId, 'Comment')

  const [expense, comment] = await Promise.all([
    Expense.findOne({ _id: expId, deletedAt: null }),
    Comment.findOne({ _id: commentId, expenseId: expId }),
  ])

  if (!expense || !comment) throw notFound('Comment not found')

  const isAuthor = comment.userId.toString() === me
  const isCreator = expense.createdBy.toString() === me
  if (!isAuthor && !isCreator) {
    throw forbidden('You cannot delete this comment')
  }

  await comment.deleteOne()
  res.json({ ok: true })
})
