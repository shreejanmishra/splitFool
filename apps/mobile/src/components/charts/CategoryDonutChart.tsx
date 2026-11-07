import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { G, Path } from 'react-native-svg'
import { computePieChart, CATEGORY_COLORS, chartColor, type PieSlice } from '@splitfool/chart-core'
import { formatMoney } from '@splitfool/shared'

interface CategoryDonutChartProps {
  data: Array<{ label: string; value: number; color?: string }>
  currency?: string
  size?: number
}

export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({
  data,
  currency = 'USD',
  size = 220,
}) => {
  if (!data || data.length === 0 || data.every((d) => d.value <= 0)) {
    return (
      <View style={[styles.emptyContainer, { height: size }]}>
        <View style={styles.emptyCircle}>
          <Text style={styles.emptyText}>No data</Text>
        </View>
        <Text style={styles.emptyLabel}>No expenses recorded yet</Text>
      </View>
    )
  }

  const chartData = data.map((d, i) => ({
    label: d.label,
    value: d.value,
    color: d.color || CATEGORY_COLORS[d.label.toLowerCase()] || chartColor(i),
  }))

  const outerRadius = size / 2 - 10
  const innerRadius = outerRadius * 0.62
  const center = size / 2

  const slices: PieSlice[] = computePieChart({
    data: chartData,
    radius: outerRadius,
    innerRadius,
  })

  const total = chartData.reduce((acc, d) => acc + d.value, 0)

  return (
    <View style={styles.container}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <G transform={`translate(${center}, ${center})`}>
            {slices.map((slice, index) => (
              <Path
                key={index}
                d={slice.path}
                fill={slice.color}
                stroke="#060913"
                strokeWidth={2}
              />
            ))}
          </G>
        </Svg>
        {/* Center label */}
        <View style={styles.centerLabel}>
          <Text style={styles.centerTitle}>Total</Text>
          <Text style={styles.centerValue}>{formatMoney(total, currency)}</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {slices.slice(0, 5).map((slice, idx) => (
          <View key={idx} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: slice.color }]} />
            <Text style={styles.legendText} numberOfLines={1}>
              {slice.label} ({slice.percentage.toFixed(0)}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 12,
  },
  centerLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerTitle: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  centerValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 14,
    gap: 8,
    paddingHorizontal: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  legendColor: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 11,
    color: '#64748b',
  },
  emptyLabel: {
    fontSize: 13,
    color: '#64748b',
  },
})
