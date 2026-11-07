import mongoose from 'mongoose'
import { env } from '../config/env.js'
import { logger } from '../lib/logger.js'

mongoose.set('strictQuery', true)

let connectPromise: Promise<void> | null = null

export async function connectMongo(uri = env.MONGODB_URI, dbName = env.MONGODB_DB): Promise<void> {
  if (mongoose.connection.readyState === 1) return
  if (!connectPromise) {
    connectPromise = mongoose
      .connect(uri, {
        dbName,
        serverSelectionTimeoutMS: 10_000,
        maxPoolSize: 20,
      })
      .then(() => {
        logger.info({ db: dbName }, 'MongoDB connected')
      })
      .catch((err) => {
        connectPromise = null
        throw err
      })
  }
  return connectPromise
}

export async function disconnectMongo(): Promise<void> {
  connectPromise = null
  await mongoose.disconnect()
}

export function isMongoReady(): boolean {
  return mongoose.connection.readyState === 1
}
