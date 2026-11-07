import mongoose, { Schema, type HydratedDocument } from 'mongoose'

/** Daily FX rate snapshot (one document per base currency per day). */
export interface IFxRate {
  base: string
  /** YYYY-MM-DD (UTC). */
  date: string
  rates: Map<string, number>
  fetchedAt: Date
}

export type FxRateDoc = HydratedDocument<IFxRate>

const fxRateSchema = new Schema<IFxRate>({
  base: { type: String, required: true, uppercase: true },
  date: { type: String, required: true },
  rates: { type: Map, of: Number, required: true },
  fetchedAt: { type: Date, required: true },
})

fxRateSchema.index({ base: 1, date: -1 }, { unique: true })

export const FxRate = mongoose.model<IFxRate>('FxRate', fxRateSchema)
