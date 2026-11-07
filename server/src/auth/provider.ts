import type { ProviderProfile } from '../services/userAuth.js'

/**
 * An OAuth/OIDC provider adapter.
 * Each provider implements these methods to normalize the flow.
 */
export interface OAuthProvider {
  name: string
  /** Build the authorization URL the user is redirected to. */
  getAuthUrl(params: {
    redirectUri: string
    state: string
    nonce: string
    codeChallenge: string
  }): string
  /** Exchange the authorization code for user profile data. */
  exchangeCode(params: {
    code: string
    redirectUri: string
    codeVerifier: string
    nonce: string
  }): Promise<ProviderProfile>
}
