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
})

export const tideReadingSchema = z.object({
  at: z.string(),
  height_m: nullableNumber,
})

export const errorSchema =z.object({
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

export type Station = z.infer<typeof stationSchema>
export type Current = z.infer<typeof currentSchema>
export type ForecastStep = z.infer<typeof forecastStepSchema>
export type ForecastDay = z.infer<typeof forecastDaySchema>
export type HistoryPoint = z.infer<typeof historyPointSchema>
export type TideCurrent = z.infer<typeof tideCurrentSchema>
export type TideReading = z.infer<typeof tideReadingSchema>
export type StationsResponse= z.infer<typeof stationsResponse>
export type CurrentResponse = z.infer<typeof currentResponse>
export type ForecastResponse = z.infer<typeof forecastResponse>
