import { afterAll, beforeAll } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'

// Env must be set before any module imports config/env.ts.
process.env.NODE_ENV = 'test'
process.env.MONGODB_URI ??= 'mongodb://placeholder'
process.env.COOKIE_SECRET = 'test-cookie-secret-test-cookie-secret-123'
process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-test-access-secret-123'
process.env.PUBLIC_URL = 'http://localhost:5173'

let mongo: MongoMemoryServer | undefined

beforeAll(async () => {
  mongo = await MongoMemoryServer.create()
  const { connectMongo } = await import('../src/db/mongo.js')
  await connectMongo(mongo.getUri(), 'splitfool-test')
})

afterAll(async () => {
  const { disconnectMongo } = await import('../src/db/mongo.js')
  await disconnectMongo()
  await mongo?.stop()
})
