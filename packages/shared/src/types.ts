/** Supported split methods. */
export type SplitMethod = 'equal' | 'exact' | 'percent' | 'shares'

/** ISO 4217 currency codes we support (extensible). */
export type CurrencyCode = string

/** A participant's share in an expense (payer or split recipient). */
export interface Participant {
  userId: string
  /** Amount in minor units (cents/paise). Always an integer. */
  amountMinor: number
}

/** Expense category. */
export type ExpenseCategory =
  | 'general'
  | 'food'
  | 'transport'
  | 'entertainment'
  | 'shopping'
  | 'utilities'
  | 'rent'
  | 'travel'
  | 'health'
  | 'education'
  | 'other'

/** Friendship status. */
export type FriendshipStatus = 'pending' | 'accepted'

/** Group member role. */
export type GroupRole = 'admin' | 'member'

/** Recurring frequency. */
export type RecurringFrequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly'

/** A balance entry: who owes whom. */
export interface Balance {
  from: string
  to: string
  amountMinor: number
  currency: CurrencyCode
}

/** Activity event types. */
export type ActivityType =
  | 'expense_created'
  | 'expense_updated'
  | 'expense_deleted'
  | 'settlement_created'
  | 'settlement_deleted'
  | 'group_created'
  | 'group_updated'
  | 'group_deleted'
  | 'member_added'
  | 'member_removed'
  | 'comment_added'
  | 'friend_added'
  | 'recurring_created'
