import * as jose from 'jose'
import { env } from '../config/env.js'
import type { OAuthProvider } from './provider.js'
import type { ProviderProfile } from '../services/userAuth.js'
import { logger } from '../lib/logger.js'

const ISSUER = 'https://accounts.google.com'
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs'

let jwks: ReturnType<typeof jose.createRemoteJWKSet> | undefined

function getJwks() {
  if (!jwks) jwks = jose.createRemoteJWKSet(new URL(JWKS_URI))
  return jwks
}

export class GoogleProvider implements OAuthProvider {
  name = 'google'

  getAuthUrl(params: { redirectUri: string; state: string; nonce: string; codeChallenge: string }): string {
    const url = new URL(AUTH_ENDPOINT)
    url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID!)
    url.searchParams.set('redirect_uri', params.redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'openid email profile')
    url.searchParams.set('state', params.state)
    url.searchParams.set('nonce', params.nonce)
    url.searchParams.set('code_challenge', params.codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    return url.toString()
  }

  async exchangeCode(params: {
    code: string
    redirectUri: string
    codeVerifier: string
    nonce: string
  }): Promise<ProviderProfile> {
    // Exchange code for tokens
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        code: params.code,
        code_verifier: params.codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: params.redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      logger.error({ status: tokenRes.status, body }, 'Google token exchange failed')
      throw new Error('Google token exchange failed')
    }

    const tokenData = (await tokenRes.json()) as { id_token: string; access_token: string }

    // Verify ID token
    const { payload } = await jose.jwtVerify(tokenData.id_token, getJwks(), {
      issuer: ISSUER,
      audience: env.GOOGLE_CLIENT_ID!,
    })

    // Verify nonce
    if (payload.nonce !== params.nonce) {
      throw new Error('Google ID token nonce mismatch')
    }

    const sub = payload.sub
    const email = payload.email as string | undefined
    const emailVerified = payload.email_verified as boolean | undefined
    const name = (payload.name as string | undefined) ?? email ?? 'Google User'
    const picture = payload.picture as string | undefined

    if (!sub || !email) {
      throw new Error('Google ID token missing sub or email')
    }

    return {
      provider: 'google',
      providerSub: sub,
      email,
      emailVerified: emailVerified ?? false,
      name,
      avatar: picture,
    }
  }
}
