import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { Text, Surface, Button, TextInput, Modal, Portal } from 'react-native-paper'
import { formatMoney } from '@splitfool/shared'
import { useAuthStore, useBalanceStore } from '@splitfool/store'
import { mobileApi } from '../api/client'
import { SettleUpModal } from '../components/modals/SettleUpModal'

interface FriendItem {
  user: {
    _id: string
    name: string
    email: string
    avatar?: string
  }
  balances: Array<{ currency: string; amountMinor: number }>
}

export const FriendsScreen: React.FC = () => {
  const { user } = useAuthStore()
  const { fetchBalances } = useBalanceStore()

  const [friends, setFriends] = useState<FriendItem[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [friendEmail, setFriendEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settleFriend, setSettleFriend] = useState<{
    fromId: string
    toId: string
    name: string
    amount: number
    currency: string
  } | null>(null)

  const loadFriends = async () => {
    try {
      await fetchBalances()
      const res = await mobileApi.get<{ friends: FriendItem[] }>('/api/friends')
      setFriends(res.friends || [])
    } catch {
      // fallback
    }
  }

  useEffect(() => {
    loadFriends()
  }, [])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadFriends()
    setRefreshing(false)
  }

  const handleAddFriend = async () => {
    if (!friendEmail.trim()) {
      setError('Please enter an email')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await mobileApi.post('/api/friends', { email: friendEmail.trim() })
      setFriendEmail('')
      setShowAddFriend(false)
      loadFriends()
    } catch (err: any) {
      setError(err?.message || 'Failed to add friend')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#14b8a6" />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.pageTitle}>Friends</Text>
          <Text style={styles.pageSub}>Manage 1-on-1 balances</Text>
        </View>
        <Button
          mode="contained"
          icon="account-plus"
          buttonColor="#14b8a6"
          textColor="#ffffff"
          onPress={() => setShowAddFriend(true)}
        >
          Add Friend
        </Button>
      </View>

      {friends.length === 0 ? (
        <Surface style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No friends added yet</Text>
          <Text style={styles.emptySub}>
            Invite friends by email to easily split individual bills and track balances.
          </Text>
          <Button
            mode="contained"
            buttonColor="#14b8a6"
            textColor="#ffffff"
            onPress={() => setShowAddFriend(true)}
            style={{ marginTop: 14 }}
          >
            Invite Friend
          </Button>
        </Surface>
      ) : (
        friends.map((friend) => {
          const firstBalance = friend.balances?.[0] ?? {
            currency: user?.defaultCurrency || 'INR',
            amountMinor: 0,
          }
          const { currency, amountMinor } = firstBalance
          const isOwed = amountMinor > 0
          const owes = amountMinor < 0
          const displayName = friend.user.name || friend.user.email

          return (
            <Surface key={friend.user._id} style={styles.friendCard}>
              <View style={styles.friendCardRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {displayName ? displayName.charAt(0).toUpperCase() : 'F'}
                  </Text>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.friendName}>{displayName}</Text>
                  <Text style={styles.friendEmail}>{friend.user.email}</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={[
                      styles.balanceAmount,
                      isOwed ? styles.positiveText : owes ? styles.negativeText : styles.neutralText,
                    ]}
                  >
                    {formatMoney(Math.abs(amountMinor), currency)}
                  </Text>
                  <Text style={styles.balanceStatus}>
                    {isOwed ? 'owes you' : owes ? 'you owe' : 'settled up'}
                  </Text>
                </View>
              </View>

              {(owes || isOwed) && (
                <View style={styles.cardActions}>
                  <Button
                    mode="contained"
                    buttonColor="#14b8a6"
                    textColor="#ffffff"
                    compact
                    onPress={() =>
                      setSettleFriend({
                        fromId: owes ? user?._id || '' : friend.user._id,
                        toId: owes ? friend.user._id : user?._id || '',
                        name: displayName,
                        amount: Math.abs(amountMinor),
                        currency,
                      })
                    }
                  >
                    Settle Up
                  </Button>
                </View>
              )}
            </Surface>
          )
        })
      )}

      {/* Add Friend Modal */}
      <Portal>
        <Modal
          visible={showAddFriend}
          onDismiss={() => setShowAddFriend(false)}
          contentContainerStyle={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Add a Friend</Text>
          <Text style={styles.modalSub}>Send an invitation to track shared expenses together</Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={styles.inputLabel}>Friend's Email Address</Text>
          <TextInput
            mode="outlined"
            placeholder="e.g. friend@example.com"
            value={friendEmail}
            onChangeText={setFriendEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            textColor="#f8fafc"
            style={styles.modalInput}
            outlineColor="#334155"
            activeOutlineColor="#14b8a6"
          />

          <View style={styles.modalActions}>
            <Button mode="text" onPress={() => setShowAddFriend(false)} textColor="#94a3b8">
              Cancel
            </Button>
            <Button
              mode="contained"
              buttonColor="#14b8a6"
              textColor="#ffffff"
              loading={loading}
              disabled={loading}
              onPress={handleAddFriend}
            >
              Send Invite
            </Button>
          </View>
        </Modal>
      </Portal>

      <SettleUpModal
        visible={!!settleFriend}
        payerId={settleFriend?.fromId}
        recipientId={settleFriend?.toId}
        recipientName={settleFriend?.name}
        initialAmountMinor={settleFriend?.amount}
        currency={settleFriend?.currency}
        onDismiss={() => setSettleFriend(null)}
        onSuccess={loadFriends}
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
  headerRow: {
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
  friendCard: {
    backgroundColor: '#0c1322',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  friendCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#162036',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#14b8a6',
  },
  friendName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  friendEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  balanceStatus: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  positiveText: {
    color: '#14b8a6',
  },
  negativeText: {
    color: '#f43f5e',
  },
  neutralText: {
    color: '#64748b',
  },
  cardActions: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#162036',
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
  modalContainer: {
    backgroundColor: '#0c1322',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
  },
  errorText: {
    color: '#f43f5e',
    fontSize: 13,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#111b30',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
})
