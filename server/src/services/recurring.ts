import type { RecurringFrequency } from '@splitfool/shared'
import { Group, RecurringRule, type RecurringRuleDoc } from '../models/index.js'
import { logger } from '../lib/logger.js'
import { createExpense } from './expenses.js'
import { isMember } from './access.js'

const daysInMonthUtc = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

/**
 * Next occurrence after `from`. Monthly/yearly rules clamp to the month length but keep the
 * original anchor day, so a rule started on Jan 31 runs Feb 28, then Mar 31 (not Mar 28).
 */
export function nextOccurrence(from: Date, frequency: RecurringFrequency, anchorDay: number): Date {
  const d = new Date(from)
  switch (frequency) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7)
      return d
    case 'biweekly':
      d.setUTCDate(d.getUTCDate() + 14)
      return d
    case 'monthly':
    case 'yearly': {
      const y = d.getUTCFullYear() + (frequency === 'yearly' ? 1 : 0)
      const m = d.getUTCMonth() + (frequency === 'monthly' ? 1 : 0)
      const ny = y + Math.floor(m / 12)
      const nm = m % 12
      const day = Math.min(anchorDay, daysInMonthUtc(ny, nm))
      return new Date(Date.UTC(ny, nm, day, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()))
    }
  }
}

const runKeyFor = (rule: RecurringRuleDoc, at: Date) => `${rule._id.toString()}:${at.toISOString()}`

/** Max periods to catch up per rule per run (e.g. after downtime). */
const MAX_CATCH_UP = 12

/**
 * Create expenses for all due recurring rules.
 *
 * Idempotent and safe to run concurrently on several instances:
 * - each period has a unique `recurringRunKey` on the expense (unique index → duplicates are rejected);
 * - advancing `nextRunAt` is conditional on the value we read, so only one worker moves it forward.
 */
export async function runDueRecurring(now = new Date()): Promise<{ created: number }> {
  let created = 0
  const due = await RecurringRule.find({ active: true, nextRunAt: { $lte: now } }).limit(500)

  for (const rule of due) {
    for (let i = 0; i < MAX_CATCH_UP && rule.nextRunAt <= now; i++) {
      const at = rule.nextRunAt
      const runKey = runKeyFor(rule, at)

      const group = await Group.findOne({ _id: rule.groupId, deletedAt: null })
      const people = [...rule.template.payers, ...rule.template.splits].map((p) => p.userId.toString())
      if (!group || !people.every((id) => isMember(group, id)) || !isMember(group, rule.createdBy.toString())) {
        await RecurringRule.updateOne({ _id: rule._id }, { $set: { active: false } })
        logger.info({ ruleId: rule._id }, 'Recurring rule deactivated (group gone or member left)')
        break
      }

      try {
        await createExpense(
          rule.createdBy.toString(),
          {
            groupId: rule.groupId.toString(),
            description: rule.template.description,
            category: rule.template.category,
            currency: rule.template.currency,
            amountMinor: rule.template.amountMinor,
            date: at,
            payers: rule.template.payers.map((p) => ({ userId: p.userId.toString(), amountMinor: p.amountMinor })),
            splits: rule.template.splits.map((p) => ({ userId: p.userId.toString(), amountMinor: p.amountMinor })),
            splitMethod: rule.template.splitMethod,
          },
          { recurringId: rule._id, recurringRunKey: runKey },
        )
        created++
      } catch (err) {
        // Duplicate key → this period was already created by another worker/run. Anything else is a real error.
        if ((err as { code?: number })?.code !== 11000) {
          logger.error({ err, ruleId: rule._id }, 'Recurring run failed')
          break
        }
      }

      const next = nextOccurrence(at, rule.frequency, rule.anchorDay)
      const res = await RecurringRule.updateOne(
        { _id: rule._id, nextRunAt: at },
        { $set: { nextRunAt: next, lastRunKey: runKey } },
      )
      if (res.modifiedCount === 0) break // another worker advanced it
      rule.nextRunAt = next
    }
  }
  return { created }
}
