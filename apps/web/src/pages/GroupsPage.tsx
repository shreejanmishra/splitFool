import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Users, ChevronRight, Home, Plane, Heart, Folder, X, AlertCircle } from 'lucide-react'
import { GROUP_TYPES, CURRENCIES } from '@splitfool/shared'
import { useGroupStore } from '@splitfool/store'

export const GroupsPage: React.FC = () => {
  const { groups, fetchGroups, createGroup } = useGroupStore()
  const [showCreateModal, setShowCreateModal] = useState(false)

  const [name, setName] = useState('')
  const [type, setType] = useState<string>('trip')
  const [currency, setCurrency] = useState('INR')
  const [simplifyDebts, setSimplifyDebts] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      setLoading(true)
      setError(null)
      await createGroup({
        name: name.trim(),
        type: type as any,
        defaultCurrency: currency,
        simplifyDebts,
      })
      setShowCreateModal(false)
      setName('')
    } catch (err: any) {
      setError(err.message || 'Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  const getTypeIcon = (grpType: string) => {
    switch (grpType) {
      case 'home':
        return <Home className="w-4 h-4 text-emerald-400" />
      case 'trip':
        return <Plane className="w-4 h-4 text-cyan-400" />
      case 'couple':
        return <Heart className="w-4 h-4 text-rose-400" />
      default:
        return <Folder className="w-4 h-4 text-amber-400" />
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-white">Groups</h1>
          <p className="text-sm text-slate-400">
            Organize shared expenses for trips, housemates, or projects.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 shadow-md shadow-teal-500/20 active:scale-98 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>New Group</span>
        </button>
      </div>

      {/* Groups Grid */}
      {groups.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <h3 className="text-base font-semibold text-slate-300 mb-1">No groups yet</h3>
          <p className="text-xs mb-4">Create a group to start splitting expenses with friends.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-500/10 text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-all cursor-pointer"
          >
            Create Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <Link
              key={group._id}
              to={`/groups/${group._id}`}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-teal-500/40 backdrop-blur-xl transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium">
                    {getTypeIcon(group.type)}
                    <span className="capitalize text-slate-300">{group.type}</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                    {group.defaultCurrency}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-teal-300 transition-colors mb-1 truncate">
                  {group.name}
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                </p>
              </div>

              {/* Members Avatars preview */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {group.members.slice(0, 4).map((m) => (
                    <div
                      key={m.userId}
                      title={m.name}
                      className="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-teal-400 uppercase"
                    >
                      {m.name ? m.name[0] : 'U'}
                    </div>
                  ))}
                  {group.members.length > 4 && (
                    <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-[10px] font-bold text-slate-400">
                      +{group.members.length - 4}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-teal-400 transition-colors">
                  <span>View</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <h2 className="font-display font-bold text-lg text-white">Create New Group</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Group Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Goa Trip, Apartment 4B"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white capitalize focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    {GROUP_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Default Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    {Object.keys(CURRENCIES).map((c) => (
                      <option key={c} value={c}>
                        {c} ({CURRENCIES[c].symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Simplify Debts</span>
                  <span className="text-[11px] text-slate-500">
                    Automatically minimizes number of payments needed
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={simplifyDebts}
                  onChange={(e) => setSimplifyDebts(e.target.checked)}
                  className="rounded border-slate-700 text-teal-500 focus:ring-0 cursor-pointer"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !name.trim()}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 shadow-md shadow-teal-500/20 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {loading ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
