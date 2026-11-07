import React, { useState } from 'react'
import { computeBarChart } from '@splitfool/chart-core'
import { formatMoney } from '@splitfool/shared'

interface MonthlyBarChartProps {
  data: Array<{ label: string; value: number; color?: string }>
  currency?: string
  width?: number
  height?: number
}

export const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({
  data,
  currency = 'USD',
  width = 460,
  height = 220,
}) => {
  const [hoveredBar, setHoveredBar] = useState<{ label: string; value: number } | null>(null)

  if (!data || data.length === 0 || data.every((d) => d.value <= 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-slate-500 h-52">
        <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-700/60 mb-2 flex items-center justify-center">
          <span className="text-xs">No data</span>
        </div>
        <p className="text-sm">No monthly spending data yet</p>
      </div>
    )
  }

  const chartData = data.map((d) => ({
    label: d.label,
    value: d.value,
    color: d.color || '#14b8a6',
  }))

  const padding = { top: 20, right: 15, bottom: 35, left: 45 }
  const { bars, yScale } = computeBarChart({
    data: chartData,
    width,
    height,
    padding,
  })

  const yTicks = yScale.ticks(4)

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible select-none"
      >
        {/* Horizontal grid lines */}
        {yTicks.map((tick, i) => {
          const y = yScale(tick)
          return (
            <g key={i}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#1e293b"
                strokeDasharray="3 3"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                className="text-[10px] fill-slate-500"
              >
                {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {bars.map((bar, i) => {
          const isHovered = hoveredBar?.label === bar.label
          return (
            <g key={i}>
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                rx={4}
                fill={isHovered ? '#2dd4bf' : bar.color}
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredBar({ label: bar.label, value: bar.value })}
                onMouseLeave={() => setHoveredBar(null)}
              />
              {/* Month label */}
              <text
                x={bar.x + bar.width / 2}
                y={height - 12}
                textAnchor="middle"
                className={`text-[11px] font-medium transition-colors ${
                  isHovered ? 'fill-teal-300 font-semibold' : 'fill-slate-400'
                }`}
              >
                {bar.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Floating tooltip */}
      {hoveredBar && (
        <div className="absolute top-2 right-2 bg-slate-800/90 border border-slate-700/80 px-2.5 py-1 rounded-md shadow-lg text-xs pointer-events-none">
          <span className="text-slate-400 mr-2">{hoveredBar.label}:</span>
          <span className="font-bold text-teal-300 font-display">
            {formatMoney(hoveredBar.value, currency)}
          </span>
        </div>
      )}
    </div>
  )
}
