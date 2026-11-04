import { formatDateTime, formatHeight } from '@/lib/format'
import type { ForecastStep, HistoryPoint, RiverCurrent, RiverForecast, TideCurrent, TideEvent } from '@/lib/schemas'
import { bandText } from '@/lib/rivers'

/**
 * Umbrales PROVISORIOS: los de marea son los de la casa del usuario; viento, lluvia y retardos son
 * una primera propuesta a calibrar con eventos reales. Las predicciones pueden ser optimistas, por eso
 * hay márgenes de prudencia y, para el río, se usa la banda alta (p95) y no la línea central.
 */
export const FLOOD = {
  tideLevels: [2.5, 3, 3.5], // moderado, moderado a intenso, intenso (mareógrafo SHN)
  tideHigh: 2, // desde acá la marea cuenta como "nivel alto" para activar Atención
  forecastMarginM: 0.25, // se suma a la pleamar prevista
  seSector: [100, 170], // grados de procedencia del viento que se toman como sudestada
  seMinKmh: 20,
  seObservedHours: 6,
  seForecastHours: 12,
  rain24Mm: 20,
  rain72Mm: 50,
  staleHours: 6,
  upstreamStaleHours: 36, // Rosario a Escobar se leen una vez por día
}

export const LEVEL_LABELS = ['Normal', 'Atención', 'Moderado', 'Moderado a intenso', 'Intenso'] as const
export type Level = 0 | 1 | 2 | 3 | 4

export type SignalKey = 'tide' | 'river' | 'wind' | 'rain' | 'upstream'
export type SignalState = 'active' | 'inactive' | 'nodata'

export interface Signal {
  key: SignalKey
  title: string
  state: SignalState
  lines: string[]
}

export interface FloodInput {
  now: number
  tide: { current: TideCurrent | null; events: TideEvent[] | null }
  river: { current: RiverCurrent | null; forecast: RiverForecast | null }
  wind: { history: HistoryPoint[] | null; steps: ForecastStep[] | null }
  upstream: { name: string; current: RiverCurrent }[]
}

export interface FloodResult {
  /** null = sin datos recientes de nivel (marea y río): no se evalúa */
  level: Level | null
  reasons: string[]
  signals: Signal[]
  partial: boolean
}

const HOUR = 3600_000
const ageHours = (iso: string, now: number) => (now - Date.parse(iso)) / HOUR
const fresh = (iso: string, now: number, hours: number) => {
  const a = ageHours(iso, now)
  return Number.isFinite(a) && a <= hours
}
const comma = (n: number, d = 0) => n.toFixed(d).replace('.', ',')

const isSE = (dir: number | null, kmh: number | null) =>
  dir !== null && kmh !== null && dir >= FLOOD.seSector[0] && dir <= FLOOD.seSector[1] && kmh >= FLOOD.seMinKmh

const tideSeverity = (h: number) => FLOOD.tideLevels.filter((t) => h >= t).length

interface Part {
  signal: Signal
  severity: number
  high: boolean
}

function evalTide({ now, tide }: FloodInput): Part {
  const current = tide.current && fresh(tide.current.updated_at, now, FLOOD.staleHours) ? tide.current : null
  const nextHigh = (tide.events ?? [])
    .filter((e) => e.kind === 'high' && Date.parse(e.at) >= now && Date.parse(e.at) <= now + 24 * HOUR)
    .sort((a, b) => b.height_m - a.height_m)[0]
  if (!current && !nextHigh) {
    return { signal: { key: 'tide', title: 'Marea (SHN)', state: 'nodata', lines: ['Sin lectura reciente'] }, severity: 0, high: false }
  }
  const lines: string[] = []
  let effective = 0
  if (current) {
    effective = current.height_m
    lines.push(`Ahora ${formatHeight(current.height_m)} (lectura del ${formatDateTime(current.at)})`)
  } else {
    lines.push('Sin lectura reciente del mareógrafo')
  }
  if (nextHigh) {
    const padded = nextHigh.height_m + FLOOD.forecastMarginM
    effective = Math.max(effective, padded)
    lines.push(
      `Pleamar prevista ${formatHeight(nextHigh.height_m)} el ${formatDateTime(nextHigh.at)}; con margen de prudencia (+${comma(FLOOD.forecastMarginM, 2)} m): ${formatHeight(padded)}`,
    )
  }
  const severity = tideSeverity(effective)
  return {
    signal: { key: 'tide', title: 'Marea (SHN)', state: severity >= 1 ? 'active' : 'inactive', lines },
    severity,
    high: effective >= FLOOD.tideHigh,
  }
}

