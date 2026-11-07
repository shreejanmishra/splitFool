import React, { useState, useEffect } from 'react'
import {
  X,
  Receipt,
  Paperclip,
  Check,
  AlertCircle,
  Repeat,
} from 'lucide-react'
import {
  CURRENCIES,
  EXPENSE_CATEGORIES,
  SPLIT_METHODS,
  formatMoney,
  parseToMinor,
  calculateSplit,
  type SplitMethod,
  type Participant,
} from '@splitfool/shared'
import { useAuthStore, useGroupStore, useExpenseStore, useBalanceStore } from '@splitfool/store'
import { webApi } from '../../api/client'

interface AddExpenseModalProps {
  isOpen: boolean
  onClose: () => void
  defaultGroupId?: string
  onSuccess?: () => void
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  isOpen,
  onClose,
  defaultGroupId,
  onSuccess,
}) => {
  const { user } = useAuthStore()
  const { groups, fetchGroups } = useGroupStore()
  const { createExpense } = useExpenseStore()
  const { fetchBalances, fetchStats } = useBalanceStore()

  const [description, setDescription] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [currency, setCurrency] = useState(user?.defaultCurrency || 'INR')
  const [category, setCategory] = useState<string>('food')
  const [groupId, setGroupId] = useState<string>(defaultGroupId || '')
  const [payerId, setPayerId] = useState<string>(user?._id || '')
  const [splitMethod, setSplitMethod] = useState<SplitMethod>('equal')

  // Participant selection and split details
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [customValues, setCustomValues] = useState<Record<string, string>>({}) // exact amounts, percentages, or shares
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [isRecurring, setIsRecurring] = useState(false)
  const [friendsList, setFriendsList] = useState<Array<{ userId: string; name: string; email: string; role: 'member' }>>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchGroups()
      if (defaultGroupId !== undefined) setGroupId(defaultGroupId)
      if (user?._id) setPayerId(user._id)
      webApi
        .get<{ friends: Array<{ user: { _id: string; name: string; email: string } }> }>('/api/friends')
        .then((res) => {
          setFriendsList(
            (res.friends || []).map((f) => ({
              userId: f.user._id,
              name: f.user.name,
              email: f.user.email,
              role: 'member' as const,
            })),
          )
        })
        .catch(() => {})
    }
  }, [isOpen, defaultGroupId, fetchGroups, user])

  const selectedGroup = groups.find((g) => g._id === groupId)

  // Update participants when group selection changes
  useEffect(() => {
    if (selectedGroup) {
      const memberIds = selectedGroup.members.map((m) => m.userId)
      setSelectedUserIds(memberIds)
      if (selectedGroup.defaultCurrency) setCurrency(selectedGroup.defaultCurrency)
    } else if (user?._id) {
      setSelectedUserIds([user._id])
    }
  }, [selectedGroup, user])

  if (!isOpen) return null

  const handleToggleUser = (uid: string) => {
    if (selectedUserIds.includes(uid)) {
      if (selectedUserIds.length > 1) {
        setSelectedUserIds(selectedUserIds.filter((id) => id !== uid))
      }
    } else {
      setSelectedUserIds([...selectedUserIds, uid])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!description.trim()) {
      setError('Please provide a description')
      return
    }

    const minorTotal = parseToMinor(amountStr, currency)
    if (minorTotal <= 0) {
      setError('Please enter a valid amount greater than zero')
      return
    }

    if (selectedUserIds.length === 0) {
      setError('Please select at least one participant')
      return
    }

    try {
      setLoading(true)

      // Calculate splits based on method
      let splits: Participant[] = []

      if (splitMethod === 'equal') {
        splits = calculateSplit(minorTotal, selectedUserIds, 'equal')
      } else if (splitMethod === 'exact') {
        splits = selectedUserIds.map((uid) => ({
          userId: uid,
          amountMinor: parseToMinor(customValues[uid] || '0', currency),
        }))
        const sum = splits.reduce((acc, s) => acc + s.amountMinor, 0)
        if (sum !== minorTotal) {
          throw new Error(
            `Exact splits sum (${formatMoney(sum, currency)}) does not equal total (${formatMoney(
              minorTotal,
              currency,
            )})`,
          )
        }
      } else if (splitMethod === 'percent') {
        const percents: Record<string, number> = {}
        let percentSum = 0
        for (const uid of selectedUserIds) {
          const p = parseFloat(customValues[uid] || '0')
          percents[uid] = p
          percentSum += p
        }
        if (Math.abs(percentSum - 100) > 0.01) {
          throw new Error(`Percentages must add up to 100% (currently ${percentSum}%)`)
        }
        splits = calculateSplit(minorTotal, selectedUserIds, 'percent', percents)
      } else if (splitMethod === 'shares') {
        const shares: Record<string, number> = {}
        for (const uid of selectedUserIds) {
          shares[uid] = Math.max(1, parseInt(customValues[uid] || '1', 10))
        }
        splits = calculateSplit(minorTotal, selectedUserIds, 'shares', shares)
      }

      const payers: Participant[] = [{ userId: payerId, amountMinor: minorTotal }]


      const created = await createExpense({
        groupId: groupId || undefined,
        description: description.trim(),
        category: category as any,
        currency,
        amountMinor: minorTotal,
        date: new Date().toISOString(),
        payers,
        splits,
        splitMethod,
      })

      // Upload receipt if provided
      if (receiptFile && created._id) {
        const formData = new FormData()
        formData.append('receipt', receiptFile)
        await webApi.post(`/api/expenses/${created._id}/receipt`, formData)
      }

      // Create recurring rule if checked
      if (isRecurring && groupId) {
        await webApi.post('/api/recurring', {
          groupId,
          description: description.trim(),
          category,
          currency,
          amountMinor: minorTotal,
          payers,
          splits,
          splitMethod,
          frequency: 'monthly',
          startDate: new Date().toISOString(),
        })
      }

      await Promise.all([fetchBalances(groupId || undefined), fetchStats()])
      setDescription('')
      setAmountStr('')
      setCustomValues({})
      setReceiptFile(null)
      setIsRecurring(false)
      onSuccess?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to create expense')
    } finally {
      setLoading(false)
    }
  }

  const memberOptions = selectedGroup?.members || [
    { userId: user?._id || '', name: user?.name || 'You', email: user?.email || '', role: 'member' as const },
    ...friendsList.filter((f) => f.userId !== user?._id),
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
              <Receipt className="w-4 h-4" />
            </div>
            <h2 className="font-display font-bold text-lg text-white">Add an Expense</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Choose Group
            </label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500 transition-colors cursor-pointer"
            >
              <option value="">Non-group expense (Personal)</option>
              {groups.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.name} ({g.type})
                </option>
              ))}
            </select>
          </div>

          {/* Description & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Description
              </label>
              <input
                type="text"
                placeholder="e.g. Dinner, Groceries, Flight"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 capitalize focus:outline-none focus:border-teal-500 transition-colors cursor-pointer"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Total Amount
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
                    {code} ({CURRENCIES[code].symbol})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Paid by selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Paid by
            </label>
            <select
              value={payerId}
              onChange={(e) => setPayerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500 transition-colors cursor-pointer"
            >
              {memberOptions.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userId === user?._id ? `You (${m.name})` : m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Split Method Tabs */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Split Method
            </label>
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80">
              {SPLIT_METHODS.map((method) => (
                <button
                  type="button"
                  key={method}
                  onClick={() => setSplitMethod(method)}
                  className={`py-1.5 text-xs font-medium rounded-lg capitalize transition-all cursor-pointer ${
                    splitMethod === method
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          {/* Participants list */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Split with ({selectedUserIds.length} selected)
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar pr-1">
              {memberOptions.map((m) => {
                const isSelected = selectedUserIds.includes(m.userId)
                return (
                  <div
                    key={m.userId}
                    className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-slate-800/60 border-slate-700'
                        : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div
                      className="flex items-center gap-2.5 cursor-pointer flex-1"
                      onClick={() => handleToggleUser(m.userId)}
                    >
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                          isSelected
                            ? 'bg-teal-500 border-teal-400 text-slate-950'
                            : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="text-xs font-medium text-slate-200">
                        {m.userId === user?._id ? `You (${m.name})` : m.name}
                      </span>
                    </div>

                    {/* Inputs for exact / percent / shares */}
                    {isSelected && splitMethod !== 'equal' && (
                      <div className="w-24">
                        <input
                          type="number"
                          step={splitMethod === 'shares' ? '1' : 'any'}
                          placeholder={
                            splitMethod === 'percent' ? '%' : splitMethod === 'shares' ? 'shares' : '0.00'
                          }
                          value={customValues[m.userId] || ''}
                          onChange={(e) =>
                            setCustomValues({ ...customValues, [m.userId]: e.target.value })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-right text-white focus:outline-none focus:border-teal-500"
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Receipt attachment & recurring options */}
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <label className="flex items-center gap-2 text-slate-400 hover:text-teal-400 transition-colors cursor-pointer">
              <Paperclip className="w-4 h-4" />
              <span>{receiptFile ? receiptFile.name : 'Attach receipt (image)'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
              />
            </label>

            {groupId && (
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-slate-700 text-teal-500 focus:ring-0"
                />
                <span className="flex items-center gap-1">
                  <Repeat className="w-3.5 h-3.5" />
                  <span>Repeat monthly</span>
                </span>
              </label>
            )}
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
              disabled={loading}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 shadow-md shadow-teal-500/20 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Adding...' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
