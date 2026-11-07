import { z } from 'zod'

const optional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional()

const defaultPublicUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:5173'

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB: z.string().default('splitfool'),

  /** Public origin users load the app from. OAuth redirect URIs are built from it. */
  PUBLIC_URL: z.url().default(defaultPublicUrl),
  /** Extra browser origins allowed by CORS/CSRF checks (comma separated). */
  CORS_ORIGINS: optional,
  /** Number of reverse-proxy hops in front of the API (for correct client IPs). */
  TRUST_PROXY: z.coerce.number().int().min(0).default(process.env.VERCEL ? 1 : 0),

  /** Secret for signing short-lived cookies (OAuth state). Min 32 chars. */
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),
  /** Secret for signing mobile access tokens (HS256). Min 32 chars. */
  ACCESS_TOKEN_SECRET: z.string().min(32, 'ACCESS_TOKEN_SECRET must be at least 32 characters'),

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GITHUB_CLIENT_ID: optional,
  GITHUB_CLIENT_SECRET: optional,

  /** Cloudflare Turnstile secret. When unset, verification is skipped outside production. */
  TURNSTILE_SECRET_KEY: optional,

  /** Secret sent by Vercel Cron Jobs in Authorization: Bearer <CRON_SECRET>. */
  CRON_SECRET: optional,

  /** SMTP connection URL, e.g. smtps://user:pass@smtp.example.com:465 */
  SMTP_URL: optional,
  MAIL_FROM: z.string().default('splitFool <no-reply@splitfool.local>'),

  /** Android deep-link target after native login. */
  ANDROID_REDIRECT_URI: z.string().default('splitfool://auth'),
})

export type Env = z.infer<typeof EnvSchema>

function load(): Env {
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment configuration:\n${issues}`)
  }
  const env = parsed.data
  if (env.NODE_ENV === 'production' && !env.TURNSTILE_SECRET_KEY) {
    throw new Error('TURNSTILE_SECRET_KEY is required in production')
  }
  return env
}

export const env = load()

export const isProd = env.NODE_ENV === 'production'
export const isDev = env.NODE_ENV !== 'production'

const vercelOrigins = [
  process.env.VERCEL_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
]
  .filter((host): host is string => Boolean(host))
  .map((host) => `https://${host}`)

/** All browser origins permitted to make credentialed requests. */
export const allowedOrigins: ReadonlySet<string> = new Set(
  [new URL(env.PUBLIC_URL).origin, ...vercelOrigins, ...(env.CORS_ORIGINS?.split(',') ?? [])]
    .map((o) => o.trim())
    .filter(Boolean),
)
