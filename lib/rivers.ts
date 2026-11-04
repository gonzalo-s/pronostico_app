import type { Box } from '@/lib/history'
import type { RiverCurrent, RiverForecast, RiverReading, RiverStation } from '@/lib/schemas'

const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase()

/** Las estaciones se buscan por nombre: no se hardcodean ids */
export const findRiverStation = (list: RiverStation[], name: string): RiverStation | undefined =>
  list.find((s) => plain(s.name) === plain(name))

export type OfficialLevel = RiverCurrent['official_level']

/** `unknown` = sin niveles cargados: no se muestra estado */
export const OFFICIAL: Record<Exclude<OfficialLevel, 'unknown'>, { label: string; tone: 'evac' | 'alert' | 'ok' | 'low' }> = {
  evacuation: { label: 'Sobre el nivel de evacuación', tone: 'evac' },
  alert: { label: 'Sobre el nivel de alerta', tone: 'alert' },
  normal: { label: 'Por debajo del nivel de alerta', tone: 'ok' },
  low_water: { label: 'Aguas bajas', tone: 'low' },
}

/** Contexto neutro (sin colores de alerta): compara con lo histórico del día */
export function bandText(band: RiverCurrent['level_band']): string | null {
  if (band === 'above_p99') return 'Más alto que el 99 % de lo registrado en esta fecha'
  if (band === 'above_p90') return 'Más alto que el 90 % de lo registrado en esta fecha'
  if (band === 'normal') return 'Dentro de lo habitual para esta fecha'
  return null
}

export function changeText(change: number | null): string | null {
  if (change === null) return null
  const sign = change > 0 ? '+' : change < 0 ? '−' : ''
  return `${sign}${Math.abs(change).toFixed(2).replace('.', ',')} m en 24 h`
}

export interface Levels {
  alert: number | null
  evacuation: number | null
  lowWater: number | null
}

export const toLevels = (l: RiverForecast['levels']): Levels => ({
  alert: l?.alert_m ?? null,
  evacuation: l?.evacuation_m ?? null,
  lowWater: l?.low_water_m ?? null,
})

/** Primer momento previsto en que la banda alta (p95) alcanza un nivel; para avisos se usa la banda alta, no `main` */
export function firstExceedance(
  points: RiverForecast['points'],
  levels: Levels,
): { kind: 'evacuation' | 'alert'; level: number; at: string } | null {
  const checks = [
    { kind: 'evacuation', level: levels.evacuation },
    { kind: 'alert', level: levels.alert },
  ] as const
  for (const c of checks) {
    const level = c.level
    if (level === null) continue
    const hit = points.find((p) => p.p95_m >= level)
    if (hit) return { kind: c.kind, level, at: hit.at }
  }
  return null
}

export interface ChartPick {
  x: number
  y: number
  at: string
  kind: 'real' | 'forecast'
  value: number
  low?: number
  high?: number
}

export interface ForecastChart {
  t0: number
  t1: number
  /** Banda del modelo p05–p95 y p25–p75, como polígono */
  outer: string
  inner: string
  main: string
  readings: { x: number; y: number }[]
  nowX: number | null
  levels: { key: 'alert' | 'evacuation' | 'lowWater'; value: number; y: number }[]
  ticks: { value: number; y: number }[]
  picks: ChartPick[]
}

export function buildForecastChart(
  forecast: RiverForecast,
  readings: RiverReading[],
  levels: Levels,
  box: Box,
  now: number,
  tickCount = 5,
): ForecastChart | null {
  const pts = forecast.points
    .map((p) => ({ ...p, t: Date.parse(p.at) }))
    .filter((p) => Number.isFinite(p.t))
  if (pts.length === 0) return null
  const reads = readings.map((r) => ({ ...r, t: Date.parse(r.at) })).filter((r) => Number.isFinite(r.t))

  const t1 = pts[pts.length - 1].t
  const t0 = Math.min(pts[0].t, ...reads.map((r) => r.t))
  const values = [
    ...pts.flatMap((p) => [p.p05_m, p.p95_m]),
    ...reads.map((r) => r.height_m),
    ...[levels.alert, levels.evacuation].filter((v): v is number => v !== null),
  ]
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  const pad = Math.max((dataMax - dataMin) * 0.05, 0.05)
  const lo = dataMin - pad
  const hi = dataMax + pad

  const innerW = box.width - box.padLeft - box.padRight
  const innerH = box.height - box.padTop - box.padBottom
  const x = (t: number) => box.padLeft + (t1 === t0 ? innerW / 2 : ((t - t0) / (t1 - t0)) * innerW)
  const y = (v: number) => box.padTop + (1 - (v - lo) / (hi - lo)) * innerH
  const f = (n: number) => n.toFixed(1)
  const path = (a: (p: (typeof pts)[number]) => number, b: (p: (typeof pts)[number]) => number) =>
    [...pts.map((p) => `${f(x(p.t))},${f(y(b(p)))}`), ...[...pts].reverse().map((p) => `${f(x(p.t))},${f(y(a(p)))}`)].join(' ')

  const lines: ForecastChart['levels'] = []
  if (levels.evacuation !== null) lines.push({ key: 'evacuation', value: levels.evacuation, y: y(levels.evacuation) })
  if (levels.alert !== null) lines.push({ key: 'alert', value: levels.alert, y: y(levels.alert) })
  // Aguas bajas solo si cae dentro de lo que ya se dibuja: no se estira el eje por ella
  if (levels.lowWater !== null && levels.lowWater >= lo && levels.lowWater <= hi) {
    lines.push({ key: 'lowWater', value: levels.lowWater, y: y(levels.lowWater) })
  }

  const picks: ChartPick[] = [
    ...reads.map((r): ChartPick => ({ x: x(r.t), y: y(r.height_m), at: r.at, kind: 'real', value: r.height_m })),
    ...pts.map((p): ChartPick => ({ x: x(p.t), y: y(p.main_m), at: p.at, kind: 'forecast', value: p.main_m, low: p.p05_m, high: p.p95_m })),
  ].sort((a, b) => a.x - b.x)

  return {
    t0,
    t1,
    outer: path((p) => p.p05_m, (p) => p.p95_m),
    inner: path((p) => p.p25_m, (p) => p.p75_m),
    main: pts.map((p) => `${f(x(p.t))},${f(y(p.main_m))}`).join(' '),
    readings: reads.map((r) => ({ x: x(r.t), y: y(r.height_m) })),
    nowX: now >= t0 && now <= t1 ? x(now) : null,
    levels: lines,
    ticks: Array.from({ length: tickCount }, (_, i) => hi - ((hi - lo) * i) / (tickCount - 1)).map((value) => ({ value, y: y(value) })),
    picks,
  }
}
