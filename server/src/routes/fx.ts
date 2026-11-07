import { Router } from 'express'
import { currencySchema } from '@splitfool/shared'
import { parse } from '../lib/validate.js'
import { getRates, supportedCurrencies } from '../services/fx.js'
import { badRequest } from '../lib/errors.js'

export const fxRouter = Router()

/** List all supported currencies and formatting metadata. */
fxRouter.get('/currencies', (_req, res) => {
  res.json({ currencies: supportedCurrencies() })
})

/** Get exchange rates relative to a base currency. */
fxRouter.get('/rates', async (req, res) => {
  const baseParam = req.query.base
  if (!baseParam || typeof baseParam !== 'string') {
    throw badRequest('base currency query parameter is required')
  }
  const base = parse(currencySchema, baseParam)

  const rates = await getRates(base)
  if (!rates) {
    throw badRequest(`Unable to fetch rates for currency: ${base}`)
  }

  res.json({ base, rates })
})
