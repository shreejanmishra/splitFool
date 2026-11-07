import React, { useState, useEffect } from 'react'
import { X, HandCoins, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react'
import { CURRENCIES, parseToMinor, minorToMajorString } from '@splitfool/shared'
import { useAuthStore, useBalanceStore, useGroupStore } from '@splitfool/store'
import { webApi } from '../../api/client'

interface SettleUpModalProps {
  isOpen: boolean
  onClose: () => void
  defaultPayerId?: string
  defaultRecipientId?: string
  defaultAmount?: number // in minor units
  defaultCurrency?: string
  groupId?: string
  onSuccess?: () => void
}

export const SettleUpModal: React.FC<SettleUpModalProps> = ({
  isOpen,
  onClose,
  defaultPayerId,
  defaultRecipientId,
  defaultAmount,
  defaultCurrency,
  groupId,
  onSuccess,
}) => {
  const { user } = useAuthStore()
  const { fetchBalances, fetchStats } = useBalanceStore()
  const { groups, currentGroup } = useGroupStore()

  const activeCurrency = defaultCurrency || user?.defaultCurrency || 'INR'
  const [fromUser, setFromUser] = useState<string>(defaultPayerId || user?._id || '')
  const [toUser, setToUser] = useState<string>(defaultRecipientId || '')
  const [amountStr, setAmountStr] = useState<string>(
    defaultAmount ? minorToMajorString(defaultAmount, activeCurrency) : '',
  )
  const [currency, setCurrency] = useState<string>(activeCurrency)
  const [friendsList, setFriendsList] = useState<Array<{ user: { _id: string; name: string; email: string } }>>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (isOpen) {
      const nextCurrency = defaultCurrency || user?.defaultCurrency || 'INR'
      setCurrency(nextCurrency)
      setFromUser(defaultPayerId || user?._id || '')
      setToUser(defaultRecipientId || '')
      setAmountStr(defaultAmount ? minorToMajorString(defaultAmount, nextCurrency) : '')
      setError(null)
      setSuccess(false)

      webApi
        .get<{ friends: Array<{ user: { _id: string; name: string; email: string } }> }>('/api/friends')
        .then((res) => {
          const loaded = res.friends || []
          // Also include group members if settling inside a group
          const grp = (currentGroup && currentGroup._id === groupId ? currentGroup : null) || groups.find((g) => g._id === groupId)
          const merged = new Map<string, { user: { _id: string; name: string; email: string } }>()
          for (const f of loaded) merged.set(f.user._id, f)
          if (grp) {
            for (const m of grp.members) {
              if (m.userId !== user?._id && !merged.has(m.userId)) {
                merged.set(m.userId, { user: { _id: m.userId, name: m.name, email: m.email } })
              }
            }
          }
          const list = [...merged.values()]
          setFriendsList(list)
          if (!defaultRecipientId && list.length > 0) {
            setToUser(list[0]!.user._id)
          }
        })
        .catch(() => {})
    }
  }, [isOpen, defaultPayerId, defaultRecipientId, defaultAmount, defaultCurrency, groupId, user, currentGroup, groups])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fromUser || !toUser) {
      setError('Please select both payer and recipient')
      return
    }

    if (fromUser === toUser) {
      setError('Payer and recipient cannot be the same person')
      return
    }

    const minorAmount = parseToMinor(amountStr, currency)
    if (minorAmount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    try {
      setLoading(true)
      await webApi.post('/api/settlements', {
        groupId: groupId || undefined,
        from: fromUser,
        to: toUser,
        amountMinor: minorAmount,
        currency,
        date: new Date().toISOString(),
      })

      setSuccess(true)
      await Promise.all([fetchBalances(groupId), fetchStats()])
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 1000)
    } catch (err: any) {
      setError(err.message || 'Failed to record settlement')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <HandCoins className="w-4 h-4" />
            </div>
            <h2 className="font-display font-bold text-lg text-white">Record a Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-300 text-xs">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>Settlement recorded successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Who pays whom */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Payer</label>
              <select
                value={fromUser}
                onChange={(e) => setFromUser(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                <option value={user?._id || ''}>You ({user?.name})</option>
                {friendsList.map((f) => (
                  <option key={f.user._id} value={f.user._id}>
                    {f.user.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-center pt-4">
              <ArrowRight className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Recipient</label>
              <select
                value={toUser}
                onChange={(e) => setToUser(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-teal-500"
              >
                <option value="">Select recipient...</option>
                {user?._id !== fromUser && (
                  <option value={user?._id || ''}>You ({user?.name})</option>
                )}
                {friendsList
                  .filter((f) => f.user._id !== fromUser)
                  .map((f) => (
                    <option key={f.user._id} value={f.user._id}>
                      {f.user.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Amount Paid
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-base font-bold font-display text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-sm text-slate-200 font-semibold focus:outline-none focus:border-teal-500 transition-colors cursor-pointer"
              >
                {Object.keys(CURRENCIES).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || success}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-md shadow-emerald-500/20 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
