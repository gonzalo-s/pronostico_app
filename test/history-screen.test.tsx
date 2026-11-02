import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { HistoryScreen } from '@/features/history/HistoryScreen'
import { stationsResponse } from '@/lib/schemas'
import { pickDefaultStation } from '@/lib/stations'
import stationsJson from './fixtures/stations.json'
import { mockFetch, renderWithProviders } from './helpers'

const list = stationsResponse.parse(stationsJson).data
const ID = pickDefaultStation(list)!.id

const row = (hour: number, temp: number | null, humidity = 50) => ({
  at: `2026-11-02T${String(hour).padStart(2, '0')}:00:00.000Z`,
  temp_c: temp, humidity_pct: humidity, pressure_hpa: 1010, wind_dir_deg: 135, wind_kmh: 12,
})
const history = (data: unknown[]) => ({
  body: { data, meta: { source: 'SMN', updated_at: '2026-11-02T20:00:00.000Z' } },
})
const key = (range: string) => `stations/${ID}/history?range=${range}`

beforeEach(() => localStorage.clear())

describe('HistoryScreen', () => {
  it('muestra el gráfico de temperatura de 24 h con mínimo, máximo y último', async () => {
    mockFetch({ stations: { body: stationsJson }, [key('24h')]: history([row(10, 12), row(14, 24), row(18, 20)]) })
    renderWithProviders(<HistoryScreen />)
    expect(
      await screen.findByRole('img', { name: 'Temperatura, últimas 24 horas: mínimo 12°, máximo 24°, último 20°' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '24 h' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Temperatura' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('cambiar de métrica redibuja con su unidad', async () => {
    mockFetch({
      stations: { body: stationsJson },
      [key('24h')]: history([row(10, 12, 40), row(14, 24, 60)]),
    })
    renderWithProviders(<HistoryScreen />)
    await screen.findByRole('img', { name: /Temperatura/ })
    await userEvent.click(screen.getByRole('button', { name: 'Humedad' }))
    expect(
      screen.getByRole('img', { name: 'Humedad, últimas 24 horas: mínimo 40 %, máximo 60 %, último 60 %' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Humedad' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('cambiar el período pide ese rango', async () => {
    const fetchMock = mockFetch({
      stations: { body: stationsJson },
      [key('24h')]: history([row(10, 12), row(14, 24)]),
      [key('7d')]: history([row(10, 5), row(14, 9)]),
    })
    renderWithProviders(<HistoryScreen />)
    await screen.findByRole('img', { name: /últimas 24 horas/ })
    await userEvent.click(screen.getByRole('button', { name: '7 días' }))
    expect(await screen.findByRole('img', { name: /últimos 7 días: mínimo 5°, máximo 9°/ })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(`/api/smn/${key('7d')}`)
  })

  it('sin puntos: mensaje claro', async () => {
    mockFetch({ stations: { body: stationsJson }, [key('24h')]: history([]) })
    renderWithProviders(<HistoryScreen />)
    expect(await screen.findByText('Sin datos históricos para este período')).toBeInTheDocument()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('todos los valores nulos: mismo mensaje', async () => {
    mockFetch({ stations: { body: stationsJson }, [key('24h')]: history([row(10, null), row(11, null)]) })
    renderWithProviders(<HistoryScreen />)
    expect(await screen.findByText('Sin datos históricos para este período')).toBeInTheDocument()
  })

  it('error del servicio: aviso con reintento', async () => {
    mockFetch({
      stations: { body: stationsJson },
      [key('24h')]: { status: 502, body: { error: { code: 'upstream_error', message: 'x' } } },
    })
    renderWithProviders(<HistoryScreen />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los datos')
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
  })

  it('usa la estación activa en el pedido', async () => {
    const saved = list.find((s) => s.id !== ID)!
    localStorage.setItem('pronostico:stationId', String(saved.id))
    const fetchMock = mockFetch({
      stations: { body: stationsJson },
      [`stations/${saved.id}/history?range=24h`]: history([row(10, 12), row(14, 24)]),
    })
    renderWithProviders(<HistoryScreen />)
    await screen.findByRole('img', { name: /Temperatura/ })
    expect(fetchMock).toHaveBeenCalledWith(`/api/smn/stations/${saved.id}/history?range=24h`)
    expect(fetchMock).not.toHaveBeenCalledWith(`/api/smn/${key('24h')}`)
  })
})
