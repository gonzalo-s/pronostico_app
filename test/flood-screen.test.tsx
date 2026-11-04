import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FloodScreen } from '@/features/flood/FloodScreen'
import { ZONE } from '@/lib/elnino'
import { stationsResponse } from '@/lib/schemas'
import { nearestTo } from '@/lib/stations'
import stationsJson from './fixtures/stations.json'
import { mockFetch, renderWithProviders } from './helpers'

const smn = stationsResponse.parse(stationsJson).data
const meta = { source: 'SHN', updated_at: new Date().toISOString() }
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const ahead = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()
const notFound = { status: 404, body: { error: { code: 'not_found', message: 'x' } } }

const riverStation = (id: number, name: string) => ({
  id, name, river: 'Paraná', lat: 0, lon: 0, alert_level_m: 3, evacuation_level_m: 3.5, low_water_level_m: null, has_forecast: name === 'San Fernando',
})
const riverCurrent = (id: number, name: string, over = {}) => ({
  body: {
    data: {
      id, name, river: 'Paraná', at: ago(0.5), height_m: 1.5, updated_at: ago(0.5), change_24h_m: 0.1, thresholds: null,
      level_band: 'normal', levels: { alert_m: 3, evacuation_m: 3.5, low_water_m: null }, official_level: 'normal', ...over,
    },
    meta,
  },
})

// El mock responde por ruta exacta; la estación del SMN la elige la pantalla por cercanía
const routes = (smnId: number, over: Record<string, { status?: number; body: unknown }> = {}) => ({
  stations: { body: stationsJson },
  [`stations/${smnId}/forecast`]: { body: { data: { steps: [], days: [] }, meta } },
  [`stations/${smnId}/history?range=7d`]: { body: { data: [], meta } },
  'tides/stations/2/current': {
    body: { data: { id: 2, name: 'San Fernando', at: ago(0.5), height_m: 1.2, updated_at: ago(0.5), trend: 'steady', change_m_per_hour: 0 }, meta },
  },
  'tides/stations/2/forecast': { body: { data: { valid_from: ago(3), valid_to: ahead(9), events: [] }, meta } },
  'rivers/stations': {
    body: { data: [riverStation(1, 'Rosario'), riverStation(5, 'San Fernando')], meta },
  },
  'rivers/stations/1/current': riverCurrent(1, 'Rosario'),
  'rivers/stations/5/current': riverCurrent(5, 'San Fernando'),
  'rivers/stations/5/forecast': notFound,
  ...over,
})

describe('FloodScreen', () => {
  it('sin señales: Normal, con la evidencia por fuente y el contexto de El Niño', async () => {
    const smnId = nearestTo(smn, ZONE.lat, ZONE.lon)!.id
    mockFetch(routes(smnId))
    renderWithProviders(<FloodScreen />)
    const card = await screen.findByRole('region', { name: 'Posible crecida' })
    expect(within(card).getByText('Normal')).toBeInTheDocument()
    expect(within(card).getByText('Sin señales de crecida.')).toBeInTheDocument()
    const evidence = screen.getByRole('region', { name: 'Evidencia' })
    expect(within(evidence).getByText('Marea (SHN)')).toBeInTheDocument()
    expect(within(evidence).getByText('Paraná aguas arriba (INA)')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Contexto: El Niño' })).toBeInTheDocument()
    expect(screen.getByText(/no es una alerta oficial/)).toBeInTheDocument()
  })

  it('marea alta + Paraná alto aguas arriba + sudestada: sube el nivel y lista las señales', async () => {
    const smnId = nearestTo(smn, ZONE.lat, ZONE.lon)!.id
    const step = (h: number) => ({
      locality: 'x', at: ahead(h), temp_c: 15, wind_dir_deg: 135, wind_kmh: 35, precip_mm: 15, updated_at: ago(3),
    })
    mockFetch(
      routes(smnId, {
        'tides/stations/2/current': {
          body: { data: { id: 2, name: 'San Fernando', at: ago(0.5), height_m: 2.7, updated_at: ago(0.5), trend: 'rising', change_m_per_hour: 0.1 }, meta },
        },
        'rivers/stations/1/current': riverCurrent(1, 'Rosario', { level_band: 'above_p99', height_m: 5.4 }),
        [`stations/${smnId}/forecast`]: { body: { data: { steps: [step(3), step(6), step(9), step(12)], days: [] }, meta } },
      }),
    )
    renderWithProviders(<FloodScreen />)
    const card = await screen.findByRole('region', { name: 'Posible crecida' })
    // marea 2,7 m → moderado; sudestada + lluvia + pulso del Paraná (3 agravantes) → sube un nivel
    expect(await within(card).findByText('Moderado a intenso')).toBeInTheDocument()
    expect(within(card).getByText(/Señales activas: Marea \(SHN\), Sudestada \(viento del SE\), Lluvia, Paraná aguas arriba \(INA\)\./)).toBeInTheDocument()
  })

  it('marea y río sin lecturas: "Sin datos recientes", no evalúa', async () => {
    const smnId = nearestTo(smn, ZONE.lat, ZONE.lon)!.id
    mockFetch(routes(smnId, { 'tides/stations/2/current': notFound, 'rivers/stations/5/current': notFound }))
    renderWithProviders(<FloodScreen />)
    const card = await screen.findByRole('region', { name: 'Posible crecida' })
    expect(within(card).getByText('Sin datos recientes')).toBeInTheDocument()
    expect(within(card).queryByText('Normal')).toBeNull()
  })
})
