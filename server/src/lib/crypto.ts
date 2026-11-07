import { randomBytes, createHash } from 'node:crypto'

/** Generate a cryptographically random opaque token (URL-safe base64, 256 bits). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

/** SHA-256 hash of a token value, for safe storage. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Generate a PKCE code verifier (43–128 chars, URL-safe). */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

/** SHA-256 code challenge from a verifier (S256 method). */
export function codeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

/** Generate a random state or nonce string. */
export function generateState(): string {
  return randomBytes(16).toString('base64url')
}
