/**
 * Platform-agnostic API client interface.
 * Web injects fetch-based impl, mobile can inject its own.
 */
export interface ApiClient {
  get<T>(url: string): Promise<T>
  post<T>(url: string, data?: unknown): Promise<T>
  patch<T>(url: string, data?: unknown): Promise<T>
  put<T>(url: string, data?: unknown): Promise<T>
  delete<T>(url: string): Promise<T>
}

let _client: ApiClient | null = null

/** Set the API client (called once at app startup). */
export function setApiClient(client: ApiClient): void {
  _client = client
}

/** Get the configured API client. Throws if not initialized. */
export function getApiClient(): ApiClient {
  if (!_client) throw new Error('API client not initialized. Call setApiClient() first.')
  return _client
}
