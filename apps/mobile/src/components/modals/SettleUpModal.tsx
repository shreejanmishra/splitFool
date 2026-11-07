import React, { useEffect, useState } from 'react'
import { StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native'
import { Modal, Portal, Text, TextInput, Button } from 'react-native-paper'
import { parseToMinor, minorToMajorString } from '@splitfool/shared'
import { useAuthStore } from '@splitfool/store'
import { mobileApi } from '../../api/client'

interface SettleUpModalProps {
  visible: boolean
  groupId?: string
  payerId?: string
  recipientId?: string
  recipientName?: string
  initialAmountMinor?: number
  currency?: string
  onDismiss: () => void
  onSuccess?: () => void
}

export const SettleUpModal: React.FC<SettleUpModalProps> = ({
  visible,
  groupId,
  payerId,
  recipientId,
  recipientName,
  initialAmountMinor = 0,
  currency = 'INR',
  onDismiss,
  onSuccess,
}) => {
  const { user } = useAuthStore()

  const [selectedFromId, setSelectedFromId] = useState(payerId || user?._id || '')
  const [selectedToId, setSelectedToId] = useState(recipientId || '')
  const [selectedName, setSelectedName] = useState(recipientName || '')
  const [friends, setFriends] = useState<Array<{ _id: string; name: string; email: string }>>([])
  const [amountStr, setAmountStr] = useState(
    initialAmountMinor > 0 ? minorToMajorString(initialAmountMinor, currency) : '',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      setSelectedFromId(payerId || user?._id || '')
      setSelectedToId(recipientId || '')
      setSelectedName(recipientName || '')
      setAmountStr(initialAmountMinor > 0 ? minorToMajorString(initialAmountMinor, currency) : '')
      setError(null)

      if (!recipientId) {
        mobileApi
          .get<{ friends: Array<{ user: { _id: string; name: string; email: string } }> }>('/api/friends')
          .then((res) => {
            const list = (res.friends || []).map((f) => f.user)
            setFriends(list)
            if (list.length > 0) {
              setSelectedToId(list[0]!._id)
              setSelectedName(list[0]!.name)
            }
          })
          .catch(() => {})
      }
    }
  }, [visible, payerId, recipientId, recipientName, initialAmountMinor, currency, user])

  const handleSubmit = async () => {
    const amountMinor = parseToMinor(amountStr, currency)
    if (isNaN(amountMinor) || amountMinor <= 0) {
      setError('Please enter a valid amount')
      return
    }

    const from = selectedFromId || user?._id || ''
    const to = selectedToId
    if (!from || !to) {
      setError('Please select a recipient')
      return
    }
    if (from === to) {
      setError('Payer and recipient must be different')
      return
    }

    try {
      setLoading(true)
      setError(null)

      await mobileApi.post('/api/settlements', {
        groupId: groupId || undefined,
        from,
        to,
        amountMinor,
        currency,
        date: new Date().toISOString(),
      })

      setAmountStr('')
      onSuccess?.()
      onDismiss()
    } catch (err: any) {
      setError(err?.message || 'Failed to record settlement')
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
          <Text style={styles.title}>Settle Up</Text>
          <Text style={styles.subtitle}>
            Pay {recipientName || 'friend'} to clear outstanding balance
          </Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={styles.label}>Recipient</Text>
          {recipientId ? (
            <TextInput
              mode="outlined"
              value={selectedName || recipientId || 'Friend'}
              editable={false}
              textColor="#94a3b8"
              style={styles.input}
              outlineColor="#334155"
            />
          ) : friends.length === 0 ? (
            <Text style={styles.subtitle}>No friends found to settle up with.</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {friends.map((f) => {
                const active = selectedToId === f._id
                return (
                  <TouchableOpacity
                    key={f._id}
                    onPress={() => {
                      setSelectedToId(f._id)
                      setSelectedName(f.name)
                    }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: active ? '#14b8a6' : '#334155',
                      backgroundColor: active ? 'rgba(20, 184, 166, 0.15)' : '#111b30',
                    }}
                  >
                    <Text style={{ color: active ? '#14b8a6' : '#cbd5e1', fontSize: 13 }}>
                      {f.name || f.email}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          )}

          <Text style={styles.label}>Amount ({currency})</Text>
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
              Confirm Settlement
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
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
})
