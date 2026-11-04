import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TidesScreen } from '@/features/tides/TidesScreen'
import { formatDateTime } from '@/lib/format'
import { mockFetch, renderWithProviders } from './helpers'

const meta = { source: 'SHN', updated_at: new Date().toISOString() }
const reading = (hour: number, height: number | null) => ({
  at: `2026-11-02T${String(hour).padStart(2, '0')}:00:00.000Z`,
  height_m: height,
})
const currentData = {
  id: 2, name: 'San Fernando', at: '2026-11-02T18:00:00.000Z', height_m: 1.23, updated_at: meta.updated_at,
  trend: 'rising', change_m_per_hour: 0.12,
}
const current = { body: { data: currentData, meta } }
const heights = (data: unknown[]) => ({ body: { data, meta } })
const events = [
  { kind: 'high', at: '2026-11-02T21:00:00.000Z', height_m: 2.6 },
  { kind: 'low', at: '2026-11-03T03:00:00.000Z', height_m: 0.3 },
]
const forecast = { body: { data: { valid_from: '2026-11-02T15:00:00.000Z', valid_to: '2026-11-03T03:00:00.000Z', events }, meta } }
const noForecast = { status: 404, body: { error: { code: 'not_found', message: 'x' } } }

// Rutas que toda pantalla pide; cada test pisa las que le interesan
const routes = (over: Record<string, { status?: number; body: unknown }> = {}) => ({
  'tides/stations/2/current': current,
  'tides/stations/2/heights?range=24h': heights([reading(10, 0.4), reading(14, 1.8), reading(18, 1.23)]),
  'tides/stations/2/extremes?range=24h': { body: { data: [], meta } },
  'tides/stations/2/forecast': noForecast,
  'rivers/stations': { body: { data: [], meta } },
  ...over,
})

