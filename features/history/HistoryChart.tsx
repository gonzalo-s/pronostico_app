import { formatShortDate, formatTime } from '@/lib/format'
import { METRICS, RANGES, buildSeries, type HistoryRange, type MetricKey } from '@/lib/history'
import type { HistoryPoint } from '@/lib/schemas'

interface Props {
  points: HistoryPoint[]
  metric: MetricKey
  range: HistoryRange
}

const BOX = { width: 320, height: 160, padX: 8, padY: 12 }

export function HistoryChart({ points, metric, range }: Props) {
  const m = METRICS.find((x) => x.key === metric)!
  const r = RANGES.find((x) => x.key === range)!
  const series = buildSeries(points, metric, BOX)
  if (!series) return <p className="muted">Sin datos históricos para este período</p>

  const fmtX = (t: number) => (range === '24h' ? formatTime : formatShortDate)(new Date(t).toISOString())
  const mid = (series.t0 + series.t1) / 2
  const summary = `${m.label}, ${r.phrase}: mínimo ${m.format(series.min)}, máximo ${m.format(series.max)}, último ${m.format(series.last)}`

  return (
    <>
      <svg className="chart" viewBox={`0 0 ${BOX.width} ${BOX.height}`} role="img" aria-label={summary}>
        {series.segments.map((seg, i) =>
          seg.length > 1 ? (
            <polyline key={i} className="chart__line" points={seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} />
          ) : (
            <circle key={i} className="chart__dot" cx={seg[0].x} cy={seg[0].y} r={2.5} />
          ),
        )}
      </svg>
      <div className="chart__axis" aria-hidden="true">
        <span>{fmtX(series.t0)}</span>
        <span>{fmtX(mid)}</span>
        <span>{fmtX(series.t1)}</span>
      </div>
      <dl className="stats stats--three">
        <div className="stat"><dt>Mínimo</dt><dd>{m.format(series.min)}</dd></div>
        <div className="stat"><dt>Máximo</dt><dd>{m.format(series.max)}</dd></div>
        <div className="stat"><dt>Último</dt><dd>{m.format(series.last)}</dd></div>
      </dl>
    </>
  )
}
