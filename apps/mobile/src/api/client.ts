import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import type { ApiClient } from '@splitfool/store'

// Base URL: In Android emulator, localhost is 10.0.2.2. On physical device or web, use localhost or custom URL.
const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL
  }
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000'
  }
  return 'http://localhost:4000'
}

const ACCESS_TOKEN_KEY = 'sf_access_token'
const REFRESH_TOKEN_KEY = 'sf_refresh_token'

// In-memory fallback for environments without SecureStore (e.g. web/tests)
const memoryStore = new Map<string, string>()

async function getItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key)
  } catch {
    return memoryStore.get(key) || null
  }
}

async function setItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value)
  } catch {
    memoryStore.set(key, value)
  }
}

async function deleteItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key)
  } catch {
    memoryStore.delete(key)
  }
}

export class MobileApiClient implements ApiClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getBaseUrl()
  }

  setBaseUrl(url: string) {
    this.baseUrl = url
  }

  async getAccessToken(): Promise<string | null> {
    return getItem(ACCESS_TOKEN_KEY)
  }

  async getRefreshToken(): Promise<string | null> {
    return getItem(REFRESH_TOKEN_KEY)
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await setItem(ACCESS_TOKEN_KEY, accessToken)
    await setItem(REFRESH_TOKEN_KEY, refreshToken)
  }

  async clearTokens(): Promise<void> {
    await deleteItem(ACCESS_TOKEN_KEY)
    await deleteItem(REFRESH_TOKEN_KEY)
  }

  private async refreshTokens(): Promise<string | null> {
    const refreshToken = await this.getRefreshToken()
    if (!refreshToken) return null

    try {
      const res = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sf-request': '1',
        },
        body: JSON.stringify({ refreshToken }),
      })

      if (!res.ok) {
        await this.clearTokens()
        return null
      }

      const data = await res.json()
      if (data.accessToken && data.refreshToken) {
        await this.setTokens(data.accessToken, data.refreshToken)
        return data.accessToken
      }
      return null
    } catch {
      return null
    }
  }

  private async request<T>(endpoint: string, init?: RequestInit, isRetry = false): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`
    const headers = new Headers(init?.headers)
    headers.set('x-sf-request', '1')

    const token = await this.getAccessToken()
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const res = await fetch(url, {
      ...init,
      headers,
    })

    // If 401 Unauthorized and not already retrying, try to refresh token
    if (res.status === 401 && !isRetry) {
      const newToken = await this.refreshTokens()
      if (newToken) {
        return this.request<T>(endpoint, init, true)
      }
    }

    if (!res.ok) {
      let errorMsg = `Request failed: ${res.status}`
      try {
        const errorJson = await res.json()
        errorMsg = errorJson.error?.message || errorJson.message || errorMsg
      } catch {
        // fallback
      }
      throw new Error(errorMsg)
    }

    if (res.status === 204) {
      return {} as T
    }

    return res.json() as Promise<T>
  }

  get<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'GET' })
  }

  post<T>(url: string, data?: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: data instanceof FormData ? data : data !== undefined ? JSON.stringify(data) : undefined,
    })
  }

  put<T>(url: string, data?: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: data instanceof FormData ? data : data !== undefined ? JSON.stringify(data) : undefined,
    })
  }

  patch<T>(url: string, data?: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'PATCH',
      body: data instanceof FormData ? data : data !== undefined ? JSON.stringify(data) : undefined,
    })
  }

  delete<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'DELETE' })
  }
}

export const mobileApi = new MobileApiClient()
