import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  UserPlus,
  UserCheck,
  ChevronRight,
  X,
  AlertCircle,
  CheckCircle,
  Mail,
} from 'lucide-react'
import { formatMoney } from '@splitfool/shared'
import { useAuthStore } from '@splitfool/store'
import { SettleUpModal } from '../components/modals/SettleUpModal'
import { webApi } from '../api/client'

interface FriendItem {
  user: {
    _id: string
    name: string
    email: string
    avatar?: string
  }
  balances: Array<{ currency: string; amountMinor: number }>
}

export const FriendsPage: React.FC = () => {
  const { user } = useAuthStore()
  const [friends, setFriends] = useState<FriendItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [email, setEmail] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Settle modal state
  const [settleFriend, setSettleFriend] = useState<FriendItem | null>(null)

  const fetchFriends = async () => {
    try {
      setLoading(true)
      const res = await webApi.get<{ friends: FriendItem[] }>('/api/friends')
      setFriends(res.friends || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFriends()
  }, [])

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    try {
      setActionLoading(true)
      setMsg(null)
      const res = await webApi.post<{ status: string }>('/api/friends', { email: email.trim() })
      setMsg({
        type: 'success',
        text:
          res.status === 'added'
            ? 'Friend added successfully!'
            : 'Friend invite email sent successfully!',
      })
      setEmail('')
      fetchFriends()
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to add friend' })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Friends</h1>
          <p className="text-sm text-slate-400">
            View shared balances and settle up one-on-one with friends.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 shadow-md shadow-teal-500/20 active:scale-98 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4 stroke-[2.5]" />
          <span>Add Friend</span>
        </button>
      </div>

      {/* Friends list */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs">Loading friends...</div>
      ) : friends.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500">
          <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <h3 className="text-base font-semibold text-slate-300 mb-1">No friends added yet</h3>
          <p className="text-xs mb-4">Add your friends to start splitting expenses directly.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 cursor-pointer"
          >
            Add a Friend
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {friends.map((friend) => {
            const hasBalances = friend.balances && friend.balances.length > 0

            return (
              <div
                key={friend.user._id}
                className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 backdrop-blur-xl transition-all flex items-center justify-between"
              >
                <Link
                  to={`/friends/${friend.user._id}`}
                  className="flex items-center gap-3.5 flex-1 min-w-0"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-800 text-teal-400 border border-slate-700 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                    {friend.user.name ? friend.user.name[0] : 'U'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {friend.user.name}
                    </h3>
                    <p className="text-xs text-slate-400 truncate">{friend.user.email}</p>
                  </div>
                </Link>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    {hasBalances ? (
                      friend.balances.map((b, i) => {
                        const positive = b.amountMinor > 0
                        return (
                          <div key={i}>
                            <span
                              className={`text-xs font-bold font-display ${
                                positive ? 'text-teal-400' : 'text-rose-400'
                              }`}
                            >
                              {positive ? 'owes you ' : 'you owe '}
                              {formatMoney(Math.abs(b.amountMinor), b.currency)}
                            </span>
                          </div>
                        )
                      })
                    ) : (
                      <span className="text-xs text-slate-500 font-medium">Settled up</span>
                    )}
                  </div>

                  {hasBalances && (
                    <button
                      onClick={() => setSettleFriend(friend)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
                    >
                      Settle
                    </button>
                  )}

                  <Link to={`/friends/${friend.user._id}`} className="text-slate-500 hover:text-white">
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Friend Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h2 className="font-display font-bold text-lg text-white">Add a Friend</h2>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setMsg(null)
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {msg && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
                  msg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                }`}
              >
                {msg.type === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>{msg.text}</span>
              </div>
            )}

            <form onSubmit={handleAddFriend} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Friend's Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  If they already have a splitFool account, they will be added immediately.
                  Otherwise, an invite email will be sent.
                </p>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !email.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-500 text-slate-950 hover:bg-teal-400 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Adding...' : 'Send Friend Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Up Modal */}
      {settleFriend && (
        <SettleUpModal
          isOpen={!!settleFriend}
          onClose={() => setSettleFriend(null)}
          defaultPayerId={
            settleFriend.balances?.[0]?.amountMinor < 0 ? user?._id : settleFriend.user._id
          }
          defaultRecipientId={
            settleFriend.balances?.[0]?.amountMinor < 0 ? settleFriend.user._id : user?._id
          }
          defaultAmount={Math.abs(settleFriend.balances?.[0]?.amountMinor || 0)}
          defaultCurrency={settleFriend.balances?.[0]?.currency}
          onSuccess={() => fetchFriends()}
        />
      )}
    </div>
  )
}
