import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, HandCoins, Trash2 } from 'lucide-react'
import { formatMoney } from '@splitfool/shared'
import { useAuthStore } from '@splitfool/store'
import { SettleUpModal } from '../components/modals/SettleUpModal'
import { webApi } from '../api/client'

interface FriendDetail {
  friend: {
    _id: string
    name: string
    email: string
    avatar?: string
  }
  balances: Array<{ currency: string; amountMinor: number }>
  breakdown: Array<{ groupId: string | null; currency: string; amountMinor: number }>
  groups: Array<{ _id: string; name: string; type: string; defaultCurrency: string }>
}

export const FriendDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [detail, setDetail] = useState<FriendDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSettle, setShowSettle] = useState(false)

  const fetchDetail = async () => {
    if (!id) return
    try {
      setLoading(true)
      const res = await webApi.get<FriendDetail>(`/api/friends/${id}`)
      setDetail(res)
    } catch (err: any) {
      setError(err.message || 'Failed to load friend detail')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetail()
  }, [id])

  const handleRemoveFriend = async () => {
    if (!id) return
    if (!confirm('Are you sure you want to remove this friend? Debts must be settled first.')) return
    try {
      await webApi.delete(`/api/friends/${id}`)
      navigate('/friends')
    } catch (err: any) {
      alert(err.message || 'Failed to remove friend')
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-500 text-xs">Loading friend detail...</div>
  }

  if (error || !detail) {
    return (
      <div className="p-8 text-center text-slate-400">
        <p className="mb-2">{error || 'Friend not found'}</p>
        <button onClick={() => navigate('/friends')} className="text-teal-400 font-semibold text-xs">
          Back to Friends
        </button>
      </div>
    )
  }

  const primaryBalance = detail.balances[0]

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top back & actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/friends')}
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Friends</span>
        </button>

        <div className="flex items-center gap-2">
          {detail.balances.length > 0 && (
            <button
              onClick={() => setShowSettle(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
            >
              <HandCoins className="w-3.5 h-3.5" />
              <span>Settle Up</span>
            </button>
          )}
          <button
            onClick={handleRemoveFriend}
            title="Remove Friend"
            className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Friend Hero Card */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-slate-800 text-teal-400 border-2 border-slate-700 flex items-center justify-center font-bold text-lg uppercase flex-shrink-0">
            {detail.friend.name ? detail.friend.name[0] : 'U'}
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-white">{detail.friend.name}</h1>
            <p className="text-xs text-slate-400">{detail.friend.email}</p>
          </div>
        </div>

        {/* Balance status badge */}
        <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">
            Overall Balance
          </span>
          {detail.balances.length === 0 ? (
            <span className="text-sm font-bold text-emerald-400">Settled up</span>
          ) : (
            detail.balances.map((b, i) => (
              <span
                key={i}
                className={`text-base font-bold font-display block ${
                  b.amountMinor > 0 ? 'text-teal-400' : 'text-rose-400'
                }`}
              >
                {b.amountMinor > 0 ? 'Owes you ' : 'You owe '}
                {formatMoney(Math.abs(b.amountMinor), b.currency)}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Breakdown across contexts */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
        <h3 className="font-display font-bold text-base text-white mb-1">Balance Breakdown</h3>
        <p className="text-xs text-slate-400 mb-4">
          Details of debts divided by shared group and direct non-group expenses
        </p>

        {detail.breakdown.length === 0 ? (
          <p className="text-xs text-slate-500">No active debts with this friend.</p>
        ) : (
          <div className="space-y-2">
            {detail.breakdown.map((item, i) => {
              const matchedGroup = detail.groups.find((g) => g._id === item.groupId)
              const contextName = matchedGroup ? matchedGroup.name : 'Non-group expense'
              const isPositive = item.amountMinor > 0

              return (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800/80"
                >
                  <span className="text-xs font-medium text-slate-300">{contextName}</span>
                  <span
                    className={`text-xs font-bold font-display ${
                      isPositive ? 'text-teal-400' : 'text-rose-400'
                    }`}
                  >
                    {isPositive ? '+' : ''}
                    {formatMoney(item.amountMinor, item.currency)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Shared Groups */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl">
        <h3 className="font-display font-bold text-base text-white mb-1">Shared Groups</h3>
        <p className="text-xs text-slate-400 mb-4">Groups you both belong to</p>

        {detail.groups.length === 0 ? (
          <p className="text-xs text-slate-500">No shared groups.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {detail.groups.map((grp) => (
              <Link
                key={grp._id}
                to={`/groups/${grp._id}`}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-teal-500/30 flex items-center justify-between group transition-all"
              >
                <div>
                  <h4 className="text-xs font-semibold text-white group-hover:text-teal-300 transition-colors">
                    {grp.name}
                  </h4>
                  <span className="text-[10px] text-slate-500 capitalize">{grp.type}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                  {grp.defaultCurrency}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Settle Up Modal */}
      {showSettle && primaryBalance && (
        <SettleUpModal
          isOpen={showSettle}
          onClose={() => setShowSettle(false)}
          defaultPayerId={primaryBalance.amountMinor < 0 ? user?._id : detail.friend._id}
          defaultRecipientId={primaryBalance.amountMinor < 0 ? detail.friend._id : user?._id}
          defaultAmount={Math.abs(primaryBalance.amountMinor)}
          defaultCurrency={primaryBalance.currency}
          onSuccess={() => fetchDetail()}
        />
      )}
    </div>
  )
}
