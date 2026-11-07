import React, { useEffect, useState } from 'react'
import { View, StyleSheet, ScrollView, Alert } from 'react-native'
import { Text, Surface, Button, SegmentedButtons } from 'react-native-paper'
import { useAuthStore } from '@splitfool/store'
import { mobileApi } from '../api/client'

interface SessionItem {
  id: string
  kind: string
  lastUsedAt: string
  current?: boolean
  device?: { ua?: string; ip?: string }
}

interface SettingsScreenProps {
  onLogout: () => void
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onLogout }) => {
  const { user, fetchMe, logout } = useAuthStore()
  const [currency, setCurrency] = useState(user?.defaultCurrency || 'INR')
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [savingCurrency, setSavingCurrency] = useState(false)

  const loadSessions = async () => {
    try {
      const res = await mobileApi.get<{ sessions: SessionItem[] }>('/api/auth/sessions')
      setSessions(res.sessions || [])
    } catch {
      // fallback
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const handleCurrencyChange = async (newCurrency: string) => {
    setCurrency(newCurrency)
    try {
      setSavingCurrency(true)
      await mobileApi.patch('/api/auth/me', { defaultCurrency: newCurrency })
      await fetchMe()
    } catch {
      // fallback
    } finally {
      setSavingCurrency(false)
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await mobileApi.delete(`/api/auth/sessions/${sessionId}`)
      loadSessions()
    } catch {
      // fallback
    }
  }

  const handleSignOut = async () => {
    try {
      await mobileApi.post('/api/auth/logout')
    } catch {
      // ignore
    }
    await mobileApi.clearTokens()
    logout()
    onLogout()
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Settings</Text>
        <Text style={styles.pageSub}>Preferences and security management</Text>
      </View>

      {/* Profile Card */}
      <Surface style={styles.card}>
        <Text style={styles.cardTitle}>User Profile</Text>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
          </View>
        </View>
      </Surface>

      {/* Currency Preference */}
      <Surface style={styles.card}>
        <Text style={styles.cardTitle}>Default Currency</Text>
        <Text style={styles.cardSub}>All converted balances and analytics will use this currency</Text>

        <SegmentedButtons
          value={currency}
          onValueChange={handleCurrencyChange}
          buttons={[
            { value: 'INR', label: 'INR (₹)' },
            { value: 'USD', label: 'USD ($)' },
            { value: 'EUR', label: 'EUR (€)' },
            { value: 'GBP', label: 'GBP (£)' },
          ]}
          style={styles.segmented}
          theme={{ colors: { secondaryContainer: '#14b8a6', onSecondaryContainer: '#ffffff' } }}
        />
      </Surface>

      {/* Active Sessions */}
      <Surface style={styles.card}>
        <Text style={styles.cardTitle}>Active Sessions</Text>
        <Text style={styles.cardSub}>Revoke any active session from other devices</Text>

        {sessions.map((sess) => (
          <View key={sess.id} style={styles.sessionItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sessionKind}>
                {(sess.kind || 'mobile').toUpperCase()} Session{sess.current ? ' (Current)' : ''}
              </Text>
              <Text style={styles.sessionTime}>
                Last used: {new Date(sess.lastUsedAt).toLocaleString()}
              </Text>
            </View>
            <Button
              mode="text"
              textColor="#f43f5e"
              compact
              onPress={() => handleRevokeSession(sess.id)}
            >
              Revoke
            </Button>
          </View>
        ))}
      </Surface>

      {/* Sign Out */}
      <Button
        mode="outlined"
        icon="logout"
        textColor="#f43f5e"
        style={styles.logoutBtn}
        onPress={handleSignOut}
      >
        Sign Out of splitFool
      </Button>
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
  card: {
    backgroundColor: '#0c1322',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  cardSub: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 14,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#162036',
    borderWidth: 1,
    borderColor: '#14b8a6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#14b8a6',
  },
  userName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  userEmail: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  segmented: {
    marginTop: 4,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#162036',
  },
  sessionKind: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f8fafc',
  },
  sessionTime: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  logoutBtn: {
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderRadius: 12,
    marginTop: 8,
    paddingVertical: 4,
  },
})
