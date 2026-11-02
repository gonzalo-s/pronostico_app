const ID = '[1-9]\\d{0,9}'

export const ALLOWED_ROUTES: readonly RegExp[] = [
  /^stations$/,
  /^stations\/nearest$/,
  new RegExp(`^stations/${ID}/current$`),
  new RegExp(`^stations/${ID}/forecast$`),
]

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
