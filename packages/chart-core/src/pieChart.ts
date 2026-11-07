import { pie, arc, type PieArcDatum } from 'd3-shape'

export interface PieSlice {
  label: string
  value: number
  color: string
  /** SVG path string for the slice. */
  path: string
  /** Centroid [x, y] for label positioning. */
  centroid: [number, number]
  /** Start angle in radians. */
  startAngle: number
  /** End angle in radians. */
  endAngle: number
  /** Percentage of total. */
  percentage: number
}

export interface PieChartConfig {
  data: Array<{ label: string; value: number; color: string }>
  /** Outer radius in px. */
  radius: number
  /** Inner radius for donut charts (0 for full pie). */
  innerRadius?: number
  /** Pad angle between slices in radians. */
  padAngle?: number
  /** Corner radius for rounded slices. */
  cornerRadius?: number
}

/**
 * Compute pie/donut chart geometry.
 * Returns an array of PieSlice objects with SVG path strings
 * that can be rendered in <path d={slice.path} /> on any platform.
 */
export function computePieChart(config: PieChartConfig): PieSlice[] {
  const { data, radius, innerRadius = 0, padAngle = 0.02, cornerRadius = 4 } = config

  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return []

  const pieGenerator = pie<{ label: string; value: number; color: string }>()
    .value((d) => d.value)
    .padAngle(padAngle)
    .sort(null)

  const arcGenerator = arc<PieArcDatum<{ label: string; value: number; color: string }>>()
    .innerRadius(innerRadius)
    .outerRadius(radius)
    .cornerRadius(cornerRadius)

  const arcs = pieGenerator(data)

  return arcs.map((d) => ({
    label: d.data.label,
    value: d.data.value,
    color: d.data.color,
    path: arcGenerator(d) ?? '',
    centroid: arcGenerator.centroid(d) as [number, number],
    startAngle: d.startAngle,
    endAngle: d.endAngle,
    percentage: (d.data.value / total) * 100,
  }))
}
