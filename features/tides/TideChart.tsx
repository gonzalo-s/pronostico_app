'use client'

import { useState, type PointerEvent } from 'react'
import { formatDateTime, formatHeight, formatShortDate } from '@/lib/format'
import { RANGES, buildSeries, type HistoryRange } from '@/lib/history'
import type { TideReading } from '@/lib/schemas'
import { TIDE_LEVELS, levelOf, splitByLevel } from '@/lib/tides'

interface Props {
  readings: TideReading[]
  range: HistoryRange
}

const BOX = { width: 340, height: 210, padLeft: 62, padRight: 12, padTop: 10, padBottom: 24 }
const DAY_MS = 24 * 3600_000
const Y_TICKS = 5
const LEGEND = ['Menos de 2 m', '2 a 2,5 m', '2,5 a 3 m', '3 a 3,5 m', '3,5 m o más']

export function TideChart({ readings, range }: Props) {
  const [picked, setPicked] = useState<number | null>(null)
  const r = RANGES.find((x) => x.key === range)!
  const series = buildSeries(readings, 'height_m', BOX, Y_TICKS)
  if (!series) return <p className="muted">Sin lecturas de marea para este período</p>

  const span = series.t1 - series.t0
  const fmtX = (t: number) => (span <= 8 * DAY_MS ? formatDateTime : formatShortDate)(new Date(t).toISOString())
  const innerW = BOX.width - BOX.padLeft - BOX.padRight
  const xs = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    t: series.t0 + span * f,
    x: BOX.padLeft + innerW * f,
    anchor: f === 0 ? 'start' : f === 1 ? 'end' : 'middle',
  })) as { t: number; x: number; anchor: 'start' | 'middle' | 'end' }[]
  const summary = `Altura de marea, ${r.phrase}: mínimo ${formatHeight(series.min)}, máximo ${formatHeight(series.max)}, último ${formatHeight(series.last)}`
  const pieces = splitByLevel(series.points)
  const limits = TIDE_LEVELS.filter((th) => th > series.min && th < series.max)
  const point = picked === null ? null : (series.points[picked] ?? null)

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * BOX.width
    let best = 0
    series.points.forEach((p, i) => {
      if (Math.abs(p.x - x) < Math.abs(series.points[best].x - x)) best = i
    })
    setPicked(best)
  }

  return (
    <>
      <svg
        className="chart chart--touch"
        viewBox={`0 0 ${BOX.width} ${BOX.height}`}
        role="img"
        aria-label={summary}
        onPointerDown={pick}
        onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons > 0 ? pick(e) : undefined)}
        onPointerLeave={(e) => (e.pointerType === 'mouse' ? setPicked(null) : undefined)}
      >
        {series.ticks.map((tick) => (
          <g key={tick.value}>
            <line className="chart__grid" x1={BOX.padLeft} x2={BOX.width - BOX.padRight} y1={tick.y} y2={tick.y} />
            <text className="chart__tick" x={BOX.padLeft - 6} y={tick.y} textAnchor="end" dominantBaseline="middle">
              {formatHeight(tick.value)}
            </text>
          </g>
        ))}
        {limits.map((th) => (
          <line
            key={th}
            className={`chart__limit tide-l${levelOf(th)}`}
            x1={BOX.padLeft}
            x2={BOX.width - BOX.padRight}
            y1={series.yOf(th)}
            y2={series.yOf(th)}
          />
        ))}
        {pieces.map((p, i) => (
          <line key={i} className={`chart__piece tide-l${p.level}`} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} />
        ))}
        {xs.map((tick) => (
          <text key={tick.x} className="chart__tick" x={tick.x} y={BOX.height - 6} textAnchor={tick.anchor}>
            {fmtX(tick.t)}
          </text>
        ))}
        {point && (
          <g aria-hidden="true">
            <line className="chart__cursor" x1={point.x} x2={point.x} y1={BOX.padTop} y2={BOX.height - BOX.padBottom} />
            <circle className={`chart__pick tide-l${levelOf(point.v)}`} cx={point.x} cy={point.y} r={4.5} />
          </g>
        )}
      </svg>
      <p className="chart__readout" aria-live="polite">
        {point ? (
          <>
            <strong>{formatHeight(point.v)}</strong> · {formatDateTime(new Date(point.t).toISOString())}
          </>
        ) : (
          <span className="muted">Tocá o deslizá sobre el gráfico para ver la altura en cada hora</span>
        )}
      </p>
      <ul className="tide-legend" aria-label="Referencia de colores">
        {LEGEND.map((label, i) => (
          <li key={label}>
            <span className="tide-legend__swatch" style={{ background: `var(--tide-${i})` }} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
      <dl className="stats stats--three">
        <div className="stat"><dt>Mínima</dt><dd>{formatHeight(series.min)}</dd></div>
        <div className="stat"><dt>Máxima</dt><dd>{formatHeight(series.max)}</dd></div>
        <div className="stat"><dt>Última</dt><dd>{formatHeight(series.last)}</dd></div>
      </dl>
    </>
  )
}