function evalRiver({ now, river }: FloodInput): Part {
  const current = river.current && fresh(river.current.updated_at, now, FLOOD.staleHours) ? river.current : null
  const fc = river.forecast
  if (!current && !fc) {
    return { signal: { key: 'river', title: 'Río en San Fernando (INA)', state: 'nodata', lines: ['Sin lectura reciente'] }, severity: 0, high: false }
  }
  const lines: string[] = []
  let severity = 0
  let high = false
  if (current) {
    lines.push(`Ahora ${formatHeight(current.height_m)} (lectura del ${formatDateTime(current.at)})`)
    if (current.official_level === 'evacuation') {
      severity = 3
      lines.push('Sobre el nivel de evacuación')
    } else if (current.official_level === 'alert') {
      severity = 2
      lines.push('Sobre el nivel de alerta')
    }
    const band = bandText(current.level_band)
    if (band) lines.push(band)
    high = current.level_band === 'above_p90' || current.level_band === 'above_p99'
  }
  if (fc) {
    const future = fc.points.filter((p) => Date.parse(p.at) >= now)
    const peak = future.reduce<(typeof future)[number] | null>((m, p) => (m === null || p.p95_m > m.p95_m ? p : m), null)
    const alert = fc.levels?.alert_m ?? null
    const evac = fc.levels?.evacuation_m ?? null
    if (peak) {
      lines.push(`Banda alta del pronóstico: hasta ${formatHeight(peak.p95_m)} el ${formatDateTime(peak.at)}`)
      if (evac !== null && peak.p95_m >= evac) severity = Math.max(severity, 2)
      else if (alert !== null && peak.p95_m >= alert) severity = Math.max(severity, 1)
    }
  }
  return { signal: { key: 'river', title: 'Río en San Fernando (INA)', state: severity >= 1 ? 'active' : 'inactive', lines }, severity, high: high || severity >= 1 }
}

function evalWind({ now, wind }: FloodInput): Signal {
  const { history, steps } = wind
  if (!history && !steps) return { key: 'wind', title: 'Sudestada (viento del SE)', state: 'nodata', lines: ['Sin datos de viento'] }
  const lines: string[] = []
  let observedH = 0
  if (history) {
    const pts = history
      .map((p) => ({ t: Date.parse(p.at), se: isSE(p.wind_dir_deg, p.wind_kmh) }))
      .filter((p) => Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t)
    const last = pts[pts.length - 1]
    if (last && now - last.t <= 3 * HOUR && last.se) {
      let first = last.t
      for (let i = pts.length - 2; i >= 0; i--) {
        if (!pts[i].se || pts[i + 1].t - pts[i].t > 1.5 * HOUR) break
        first = pts[i].t
      }
      observedH = Math.round((last.t - first) / HOUR) + 1
    }
    lines.push(
      observedH > 0
        ? `Viento del SE (≥ ${FLOOD.seMinKmh} km/h) sostenido hace ${observedH} h`
        : `Sin viento del SE (≥ ${FLOOD.seMinKmh} km/h) sostenido ahora`,
    )
  }
  let forecastH = 0
  if (steps) {
    const se = steps.filter((s) => {
      const t = Date.parse(s.at)
      return t >= now && t <= now + 48 * HOUR && isSE(s.wind_dir_deg, s.wind_kmh)
    })
    forecastH = se.length * 3
    const max = Math.max(0, ...se.map((s) => s.wind_kmh ?? 0))
    lines.push(
      forecastH > 0
        ? `Previsto: ${forecastH} h de viento del SE en las próximas 48 h (hasta ${comma(max)} km/h)`
        : 'Previsto: sin viento del SE relevante en las próximas 48 h',
    )
  }
  const active = observedH >= FLOOD.seObservedHours || forecastH >= FLOOD.seForecastHours
  return { key: 'wind', title: 'Sudestada (viento del SE)', state: active ? 'active' : 'inactive', lines }
}

