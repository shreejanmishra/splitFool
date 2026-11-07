import { z } from 'zod'

// ─── Primitives ─────────────────────────────────────────────────────────────

/** 24-char hex MongoDB ObjectId. */
export const objectIdSchema = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id')

export const currencySchema = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Za-z]{3}$/, 'Invalid currency code')
  .toUpperCase()

export const EXPENSE_CATEGORIES = [
  'general', 'food', 'transport', 'entertainment', 'shopping',
  'utilities', 'rent', 'travel', 'health', 'education', 'other',
] as const

export const SPLIT_METHODS = ['equal', 'exact', 'percent', 'shares'] as const
export const GROUP_TYPES = ['home', 'trip', 'couple', 'other'] as const
export const RECURRING_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'yearly'] as const

/** Upper bound for a single amount: 10^12 minor units (well within 2^53). */
const MAX_AMOUNT = 1_000_000_000_000
const amountSchema = z.number().int().positive().max(MAX_AMOUNT)

const dateSchema = z.coerce
  .date()
  .refine((d) => d.getFullYear() >= 2000 && d.getFullYear() <= 2100, 'Date out of range')

// ─── Expense ────────────────────────────────────────────────────────────────

const participantSchema = z.object({
  userId: objectIdSchema,
  amountMinor: z.number().int().min(0).max(MAX_AMOUNT),
})

const expenseBase = z.object({
  groupId: objectIdSchema.optional(),
  description: z.string().trim().min(1).max(200),
  category: z.enum(EXPENSE_CATEGORIES),
  currency: currencySchema,
  amountMinor: amountSchema,
  date: dateSchema,
  payers: z.array(participantSchema).min(1).max(50),
  splits: z.array(participantSchema).min(1).max(50),
  splitMethod: z.enum(SPLIT_METHODS),
  /** For percent/shares: the raw user input values before conversion to amountMinor. */
  splitValues: z.record(z.string(), z.number().min(0).max(MAX_AMOUNT)).optional(),
  notes: z.string().trim().max(1000).optional(),
})

type ExpenseLike = {
  amountMinor?: number
  payers?: Array<{ userId: string; amountMinor: number }>
  splits?: Array<{ userId: string; amountMinor: number }>
}

/**
 * Validate that payers and splits each sum to the total and contain no duplicate users.
 * Exported so the server can re-check after merging a partial update.
 */
export function expenseTotalsIssues(e: ExpenseLike): string[] {
  const issues: string[] = []
  const check = (label: 'payers' | 'splits') => {
    const list = e[label]
    if (!list || e.amountMinor === undefined) return
    const sum = list.reduce((s, p) => s + p.amountMinor, 0)
    if (sum !== e.amountMinor) issues.push(`${label} must add up to the total (${sum} ≠ ${e.amountMinor})`)
    if (new Set(list.map((p) => p.userId)).size !== list.length) issues.push(`${label} contain duplicate users`)
  }
  check('payers')
  check('splits')
  return issues
}

export const createExpenseSchema = expenseBase
  .extend({ category: z.enum(EXPENSE_CATEGORIES).default('general') })
  .superRefine((e, ctx) => {
    for (const message of expenseTotalsIssues(e)) ctx.addIssue({ code: 'custom', message })
  })

export type CreateExpenseInput = z.input<typeof createExpenseSchema>

/** No defaults here, so omitted fields stay untouched on PATCH. */
export const updateExpenseSchema = expenseBase.omit({ groupId: true }).partial()
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>

export const listExpensesQuerySchema = z.object({
  groupId: objectIdSchema.optional(),
  friendId: objectIdSchema.optional(),
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
})

// ─── Group ──────────────────────────────────────────────────────────────────

export const createGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(GROUP_TYPES).default('other'),
  defaultCurrency: currencySchema.default('INR'),
  simplifyDebts: z.boolean().default(true),
  memberIds: z.array(objectIdSchema).max(100).optional(),
})

export type CreateGroupInput = z.input<typeof createGroupSchema>

export const updateGroupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  type: z.enum(GROUP_TYPES).optional(),
  defaultCurrency: currencySchema.optional(),
  simplifyDebts: z.boolean().optional(),
})
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>

/** Add a member by existing friend id, or by email (invites if not registered). */
export const addMemberSchema = z
  .object({
    userId: objectIdSchema.optional(),
    email: z.email().max(254).optional(),
  })
  .refine((v) => Boolean(v.userId) !== Boolean(v.email), 'Provide either userId or email')
export type AddMemberInput = z.infer<typeof addMemberSchema>

// ─── Friends ────────────────────────────────────────────────────────────────

export const addFriendSchema = z.object({
  email: z.email().max(254),
})
export type AddFriendInput = z.infer<typeof addFriendSchema>

// ─── Settlement ─────────────────────────────────────────────────────────────

export const createSettlementSchema = z
  .object({
    groupId: objectIdSchema.optional(),
    from: objectIdSchema,
    to: objectIdSchema,
    amountMinor: amountSchema,
    currency: currencySchema,
    date: dateSchema,
    notes: z.string().trim().max(500).optional(),
  })
  .refine((s) => s.from !== s.to, 'Payer and recipient must be different')

export type CreateSettlementInput = z.infer<typeof createSettlementSchema>

// ─── Comment ────────────────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>

// ─── Recurring rule ─────────────────────────────────────────────────────────

export const createRecurringSchema = expenseBase
  .omit({ date: true, notes: true })
  .extend({
    groupId: objectIdSchema,
    category: z.enum(EXPENSE_CATEGORIES).default('general'),
    frequency: z.enum(RECURRING_FREQUENCIES),
    startDate: dateSchema,
  })
  .superRefine((e, ctx) => {
    for (const message of expenseTotalsIssues(e)) ctx.addIssue({ code: 'custom', message })
  })

export type CreateRecurringInput = z.input<typeof createRecurringSchema>

export const updateRecurringSchema = z.object({
  active: z.boolean().optional(),
  description: z.string().trim().min(1).max(200).optional(),
  frequency: z.enum(RECURRING_FREQUENCIES).optional(),
})
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>

// ─── User profile ───────────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  defaultCurrency: currencySchema.optional(),
  notificationPrefs: z.object({
    email: z.boolean().optional(),
    expenseAdded: z.boolean().optional(),
    weeklySummary: z.boolean().optional(),
  }).optional(),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

// ─── Invite ─────────────────────────────────────────────────────────────────

export const createInviteSchema = z.object({
  email: z.email().max(254),
  groupId: objectIdSchema.optional(),
})

export type CreateInviteInput = z.infer<typeof createInviteSchema>

export const acceptInviteSchema = z.object({
  token: z.string().min(20).max(100),
})

// ─── Stats ──────────────────────────────────────────────────────────────────

export const statsQuerySchema = z.object({
  groupId: objectIdSchema.optional(),
  currency: currencySchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})
export type StatsQuery = z.infer<typeof statsQuerySchema>

// ─── Pagination ─────────────────────────────────────────────────────────────

export const cursorPaginationSchema = z.object({
  cursor: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type CursorPaginationInput = z.infer<typeof cursorPaginationSchema>
