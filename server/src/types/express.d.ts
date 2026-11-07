export type AuthContext = {
  userId: string
  sessionId: string
  kind: 'web' | 'android'
  /** When the user last completed a provider sign-in (for recent-auth checks). */
  authTime: Date
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}
