import { formatDateTime, formatShortDate } from '@/lib/format'
import { METRICS, RANGES, buildSeries, type HistoryRange, type MetricKey } from '@/lib/history'
import type { HistoryPoint } from '@/lib/schemas'

interface Props {
  points: HistoryPoint[]
  metric: MetricKey
  range: HistoryRange
}

const BOX = { width: 340, height: 190, padLeft: 62, padRight: 12, padTop: 10, padBottom: 24 }
const HOUR_MS = 3600_000
const DAY_MS = 24 * HOUR_MS
// Bajo este porcentaje del período pedido, se avisa que el histórico guardado es más corto
const COVERAGE_MIN = 0.9

export function HistoryChart({ points, metric, range }: Props) {
  const m = METRICS.find((x) => x.key === metric)!
  const r = RANGES.find((x) => x.key === range)!
  const series = buildSeries(points, metric, BOX)
  if (!series) return <p className="muted">Sin datos históricos para este período</p>

  const span = series.t1 - series.t0
  // Con menos de ~8 días entran fecha y hora; con más, solo la fecha
  const fmtX = (t: number) => (span <= 8 * DAY_MS ? formatDateTime : formatShortDate)(new Date(t).toISOString())
  const xs = [
    { t: series.t0, x: BOX.padLeft, anchor: 'start' },
    { t: (series.t0 + series.t1) / 2, x: (BOX.padLeft + BOX.width - BOX.padRight) / 2, anchor: 'middle' },
    { t: series.t1, x: BOX.width - BOX.padRight, anchor: 'end' },
  ] as const
  const coverageHours = Math.round(span / HOUR_MS)
  const short = range !== '24h' && span < r.hours * HOUR_MS * COVERAGE_MIN
  const summary = `${m.label}, ${r.phrase}: mínimo ${m.format(series.min)}, máximo ${m.format(series.max)}, último ${m.format(series.last)}`

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-label={summary}>
        {series.ticks.map((tick) => (
          <g key={tick.value}>
            <line className="chart__grid" x1={BOX.padLeft} x2={BOX.width - BOX.padRight} y1={tick.y} y2={tick.y} />
            <text className="chart__tick" x={BOX.padLeft - 6} y={tick.y} textAnchor="end" dominantBaseline="middle">
              {m.format(tick.value)}
            </text>
          </g>
        ))}
        {series.segments.map((seg, i) =>
          seg.length > 1 ? (
            <polyline key={i} className="chart__line" points={seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} />
          ) : (
            <circle key={i} className="chart__dot" cx={seg[0].x} cy={seg[0].y} r={2.5} />
          ),
        )}
        {xs.map((tick) => (
          <text key={tick.anchor} className="chart__tick" x={tick.x} y={BOX.height - 6} textAnchor={tick.anchor}>
            {fmtX(tick.t)}
          </text>
        ))}
      </svg>
      <p className="muted">
        Datos del {formatDateTime(new Date(series.t0).toISOString())} al {formatDateTime(new Date(series.t1).toISOString())} ·{' '}
        {series.count} {series.count === 1 ? 'punto' : 'puntos'}
      </p>
      {short && (
        <p className="muted">
          Solo hay {coverageHours} h de datos guardados para esta estación, por eso este período se ve igual que uno más corto.
        </p>
      )}
      <dl className="stats stats--three">
        <div className="stat"><dt>Mínimo</dt><dd>{m.format(series.min)}</dd></div>
        <div className="stat"><dt>Máximo</dt><dd>{m.format(series.max)}</dd></div>
        <div className="stat"><dt>Último</dt><dd>{m.format(series.last)}</dd></div>
      </dl>
    </>
  )
}
