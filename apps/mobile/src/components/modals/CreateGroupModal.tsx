import React, { useState } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Modal, Portal, Text, TextInput, Button, SegmentedButtons, Switch } from 'react-native-paper'
import { useGroupStore } from '@splitfool/store'

interface CreateGroupModalProps {
  visible: boolean
  onDismiss: () => void
  onSuccess?: () => void
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  visible,
  onDismiss,
  onSuccess,
}) => {
  const { createGroup } = useGroupStore()
  const [name, setName] = useState('')
  const [type, setType] = useState('trip')
  const [currency, setCurrency] = useState('INR')
  const [simplifyDebts, setSimplifyDebts] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter a group name')
      return
    }

    try {
      setLoading(true)
      setError(null)
      await createGroup({
        name: name.trim(),
        type: type as any,
        defaultCurrency: currency,
        simplifyDebts,
      })
      setName('')
      onSuccess?.()
      onDismiss()
    } catch (err: any) {
      setError(err?.message || 'Failed to create group')
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
          <Text style={styles.title}>Create New Group</Text>
          <Text style={styles.subtitle}>Organize shared expenses with friends or flatmates</Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Text style={styles.label}>Group Name</Text>
          <TextInput
            mode="outlined"
            placeholder="e.g. Goa Trip, Apartment 4B"
            value={name}
            onChangeText={setName}
            textColor="#f8fafc"
            style={styles.input}
            outlineColor="#334155"
            activeOutlineColor="#14b8a6"
          />

          <Text style={styles.label}>Group Type</Text>
          <SegmentedButtons
            value={type}
            onValueChange={setType}
            buttons={[
              { value: 'trip', label: 'Trip' },
              { value: 'home', label: 'Home' },
              { value: 'couple', label: 'Couple' },
              { value: 'other', label: 'Other' },
            ]}
            style={styles.segmented}
            theme={{ colors: { secondaryContainer: '#14b8a6', onSecondaryContainer: '#ffffff' } }}
          />

          <Text style={styles.label}>Currency</Text>
          <SegmentedButtons
            value={currency}
            onValueChange={setCurrency}
            buttons={[
              { value: 'INR', label: 'INR (₹)' },
              { value: 'USD', label: 'USD ($)' },
              { value: 'EUR', label: 'EUR (€)' },
              { value: 'GBP', label: 'GBP (£)' },
            ]}
            style={styles.segmented}
            theme={{ colors: { secondaryContainer: '#14b8a6', onSecondaryContainer: '#ffffff' } }}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={styles.switchLabel}>Simplify Debts</Text>
              <Text style={styles.switchHelp}>Automatically minimize number of transactions</Text>
            </View>
            <Switch
              value={simplifyDebts}
              onValueChange={setSimplifyDebts}
              color="#14b8a6"
            />
          </View>

          <View style={styles.actions}>
            <Button mode="text" onPress={onDismiss} textColor="#94a3b8" style={styles.button}>
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              buttonColor="#14b8a6"
              textColor="#ffffff"
              style={styles.button}
            >
              Create Group
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
    marginBottom: 18,
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
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#111b30',
    marginBottom: 8,
  },
  segmented: {
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 14,
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  switchHelp: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  button: {
    borderRadius: 8,
  },
})
