import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg'
import { computeBarChart } from '@splitfool/chart-core'

interface MonthlyBarChartProps {
  data: Array<{ label: string; value: number; color?: string }>
  currency?: string
  width?: number
  height?: number
}

export const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({
  data,
  currency = 'USD',
  width = 320,
  height = 180,
}) => {
  if (!data || data.length === 0 || data.every((d) => d.value <= 0)) {
    return (
      <View style={[styles.emptyContainer, { height }]}>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No data</Text>
        </View>
        <Text style={styles.emptyLabel}>No monthly spending data yet</Text>
      </View>
    )
  }

  const chartData = data.map((d) => ({
    label: d.label,
    value: d.value,
    color: d.color || '#14b8a6',
  }))

  const padding = { top: 15, right: 10, bottom: 30, left: 35 }
  const { bars, yScale } = computeBarChart({
    data: chartData,
    width,
    height,
    padding,
  })

  const yTicks = yScale.ticks(3)

  return (
    <View style={styles.container}>
      <Svg width={width} height={height}>
        {/* Horizontal grid lines */}
        {yTicks.map((tick, i) => {
          const y = yScale(tick)
          return (
            <React.Fragment key={i}>
              <Line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#1e293b"
                strokeDasharray="3 3"
              />
              <SvgText
                x={padding.left - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={9}
                fill="#64748b"
              >
                {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick}
              </SvgText>
            </React.Fragment>
          )
        })}

        {/* Bars */}
        {bars.map((bar, i) => (
          <React.Fragment key={i}>
            <Rect
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx={3}
              fill={bar.color}
            />
            <SvgText
              x={bar.x + bar.width / 2}
              y={height - 10}
              textAnchor="middle"
              fontSize={10}
              fill="#94a3b8"
            >
              {bar.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 10,
    color: '#64748b',
  },
  emptyLabel: {
    fontSize: 12,
    color: '#64748b',
  },
})
