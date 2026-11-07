import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { Text, Surface, Button } from 'react-native-paper'
import { formatMoney, type Balance } from '@splitfool/shared'
import { useAuthStore, useGroupStore, useExpenseStore, useBalanceStore } from '@splitfool/store'
import { CreateGroupModal } from '../components/modals/CreateGroupModal'
import { AddExpenseModal } from '../components/modals/AddExpenseModal'
import { SettleUpModal } from '../components/modals/SettleUpModal'

export const GroupsScreen: React.FC = () => {
  const { user } = useAuthStore()
  const { groups, fetchGroups } = useGroupStore()
  const { expenses, fetchExpenses } = useExpenseStore()
  const { balances, simplifiedDebts, fetchBalances } = useBalanceStore()

  const [refreshing, setRefreshing] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [settleRecipient, setSettleRecipient] = useState<{
    fromId: string
    toId: string
    name: string
    amount: number
    currency: string
  } | null>(null)

  const loadData = async () => {
    await fetchGroups()
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedGroupId) {
      fetchBalances(selectedGroupId)
      fetchExpenses(selectedGroupId)
    }
  }, [selectedGroupId])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    if (selectedGroupId) {
      await Promise.all([fetchBalances(selectedGroupId), fetchExpenses(selectedGroupId)])
    }
    setRefreshing(false)
  }

  const selectedGroup = groups.find((g) => g._id === selectedGroupId)
  const selectedGroupExpenses = expenses.filter((e) => e.groupId === selectedGroupId)
  const getMemberName = (uid?: string) => {
    if (!uid) return 'Unknown'
    if (uid === user?._id) return 'You'
    return selectedGroup?.members?.find((m) => m.userId === uid)?.name || `User ${uid.slice(-4)}`
  }
  const activeDebts = selectedGroup?.simplifyDebts ? simplifiedDebts : balances

  // If a group is selected, show Group Detail
  if (selectedGroup) {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#14b8a6" />}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => setSelectedGroupId(null)}>
          <Text style={styles.backButtonText}>← Back to all groups</Text>
        </TouchableOpacity>

        <Surface style={styles.detailHeaderCard}>
          <Text style={styles.groupTypeTag}>{selectedGroup.type.toUpperCase()}</Text>
          <Text style={styles.detailTitle}>{selectedGroup.name}</Text>
          <Text style={styles.detailSub}>
            {selectedGroup.members?.length || 0} members • Currency: {selectedGroup.defaultCurrency}
          </Text>

          <View style={styles.headerActions}>
            <Button
              mode="contained"
              buttonColor="#14b8a6"
              textColor="#ffffff"
              icon="plus"
              style={{ flex: 1 }}
              onPress={() => setShowAddExpense(true)}
            >
              Add Expense
            </Button>
          </View>
        </Surface>

        {/* Live Simplified Debts */}
        <Surface style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Debt Simplification</Text>
            {selectedGroup.simplifyDebts && (
              <View style={styles.pillBadge}>
                <Text style={styles.pillText}>Optimized</Text>
              </View>
            )}
          </View>

          {activeDebts.length === 0 ? (
            <Text style={styles.emptyNotice}>All settled up! No debts in this group.</Text>
          ) : (
            activeDebts.map((debt: Balance, index: number) => {
              const involvesMe = debt.from === user?._id || debt.to === user?._id

              return (
                <View key={index} style={styles.debtItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.debtText}>
                      <Text style={{ fontWeight: 'bold', color: '#f8fafc' }}>
                        {getMemberName(debt.from)}
                      </Text>{' '}
                      owes{' '}
                      <Text style={{ fontWeight: 'bold', color: '#f8fafc' }}>
                        {getMemberName(debt.to)}
                      </Text>
                    </Text>
                    <Text style={styles.debtAmount}>
                      {formatMoney(debt.amountMinor, debt.currency)}
                    </Text>
                  </View>

                  {involvesMe && (
                    <Button
                      mode="contained"
                      buttonColor="#14b8a6"
                      textColor="#ffffff"
                      compact
                      onPress={() =>
                        setSettleRecipient({
                          fromId: debt.from,
                          toId: debt.to,
                          name: debt.from === user?._id ? getMemberName(debt.to) : getMemberName(debt.from),
                          amount: debt.amountMinor,
                          currency: debt.currency,
                        })
                      }
                    >
                      Settle
                    </Button>
                  )}
                </View>
              )
            })
          )}
        </Surface>

        {/* Group Expenses List */}
        <Surface style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Expenses ({selectedGroupExpenses.length})</Text>
          {selectedGroupExpenses.length === 0 ? (
            <Text style={styles.emptyNotice}>No expenses in this group yet.</Text>
          ) : (
            selectedGroupExpenses.map((exp) => {
              const payerId = exp.payers[0]?.userId
              return (
                <View key={exp._id} style={styles.expenseItem}>
                  <View>
                    <Text style={styles.itemTitle}>{exp.description}</Text>
                    <Text style={styles.itemSub}>
                      {new Date(exp.date).toLocaleDateString()} • Paid by {getMemberName(payerId)}
                    </Text>
                  </View>
                  <Text style={styles.expenseAmount}>
                    {formatMoney(exp.amountMinor, exp.currency)}
                  </Text>
                </View>
              )
            })
          )}
        </Surface>

        <AddExpenseModal
          visible={showAddExpense}
          groupId={selectedGroup._id}
          onDismiss={() => setShowAddExpense(false)}
          onSuccess={onRefresh}
        />

        <SettleUpModal
          visible={!!settleRecipient}
          groupId={selectedGroup._id}
          payerId={settleRecipient?.fromId}
          recipientId={settleRecipient?.toId}
          recipientName={settleRecipient?.name}
          initialAmountMinor={settleRecipient?.amount}
          currency={settleRecipient?.currency || selectedGroup.defaultCurrency}
          onDismiss={() => setSettleRecipient(null)}
          onSuccess={onRefresh}
        />
      </ScrollView>
    )
  }

  // Groups list
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#14b8a6" />}
    >
      <View style={styles.listHeaderRow}>
        <View>
          <Text style={styles.pageTitle}>Groups</Text>
          <Text style={styles.pageSub}>Collaborative expense hubs</Text>
        </View>
        <Button
          mode="contained"
          icon="plus"
          buttonColor="#14b8a6"
          textColor="#ffffff"
          onPress={() => setShowCreateGroup(true)}
        >
          New Group
        </Button>
      </View>

      {groups.length === 0 ? (
        <Surface style={styles.emptyCard}>
          <Text style={styles.emptyCardTitle}>No groups yet</Text>
          <Text style={styles.emptyCardSub}>
            Create your first group for a trip, house, or project to start tracking shared expenses.
          </Text>
          <Button
            mode="contained"
            buttonColor="#14b8a6"
            textColor="#ffffff"
            onPress={() => setShowCreateGroup(true)}
            style={{ marginTop: 12 }}
          >
            Create Group
          </Button>
        </Surface>
      ) : (
        groups.map((group) => (
          <TouchableOpacity
            key={group._id}
            onPress={() => setSelectedGroupId(group._id)}
            activeOpacity={0.7}
          >
            <Surface style={styles.groupCard}>
              <View style={styles.groupCardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.groupCardName}>{group.name}</Text>
                  <Text style={styles.groupCardSub}>
                    {group.members?.length || 0} members • {group.defaultCurrency}
                  </Text>
                </View>
                <Text style={styles.chevron}>→</Text>
              </View>

              <View style={styles.groupCardBottom}>
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{group.type}</Text>
                </View>
                {group.simplifyDebts && (
                  <View style={styles.pillBadge}>
                    <Text style={styles.pillText}>Debt Simplification Active</Text>
                  </View>
                )}
              </View>
            </Surface>
          </TouchableOpacity>
        ))
      )}

      <CreateGroupModal
        visible={showCreateGroup}
        onDismiss={() => setShowCreateGroup(false)}
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
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  groupCard: {
    backgroundColor: '#0c1322',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  groupCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupCardName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  groupCardSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 3,
  },
  chevron: {
    fontSize: 18,
    color: '#14b8a6',
    fontWeight: 'bold',
  },
  groupCardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#162036',
  },
  typeBadge: {
    backgroundColor: '#162036',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'capitalize',
  },
  pillBadge: {
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: {
    fontSize: 11,
    color: '#14b8a6',
    fontWeight: '600',
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
  emptyCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 8,
  },
  emptyCardSub: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
  },
  backButton: {
    marginBottom: 14,
  },
  backButtonText: {
    color: '#14b8a6',
    fontSize: 14,
    fontWeight: '600',
  },
  detailHeaderCard: {
    backgroundColor: '#0c1322',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  groupTypeTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#14b8a6',
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  detailSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  headerActions: {
    marginTop: 16,
  },
  sectionCard: {
    backgroundColor: '#0c1322',
    borderRadius: 16,
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
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 10,
  },
  debtItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#162036',
  },
  debtText: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  debtAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#14b8a6',
    marginTop: 2,
  },
  expenseItem: {
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
  emptyNotice: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 14,
  },
})
