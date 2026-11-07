import React, { useState, useEffect } from 'react'
import {
  Activity as ActivityIcon,
  Receipt,
  HandCoins,
  Users,
  UserPlus,
  Clock,
  Sparkles,
} from 'lucide-react'
import { webApi } from '../api/client'

interface ActivityItem {
  _id: string
  actorId: string
  actor: {
    _id: string
    name: string
    email: string
  }
  type: string
  data: Record<string, any>
  createdAt: string
}

export const ActivityPage: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    webApi
      .get<{ activities: ActivityItem[] }>('/api/activity')
      .then((res) => setActivities(res.activities || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'expense_created':
      case 'expense_updated':
        return <Receipt className="w-4 h-4 text-teal-400" />
      case 'settlement_created':
        return <HandCoins className="w-4 h-4 text-emerald-400" />
      case 'group_created':
        return <Users className="w-4 h-4 text-cyan-400" />
      case 'friend_added':
      case 'member_added':
        return <UserPlus className="w-4 h-4 text-purple-400" />
      default:
        return <Sparkles className="w-4 h-4 text-amber-400" />
    }
  }

  const formatActivityText = (item: ActivityItem) => {
    const actorName = item.actor?.name || 'Someone'
    switch (item.type) {
      case 'expense_created':
        return `${actorName} added expense "${item.data?.description || 'Expense'}"`
      case 'expense_updated':
        return `${actorName} updated expense "${item.data?.description || 'Expense'}"`
      case 'expense_deleted':
        return `${actorName} deleted an expense`
      case 'settlement_created':
        return `${actorName} recorded a payment`
      case 'group_created':
        return `${actorName} created the group "${item.data?.name || 'Group'}"`
      case 'member_added':
        return `${actorName} added a member to the group`
      case 'friend_added':
        return `${actorName} and you became friends`
      default:
        return `${actorName} performed an action`
    }
  }

  const formatTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return new Date(dateStr).toLocaleDateString()
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-display text-white">Activity Feed</h1>
        <p className="text-sm text-slate-400">
          Real-time log of expenses, repayments, and updates across your network.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs">Loading activity...</div>
      ) : activities.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800 text-slate-500">
          <ActivityIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No activity recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((item) => (
            <div
              key={item._id}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center flex-shrink-0">
                  {getActivityIcon(item.type)}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{formatActivityText(item)}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{formatTimeAgo(item.createdAt)}</span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
