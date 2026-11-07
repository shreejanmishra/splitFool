import type { Store, Options, ClientRateLimitInfo } from 'express-rate-limit'
import mongoose from 'mongoose'

const COLLECTION = 'rateLimits'
let indexEnsured = false

/**
 * express-rate-limit store backed by MongoDB, so limits are shared across server
 * instances and survive restarts. Uses an atomic fixed-window counter per key;
 * expired windows are purged by a TTL index.
 */
export class MongoRateLimitStore implements Store {
  windowMs = 60_000
  readonly prefix: string
  readonly localKeys = false

  constructor(prefix: string) {
    this.prefix = `${prefix}:`
  }

  init(options: Options): void {
    this.windowMs = options.windowMs
  }

  private get collection() {
    const db = mongoose.connection.db
    if (!db) throw new Error('MongoDB is not connected')
    const coll = db.collection<{ _id: string; hits: number; resetAt: Date }>(COLLECTION)
    if (!indexEnsured) {
      indexEnsured = true
      void coll.createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {
        indexEnsured = false
      })
    }
    return coll
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const doc = await this.collection.findOne({ _id: this.prefix + key })
    if (!doc || doc.resetAt <= new Date()) return undefined
    return { totalHits: doc.hits, resetTime: doc.resetAt }
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = new Date()
    const expired = { $lte: ['$resetAt', now] }
    const doc = await this.collection.findOneAndUpdate(
      { _id: this.prefix + key },
      [
        {
          $set: {
            hits: { $cond: [expired, 1, { $add: ['$hits', 1] }] },
            resetAt: { $cond: [expired, new Date(now.getTime() + this.windowMs), '$resetAt'] },
          },
        },
      ],
      { upsert: true, returnDocument: 'after' },
    )
    return { totalHits: doc?.hits ?? 1, resetTime: doc?.resetAt }
  }

  async decrement(key: string): Promise<void> {
    await this.collection.updateOne({ _id: this.prefix + key, hits: { $gt: 0 } }, { $inc: { hits: -1 } })
  }

  async resetKey(key: string): Promise<void> {
    await this.collection.deleteOne({ _id: this.prefix + key })
  }
}
