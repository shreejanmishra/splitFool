import mongoose, { Schema, type HydratedDocument } from 'mongoose'

export type Provider = 'google' | 'github' | 'dev'

export interface IAuthIdentity {
  userId: mongoose.Types.ObjectId
  provider: Provider
  /** The provider's unique user ID (`sub` for OIDC, `id` for GitHub). */
  providerSub: string
  /** Whether the provider confirmed the email is verified. */
  emailVerified: boolean
  /** Provider display name (for the sessions/linked-accounts page). */
  displayName?: string
  createdAt: Date
}

export type AuthIdentityDoc = HydratedDocument<IAuthIdentity>

const authIdentitySchema = new Schema<IAuthIdentity>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    provider: { type: String, required: true, enum: ['google', 'github', 'dev'] },
    providerSub: { type: String, required: true },
    emailVerified: { type: Boolean, default: false },
    displayName: { type: String, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

// A provider+sub pair is globally unique; one identity per provider per external account.
authIdentitySchema.index({ provider: 1, providerSub: 1 }, { unique: true })

export const AuthIdentity = mongoose.model<IAuthIdentity>('AuthIdentity', authIdentitySchema)
