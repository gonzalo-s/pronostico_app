import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WeatherScreen } from '@/features/weather/WeatherScreen'
import { titleCase } from '@/lib/format'
import { stationsResponse } from '@/lib/schemas'
import { pickDefaultStation } from '@/lib/stations'
import current from './fixtures/current.json'
import forecast from './fixtures/forecast.json'
import stationsJson from './fixtures/stations.json'
import { mockFetch, renderWithProviders } from './helpers'

const list = stationsResponse.parse(stationsJson).data
const defaultStation = pickDefaultStation(list)!
const NOTE = 'Pronóstico basado en un modelo numérico; puede diferir del pronóstico oficial del SMN.'

type Route = { status?: number; body: unknown }
function routes(over: Record<string, Route> = {}): Record<string, Route> {
  const base: Record<string, Route> = { stations: { body: stationsJson } }
  for (const s of list) {
    base[`stations/${s.id}/current`] = { body: current }
    base[`stations/${s.id}/forecast`] = { body: forecast }
  }
  return { ...base, ...over }
}
const headerName = (name: string) => screen.findByText(titleCase(name), { selector: '.station-btn__name' })

beforeEach(() => localStorage.clear())

describe('WeatherScreen', () => {
  it('muestra la estación por defecto con condiciones, pronóstico y nota', async () => {
    mockFetch(routes())
    renderWithProviders(<WeatherScreen />)
    expect(await headerName(defaultStation.name)).toBeInTheDocument()
    expect(await screen.findByText('Ahora')).toBeInTheDocument()
    expect(await screen.findByText('Próximos días')).toBeInTheDocument()
    expect(screen.getByText(NOTE)).toBeInTheDocument()
    expect(screen.getByText(/Fuente: SMN/)).toBeInTheDocument()
  })

  it('usa la estación guardada en el dispositivo', async () => {
    const saved = list.find((s) => s.id !== defaultStation.id)!
    localStorage.setItem('pronostico:stationId', String(saved.id))
    const fetchMock = mockFetch(routes())
    renderWithProviders(<WeatherScreen />)
    expect(await headerName(saved.name)).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/smn/stations/${saved.id}/current`))
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/smn/stations/${defaultStation.id}/current`)
  })

  it('404 en condiciones: mensaje claro y el pronóstico sigue visible', async () => {
    mockFetch(routes({ [`stations/${defaultStation.id}/current`]: { status: 404, body: { error: { code: 'not_found', message: 'x' } } } }))
    renderWithProviders(<WeatherScreen />)
    expect(await screen.findByText('Sin datos para esta estación')).toBeInTheDocument()
    expect(await screen.findByText('Próximos días')).toBeInTheDocument()
  })

  it('datos con más de 6 h → aviso de desactualizados', async () => {
    const stale = { ...current, meta: { ...current.meta, updated_at: '2020-01-01T00:00:00.000Z' } }
    mockFetch(routes({ [`stations/${defaultStation.id}/current`]: { body: stale } }))
    renderWithProviders(<WeatherScreen />)
    expect(await screen.findByText('Datos desactualizados')).toBeInTheDocument()
  })

  it('datos frescos → sin aviso de desactualizados', async () => {
    const fresh = new Date().toISOString()
    mockFetch(
      routes({
        [`stations/${defaultStation.id}/current`]: { body: { ...current, meta: { ...current.meta, updated_at: fresh } } },
        [`stations/${defaultStation.id}/forecast`]: { body: { ...forecast, meta: { ...forecast.meta, updated_at: fresh } } },
      }),
    )
    renderWithProviders(<WeatherScreen />)
    expect(await screen.findByText('Próximos días')).toBeInTheDocument()
    expect(await screen.findByText('Ahora')).toBeInTheDocument()
    expect(screen.queryByText('Datos desactualizados')).toBeNull()
  })

  it('solo el pronóstico viejo → aviso de desactualizados', async () => {
    const fresh = new Date().toISOString()
    mockFetch(
      routes({
        [`stations/${defaultStation.id}/current`]: { body: { ...current, meta: { ...current.meta, updated_at: fresh } } },
        [`stations/${defaultStation.id}/forecast`]: { body: { ...forecast, meta: { ...forecast.meta, updated_at: '2020-01-01T00:00:00.000Z' } } },
      }),
    )
    renderWithProviders(<WeatherScreen />)
    expect(await screen.findByText('Datos desactualizados')).toBeInTheDocument()
    expect(await screen.findByText('Próximos días')).toBeInTheDocument()
    expect(await screen.findByText('Ahora')).toBeInTheDocument()
  })

  it('respuesta fuera de contrato → "Respuesta inesperada de la API"', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockFetch(routes({ [`stations/${defaultStation.id}/forecast`]: { body: { data: {}, meta: {} } } }))
    renderWithProviders(<WeatherScreen />)
    expect(await screen.findByText('Respuesta inesperada de la API')).toBeInTheDocument()
    expect(screen.queryByText('Próximos días')).not.toBeInTheDocument()
  })

  it('error de servicio: banner con Reintentar', async () => {
    mockFetch(routes({ [`stations/${defaultStation.id}/current`]: { status: 502, body: {} } }))
    renderWithProviders(<WeatherScreen />)
    expect(await screen.findByText('No se pudieron cargar los datos')).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Reintentar' })
    const second = mockFetch(routes())
    await userEvent.click(retry)
    await waitFor(() => expect(second).toHaveBeenCalledWith(`/api/smn/stations/${defaultStation.id}/current`))
    expect(await screen.findByText('Ahora')).toBeInTheDocument()
    expect(screen.queryByText('No se pudieron cargar los datos')).toBeNull()
  })

  it('cambiar de estación pide sus datos y la recuerda', async () => {
    const other = list.find((s) => s.id !== defaultStation.id)!
    const fetchMock = mockFetch(routes())
    renderWithProviders(<WeatherScreen />)
    await headerName(defaultStation.name)
    await userEvent.click(document.querySelector('.station-btn') as HTMLElement)
    const dialog = await screen.findByRole('dialog')
    const option = within(dialog)
      .getAllByRole('button')
      .find((b) => b.querySelector('.station__name')?.textContent === titleCase(other.name))!
    await userEvent.click(option)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(`/api/smn/stations/${other.id}/current`))
    expect(localStorage.getItem('pronostico:stationId')).toBe(String(other.id))
    expect(await headerName(other.name)).toBeInTheDocument()
  })
})
