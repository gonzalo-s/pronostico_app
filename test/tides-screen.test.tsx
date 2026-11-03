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
const current = {
  body: { data: { id: 2, name: 'San Fernando', at: '2026-11-02T18:00:00.000Z', height_m: 1.23, updated_at: meta.updated_at }, meta },
}
const heights = (data: unknown[]) => ({ body: { data, meta } })

describe('TidesScreen', () => {
  it('muestra la marea actual y el gráfico de 24 h con mínima, máxima y última', async () => {
    mockFetch({
      'tides/stations/2/current': current,
      'tides/stations/2/heights?range=24h': heights([reading(10, 0.4), reading(14, 1.8), reading(18, 1.23)]),
    })
    renderWithProviders(<TidesScreen />)
    const now = screen.getByRole('region', { name: 'Marea ahora' })
    expect(await within(now).findByText('1,23 m')).toBeInTheDocument()
    expect(screen.getByText(`Última lectura: ${formatDateTime('2026-11-02T18:00:00.000Z')}`)).toBeInTheDocument()
    expect(
      await screen.findByRole('img', { name: 'Altura de marea, últimas 24 horas: mínimo 0,40 m, máximo 1,80 m, último 1,23 m' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Referencia para Tigre, San Fernando y Victoria')).toBeInTheDocument()
  })

  it('al tocar el gráfico muestra la altura y la hora del punto más cercano', async () => {
    mockFetch({
      'tides/stations/2/current': current,
      'tides/stations/2/heights?range=24h': heights([reading(10, 0.4), reading(14, 2.6), reading(18, 1.2)]),
    })
    renderWithProviders(<TidesScreen />)
    const chart = await screen.findByRole('img', { name: /Altura de marea/ })
    expect(screen.getByText(/Tocá o deslizá/)).toBeInTheDocument()
    // jsdom no calcula layout: el ancho 0 hace que toda la x caiga en el primer punto
    chart.getBoundingClientRect = () => ({ left: 0, width: 340 }) as DOMRect
    fireEvent.pointerDown(chart, { clientX: 340 })
    expect(document.querySelector('.chart__readout')).toHaveTextContent(`1,20 m · ${formatDateTime('2026-11-02T18:00:00.000Z')}`)
  })

  it('cambiar el período pide ese rango', async () => {
    const fetchMock = mockFetch({
      'tides/stations/2/current': current,
      'tides/stations/2/heights?range=24h': heights([reading(10, 0.4), reading(14, 1.8)]),
      'tides/stations/2/heights?range=7d': heights([reading(10, 0.1), reading(14, 2.1)]),
    })
    renderWithProviders(<TidesScreen />)
    await screen.findByRole('img', { name: /últimas 24 horas/ })
    await userEvent.click(screen.getByRole('button', { name: '7 días' }))
    expect(await screen.findByRole('img', { name: /últimos 7 días: mínimo 0,10 m, máximo 2,10 m/ })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/smn/tides/stations/2/heights?range=7d')
  })

  it('sin lecturas: mensaje claro', async () => {
    mockFetch({ 'tides/stations/2/current': current, 'tides/stations/2/heights?range=24h': heights([reading(10, null)]) })
    renderWithProviders(<TidesScreen />)
    expect(await screen.findByText('Sin lecturas de marea para este período')).toBeInTheDocument()
  })

  it('error del servicio en las alturas: aviso con reintento', async () => {
    mockFetch({
      'tides/stations/2/current': current,
      'tides/stations/2/heights?range=24h': { status: 502, body: { error: { code: 'upstream_error', message: 'x' } } },
    })
    renderWithProviders(<TidesScreen />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los datos')
  })
})
