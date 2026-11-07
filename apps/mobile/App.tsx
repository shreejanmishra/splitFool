import React, { useEffect, useMemo, useState } from 'react'
import { View, StyleSheet, SafeAreaView, Platform } from 'react-native'
import { Provider as PaperProvider, BottomNavigation, ActivityIndicator } from 'react-native-paper'
import { StatusBar } from 'expo-status-bar'
import * as Linking from 'expo-linking'
import { theme } from './src/theme'
import { mobileApi } from './src/api/client'
import { setApiClient, useAuthStore } from '@splitfool/store'
import { LoginScreen } from './src/screens/LoginScreen'
import { DashboardScreen } from './src/screens/DashboardScreen'
import { GroupsScreen } from './src/screens/GroupsScreen'
import { FriendsScreen } from './src/screens/FriendsScreen'
import { ActivityScreen } from './src/screens/ActivityScreen'
import { SettingsScreen } from './src/screens/SettingsScreen'

export default function App() {
  const { user, fetchMe } = useAuthStore()
  const [initializing, setInitializing] = useState(true)
  const [index, setIndex] = useState(0)

  // Configure bottom navigation tabs
  const [routes] = useState([
    { key: 'dashboard', title: 'Dashboard', focusedIcon: 'view-dashboard', unfocusedIcon: 'view-dashboard-outline' },
    { key: 'groups', title: 'Groups', focusedIcon: 'account-group', unfocusedIcon: 'account-group-outline' },
    { key: 'friends', title: 'Friends', focusedIcon: 'account-multiple', unfocusedIcon: 'account-multiple-outline' },
    { key: 'activity', title: 'Activity', focusedIcon: 'pulse', unfocusedIcon: 'pulse' },
    { key: 'settings', title: 'Settings', focusedIcon: 'cog', unfocusedIcon: 'cog-outline' },
  ])

  useEffect(() => {
    // Inject mobileApi into store singletons
    setApiClient(mobileApi)

    // Check token and restore session
    const initAuth = async () => {
      try {
        const token = await mobileApi.getAccessToken()
        if (token) {
          await fetchMe()
        }
      } catch {
        // failed restore
      } finally {
        setInitializing(false)
      }
    }

    initAuth()

    // Deep linking handler for splitfool:// scheme
    const handleDeepLink = async (event: { url: string }) => {
      const parsed = Linking.parse(event.url)
      if (parsed.path === 'auth/callback' && parsed.queryParams?.code) {
        try {
          const res = await mobileApi.post<{ accessToken: string; refreshToken: string }>(
            '/api/auth/native/exchange',
            {
              code: parsed.queryParams.code as string,
              appVerifier: 'mobile_app',
            },
          )
          if (res.accessToken) {
            await mobileApi.setTokens(res.accessToken, res.refreshToken)
            await fetchMe()
          }
        } catch {
          // ignore
        }
      }
    }

    const sub = Linking.addEventListener('url', handleDeepLink)
    return () => sub.remove()
  }, [])

  const renderScene = useMemo(
    () =>
      BottomNavigation.SceneMap({
        dashboard: () => (
          <DashboardScreen
            onNavigateToGroups={() => setIndex(1)}
            onNavigateToFriends={() => setIndex(2)}
          />
        ),
        groups: GroupsScreen,
        friends: FriendsScreen,
        activity: ActivityScreen,
        settings: () => <SettingsScreen onLogout={() => setIndex(0)} />,
      }),
    [],
  )

  if (initializing) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    )
  }

  return (
    <PaperProvider theme={theme}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        {!user ? (
          <LoginScreen onLoginSuccess={() => setIndex(0)} />
        ) : (
          <BottomNavigation
            navigationState={{ index, routes }}
            onIndexChange={setIndex}
            renderScene={renderScene}
            barStyle={{ backgroundColor: '#0c1322' }}
            activeColor="#14b8a6"
            inactiveColor="#64748b"
            theme={{ colors: { secondaryContainer: 'rgba(20, 184, 166, 0.15)' } }}
          />
        )}
      </SafeAreaView>
    </PaperProvider>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#060913',
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#060913',
    justifyContent: 'center',
    alignItems: 'center',
  },
})
