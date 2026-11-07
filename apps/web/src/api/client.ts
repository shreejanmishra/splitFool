import type { ApiClient } from '@splitfool/store'

export class WebApiClient implements ApiClient {
  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers)
    headers.set('x-sf-request', '1')

    if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const res = await fetch(url, {
      ...init,
      headers,
      credentials: 'include', // sends __Host-sf_session cookie
    })

    if (!res.ok) {
      let errorMsg = `Request failed: ${res.status}`
      try {
        const errorJson = await res.json()
        errorMsg = errorJson.error?.message || errorJson.message || errorMsg
      } catch {
        // use default status message
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

  patch<T>(url: string, data?: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'PATCH',
      body: data instanceof FormData ? data : data !== undefined ? JSON.stringify(data) : undefined,
    })
  }

  put<T>(url: string, data?: unknown): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: data instanceof FormData ? data : data !== undefined ? JSON.stringify(data) : undefined,
    })
  }

  delete<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'DELETE' })
  }
}

export const webApi = new WebApiClient()
