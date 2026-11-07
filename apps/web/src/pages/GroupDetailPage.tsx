import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Users,
  Receipt,
  HandCoins,
  Plus,
  Sparkles,
  UserPlus,
  Trash2,
  AlertCircle,
  CheckCircle,
  Repeat,
} from 'lucide-react'
import { formatMoney, type Balance } from '@splitfool/shared'
import { useAuthStore, useGroupStore, useExpenseStore, useBalanceStore } from '@splitfool/store'
import { AddExpenseModal } from '../components/modals/AddExpenseModal'
import { SettleUpModal } from '../components/modals/SettleUpModal'
import { webApi } from '../api/client'

export const GroupDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { currentGroup, fetchGroup } = useGroupStore()
  const { expenses, fetchExpenses, deleteExpense } = useExpenseStore()
  const { balances, simplifiedDebts, fetchBalances } = useBalanceStore()

  const [activeTab, setActiveTab] = useState<'expenses' | 'balances' | 'members' | 'recurring'>('expenses')
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showSettleUp, setShowSettleUp] = useState(false)
  const [settlePayerId, setSettlePayerId] = useState<string | undefined>()
  const [settleRecipientId, setSettleRecipientId] = useState<string | undefined>()
  const [settleAmountMinor, setSettleAmountMinor] = useState<number | undefined>()

  // Member invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Recurring rules state
  const [recurringRules, setRecurringRules] = useState<any[]>([])

  useEffect(() => {
    if (id) {
      fetchGroup(id)
      fetchExpenses(id)
      fetchBalances(id)

      webApi
        .get<{ rules: any[] }>(`/api/recurring?groupId=${id}`)
        .then((res) => setRecurringRules(res.rules || []))
        .catch(() => {})
    }
  }, [id, fetchGroup, fetchExpenses, fetchBalances])

  if (!currentGroup && !id) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Group not found.</p>
        <button onClick={() => navigate('/groups')} className="mt-2 text-teal-400 font-semibold">
          Back to Groups
        </button>
      </div>
    )
  }

  const handleToggleSimplify = async () => {
    if (!id || !currentGroup) return
    try {
      const updated = !currentGroup.simplifyDebts
      await webApi.patch(`/api/groups/${id}`, { simplifyDebts: updated })
      await fetchGroup(id)
      await fetchBalances(id)
    } catch (err: any) {
      alert(err.message || 'Failed to update debt simplification setting')
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !inviteEmail.trim()) return

    try {
      setInviteLoading(true)
      setInviteMsg(null)
      const res = await webApi.post<{ status: string }>(`/api/groups/${id}/members`, {
        email: inviteEmail.trim(),
      })
      setInviteMsg({
        type: 'success',
        text: res.status === 'added' ? 'Member added to group!' : 'Invite email sent to user!',
      })
      setInviteEmail('')
      fetchGroup(id)
    } catch (err: any) {
      setInviteMsg({ type: 'error', text: err.message || 'Failed to add member' })
    } finally {
      setInviteLoading(false)
    }
  }

  const triggerSettleDebt = (b: Balance) => {
    setSettlePayerId(b.from)
    setSettleRecipientId(b.to)
    setSettleAmountMinor(b.amountMinor)
    setShowSettleUp(true)
  }

  const getMemberName = (userId: string) => {
    if (userId === user?._id) return 'You'
    const m = currentGroup?.members.find((member) => member.userId === userId)
    return m?.name || 'Member'
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top back & actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/groups')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Groups</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSettlePayerId(undefined)
              setSettleRecipientId(undefined)
              setSettleAmountMinor(undefined)
              setShowSettleUp(true)
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
          >
            <HandCoins className="w-3.5 h-3.5" />
            <span>Settle Up</span>
          </button>
          <button
            onClick={() => setShowAddExpense(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 shadow-md shadow-teal-500/20 active:scale-98 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Expense</span>
          </button>
        </div>
      </div>

      {/* Group Hero Banner */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-teal-400 border border-slate-700">
                {currentGroup?.type || 'Group'}
              </span>
              <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                {currentGroup?.defaultCurrency}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-display text-white">
              {currentGroup?.name}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {currentGroup?.members.length} participants · Created by{' '}
              {getMemberName(currentGroup?.createdBy || '')}
            </p>
          </div>

          {/* Simplify Debts Toggle */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 self-start sm:self-auto">
            <Sparkles className="w-4 h-4 text-teal-400" />
            <div>
              <span className="text-xs font-semibold text-white block">Simplify Debts</span>
              <span className="text-[10px] text-slate-500">
                {currentGroup?.simplifyDebts ? 'Active (Minimal payments)' : 'Off (Raw pairwise)'}
              </span>
            </div>
            <button
              onClick={handleToggleSimplify}
              className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                currentGroup?.simplifyDebts ? 'bg-teal-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                  currentGroup?.simplifyDebts ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-t border-slate-800/80 mt-6 pt-4">
          {[
            { id: 'expenses', label: 'Expenses', icon: Receipt },
            { id: 'balances', label: 'Balances & Settle', icon: HandCoins },
            { id: 'members', label: 'Members', icon: Users },
            { id: 'recurring', label: 'Recurring Rules', icon: Repeat },
          ].map((tab) => {
            const Icon = tab.icon
            const isTabActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isTabActive
                    ? 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Content 1: Expenses */}
      {activeTab === 'expenses' && (
        <div className="space-y-3">
          {expenses.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500">
              <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No expenses in this group yet.</p>
              <button
                onClick={() => setShowAddExpense(true)}
                className="mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20"
              >
                Add the first expense
              </button>
            </div>
          ) : (
            expenses.map((exp) => (
              <div
                key={exp._id}
                className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 backdrop-blur-xl flex items-center justify-between transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 text-teal-400 flex items-center justify-center flex-shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{exp.description}</h3>
                    <p className="text-xs text-slate-400">
                      Paid by{' '}
                      <span className="text-slate-200 font-medium">
                        {getMemberName(exp.payers?.[0]?.userId || '')}
                      </span>{' '}
                      · {new Date(exp.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-base font-bold font-display text-white">
                      {formatMoney(exp.amountMinor, exp.currency)}
                    </span>
                    <span className="block text-[11px] text-slate-500 capitalize">
                      {exp.splitMethod} split
                    </span>
                  </div>

                  <button
                    onClick={async () => {
                      if (confirm('Delete this expense?')) {
                        await deleteExpense(exp._id)
                        if (id) fetchBalances(id)
                      }
                    }}
                    title="Delete expense"
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content 2: Balances & Settle */}
      {activeTab === 'balances' && (
        <div className="space-y-6">
          {/* Active Repayments */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
            <h3 className="font-display font-bold text-base text-white mb-1">
              {currentGroup?.simplifyDebts ? 'Suggested Repayments (Simplified)' : 'Active Debts'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              {currentGroup?.simplifyDebts
                ? 'Splitwise algorithm minimizes total transactions across members'
                : 'Direct pairwise debts between participants'}
            </p>

            {simplifiedDebts.length === 0 && balances.length === 0 ? (
              <div className="text-center py-8 text-emerald-400 text-sm font-medium">
                <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                All settled up! Nobody owes anything in this group.
              </div>
            ) : (
              <div className="space-y-2.5">
                {(currentGroup?.simplifyDebts ? simplifiedDebts : balances).map((b, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80"
                  >
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-semibold text-rose-400">{getMemberName(b.from)}</span>
                      <span className="text-slate-500">owes</span>
                      <span className="font-semibold text-teal-400">{getMemberName(b.to)}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold font-display text-white">
                        {formatMoney(b.amountMinor, b.currency)}
                      </span>
                      <button
                        onClick={() => triggerSettleDebt(b)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
                      >
                        Settle
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab Content 3: Members */}
      {activeTab === 'members' && (
        <div className="space-y-6">
          {/* Invite form */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
            <h3 className="font-display font-bold text-base text-white mb-1">Add Member</h3>
            <p className="text-xs text-slate-400 mb-4">
              Invite friends by email to join this group.
            </p>

            {inviteMsg && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                  inviteMsg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                }`}
              >
                {inviteMsg.type === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>{inviteMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleAddMember} className="flex gap-2">
              <input
                type="email"
                placeholder="friend@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
                required
              />
              <button
                type="submit"
                disabled={inviteLoading || !inviteEmail.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-teal-500 text-slate-950 hover:bg-teal-400 transition-all disabled:opacity-50 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{inviteLoading ? 'Adding...' : 'Add'}</span>
              </button>
            </form>
          </div>

          {/* Members list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentGroup?.members.map((m) => (
              <div
                key={m.userId}
                className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-800 text-teal-400 flex items-center justify-center font-bold text-xs uppercase">
                    {m.name ? m.name[0] : 'U'}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">
                      {m.userId === user?._id ? `${m.name} (You)` : m.name}
                    </h4>
                    <p className="text-[11px] text-slate-500">{m.email}</p>
                  </div>
                </div>

                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content 4: Recurring */}
      {activeTab === 'recurring' && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
          <h3 className="font-display font-bold text-base text-white mb-1">Recurring Expenses</h3>
          <p className="text-xs text-slate-400 mb-4">
            Automated recurring bills (rent, utilities, subscriptions) generated by splitFool
          </p>

          {recurringRules.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">
              <Repeat className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No recurring rules set up for this group.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recurringRules.map((rule) => {
                const desc = rule.template?.description ?? rule.description ?? 'Recurring Expense'
                const amt = rule.template?.amountMinor ?? rule.amountMinor ?? 0
                const curr = rule.template?.currency ?? rule.currency ?? currentGroup?.defaultCurrency ?? 'INR'
                return (
                  <div
                    key={rule._id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800"
                  >
                    <div>
                      <h4 className="text-xs font-semibold text-white">{desc}</h4>
                      <p className="text-[11px] text-slate-500">
                        Repeats <span className="capitalize">{rule.frequency}</span> · Next:{' '}
                        {new Date(rule.nextRunAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-teal-400 font-display">
                      {formatMoney(amt, curr)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddExpense && (
        <AddExpenseModal
          isOpen={showAddExpense}
          onClose={() => setShowAddExpense(false)}
          defaultGroupId={id}
          onSuccess={() => {
            if (id) {
              fetchExpenses(id)
              fetchBalances(id)
            }
          }}
        />
      )}
      {showSettleUp && (
        <SettleUpModal
          isOpen={showSettleUp}
          onClose={() => setShowSettleUp(false)}
          defaultPayerId={settlePayerId}
          defaultRecipientId={settleRecipientId}
          defaultAmount={settleAmountMinor}
          groupId={id}
          onSuccess={() => {
            if (id) fetchBalances(id)
          }}
        />
      )}
    </div>
  )
}
