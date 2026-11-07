import type { IncomingMessage, ServerResponse } from 'node:http'
import { createApp } from './app.js'
import { connectMongo } from './db/mongo.js'

const app = createApp()

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await connectMongo()
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`
  }
  return app(req, res)
}

