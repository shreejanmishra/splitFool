import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native'
import {
  Modal,
  Portal,
  Text,
  TextInput,
  Button,
  SegmentedButtons,
  Checkbox,
} from 'react-native-paper'
import { calculateSplit, parseToMinor, type ExpenseCategory } from '@splitfool/shared'
import { useAuthStore, useExpenseStore, useGroupStore } from '@splitfool/store'
import { mobileApi } from '../../api/client'

interface AddExpenseModalProps {
  visible: boolean
  groupId?: string
  onDismiss: () => void
  onSuccess?: () => void
}

export const AddExpenseModal: React.FC<AddExpenseModalProps> = ({
  visible,
  groupId: initialGroupId,
  onDismiss,
  onSuccess,
}) => {
  const { user } = useAuthStore()
  const { groups } = useGroupStore()
  const { createExpense } = useExpenseStore()

  const [description, setDescription] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [currency, setCurrency] = useState(user?.defaultCurrency || 'INR')
  const [category, setCategory] = useState<ExpenseCategory>('general')
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId || '')
  const [splitMethod, setSplitMethod] = useState<'equal' | 'exact' | 'percent' | 'shares'>('equal')
  const [friends, setFriends] = useState<Array<{ userId: string; name: string }>>([])

  const currentGroup = groups.find((g) => g._id === selectedGroupId)
  const memberOptions: Array<{ userId: string; name: string }> = currentGroup
    ? currentGroup.members.map((m) => ({ userId: m.userId, name: m.name }))
    : [
        ...(user ? [{ userId: user._id, name: user.name || 'You' }] : []),
        ...friends.filter((f) => f.userId !== user?._id),
      ]

  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      const gid = initialGroupId ?? groups[0]?._id ?? ''
      setSelectedGroupId(gid)
      setError(null)
      const grp = groups.find((g) => g._id === gid)
      if (grp) {
        setSelectedMembers(grp.members.map((m) => m.userId))
        setCurrency(grp.defaultCurrency || user?.defaultCurrency || 'INR')
      } else {
        setSelectedMembers(user ? [user._id] : [])
        setCurrency(user?.defaultCurrency || 'INR')
        mobileApi
          .get<{ friends: Array<{ user: { _id: string; name: string } }> }>('/api/friends')
          .then((res) => {
            setFriends((res.friends || []).map((f) => ({ userId: f.user._id, name: f.user.name })))
          })
          .catch(() => {})
      }
    }
  }, [visible, initialGroupId, groups, user])

  const handleSelectGroup = (gid: string) => {
    setSelectedGroupId(gid)
    const grp = groups.find((g) => g._id === gid)
    if (grp) {
      setSelectedMembers(grp.members.map((m) => m.userId))
      if (grp.defaultCurrency) setCurrency(grp.defaultCurrency)
    } else if (user) {
      setSelectedMembers([user._id])
    }
  }

  const toggleMember = (userId: string) => {
    if (selectedMembers.includes(userId)) {
      if (selectedMembers.length <= 1) return
      setSelectedMembers(selectedMembers.filter((id) => id !== userId))
    } else {
      setSelectedMembers([...selectedMembers, userId])
    }
  }

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please enter a description')
      return
    }

    const totalMinor = parseToMinor(amountStr, currency)
    if (isNaN(totalMinor) || totalMinor <= 0) {
      setError('Please enter a valid amount')
      return
    }

    if (selectedMembers.length === 0) {
      setError('Please select at least one person to split with')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const parsedValues: Record<string, number> = {}
      if (splitMethod === 'exact') {
        for (const uid of selectedMembers) {
          parsedValues[uid] = parseToMinor(customInputs[uid] || '0', currency)
        }
      } else if (splitMethod === 'percent') {
        for (const uid of selectedMembers) {
          parsedValues[uid] = parseFloat(customInputs[uid] || '0') || 0
        }
      } else if (splitMethod === 'shares') {
        for (const uid of selectedMembers) {
          parsedValues[uid] = Math.max(1, parseInt(customInputs[uid] || '1', 10) || 1)
        }
      }

      const calculatedSplits = calculateSplit(
        totalMinor,
        selectedMembers,
        splitMethod,
        splitMethod === 'equal' ? undefined : parsedValues,
      )

      const payerId = user?._id || selectedMembers[0]!

      await createExpense({
        groupId: selectedGroupId || undefined,
        description: description.trim(),
        amountMinor: totalMinor,
        currency: currency as any,
        category,
        payers: [{ userId: payerId, amountMinor: totalMinor }],
        splitMethod,
        splits: calculatedSplits,
        date: new Date().toISOString(),
      })

      setDescription('')
      setAmountStr('')
      setCustomInputs({})
      onSuccess?.()
      onDismiss()
    } catch (err: any) {
      setError(err?.message || 'Failed to add expense')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}
      >
        <ScrollView>
          <Text style={styles.title}>Add Expense</Text>
          <Text style={styles.subtitle}>Split a shared bill or payment</Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={styles.label}>Description</Text>
          <TextInput
            mode="outlined"
            placeholder="e.g. Dinner at Olive, Grocery haul"
            value={description}
            onChangeText={setDescription}
            textColor="#f8fafc"
            style={styles.input}
            outlineColor="#334155"
            activeOutlineColor="#14b8a6"
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Amount</Text>
              <TextInput
                mode="outlined"
                placeholder="0.00"
                keyboardType="numeric"
                value={amountStr}
                onChangeText={setAmountStr}
                textColor="#f8fafc"
                style={styles.input}
                outlineColor="#334155"
                activeOutlineColor="#14b8a6"
              />
            </View>
            <View style={{ width: 110 }}>
              <Text style={styles.label}>Currency</Text>
              <TextInput
                mode="outlined"
                value={currency}
                onChangeText={setCurrency}
                textColor="#f8fafc"
                style={styles.input}
                outlineColor="#334155"
                activeOutlineColor="#14b8a6"
              />
            </View>
          </View>

          <Text style={styles.label}>Split Method</Text>
          <SegmentedButtons
            value={splitMethod}
            onValueChange={(val) => setSplitMethod(val as any)}
            buttons={[
              { value: 'equal', label: '=' },
              { value: 'exact', label: '1.23' },
              { value: 'percent', label: '%' },
              { value: 'shares', label: 'x' },
            ]}
            style={styles.segmented}
            theme={{ colors: { secondaryContainer: '#14b8a6', onSecondaryContainer: '#ffffff' } }}
          />

          {!initialGroupId && groups.length > 0 && (
            <>
              <Text style={styles.label}>Group</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {groups.map((g) => {
                  const active = selectedGroupId === g._id
                  return (
                    <TouchableOpacity
                      key={g._id}
                      onPress={() => handleSelectGroup(g._id)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: active ? '#14b8a6' : '#334155',
                        backgroundColor: active ? 'rgba(20, 184, 166, 0.15)' : '#111b30',
                      }}
                    >
                      <Text style={{ color: active ? '#14b8a6' : '#cbd5e1', fontSize: 12 }}>
                        {g.name}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </>
          )}

          <Text style={styles.label}>Split With ({selectedMembers.length} selected)</Text>
          <View style={styles.membersList}>
            {memberOptions.map((member) => {
              const isSelected = selectedMembers.includes(member.userId)
              const isCurrentUser = member.userId === user?._id
              return (
                <View key={member.userId} style={styles.memberRow}>
                  <Checkbox
                    status={isSelected ? 'checked' : 'unchecked'}
                    onPress={() => toggleMember(member.userId)}
                    color="#14b8a6"
                  />
                  <Text style={[styles.memberName, { flex: 1 }]}>
                    {isCurrentUser ? `${member.name} (You)` : member.name}
                  </Text>
                  {isSelected && splitMethod !== 'equal' && (
                    <TextInput
                      mode="outlined"
                      dense
                      keyboardType="numeric"
                      placeholder={
                        splitMethod === 'percent' ? '%' : splitMethod === 'shares' ? '1' : '0.00'
                      }
                      value={customInputs[member.userId] || ''}
                      onChangeText={(val) =>
                        setCustomInputs((prev) => ({ ...prev, [member.userId]: val }))
                      }
                      textColor="#f8fafc"
                      style={{ width: 85, backgroundColor: '#0c1322' }}
                      outlineColor="#334155"
                      activeOutlineColor="#14b8a6"
                    />
                  )}
                </View>
              )
            })}
          </View>

          <View style={styles.actions}>
            <Button mode="text" onPress={onDismiss} textColor="#94a3b8">
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              buttonColor="#14b8a6"
              textColor="#ffffff"
            >
              Save Expense
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </Portal>
  )
}

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: '#0c1322',
    margin: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    maxHeight: '85%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
  },
  errorText: {
    color: '#f43f5e',
    fontSize: 13,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#cbd5e1',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#111b30',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
  },
  segmented: {
    marginBottom: 12,
  },
  membersList: {
    backgroundColor: '#111b30',
    borderRadius: 10,
    padding: 8,
    marginVertical: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  memberName: {
    color: '#f8fafc',
    fontSize: 14,
    marginLeft: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
})
