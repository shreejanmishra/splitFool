import { describe, expect, it } from 'vitest'
import { computePieChart } from '../src/pieChart.js'
import { computeBarChart, computeLineChart } from '../src/barLineChart.js'
import { chartColor, CATEGORY_COLORS } from '../src/colors.js'

describe('computePieChart', () => {
  it('generates slices with valid SVG paths', () => {
    const slices = computePieChart({
      radius: 100,
      data: [
        { label: 'Food', value: 500, color: '#f59e0b' },
        { label: 'Transport', value: 300, color: '#3b82f6' },
        { label: 'Other', value: 200, color: '#94a3b8' },
      ],
    })

    expect(slices).toHaveLength(3)
    for (const s of slices) {
      expect(s.path).toBeTruthy()
      expect(s.path.startsWith('M')).toBe(true) // valid SVG path
      expect(s.centroid).toHaveLength(2)
      expect(s.percentage).toBeGreaterThan(0)
    }

    // Percentages should sum to 100
    const totalPct = slices.reduce((sum, s) => sum + s.percentage, 0)
    expect(totalPct).toBeCloseTo(100, 5)
  })

  it('returns empty for zero-value data', () => {
    expect(computePieChart({ radius: 100, data: [] })).toEqual([])
  })

  it('generates a donut with inner radius', () => {
    const slices = computePieChart({
      radius: 100,
      innerRadius: 60,
      data: [{ label: 'A', value: 100, color: '#000' }],
    })
    expect(slices).toHaveLength(1)
    expect(slices[0]!.percentage).toBeCloseTo(100)
  })
})

describe('computeBarChart', () => {
  it('generates bar segments', () => {
    const { bars, xScale, yScale } = computeBarChart({
      width: 400,
      height: 300,
      data: [
        { label: 'Jan', value: 100, color: '#6366f1' },
        { label: 'Feb', value: 200, color: '#22c55e' },
        { label: 'Mar', value: 150, color: '#f59e0b' },
      ],
    })

    expect(bars).toHaveLength(3)
    for (const bar of bars) {
      expect(bar.width).toBeGreaterThan(0)
      expect(bar.height).toBeGreaterThanOrEqual(0)
    }
    expect(xScale.domain()).toEqual(['Jan', 'Feb', 'Mar'])
    expect(yScale.domain()[0]).toBe(0)
  })
})

describe('computeLineChart', () => {
  it('generates a line path and data points', () => {
    const now = Date.now()
    const { linePath, points, areaPath } = computeLineChart({
      width: 400,
      height: 300,
      data: [
        { date: new Date(now - 86400000 * 2), value: 100 },
        { date: new Date(now - 86400000), value: 200 },
        { date: new Date(now), value: 150 },
      ],
    })

    expect(linePath).toBeTruthy()
    expect(linePath.startsWith('M')).toBe(true)
    expect(points).toHaveLength(3)
    expect(areaPath).toBeNull() // not filled by default
  })

  it('generates an area path when filled', () => {
    const now = Date.now()
    const { areaPath } = computeLineChart({
      width: 400,
      height: 300,
      filled: true,
      data: [
        { date: new Date(now - 86400000), value: 100 },
        { date: new Date(now), value: 200 },
      ],
    })

    expect(areaPath).toBeTruthy()
  })
})

describe('colors', () => {
  it('wraps around the palette', () => {
    expect(chartColor(0)).toBe('#6366f1')
    expect(chartColor(12)).toBe('#6366f1') // wraps
  })

  it('has category colors', () => {
    expect(CATEGORY_COLORS['food']).toBe('#f59e0b')
    expect(CATEGORY_COLORS['transport']).toBe('#3b82f6')
  })
})
