import { z } from 'zod'

const meta = z.object({
  source: z.string(),
  updated_at: z.string().nullable(),
  note: z.string().optional(),
})

function envelope<T extends z.ZodType>(data: T) {
  return z.object({ data, meta })
}

const nullableNumber = z.number().nullable()

export const stationSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  province: z.string(),
  lat: z.number(),
  lon: z.number(),
  altitude_m: nullableNumber,
})

export const currentSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  province: z.string(),
  observed_at: z.string(),
  sky: z.string().nullable(),
  visibility_km: nullableNumber,
  temp_c: nullableNumber,
  feels_like_c: nullableNumber,
  humidity_pct: nullableNumber,
  wind_dir: z.string().nullable(),
  wind_kmh: nullableNumber,
  wind_variable: z.boolean(),
  pressure_hpa: nullableNumber,
  updated_at: z.string(),
})

export const forecastStepSchema = z.object({
  locality: z.string(),
  at: z.string(),
  temp_c: nullableNumber,
  wind_dir_deg: nullableNumber,
  wind_kmh: nullableNumber,
  precip_mm: nullableNumber,
  updated_at: z.string(),
})

export const forecastDaySchema = z.object({
  date: z.string(),
  temp_min_c: nullableNumber,
  temp_max_c: nullableNumber,
  precip_mm_total: z.number(),
})

export const historyPointSchema = z.object({
  at: z.string(),
  temp_c: nullableNumber,
  humidity_pct: nullableNumber,
  pressure_hpa: nullableNumber,
  wind_dir_deg: nullableNumber,
  wind_kmh: nullableNumber,
})

export const tideCurrentSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  at: z.string(),
  height_m: z.number(),
  updated_at: z.string(),
  trend: z.enum(['rising', 'falling', 'steady', 'unknown']),
  change_m_per_hour: nullableNumber,
})

export const tideReadingSchema = z.object({
  at: z.string(),
  height_m: nullableNumber,
})

// Pleamar (high) o bajamar (low), observada (extremes) o prevista (forecast)
export const tideEventSchema = z.object({
  kind: z.enum(['high', 'low']),
  at: z.string(),
  height_m: z.number(),
})

export const tideForecastSchema = z.object({
  valid_from: z.string(),
  valid_to: z.string().nullable(),
  events: z.array(tideEventSchema),
})

const riverLevelsSchema = z.object({
  alert_m: nullableNumber,
  evacuation_m: nullableNumber,
  low_water_m: nullableNumber,
})

export const riverStationSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  river: z.string(),
  lat: z.number(),
  lon: z.number(),
  alert_level_m: nullableNumber,
  evacuation_level_m: nullableNumber,
  low_water_level_m: nullableNumber,
  has_forecast: z.boolean(),
})

export const riverCurrentSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  river: z.string(),
  at: z.string(),
  height_m: z.number(),
  updated_at: z.string(),
  change_24h_m: nullableNumber,
  thresholds: z.object({ date: z.string(), p90_m: nullableNumber, p99_m: nullableNumber }).nullable(),
  level_band: z.enum(['above_p99', 'above_p90', 'normal', 'unknown']),
  levels: riverLevelsSchema.nullable(),
  official_level: z.enum(['evacuation', 'alert', 'low_water', 'normal', 'unknown']),
})

export const riverReadingSchema = z.object({ at: z.string(), height_m: z.number() })

export const riverForecastPointSchema = z.object({
  at: z.string(),
  main_m: z.number(),
  p05_m: z.number(),
  p25_m: z.number(),
  p75_m: z.number(),
  p95_m: z.number(),
})

export const riverForecastSchema = z.object({
  issued_at: z.string(),
  model: z.string(),
  levels: riverLevelsSchema.nullable(),
  points: z.array(riverForecastPointSchema),
})

export const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
})

export const stationsResponse = envelope(z.array(stationSchema))
export const nearestStationResponse = envelope(stationSchema.extend({ distance_km: z.number() }))
export const currentResponse = envelope(currentSchema)
export const forecastResponse = envelope(
  z.object({ steps: z.array(forecastStepSchema), days: z.array(forecastDaySchema) }),
)
export const historyResponse = envelope(z.array(historyPointSchema))
export const tideCurrentResponse = envelope(tideCurrentSchema)
export const tideHeightsResponse = envelope(z.array(tideReadingSchema))
export const tideExtremesResponse = envelope(z.array(tideEventSchema))
export const tideForecastResponse = envelope(tideForecastSchema)
export const riverStationsResponse = envelope(z.array(riverStationSchema))
export const riverCurrentResponse = envelope(riverCurrentSchema)
export const riverHeightsResponse = envelope(z.array(riverReadingSchema))
export const riverForecastResponse = envelope(riverForecastSchema)

export type Station = z.infer<typeof stationSchema>
export type Current = z.infer<typeof currentSchema>
export type ForecastStep = z.infer<typeof forecastStepSchema>
export type ForecastDay = z.infer<typeof forecastDaySchema>
export type HistoryPoint = z.infer<typeof historyPointSchema>
export type TideCurrent = z.infer<typeof tideCurrentSchema>
export type TideReading = z.infer<typeof tideReadingSchema>
export type TideEvent = z.infer<typeof tideEventSchema>
export type RiverStation = z.infer<typeof riverStationSchema>
export type RiverCurrent = z.infer<typeof riverCurrentSchema>
export type RiverReading = z.infer<typeof riverReadingSchema>
export type RiverForecast = z.infer<typeof riverForecastSchema>
export type StationsResponse= z.infer<typeof stationsResponse>
export type CurrentResponse = z.infer<typeof currentResponse>
export type ForecastResponse = z.infer<typeof forecastResponse>
