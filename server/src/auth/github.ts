import { env } from '../config/env.js'
import type { OAuthProvider } from './provider.js'
import type { ProviderProfile } from '../services/userAuth.js'
import { logger } from '../lib/logger.js'

const AUTH_ENDPOINT = 'https://github.com/login/oauth/authorize'
const TOKEN_ENDPOINT = 'https://github.com/login/oauth/access_token'
const API_BASE = 'https://api.github.com'

export class GitHubProvider implements OAuthProvider {
  name = 'github'

  getAuthUrl(params: { redirectUri: string; state: string; nonce: string; codeChallenge: string }): string {
    const url = new URL(AUTH_ENDPOINT)
    url.searchParams.set('client_id', env.GITHUB_CLIENT_ID!)
    url.searchParams.set('redirect_uri', params.redirectUri)
    url.searchParams.set('state', params.state)
    url.searchParams.set('scope', 'read:user user:email')
    // GitHub doesn't support PKCE natively for web; state is the primary CSRF protection.
    // The nonce is stored in the state cookie and checked on callback.
    return url.toString()
  }

  async exchangeCode(params: {
    code: string
    redirectUri: string
    codeVerifier: string
    nonce: string
  }): Promise<ProviderProfile> {
    // Exchange code for access token
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID!,
        client_secret: env.GITHUB_CLIENT_SECRET!,
        code: params.code,
        redirect_uri: params.redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      logger.error({ status: tokenRes.status, body }, 'GitHub token exchange failed')
      throw new Error('GitHub token exchange failed')
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string }
    if (!tokenData.access_token) {
      logger.error({ error: tokenData.error }, 'GitHub token exchange returned error')
      throw new Error(`GitHub token exchange error: ${tokenData.error}`)
    }

    const headers = { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/json' }

    // Fetch user profile
    const userRes = await fetch(`${API_BASE}/user`, { headers })
    if (!userRes.ok) throw new Error('Failed to fetch GitHub user profile')
    const userData = (await userRes.json()) as {
      id: number
      login: string
      name?: string
      avatar_url?: string
    }

    // Fetch verified primary email
    const emailsRes = await fetch(`${API_BASE}/user/emails`, { headers })
    if (!emailsRes.ok) throw new Error('Failed to fetch GitHub user emails')
    const emails = (await emailsRes.json()) as Array<{
      email: string
      primary: boolean
      verified: boolean
    }>

    const primaryEmail = emails.find((e) => e.primary && e.verified)
    if (!primaryEmail) {
      throw new Error('No verified primary email found on GitHub account')
    }

    return {
      provider: 'github',
      providerSub: String(userData.id),
      email: primaryEmail.email,
      emailVerified: true, // We only accept verified emails
      name: userData.name ?? userData.login,
      avatar: userData.avatar_url,
    }
  }
}
