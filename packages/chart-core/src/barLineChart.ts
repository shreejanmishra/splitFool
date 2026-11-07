import { scaleLinear, scaleTime, scaleBand, type ScaleLinear, type ScaleTime, type ScaleBand } from 'd3-scale'
import { line, curveMonotoneX, area, curveCardinal } from 'd3-shape'
import { extent } from 'd3-array'

export interface BarSegment {
  x: number
  y: number
  width: number
  height: number
  label: string
  value: number
  color: string
}

export interface BarChartConfig {
  data: Array<{ label: string; value: number; color: string }>
  width: number
  height: number
  padding?: { top: number; right: number; bottom: number; left: number }
}

/**
 * Compute bar chart geometry.
 */
export function computeBarChart(config: BarChartConfig): {
  bars: BarSegment[]
  xScale: ScaleBand<string>
  yScale: ScaleLinear<number, number>
} {
  const { data, width, height, padding = { top: 20, right: 20, bottom: 40, left: 50 } } = config

  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const xScale = scaleBand<string>()
    .domain(data.map((d) => d.label))
    .range([padding.left, padding.left + chartWidth])
    .padding(0.3)

  const maxVal = Math.max(...data.map((d) => d.value), 0)
  const yScale = scaleLinear()
    .domain([0, maxVal * 1.1])
    .range([padding.top + chartHeight, padding.top])
    .nice()

  const bars: BarSegment[] = data.map((d) => ({
    x: xScale(d.label) ?? 0,
    y: yScale(d.value),
    width: xScale.bandwidth(),
    height: Math.max(0, (padding.top + chartHeight) - yScale(d.value)),
    label: d.label,
    value: d.value,
    color: d.color,
  }))

  return { bars, xScale, yScale }
}

// ─── Line / Area chart ──────────────────────────────────────────────────────

export interface LinePoint {
  date: Date
  value: number
}

export interface LineChartConfig {
  data: LinePoint[]
  width: number
  height: number
  padding?: { top: number; right: number; bottom: number; left: number }
  color?: string
  filled?: boolean
}

/**
 * Compute line (or area) chart geometry.
 */
export function computeLineChart(config: LineChartConfig): {
  linePath: string
  areaPath: string | null
  xScale: ScaleTime<number, number>
  yScale: ScaleLinear<number, number>
  points: Array<{ x: number; y: number; date: Date; value: number }>
} {
  const { data, width, height, padding = { top: 20, right: 20, bottom: 40, left: 50 }, filled = false } = config

  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const now = new Date()
  const [rawMinDate, rawMaxDate] = extent(data, (d) => d.date)
  const minDate = rawMinDate ?? now
  const maxDate = rawMaxDate ?? now
  const maxVal = Math.max(...data.map((d) => d.value), 0)

  const xScale = scaleTime()
    .domain([minDate, maxDate])
    .range([padding.left, padding.left + chartWidth])

  const yScale = scaleLinear()
    .domain([0, (maxVal || 1) * 1.1])
    .range([padding.top + chartHeight, padding.top])
    .nice()

  if (data.length === 0) {
    return { linePath: '', areaPath: filled ? '' : null, xScale, yScale, points: [] }
  }

  const lineGenerator = line<LinePoint>()
    .x((d) => xScale(d.date))
    .y((d) => yScale(d.value))
    .curve(curveMonotoneX)

  const linePath = lineGenerator(data) ?? ''

  let areaPath: string | null = null
  if (filled) {
    const areaGenerator = area<LinePoint>()
      .x((d) => xScale(d.date))
      .y0(padding.top + chartHeight)
      .y1((d) => yScale(d.value))
      .curve(curveCardinal)
    areaPath = areaGenerator(data) ?? null
  }

  const points = data.map((d) => ({
    x: xScale(d.date),
    y: yScale(d.value),
    date: d.date,
    value: d.value,
  }))

  return { linePath, areaPath, xScale, yScale, points }
}
