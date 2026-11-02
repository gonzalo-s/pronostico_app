const TZ = 'America/Argentina/Buenos_Aires'
const ART_OFFSET_MS = 3 * 3600_000
const DAY_MS = 24 * 3600_000

export const EMPTY = '—'

export function formatValue(v: number | null, unit: string, digits = 0): string {
  return v === null ? EMPTY : `${v.toFixed(digits).replace('.', ',')} ${unit}`
}

export const formatAltitude = (m: number | null): string | null => (m === null ? null : `${Math.round(m)} m s. n. m.`)

export function formatDistance(km: number): string {
  return km < 1 ? 'A menos de 1 km de vos' : `A ${km.toFixed(1).replace('.', ',')} km de vos`
}

export function formatTemp(v: number | null): string {
  return v === null ? EMPTY : `${Math.round(v) + 0}°`
}

const timeFmt = new Intl.DateTimeFormat('es-AR', {
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ,
})
const dateTimeFmt = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: TZ,
})
const weekdayFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: TZ })

const dayFmt = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', timeZone: TZ })

export const formatShortDate = (iso: string): string => dayFmt.format(new Date(iso))
export const formatTime =(iso: string): string => timeFmt.format(new Date(iso))
export const formatDateTime = (iso: string): string => dateTimeFmt.format(new Date(iso))

export function artDate(iso: string): string {
  return new Date(Date.parse(iso) - ART_OFFSET_MS).toISOString().slice(0, 10)
}

export const todayArt = (now: Date): string => artDate(now.toISOString())

// Aproximación deliberada: día entre las 7 y las 19 h de Argentina, sin cálculo astronómico
export function isDaytime(iso: string): boolean {
  const hour = new Date(Date.parse(iso) - ART_OFFSET_MS).getUTCHours()
  return hour >= 7 && hour < 19
}

export function formatDayLabel(date: string, today: string): string {
  if (date === today) return 'Hoy'
  const tomorrow = artDate(new Date(Date.parse(`${today}T12:00:00-03:00`) + DAY_MS).toISOString())
  if (date === tomorrow) return 'Mañana'
  const name = weekdayFmt.format(new Date(`${date}T12:00:00-03:00`))
  return name.charAt(0).toUpperCase() + name.slice(1)
}

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

export function compass(deg: number | null): string | null {
  if (deg === null) return null
  return POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]
}

export function windText(dir: string | null, kmh: number | null, variable = false): string {
  if (kmh === null) return EMPTY
  const prefix = variable ? 'Variable' : dir
  return [prefix, `${kmh} km/h`].filter(Boolean).join(' ')
}

const WIND_DEGREES: Record<string, number> = {
  norte: 0, noreste: 45, este: 90, sudeste: 135, sur: 180, sudoeste: 225, oeste: 270, noroeste: 315,
}

// El SMN informa el viento actual con el nombre de 8 puntos ("Sudeste"); devuelve los grados de origen
export function windDegrees(dir: string | null): number | null {
  const t = dir?.trim().toLowerCase()
  return t !== undefined && t in WIND_DEGREES ? WIND_DEGREES[t] : null
}

export function isSoutheast(dir: string | null): boolean {
  const t = dir?.trim().toLowerCase()
  return t === 'sudeste' || t === 'se'
}

export function isStale(updatedAt: string | null, now: Date, hours = 6): boolean {
  return updatedAt !== null && now.getTime() - Date.parse(updatedAt) > hours * 3600_000
}

const PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y'])

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-/(])(\p{L}+)/gu, (_, sep: string, word: string, offset: number) =>
      offset > 0 && PARTICLES.has(word) ? sep + word : sep + word.charAt(0).toUpperCase() + word.slice(1),
    )
}
