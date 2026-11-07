/** Curated color palette for chart data series. */
export const CHART_COLORS = [
  '#6366f1', // Indigo
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#a855f7', // Purple
  '#3b82f6', // Blue
  '#84cc16', // Lime
] as const

/** Pick a color from the palette by index (wraps around). */
export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]!
}

/** Category-specific colors for expense breakdowns. */
export const CATEGORY_COLORS: Record<string, string> = {
  food: '#f59e0b',
  transport: '#3b82f6',
  entertainment: '#ec4899',
  shopping: '#a855f7',
  utilities: '#06b6d4',
  rent: '#6366f1',
  travel: '#22c55e',
  health: '#ef4444',
  education: '#14b8a6',
  general: '#64748b',
  other: '#94a3b8',
}
