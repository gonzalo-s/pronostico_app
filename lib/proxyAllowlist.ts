const ID = '[1-9]\\d{0,9}'

export const ALLOWED_ROUTES: readonly RegExp[] = [
  /^stations$/,
  /^stations\/nearest$/,
  new RegExp(`^stations/${ID}/current$`),
  new RegExp(`^stations/${ID}/forecast$`),
  new RegExp(`^stations/${ID}/history$`),
  new RegExp(`^tides/stations/${ID}/current$`),
  new RegExp(`^tides/stations/${ID}/heights$`),
  new RegExp(`^tides/stations/${ID}/extremes$`),
  new RegExp(`^tides/stations/${ID}/forecast$`),
]

// Rutas que reciben ?range= y se traducen a from/to calculados por el servidor
export const HISTORY_ROUTE = new RegExp(`^(stations/${ID}/history|tides/stations/${ID}/(heights|extremes))$`)

export function isAllowedPath(path: string): boolean {
  return ALLOWED_ROUTES.some((route) => route.test(path))
}

// Decimal estricto (sin exponente, signo + ni espacios): lo que pasa el regex es seguro de interpolar
const COORD = /^-?\d{1,3}(\.\d{1,6})?$/

export function nearestQuery(params: URLSearchParams): string | null {
  const lat = params.get('lat')
  const lon = params.get('lon')
  if (lat === null || lon === null || !COORD.test(lat) || !COORD.test(lon)) return null
  if (Math.abs(Number(lat)) > 90 || Math.abs(Number(lon)) > 180) return null
  return `lat=${lat}&lon=${lon}`
}

const HOUR_MS = 3600_000
const HISTORY_RANGES: Record<string, number> = {
  '24h': 24 * HOUR_MS,
  '7d': 7 * 24 * HOUR_MS,
  '31d': 31 * 24 * HOUR_MS,
}

// El cliente elige un período; el servidor calcula las fechas (hora redondeada: la respuesta se cachea bien)
export function historyQuery(params: URLSearchParams, now: number): string | null {
  const range = params.get('range')
  if (range === null || !Object.hasOwn(HISTORY_RANGES, range)) return null
  const to = Math.floor(now / HOUR_MS) * HOUR_MS
  const from = to - HISTORY_RANGES[range]
  return `from=${encodeURIComponent(new Date(from).toISOString())}&to=${encodeURIComponent(new Date(to).toISOString())}`
}
