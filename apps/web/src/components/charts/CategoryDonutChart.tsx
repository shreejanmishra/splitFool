import React, { useState } from 'react'
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
  size = 240,
}) => {
  const [hoveredSlice, setHoveredSlice] = useState<PieSlice | null>(null)

  if (!data || data.length === 0 || data.every((d) => d.value <= 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-slate-500 h-60">
        <div className="w-20 h-20 rounded-full border-2 border-dashed border-slate-700/60 mb-2 flex items-center justify-center">
          <span className="text-xs">No data</span>
        </div>
        <p className="text-sm">No expenses recorded yet</p>
      </div>
    )
  }

  const radius = size / 2
  const innerRadius = radius * 0.62 // Donut hole
  const chartData = data.map((d, idx) => ({
    label: d.label,
    value: d.value,
    color: d.color || CATEGORY_COLORS[d.label.toLowerCase()] || chartColor(idx),
  }))

  const slices = computePieChart({
    data: chartData,
    radius: radius - 8,
    innerRadius,
    padAngle: 0.03,
    cornerRadius: 4,
  })

  const total = data.reduce((acc, d) => acc + d.value, 0)

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          <g transform={`translate(${radius}, ${radius})`}>
            {slices.map((slice, i) => {
              const isHovered = hoveredSlice?.label === slice.label
              return (
                <path
                  key={i}
                  d={slice.path}
                  fill={slice.color}
                  opacity={hoveredSlice ? (isHovered ? 1 : 0.4) : 0.9}
                  transform={isHovered ? 'scale(1.05)' : 'scale(1)'}
                  className="transition-all duration-200 cursor-pointer"
                  onMouseEnter={() => setHoveredSlice(slice)}
                  onMouseLeave={() => setHoveredSlice(null)}
                />
              )
            })}
          </g>
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-slate-400 font-medium">
            {hoveredSlice ? hoveredSlice.label : 'Total'}
          </span>
          <span className="text-lg font-bold text-slate-100 font-display">
            {hoveredSlice
              ? formatMoney(hoveredSlice.value, currency)
              : formatMoney(total, currency)}
          </span>
          {hoveredSlice && (
            <span className="text-[11px] text-teal-400 font-medium">
              {hoveredSlice.percentage.toFixed(1)}%
            </span>
          )}
        </div>
      </div>


      {/* Legend */}
      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-2 no-scrollbar w-full sm:w-auto">
        {data.map((item, idx) => {
          const slice = slices.find((s) => s.label === item.label)
          const color = slice?.color || '#94a3b8'
          const isSelected = hoveredSlice?.label === item.label

          return (
            <div
              key={idx}
              onMouseEnter={() => slice && setHoveredSlice(slice)}
              onMouseLeave={() => setHoveredSlice(null)}
              className={`flex items-center justify-between gap-4 px-2 py-1 rounded-md text-sm transition-all cursor-pointer ${
                isSelected ? 'bg-slate-800/80' : 'hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-slate-300 capitalize text-xs font-medium truncate max-w-[100px]">
                  {item.label}
                </span>
              </div>
              <span className="text-xs font-semibold text-slate-200">
                {formatMoney(item.value, currency)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

