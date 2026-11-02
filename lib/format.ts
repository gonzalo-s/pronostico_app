const TZ = 'America/Argentina/Buenos_Aires'
const ART_OFFSET_MS = 3 * 3600_000
const DAY_MS = 24 * 3600_000

export const EMPTY = '—'

export function formatValue(v: number | null, unit: string, digits = 0): string {
  return v === null ? EMPTY : `${v.toFixed(digits).replace('.', ',')} ${unit}`
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

export const formatTime = (iso: string): string => timeFmt.format(new Date(iso))
export const formatDateTime = (iso: string): string => dateTimeFmt.format(new Date(iso))

export function artDate(iso: string): string {
  return new Date(Date.parse(iso) - ART_OFFSET_MS).toISOString().slice(0, 10)
}

export const todayArt = (now: Date): string => artDate(now.toISOString())

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
