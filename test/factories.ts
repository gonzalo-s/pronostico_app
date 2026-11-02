import type { Current, ForecastDay, ForecastStep, Station } from '@/lib/schemas'

export const makeStation = (o: Partial<Station> = {}): Station => ({
  id: 1, name: 'BUENOS AIRES', province: 'CAPITAL FEDERAL', lat: -34.58, lon: -58.48, altitude_m: 25, ...o,
})

export const makeCurrent = (o: Partial<Current> = {}): Current => ({
  id: 1, name: 'BUENOS AIRES', province: 'CAPITAL FEDERAL',
  observed_at: '2026-11-02T17:30:00.000Z', sky: 'Despejado', visibility_km: 10,
  temp_c: 22.4, feels_like_c: 27.8, humidity_pct: 58, wind_dir: 'Norte', wind_kmh: 14,
  wind_variable: false, pressure_hpa: 1013.2, updated_at: '2026-11-02T17:35:00.000Z', ...o,
})

export const makeStep = (o: Partial<ForecastStep> = {}): ForecastStep => ({
  locality: 'BUENOS AIRES', at: '2026-11-02T18:00:00.000Z', temp_c: 20, wind_dir_deg: 90,
  wind_kmh: 10, precip_mm: 0, updated_at: '2026-11-02T12:00:00.000Z', ...o,
})

export const makeDay = (o: Partial<ForecastDay> = {}): ForecastDay => ({
  date: '2026-11-02', temp_min_c: 15, temp_max_c: 24, precip_mm_total: 0, ...o,
})
