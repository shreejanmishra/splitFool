import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { Text, Surface } from 'react-native-paper'
import { mobileApi } from '../api/client'

interface ActivityItem {
  _id: string
  type: string
  data?: Record<string, any>
  actor?: {
    _id: string
    name: string
    email: string
  }
  createdAt: string
}

function formatActivityText(item: ActivityItem): string {
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
    case 'settlement_deleted':
      return `${actorName} voided a payment`
    case 'group_created':
      return `${actorName} created the group "${item.data?.name || 'Group'}"`
    case 'group_updated':
      return `${actorName} updated the group "${item.data?.name || 'Group'}"`
    case 'member_added':
      return `${actorName} added ${item.data?.memberName || 'a member'} to ${item.data?.groupName || 'the group'}`
    case 'friend_added':
      return `${actorName} and you became friends`
    case 'comment_added':
      return `${actorName} commented on "${item.data?.description || 'an expense'}"`
    case 'recurring_created':
      return `${actorName} set up recurring expense "${item.data?.description || 'Expense'}"`
    default:
      return `${actorName} performed an action`
  }
}

export const ActivityScreen: React.FC = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const loadActivities = async () => {
    try {
      const res = await mobileApi.get<{ activities: ActivityItem[] }>('/api/activity')
      setActivities(res.activities || [])
    } catch {
      // fallback
    }
  }

  useEffect(() => {
    loadActivities()
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadActivities()
    setRefreshing(false)
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#14b8a6" />}
    >
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Activity</Text>
        <Text style={styles.pageSub}>Real-time stream of group & expense updates</Text>
      </View>

      {activities.length === 0 ? (
        <Surface style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptySub}>
            When you or your friends create expenses, settle balances, or add members, events will show up here.
          </Text>
        </Surface>
      ) : (
        activities.map((item) => (
          <Surface key={item._id} style={styles.activityCard}>
            <View style={styles.badgeRow}>
              <View style={styles.actionBadge}>
                <Text style={styles.actionText}>{(item.type || 'activity').replace(/_/g, ' ')}</Text>
              </View>
              <Text style={styles.timeText}>
                {new Date(item.createdAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <Text style={styles.descText}>{formatActivityText(item)}</Text>
          </Surface>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#060913',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  pageSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  activityCard: {
    backgroundColor: '#0c1322',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionBadge: {
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  actionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#14b8a6',
    textTransform: 'uppercase',
  },
  timeText: {
    fontSize: 11,
    color: '#64748b',
  },
  descText: {
    fontSize: 14,
    color: '#f8fafc',
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: '#0c1322',
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
})
