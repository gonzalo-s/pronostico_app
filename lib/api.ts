import type { ZodType } from 'zod'
import { roundCoord } from '@/lib/geolocation'
import type { HistoryRange } from '@/lib/history'
import {
  currentResponse, forecastResponse, historyResponse, nearestStationResponse, stationsResponse,
  tideCurrentResponse, tideExtremesResponse, tideForecastResponse, tideHeightsResponse,
} from '@/lib/schemas'

export type ApiErrorKind = 'not_found' | 'network' | 'upstream' | 'contract'

export class ApiError extends Error {
  constructor(readonly kind: ApiErrorKind, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getJson<T>(route: string, schema: ZodType<T>): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/smn/${route}`)
  } catch {
    throw new ApiError('network', 'Sin conexión')
  }
  if (res.status === 404) throw new ApiError('not_found', 'Sin datos')
  if (!res.ok) throw new ApiError('upstream', 'Servicio no disponible')

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new ApiError('contract', 'Respuesta inesperada de la API')
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    console.error(`contrato: respuesta inválida de ${route}`, parsed.error.issues)
    throw new ApiError('contract', 'Respuesta inesperada de la API')
  }
  return parsed.data
}

export const getStations = () => getJson('stations', stationsResponse)
export const getCurrent = (id: number) => getJson(`stations/${id}/current`, currentResponse)
export const getForecast = (id: number) => getJson(`stations/${id}/forecast`, forecastResponse)
export const getHistory = (id: number, range: HistoryRange) =>
  getJson(`stations/${id}/history?range=${range}`, historyResponse)
export const getTideCurrent = (id: number) => getJson(`tides/stations/${id}/current`, tideCurrentResponse)
export const getTideHeights = (id: number, range: HistoryRange) =>
  getJson(`tides/stations/${id}/heights?range=${range}`, tideHeightsResponse)
export const getTideExtremes = (id: number, range: HistoryRange) =>
  getJson(`tides/stations/${id}/extremes?range=${range}`, tideExtremesResponse)
export const getTideForecast = (id: number) => getJson(`tides/stations/${id}/forecast`, tideForecastResponse)
export const getNearestStation = (lat: number, lon: number) =>
  getJson(`stations/nearest?lat=${roundCoord(lat)}&lon=${roundCoord(lon)}`, nearestStationResponse)

export function shouldRetry(count: number, err: unknown): boolean {
  if (err instanceof ApiError && (err.kind === 'not_found' || err.kind === 'contract')) return false
  return count < 2
}
