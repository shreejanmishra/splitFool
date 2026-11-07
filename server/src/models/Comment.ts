import mongoose, { Schema, type HydratedDocument, type Types } from 'mongoose'

export interface IComment {
  expenseId: Types.ObjectId
  userId: Types.ObjectId
  body: string
  createdAt: Date
}

export type CommentDoc = HydratedDocument<IComment>

const commentSchema = new Schema<IComment>(
  {
    expenseId: { type: Schema.Types.ObjectId, ref: 'Expense', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

commentSchema.index({ expenseId: 1, createdAt: 1 })

export const Comment = mongoose.model<IComment>('Comment', commentSchema)
