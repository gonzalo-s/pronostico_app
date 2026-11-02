import { formatTemp, formatValue } from '@/lib/format'
import type { HistoryPoint } from '@/lib/schemas'

export type HistoryRange = '24h' | '7d' | '31d'
export type MetricKey = 'temp_c' | 'humidity_pct' | 'pressure_hpa' | 'wind_kmh'

export const RANGES: readonly { key: HistoryRange; label: string; phrase: string; hours: number }[] = [
  { key: '24h', label: '24 h', phrase: 'últimas 24 horas', hours: 24 },
  { key: '7d', label: '7 días', phrase: 'últimos 7 días', hours: 7 * 24 },
  { key: '31d', label: '31 días', phrase: 'últimos 31 días', hours: 31 * 24 },
]

export const METRICS: readonly { key: MetricKey; label: string; format: (v: number | null) => string }[] = [
  { key: 'temp_c', label: 'Temperatura', format: formatTemp },
  { key: 'humidity_pct', label: 'Humedad', format: (v) => formatValue(v, '%') },
  { key: 'pressure_hpa', label: 'Presión', format: (v) => formatValue(v, 'hPa', 1) },
  { key: 'wind_kmh', label: 'Viento', format: (v) => formatValue(v, 'km/h') },
]

export interface Box {
  width: number
  height: number
  padLeft: number
  padRight: number
  padTop: number
  padBottom: number
}

export interface Series {
  /** Tramos continuos: un valor nulo corta la línea */
  segments: { x: number; y: number }[][]
  min: number
  max: number
  last: number | null
  /** Cantidad de puntos con valor */
  count: number
  /** Marcas del eje Y (de mayor a menor) con su posición */
  ticks: { value: number; y: number }[]
  t0: number
  t1: number
}

export function buildSeries(points: HistoryPoint[], key: MetricKey, box: Box): Series | null {
  const rows = points
    .map((p) => ({ t: Date.parse(p.at), v: p[key] }))
    .filter((r) => Number.isFinite(r.t))
  const values = rows.flatMap((r) => (r.v === null ? [] : [r.v]))
  if (values.length === 0) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  // Serie plana: se abre el rango para no dividir por cero y que la línea quede al medio
  const lo = min === max ? min - 1 : min
  const hi = min === max ? max + 1 : max
  const t0 = rows[0].t
  const t1 = rows[rows.length - 1].t
  const innerW = box.width - box.padLeft - box.padRight
  const innerH = box.height - box.padTop - box.padBottom
  const x = (t: number) => box.padLeft + (t1 === t0 ? innerW / 2 : ((t - t0) / (t1 - t0)) * innerW)
  const y = (v: number) => box.padTop + (1 - (v - lo) / (hi - lo)) * innerH

  const segments: { x: number; y: number }[][] = []
  let current: { x: number; y: number }[] = []
  for (const r of rows) {
    if (r.v === null) {
      if (current.length > 0) segments.push(current)
      current = []
    } else {
      current.push({ x: x(r.t), y: y(r.v) })
    }
  }
  if (current.length > 0) segments.push(current)

  const lastRow = [...rows].reverse().find((r) => r.v !== null)
  const ticks =
    min === max
      ? [{ value: min, y: y(min) }]
      : [max, (min + max) / 2, min].map((value) => ({ value, y: y(value) }))
  return { segments, min, max, last: lastRow?.v ?? null, count: values.length, ticks, t0, t1 }
}
