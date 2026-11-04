'use client'

import { useState, type PointerEvent } from 'react'
import { formatDateTime, formatHeight } from '@/lib/format'
import { buildForecastChart, firstExceedance, toLevels } from '@/lib/rivers'
import type { RiverForecast, RiverReading } from '@/lib/schemas'

interface Props {
  forecast: RiverForecast
  readings: RiverReading[]
  now: Date
}

const BOX = { width: 340, height: 230, padLeft: 62, padRight: 12, padTop: 10, padBottom: 24 }
const LEVEL_LABEL = { evacuation: 'Evacuación', alert: 'Alerta', lowWater: 'Aguas bajas' } as const

export function RiverForecastChart({ forecast, readings, now }: Props) {
  const [picked, setPicked] = useState<number | null>(null)
  const levels = toLevels(forecast.levels)
  const chart = buildForecastChart(forecast, readings, levels, BOX, now.getTime())
  if (!chart) return <p className="muted">Sin pronóstico disponible</p>

  const innerW = BOX.width - BOX.padLeft - BOX.padRight
  const span = chart.t1 - chart.t0
  const xs = [0, 0.5, 1].map((f) => ({
    t: chart.t0 + span * f,
    x: BOX.padLeft + innerW * f,
    anchor: f === 0 ? 'start' : f === 1 ? 'end' : 'middle',
  })) as { t: number; x: number; anchor: 'start' | 'middle' | 'end' }[]
  const iso = (t: number) => new Date(t).toISOString()
  const over = firstExceedance(forecast.points, levels)
  const point = picked === null ? null : (chart.picks[picked] ?? null)

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * BOX.width
    let best = 0
    chart.picks.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs(chart.picks[best].x - x)) best = i
    })
    setPicked(best)
  }

  const peak = Math.max(...forecast.points.map((p) => p.main_m))
  const summary = `Pronóstico del río en San Fernando: máximo previsto ${formatHeight(peak)}, emitido ${formatDateTime(forecast.issued_at)}`

  return (
    <>
      {over && (
        <p className={`river-notice river-notice--${over.kind}`} role="status">
          La banda alta del modelo llega al nivel de {over.kind === 'evacuation' ? 'evacuación' : 'alerta'} (
          {formatHeight(over.level)}) el {formatDateTime(over.at)}.
        </p>
      )}
      <svg
        className="chart chart--touch"
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        role="img"
        aria-label={summary}
        onPointerDown={pick}
        onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons > 0 ? pick(e) : undefined)}
        onPointerLeave={(e) => (e.pointerType === 'mouse' ? setPicked(null) : undefined)}
      >
        {chart.ticks.map((tick) => (
          <g key={tick.value}>
            <line className="chart__grid" x1={BOX.padLeft} x2={BOX.width - BOX.padRight} y1={tick.y} y2={tick.y} />
            <text className="chart__tick" x={BOX.padLeft - 6} y={tick.y} textAnchor="end" dominantBaseline="middle">
              {formatHeight(tick.value)}
            </text>
          </g>
        ))}
        <polygon className="river-band" points={chart.outer} />
        <polygon className="river-band river-band--inner" points={chart.inner} />
        {chart.levels.map((l) => (
          <g key={l.key}>
            <line
              className={`river-level river-level--${l.key}`}
              x1={BOX.padLeft}
              x2={BOX.width - BOX.padRight}
              y1={l.y}
              y2={l.y}
            />
            <text className={`river-level__label river-level__label--${l.key}`} x={BOX.padLeft + 4} y={l.y - 3}>
              {LEVEL_LABEL[l.key]}
            </text>
          </g>
        ))}
        <polyline className="river-main" points={chart.main} />
        {chart.readings.map((r, i) => (
          <circle key={i} className="river-reading" cx={r.x} cy={r.y} r={1.8} />
        ))}
        {chart.nowX !== null && (
          <g aria-hidden="true">
            <line className="river-now" x1={chart.nowX} x2={chart.nowX} y1={BOX.padTop} y2={BOX.height - BOX.padBottom} />
            <text className="chart__tick" x={chart.nowX} y={BOX.padTop + 8} textAnchor="middle">ahora</text>
          </g>
        )}
        {xs.map((tick) => (
          <text key={tick.x} className="chart__tick" x={tick.x} y={BOX.height - 6} textAnchor={tick.anchor}>
            {formatDateTime(iso(tick.t))}
          </text>
        ))}
        {point && (
          <g aria-hidden="true">
            <line className="chart__cursor" x1={point.x} x2={point.x} y1={BOX.padTop} y2={BOX.height - BOX.padBottom} />
            <circle className="river-pick" cx={point.x} cy={point.y} r={4.5} />
          </g>
        )}
      </svg>
      <p className="chart__readout" aria-live="polite">
        {point ? (
          point.kind === 'real' ? (
            <>
              Lectura <strong>{formatHeight(point.value)}</strong> · {formatDateTime(point.at)}
            </>
          ) : (
            <>
              Previsto <strong>{formatHeight(point.value)}</strong> (banda {formatHeight(point.low ?? null)} a{' '}
              {formatHeight(point.high ?? null)}) · {formatDateTime(point.at)}
            </>
          )
        ) : (
          <span className="muted">Tocá o deslizá sobre el gráfico para ver los valores</span>
        )}
      </p>
      <ul className="tide-legend" aria-label="Referencia del gráfico">
        <li><span className="river-key river-key--main" aria-hidden="true" />Pronóstico del modelo</li>
        <li><span className="river-key river-key--band" aria-hidden="true" />Banda del modelo</li>
        <li><span className="river-key river-key--reading" aria-hidden="true" />Lecturas reales</li>
      </ul>
      <p className="muted">
        Pronóstico emitido el {formatDateTime(forecast.issued_at)}. A más días, mayor incertidumbre.
      </p>
    </>
  )
}
