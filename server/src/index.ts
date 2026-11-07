import cron from 'node-cron'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { connectMongo, disconnectMongo } from './db/mongo.js'
import { logger } from './lib/logger.js'
import { runDueRecurring } from './services/recurring.js'

async function main() {
  await connectMongo()
  const app = createApp()
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`)
  })

  // Run recurring expenses check every 15 minutes
  const cronTask = cron.schedule('*/15 * * * *', async () => {
    try {
      const res = await runDueRecurring()
      if (res.created > 0) logger.info({ created: res.created }, 'Processed due recurring expenses')
    } catch (err) {
      logger.error({ err }, 'Error in recurring expenses cron job')
    }
  })

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down')
    cronTask.stop()
    server.close(() => {
      void disconnectMongo().finally(() => process.exit(0))
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server')
  process.exit(1)
})
