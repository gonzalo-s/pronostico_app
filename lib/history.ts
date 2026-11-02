import { formatTemp, formatValue } from '@/lib/format'
import type { HistoryPoint } from '@/lib/schemas'

export type HistoryRange = '24h' | '7d' | '31d'
export type MetricKey = 'temp_c' | 'humidity_pct' | 'pressure_hpa' | 'wind_kmh'

export const RANGES: readonly { key: HistoryRange; label: string; phrase: string }[] = [
  { key: '24h', label: '24 h', phrase: 'últimas 24 horas' },
  { key: '7d', label: '7 días', phrase: 'últimos 7 días' },
  { key: '31d', label: '31 días', phrase: 'últimos 31 días' },
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
  padX: number
  padY: number
}

export interface Series {
  /** Tramos continuos: un valor nulo corta la línea */
  segments: { x: number; y: number }[][]
  min: number
  max: number
  last: number | null
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
  const innerW = box.width - 2 * box.padX
  const innerH = box.height - 2 * box.padY
  const x = (t: number) => box.padX + (t1 === t0 ? innerW / 2 : ((t - t0) / (t1 - t0)) * innerW)
  const y = (v: number) => box.padY + (1 - (v - lo) / (hi - lo)) * innerH

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
  return { segments, min, max, last: lastRow?.v ?? null, t0, t1 }
}