describe('TidesScreen', () => {
  it('muestra la marea actual y el gráfico de 24 h con mínima, máxima y última', async () => {
    mockFetch(routes())
    renderWithProviders(<TidesScreen />)
    const now = screen.getByRole('region', { name: 'Marea ahora' })
    expect(await within(now).findByText('1,23 m')).toBeInTheDocument()
    expect(screen.getByText(`Última lectura: ${formatDateTime('2026-11-02T18:00:00.000Z')}`)).toBeInTheDocument()
    expect(
      await screen.findByRole('img', { name: 'Altura de marea, últimas 24 horas: mínimo 0,40 m, máximo 1,80 m, último 1,23 m' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Referencia para Tigre, San Fernando y Victoria')).toBeInTheDocument()
  })

  it.each([
    ['rising', 0.12, 'Subiendo · +0,12 m/h'],
    ['falling', -0.08, 'Bajando · −0,08 m/h'],
    ['steady', 0.01, 'Estable · +0,01 m/h'],
  ])('muestra la tendencia %s', async (trend, change, text) => {
    mockFetch(routes({ 'tides/stations/2/current': { body: { data: { ...currentData, trend, change_m_per_hour: change }, meta } } }))
    renderWithProviders(<TidesScreen />)
    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  it('tendencia desconocida: no muestra nada de tendencia', async () => {
    mockFetch(routes({ 'tides/stations/2/current': { body: { data: { ...currentData, trend: 'unknown', change_m_per_hour: null }, meta } } }))
    renderWithProviders(<TidesScreen />)
    const now = screen.getByRole('region', { name: 'Marea ahora' })
    await within(now).findByText('1,23 m')
    expect(document.querySelector('.tide-trend')).toBeNull()
  })

  it('al tocar el gráfico muestra la altura y la hora del punto más cercano', async () => {
    mockFetch(routes({ 'tides/stations/2/heights?range=24h': heights([reading(10, 0.4), reading(14, 2.6), reading(18, 1.2)]) }))
    renderWithProviders(<TidesScreen />)
    const chart = await screen.findByRole('img', { name: /Altura de marea/ })
    expect(screen.getByText(/Tocá o deslizá/)).toBeInTheDocument()
    // jsdom no calcula layout: el ancho 0 hace que toda la x caiga en el primer punto
    chart.getBoundingClientRect = () => ({ left: 0, width: 340 }) as DOMRect
    fireEvent.pointerDown(chart, { clientX: 340 })
    expect(document.querySelector('.chart__readout')).toHaveTextContent(`1,20 m · ${formatDateTime('2026-11-02T18:00:00.000Z')}`)
  })

  it('cambiar el período pide ese rango (alturas y extremos)', async () => {
    const fetchMock = mockFetch(
      routes({
        'tides/stations/2/heights?range=7d': heights([reading(10, 0.1), reading(14, 2.1)]),
        'tides/stations/2/extremes?range=7d': { body: { data: [], meta } },
      }),
    )
    renderWithProviders(<TidesScreen />)
    await screen.findByRole('img', { name: /últimas 24 horas/ })
    await userEvent.click(screen.getByRole('button', { name: '7 días' }))
    expect(await screen.findByRole('img', { name: /últimos 7 días: mínimo 0,10 m, máximo 2,10 m/ })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/smn/tides/stations/2/heights?range=7d')
    expect(fetchMock).toHaveBeenCalledWith('/api/smn/tides/stations/2/extremes?range=7d')
  })

  it('lista el pronóstico de pleamares y bajamares con la validez de la emisión', async () => {
    mockFetch(routes({ 'tides/stations/2/forecast': forecast }))
    renderWithProviders(<TidesScreen />)
    const card = screen.getByRole('region', { name: 'Próximas pleamares y bajamares' })
    expect(await within(card).findByText('Pleamar')).toBeInTheDocument()
    expect(within(card).getByText('2,60 m')).toBeInTheDocument()
    expect(within(card).getByText('Bajamar')).toBeInTheDocument()
    expect(within(card).getByText('0,30 m')).toBeInTheDocument()
    expect(within(card).getByText(`Emisión válida hasta ${formatDateTime('2026-11-03T03:00:00.000Z')}`)).toBeInTheDocument()
  })

  it('404 del pronóstico es "sin pronóstico", no un error', async () => {
    mockFetch(routes())
    renderWithProviders(<TidesScreen />)
    expect(await screen.findByText('Sin pronóstico para este mareógrafo')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('lista las pleamares y bajamares observadas, la más reciente primero y hasta 6', async () => {
    const observed = Array.from({ length: 8 }, (_, i) => ({
      kind: i % 2 === 0 ? 'high' : 'low',
      at: `2026-11-02T${String(i * 3).padStart(2, '0')}:00:00.000Z`,
      height_m: i % 2 === 0 ? 2.1 : 0.5,
    }))
    mockFetch(routes({ 'tides/stations/2/extremes?range=24h': { body: { data: observed, meta } } }))
    renderWithProviders(<TidesScreen />)
    const items = await screen.findAllByRole('listitem')
    const rows = items.filter((li) => li.closest('.tide-events') && li.closest('section')?.getAttribute('aria-labelledby') === 'tide-chart-title')
    expect(rows).toHaveLength(6)
    expect(rows[0]).toHaveTextContent(`Bajamar0,50 m${formatDateTime('2026-11-02T21:00:00.000Z')}`)
  })

  it('sin lecturas: mensaje claro', async () => {
    mockFetch(routes({ 'tides/stations/2/heights?range=24h': heights([reading(10, null)]) }))
    renderWithProviders(<TidesScreen />)
    expect(await screen.findByText('Sin lecturas de marea para este período')).toBeInTheDocument()
  })

  it('error del servicio en las alturas: aviso con reintento', async () => {
    mockFetch(
      routes({ 'tides/stations/2/heights?range=24h': { status: 502, body: { error: { code: 'upstream_error', message: 'x' } } } }),
    )
    renderWithProviders(<TidesScreen />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los datos')
  })
})
