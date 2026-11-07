import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { Text, Surface, Button } from 'react-native-paper'
import { formatMoney } from '@splitfool/shared'
import { useAuthStore, useBalanceStore, useGroupStore, useExpenseStore } from '@splitfool/store'
import { CategoryDonutChart } from '../components/charts/CategoryDonutChart'
import { MonthlyBarChart } from '../components/charts/MonthlyBarChart'
import { AddExpenseModal } from '../components/modals/AddExpenseModal'
import { SettleUpModal } from '../components/modals/SettleUpModal'

interface DashboardScreenProps {
  onNavigateToGroups: () => void
  onNavigateToFriends: () => void
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  onNavigateToGroups,
}) => {
  const { user } = useAuthStore()
  const { totals, stats, fetchBalances, fetchStats } = useBalanceStore()
  const { groups, fetchGroups } = useGroupStore()
  const { expenses, fetchExpenses } = useExpenseStore()

  const [refreshing, setRefreshing] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showSettleUp, setShowSettleUp] = useState(false)

  const loadData = async () => {
    await Promise.all([fetchBalances(), fetchStats(), fetchGroups(), fetchExpenses()])
  }

  useEffect(() => {
    loadData()
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const defaultCurrency = user?.defaultCurrency || 'INR'
  const primaryTotal =
    totals.find((t) => t.currency === defaultCurrency) ??
    totals[0] ?? { currency: defaultCurrency, owedMinor: 0, oweMinor: 0 }
  const balanceCurrency = primaryTotal.currency
  const statsCurrency = stats?.currency || defaultCurrency
  const owedMinor = primaryTotal.owedMinor
  const oweMinor = primaryTotal.oweMinor
  const netMinor = owedMinor - oweMinor

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#14b8a6" />
      }
    >
      {/* Welcome Banner */}
      <Surface style={styles.banner}>
        <Text style={styles.bannerTag}>SplitFool Mobile Hub</Text>
        <Text style={styles.welcomeText}>Welcome back, {user?.name || 'Explorer'}!</Text>
        <Text style={styles.bannerSub}>Here is your real-time debt summary & analytics.</Text>

        <View style={styles.actionRow}>
          <Button
            mode="contained"
            icon="plus"
            buttonColor="#14b8a6"
            textColor="#ffffff"
            style={styles.actionBtn}
            onPress={() => setShowAddExpense(true)}
          >
            Add Expense
          </Button>
          <Button
            mode="outlined"
            icon="handshake"
            textColor="#2dd4bf"
            style={[styles.actionBtn, styles.settleBtn]}
            onPress={() => setShowSettleUp(true)}
          >
            Settle Up
          </Button>
        </View>
      </Surface>

      {/* Balance Summary Cards */}
      <View style={styles.balanceCardsRow}>
        <Surface style={[styles.balanceCard, { flex: 1.2 }]}>
          <Text style={styles.cardHeaderLabel}>Net Balance</Text>
          <Text
            style={[
              styles.netBalanceValue,
              netMinor >= 0 ? styles.positiveText : styles.negativeText,
            ]}
          >
            {formatMoney(Math.abs(netMinor), balanceCurrency)}
          </Text>
          <Text style={styles.cardSubText}>
            {netMinor >= 0 ? 'Overall owed to you' : 'Overall you owe'}
          </Text>
        </Surface>

        <Surface style={styles.balanceCard}>
          <Text style={styles.cardHeaderLabel}>You Are Owed</Text>
          <Text style={[styles.statValue, styles.positiveText]}>
            {formatMoney(owedMinor, balanceCurrency)}
          </Text>
          <Text style={styles.cardSubText}>Receivable</Text>
        </Surface>

        <Surface style={styles.balanceCard}>
          <Text style={styles.cardHeaderLabel}>You Owe</Text>
          <Text style={[styles.statValue, styles.negativeText]}>
            {formatMoney(oweMinor, balanceCurrency)}
          </Text>
          <Text style={styles.cardSubText}>Payable</Text>
        </Surface>
      </View>

      {/* Analytics Charts */}
      <Surface style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Spending by Category</Text>
          <Text style={styles.badgeText}>{statsCurrency}</Text>
        </View>
        <CategoryDonutChart
          data={stats?.byCategory ?? []}
          currency={statsCurrency}
          size={200}
        />
      </Surface>

      <Surface style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Monthly Expense Trend</Text>
          <Text style={styles.badgeText}>6 Months</Text>
        </View>
        <MonthlyBarChart
          data={stats?.byMonth ?? []}
          currency={statsCurrency}
          width={300}
          height={170}
        />
      </Surface>

      {/* Active Groups Preview */}
      <Surface style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Groups</Text>
          <TouchableOpacity onPress={onNavigateToGroups}>
            <Text style={styles.linkText}>View all ({groups.length})</Text>
          </TouchableOpacity>
        </View>
        {groups.length === 0 ? (
          <Text style={styles.emptyNotice}>No groups joined yet.</Text>
        ) : (
          groups.slice(0, 3).map((group) => (
            <View key={group._id} style={styles.listItem}>
              <View>
                <Text style={styles.itemTitle}>{group.name}</Text>
                <Text style={styles.itemSub}>{group.members?.length || 0} members • {group.defaultCurrency}</Text>
              </View>
              {group.simplifyDebts && (
                <View style={styles.pillBadge}>
                  <Text style={styles.pillText}>Simplified</Text>
                </View>
              )}
            </View>
          ))
        )}
      </Surface>

      {/* Recent Expenses Preview */}
      <Surface style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Expenses</Text>
          <Text style={styles.badgeText}>Live Sync</Text>
        </View>
        {expenses.length === 0 ? (
          <Text style={styles.emptyNotice}>No expenses recorded yet.</Text>
        ) : (
          expenses.slice(0, 4).map((exp) => (
            <View key={exp._id} style={styles.listItem}>
              <View>
                <Text style={styles.itemTitle}>{exp.description}</Text>
                <Text style={styles.itemSub}>
                  {new Date(exp.date).toLocaleDateString()} • {exp.category}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>
                {formatMoney(exp.amountMinor, exp.currency)}
              </Text>
            </View>
          ))
        )}
      </Surface>

      {/* Modals */}
      <AddExpenseModal
        visible={showAddExpense}
        onDismiss={() => setShowAddExpense(false)}
        onSuccess={loadData}
      />

      <SettleUpModal
        visible={showSettleUp}
        onDismiss={() => setShowSettleUp(false)}
        onSuccess={loadData}
      />
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
  banner: {
    backgroundColor: '#0c1322',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  bannerTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#14b8a6',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  bannerSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
  },
  settleBtn: {
    borderColor: 'rgba(45, 212, 191, 0.4)',
  },
  balanceCardsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: '#0c1322',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  netBalanceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 6,
  },
  positiveText: {
    color: '#14b8a6',
  },
  negativeText: {
    color: '#f43f5e',
  },
  cardSubText: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: '#0c1322',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f8fafc',
  },
  badgeText: {
    fontSize: 11,
    color: '#94a3b8',
    backgroundColor: '#111b30',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  linkText: {
    fontSize: 12,
    color: '#14b8a6',
    fontWeight: '600',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#162036',
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  itemSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  expenseAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  pillBadge: {
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 10,
    color: '#14b8a6',
    fontWeight: '600',
  },
  emptyNotice: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 14,
  },
})
