/**
 * Money formatting and FX conversion utilities.
 * All amounts are integer minor units (cents/paise).
 */

/** Currency metadata for formatting. */
export interface CurrencyInfo {
  code: string
  symbol: string
  name: string
  decimalPlaces: number
}

/** Common currencies. */
export const CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimalPlaces: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimalPlaces: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimalPlaces: 2 },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimalPlaces: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimalPlaces: 0 },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimalPlaces: 2 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimalPlaces: 2 },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', decimalPlaces: 2 },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', decimalPlaces: 2 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', decimalPlaces: 2 },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', decimalPlaces: 2 },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', decimalPlaces: 2 },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', decimalPlaces: 0 },
  MXN: { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', decimalPlaces: 2 },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', decimalPlaces: 2 },
}

/**
 * Format a minor-unit amount as a human-readable string.
 * e.g. formatMoney(12345, 'USD') → "$123.45"
 */
export function formatMoney(amountMinor: number, currencyCode: string): string {
  const info = CURRENCIES[currencyCode]
  const decimals = info?.decimalPlaces ?? 2
  const symbol = info?.symbol ?? currencyCode

  const major = amountMinor / Math.pow(10, decimals)
  const formatted = major.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  return `${symbol}${formatted}`
}

/**
 * Parse a major-unit string (e.g. "123.45") to minor units.
 * Returns NaN if the input is not a valid number.
 */
export function parseToMinor(majorString: string, currencyCode: string): number {
  const info = CURRENCIES[currencyCode]
  const decimals = info?.decimalPlaces ?? 2
  const parsed = parseFloat(majorString)
  if (isNaN(parsed)) return NaN
  return Math.round(parsed * Math.pow(10, decimals))
}

/**
 * Convert minor units to a plain decimal string suitable for a numeric input field.
 * e.g. minorToMajorString(12345, 'USD') → "123.45", minorToMajorString(500, 'JPY') → "500"
 */
export function minorToMajorString(amountMinor: number, currencyCode: string): string {
  const decimals = CURRENCIES[currencyCode]?.decimalPlaces ?? 2
  return (amountMinor / Math.pow(10, decimals)).toFixed(decimals)
}

/**
 * Convert an amount from one currency to another using a rate map.
 * Rates are relative to a base currency (e.g. EUR).
 *
 * @param amountMinor Amount in source currency minor units
 * @param fromCurrency Source currency code
 * @param toCurrency Target currency code
 * @param rates Map of currency → rate relative to base
 * @returns Amount in target currency minor units (rounded)
 */
export function convertCurrency(
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amountMinor

  const fromRate = rates[fromCurrency]
  const toRate = rates[toCurrency]
  if (fromRate === undefined || toRate === undefined) {
    throw new Error(`Missing exchange rate for ${fromRate === undefined ? fromCurrency : toCurrency}`)
  }

  // Convert to base, then to target
  const fromDecimals = CURRENCIES[fromCurrency]?.decimalPlaces ?? 2
  const toDecimals = CURRENCIES[toCurrency]?.decimalPlaces ?? 2

  const majorInBase = (amountMinor / Math.pow(10, fromDecimals)) / fromRate
  const majorInTarget = majorInBase * toRate
  return Math.round(majorInTarget * Math.pow(10, toDecimals))
}
