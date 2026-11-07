import mongoose, { Schema, type HydratedDocument } from 'mongoose'

export interface IUser {
  name: string
  email: string
  avatar?: string
  defaultCurrency: string
  /** Bumped to mass-revoke all sessions. */
  sessionVersion: number
  notificationPrefs: {
    email: boolean
    expenseAdded: boolean
    weeklySummary: boolean
  }
  createdAt: Date
  updatedAt: Date
}

export type UserDoc = HydratedDocument<IUser>

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    avatar: { type: String, maxlength: 2048 },
    defaultCurrency: { type: String, default: 'INR', uppercase: true, minlength: 3, maxlength: 3 },
    sessionVersion: { type: Number, default: 0 },
    notificationPrefs: {
      type: new Schema(
        {
          email: { type: Boolean, default: true },
          expenseAdded: { type: Boolean, default: true },
          weeklySummary: { type: Boolean, default: true },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  { timestamps: true },
)

export const User = mongoose.model<IUser>('User', userSchema)
