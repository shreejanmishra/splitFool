import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { env } from '../config/env.js'

const secret = new TextEncoder().encode(env.ACCESS_TOKEN_SECRET)
const ISSUER = 'splitfool'
const AUDIENCE = 'splitfool:api'

export interface AccessTokenPayload extends JWTPayload {
  sub: string
  sid: string
  kind: 'android'
}

/** Sign a short-lived access JWT for mobile clients. */
export async function signAccessToken(userId: string, sessionId: string): Promise<string> {
  return new SignJWT({ sid: sessionId, kind: 'android' as const })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret)
}

/** Verify and decode an access JWT. Returns null if invalid. */
export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    })
    return payload as AccessTokenPayload
  } catch {
    return null
  }
}
