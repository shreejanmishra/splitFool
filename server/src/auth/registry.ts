import { env, isDev } from '../config/env.js'
import type { OAuthProvider } from './provider.js'
import { GoogleProvider } from './google.js'
import { GitHubProvider } from './github.js'

const providers = new Map<string, OAuthProvider>()

/** Register providers that have credentials configured. */
export function initProviders(): void {
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.set('google', new GoogleProvider())
  }
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    providers.set('github', new GitHubProvider())
  }
}

export function getProvider(name: string): OAuthProvider | undefined {
  return providers.get(name)
}

/** Provider names available for login (returned to the client on /auth/providers). */
export function availableProviders(): string[] {
  const names = [...providers.keys()]
  if (isDev) names.push('dev')
  return names
}