function evalRain({ now, wind }: FloodInput): Signal {
  const steps = wind.steps
  if (!steps) return { key: 'rain', title: 'Lluvia', state: 'nodata', lines: ['Sin pronóstico de lluvia'] }
  const sum = (hours: number) =>
    steps
      .filter((s) => {
        const t = Date.parse(s.at)
        return t >= now && t < now + hours * HOUR
      })
      .reduce((acc, s) => acc + (s.precip_mm ?? 0), 0)
  const d1 = sum(24)
  const d3 = sum(72)
  return {
    key: 'rain',
    title: 'Lluvia',
    state: d1 >= FLOOD.rain24Mm || d3 >= FLOOD.rain72Mm ? 'active' : 'inactive',
    lines: [`Prevista: ${comma(d1)} mm en 24 h y ${comma(d3)} mm en 72 h`, 'No hay lluvia observada: el pronóstico puede subestimarla'],
  }
}

function evalUpstream({ now, upstream }: FloodInput): Signal {
  const rows = upstream.filter((u) => fresh(u.current.at, now, FLOOD.upstreamStaleHours))
  if (rows.length === 0) return { key: 'upstream', title: 'Paraná aguas arriba (INA)', state: 'nodata', lines: ['Sin lecturas recientes'] }
  const lines = rows.map((u) => {
    const band = u.current.level_band
    const txt = band === 'above_p99' ? 'sobre el p99 del día' : band === 'above_p90' ? 'sobre el p90 del día' : band === 'normal' ? 'dentro de lo habitual' : 'sin referencia'
    const c = u.current.change_24h_m
    const change = c === null ? '' : ` · ${c > 0 ? '+' : c < 0 ? '−' : ''}${comma(Math.abs(c), 2)} m en 24 h`
    return `${u.name}: ${formatHeight(u.current.height_m)}, ${txt}${change}`
  })
  const active = rows.some((u) => u.current.level_band === 'above_p90' || u.current.level_band === 'above_p99')
  return { key: 'upstream', title: 'Paraná aguas arriba (INA)', state: active ? 'active' : 'inactive', lines }
}

export function evaluateFlood(input: FloodInput): FloodResult {
  const tide = evalTide(input)
  const river = evalRiver(input)
  const wind = evalWind(input)
  const rain = evalRain(input)
  const upstream = evalUpstream(input)
  const signals = [tide.signal, river.signal, wind, rain, upstream]
  const partial = signals.some((s) => s.state === 'nodata')
  const reasons = signals.filter((s) => s.state === 'active').map((s) => s.title)

  if (tide.signal.state === 'nodata' && river.signal.state === 'nodata') {
    return { level: null, reasons, signals, partial: true }
  }
  const severity = Math.max(tide.severity, river.severity)
  const aggravators = [wind, rain, upstream].filter((s) => s.state === 'active').length
  let level: Level = 0
  if (severity >= 1) level = Math.min(4, severity + 1 + (aggravators >= 2 ? 1 : 0)) as Level
  else if (aggravators >= 2 && (tide.high || river.high)) level = 1
  return { level, reasons, signals, partial }
}
