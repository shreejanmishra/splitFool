import mongoose, { Schema, type HydratedDocument } from 'mongoose'

export interface ISession {
  userId: mongoose.Types.ObjectId
  kind: 'web' | 'android'
  /** SHA-256 hash of the current session/refresh token. Never the raw value. */
  tokenHash: string
  /** Hash of the previous token, kept during the grace window after rotation. */
  prevTokenHash?: string
  /** Family ID shared by all rotations of the same original session. */
  familyId: string
  /** The user's sessionVersion at creation. If user.sessionVersion > this, session is invalid. */
  sessionVersion: number
  /** When the token was last rotated. */
  rotatedAt: Date
  /** When the user last completed a provider sign-in (for recent-auth gates). */
  authTime: Date
  /** Sliding expiry: reset on each use. */
  idleExpiresAt: Date
  /** Hard expiry: never extended. */
  absoluteExpiresAt: Date
  /** Device info for the sessions list page. */
  device: {
    ua?: string
    ip?: string
    name?: string
  }
  lastUsedAt: Date
  createdAt: Date
}

export type SessionDoc = HydratedDocument<ISession>

const sessionSchema = new Schema<ISession>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    kind: { type: String, required: true, enum: ['web', 'android'] },
    tokenHash: { type: String, required: true, index: true },
    prevTokenHash: { type: String, index: true, sparse: true },
    familyId: { type: String, required: true, index: true },
    sessionVersion: { type: Number, required: true },
    rotatedAt: { type: Date, required: true },
    authTime: { type: Date, required: true },
    idleExpiresAt: { type: Date, required: true },
    absoluteExpiresAt: { type: Date, required: true },
    device: {
      type: new Schema({ ua: String, ip: String, name: String }, { _id: false }),
      default: () => ({}),
    },
    lastUsedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

// MongoDB automatically deletes expired documents.
sessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 0 })

export const Session = mongoose.model<ISession>('Session', sessionSchema)
