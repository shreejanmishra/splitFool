import { env, isDev } from '../config/env.js'
import { logger } from '../lib/logger.js'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * Verify a Cloudflare Turnstile token.
 * In development, verification is skipped when no secret is configured.
 */
export async function verifyTurnstile(token: string | undefined, ip?: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) {
    if (isDev) return true
    logger.error('Turnstile secret not configured in production')
    return false
  }
  if (!token) return false

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        ...(ip ? { remoteip: ip } : {}),
      }),
    })
    const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] }
    if (!data.success) {
      logger.debug({ errors: data['error-codes'] }, 'Turnstile verification failed')
    }
    return data.success
  } catch (err) {
    logger.error({ err }, 'Turnstile verification request failed')
    return false
  }
}
