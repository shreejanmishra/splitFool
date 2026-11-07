import React, { useState } from 'react'
import { View, StyleSheet, ScrollView, Platform } from 'react-native'
import { Text, Button, Surface } from 'react-native-paper'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { mobileApi } from '../api/client'
import { useAuthStore } from '@splitfool/store'

interface LoginScreenProps {
  onLoginSuccess: () => void
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const { fetchMe } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDevLogin = async (name: string, email: string) => {
    try {
      setLoading(true)
      setError(null)

      const res = await mobileApi.post<{ accessToken: string; refreshToken: string }>(
        '/api/auth/dev/login',
        {
          name,
          email,
          platform: 'android',
        },
      )

      if (res.accessToken && res.refreshToken) {
        await mobileApi.setTokens(res.accessToken, res.refreshToken)
        await fetchMe()
        onLoginSuccess()
      } else {
        throw new Error('Tokens not returned')
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google' | 'github') => {
    try {
      setLoading(true)
      setError(null)

      // Start OAuth with platform=android via POST /api/auth/:provider/start
      const redirectUri = Linking.createURL('auth/callback')
      const startRes = await mobileApi.post<{ url: string }>(`/api/auth/${provider}/start`, {
        platform: 'android',
      })
      if (!startRes.url) {
        throw new Error('Failed to start OAuth session')
      }

      const result = await WebBrowser.openAuthSessionAsync(startRes.url, redirectUri)

      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url)
        const code = parsed.queryParams?.code as string
        if (code) {
          const exchangeRes = await mobileApi.post<{ accessToken: string; refreshToken: string }>(
            '/api/auth/native/exchange',
            {
              code,
              appVerifier: 'mobile_app',
            },
          )
          if (exchangeRes.accessToken) {
            await mobileApi.setTokens(exchangeRes.accessToken, exchangeRes.refreshToken)
            await fetchMe()
            onLoginSuccess()
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'OAuth authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Brand Header */}
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>$</Text>
        </View>
        <Text style={styles.appName}>
          split<Text style={styles.brandAccent}>Fool</Text>
        </Text>
        <Text style={styles.tagline}>
          Smart debt simplification & fair expense splitting for Android
        </Text>
      </View>

      {error && (
        <Surface style={styles.errorSurface}>
          <Text style={styles.errorText}>{error}</Text>
        </Surface>
      )}

      {/* OAuth Buttons */}
      <Surface style={styles.card}>
        <Text style={styles.cardTitle}>Sign in to your account</Text>

        <Button
          mode="contained"
          buttonColor="#111b30"
          textColor="#f8fafc"
          icon="google"
          style={styles.oauthButton}
          onPress={() => handleOAuthLogin('google')}
          disabled={loading}
        >
          Continue with Google
        </Button>

        <Button
          mode="contained"
          buttonColor="#111b30"
          textColor="#f8fafc"
          icon="github"
          style={styles.oauthButton}
          onPress={() => handleOAuthLogin('github')}
          disabled={loading}
        >
          Continue with GitHub
        </Button>

        {/* Dev Quick Logins */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>QUICK DEV ACCOUNTS</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.devButtonsRow}>
          <Button
            mode="outlined"
            textColor="#14b8a6"
            style={styles.devBtn}
            onPress={() => handleDevLogin('Alice', 'alice@test.com')}
            disabled={loading}
          >
            Alice
          </Button>
          <Button
            mode="outlined"
            textColor="#14b8a6"
            style={styles.devBtn}
            onPress={() => handleDevLogin('Bob', 'bob@test.com')}
            disabled={loading}
          >
            Bob
          </Button>
          <Button
            mode="outlined"
            textColor="#14b8a6"
            style={styles.devBtn}
            onPress={() => handleDevLogin('Charlie', 'charlie@test.com')}
            disabled={loading}
          >
            Charlie
          </Button>
        </View>
      </Surface>

      {/* Security notice */}
      <Text style={styles.footerNotice}>
        End-to-end encrypted session tokens • Biometric support • OWASP compliant
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#060913',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    borderWidth: 1,
    borderColor: '#14b8a6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#14b8a6',
  },
  appName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#f8fafc',
    letterSpacing: -0.5,
  },
  brandAccent: {
    color: '#14b8a6',
  },
  tagline: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#0c1322',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 20,
    textAlign: 'center',
  },
  oauthButton: {
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 4,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1e293b',
  },
  dividerText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    letterSpacing: 1,
    marginHorizontal: 10,
  },
  devButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  devBtn: {
    flex: 1,
    borderColor: 'rgba(20, 184, 166, 0.4)',
    borderRadius: 10,
  },
  errorSurface: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    borderColor: '#f43f5e',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#f43f5e',
    fontSize: 13,
    textAlign: 'center',
  },
  footerNotice: {
    textAlign: 'center',
    fontSize: 11,
    color: '#64748b',
    marginTop: 32,
  },
})
