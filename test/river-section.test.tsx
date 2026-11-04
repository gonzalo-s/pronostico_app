import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RiverSection } from '@/features/river/RiverSection'
import { formatDateTime } from '@/lib/format'
import { mockFetch, renderWithProviders } from './helpers'

const meta = { source: 'INA', updated_at: '2026-11-04T18:00:00.000Z', note: 'Alturas sobre el cero de la escala.' }
const NOW = new Date('2026-11-04T18:30:00.000Z')
const at = (h: number) => `2026-11-04T${String(h).padStart(2, '0')}:00:00.000Z`
const station = (over = {}) => ({
  id: 5, name: 'San Fernando', river: 'Luján', lat: -34.4, lon: -58.5,
  alert_level_m: 3, evacuation_level_m: 3.5, low_water_level_m: 0.3, has_forecast: true, ...over,
})
const stations = (list: unknown[]) => ({ body: { data: list, meta } })
const currentData = {
  id: 5, name: 'San Fernando', river: 'Luján', at: at(18), height_m: 3.12, updated_at: at(18),
  change_24h_m: 0.25, thresholds: { date: '2026-11-04', p90_m: 1.9, p99_m: 2.6 }, level_band: 'above_p99',
  levels: { alert_m: 3, evacuation_m: 3.5, low_water_m: 0.3 }, official_level: 'alert',
}
const current = (over = {}) => ({ body: { data: { ...currentData, ...over }, meta } })
const pt = (h: number, main: number) => ({
  at: at(h), main_m: main, p05_m: main - 0.22, p25_m: main - 0.09, p75_m: main + 0.1, p95_m: main + 0.23,
})
const forecast = (points: unknown[]) => ({
  body: { data: { issued_at: at(3), model: 'marea_rdp_regre', levels: { alert_m: 3, evacuation_m: 3.5, low_water_m: 0.3 }, points }, meta },
})
const heights = { body: { data: [{ at: at(10), height_m: 2.4 }, { at: at(14), height_m: 2.9 }], meta } }
const notFound = { status: 404, body: { error: { code: 'not_found', message: 'x' } } }

const routes = (over: Record<string, { status?: number; body: unknown }> = {}) => ({
  'rivers/stations': stations([station()]),
  'rivers/stations/5/current': current(),
  'rivers/stations/5/forecast': forecast([pt(10, 2.4), pt(18, 2.6), pt(22, 2.9)]),
  'rivers/stations/5/heights?range=48h': heights,
  ...over,
})

describe('RiverSection', () => {
  it('muestra altura, estado oficial, cambio en 24 h, contexto histórico y la hora de la lectura', async () => {
    mockFetch(routes())
    renderWithProviders(<RiverSection now={NOW} />)
    const card = await screen.findByRole('region', { name: 'Río en San Fernando' })
    expect(await within(card).findByText('3,12 m')).toBeInTheDocument()
    expect(within(card).getByText('Sobre el nivel de alerta')).toBeInTheDocument()
    expect(within(card).getByText('+0,25 m en 24 h')).toBeInTheDocument()
    expect(within(card).getByText('Más alto que el 99 % de lo registrado en esta fecha')).toBeInTheDocument()
    expect(within(card).getByText(new RegExp(`lectura del ${formatDateTime(at(18))}`))).toBeInTheDocument()
    expect(within(card).getByText('Alturas sobre el cero de la escala.')).toBeInTheDocument()
  })

  it('el contexto histórico no usa colores de alerta', async () => {
    mockFetch(routes())
    renderWithProviders(<RiverSection now={NOW} />)
    const card = await screen.findByRole('region', { name: 'Río en San Fernando' })
    const band = await within(card).findByText(/Más alto que el 99 %/)
    expect(band.className).toBe('muted')
  })

  it('official_level unknown, cambio null y banda unknown: no muestra estado ni esos datos', async () => {
    mockFetch(routes({ 'rivers/stations/5/current': current({ official_level: 'unknown', change_24h_m: null, level_band: 'unknown', levels: null }) }))
    renderWithProviders(<RiverSection now={NOW} />)
    const card = await screen.findByRole('region', { name: 'Río en San Fernando' })
    await within(card).findByText('3,12 m')
    expect(document.querySelector('.river-status')).toBeNull()
    expect(within(card).queryByText(/en 24 h/)).toBeNull()
    expect(within(card).queryByText(/registrado en esta fecha|habitual/)).toBeNull()
  })

  it.each([
    ['evacuation', 'Sobre el nivel de evacuación'],
    ['normal', 'Por debajo del nivel de alerta'],
    ['low_water', 'Aguas bajas'],
  ])('estado oficial %s', async (level, text) => {
    mockFetch(routes({ 'rivers/stations/5/current': current({ official_level: level }) }))
    renderWithProviders(<RiverSection now={NOW} />)
    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  it('sin has_forecast no pide ni muestra el pronóstico', async () => {
    const fetchMock = mockFetch(routes({ 'rivers/stations': stations([station({ has_forecast: false })]) }))
    renderWithProviders(<RiverSection now={NOW} />)
    await screen.findByText('3,12 m')
    expect(screen.queryByRole('region', { name: 'Pronóstico del río' })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/smn/rivers/stations/5/forecast')
  })

  it('dibuja el pronóstico con banda del modelo, emisión en hora argentina y leyenda', async () => {
    mockFetch(routes())
    renderWithProviders(<RiverSection now={NOW} />)
    const card = await screen.findByRole('region', { name: 'Pronóstico del río' })
    expect(await within(card).findByRole('img', { name: /Pronóstico del río en San Fernando: máximo previsto 2,90 m/ })).toBeInTheDocument()
    expect(within(card).getByText(`Pronóstico emitido el ${formatDateTime(at(3))}. A más días, mayor incertidumbre.`)).toBeInTheDocument()
    expect(within(card).getByText('Banda del modelo')).toBeInTheDocument()
    expect(card.textContent).not.toMatch(/confianza|percentil|probabilidad/i)
    expect(document.querySelectorAll('.river-reading')).toHaveLength(2)
    expect(document.querySelectorAll('.river-level--alert, .river-level--evacuation')).toHaveLength(2)
  })

  it('avisa con la banda alta cuando llega al nivel de alerta', async () => {
    mockFetch(routes())
    renderWithProviders(<RiverSection now={NOW} />)
    // main 2,9 + 0,23 = 3,13 ≥ 3,0 a las 22
    expect(await screen.findByRole('status')).toHaveTextContent(
      `La banda alta del modelo llega al nivel de alerta (3,00 m) el ${formatDateTime(at(22))}.`,
    )
  })

  it('sin aviso si la banda alta no llega a los niveles', async () => {
    mockFetch(routes({ 'rivers/stations/5/forecast': forecast([pt(10, 1.2), pt(22, 1.4)]) }))
    renderWithProviders(<RiverSection now={NOW} />)
    await screen.findByRole('img', { name: /Pronóstico del río/ })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('al tocar el gráfico muestra el valor previsto con su banda o la lectura real', async () => {
    mockFetch(routes())
    renderWithProviders(<RiverSection now={NOW} />)
    const chart = await screen.findByRole('img', { name: /Pronóstico del río/ })
    chart.getBoundingClientRect = () => ({ left: 0, width: 340 }) as DOMRect
    fireEvent.pointerDown(chart, { clientX: 340 })
    expect(document.querySelector('.chart__readout')).toHaveTextContent(
      `Previsto 2,90 m (banda 2,68 m a 3,13 m) · ${formatDateTime(at(22))}`,
    )
    fireEvent.pointerDown(chart, { clientX: 0 })
    expect(document.querySelector('.chart__readout')).toHaveTextContent(`Lectura 2,40 m · ${formatDateTime(at(10))}`)
  })

  it('forecast 404: oculta la sección sin mostrar error', async () => {
    mockFetch(routes({ 'rivers/stations/5/forecast': notFound }))
    renderWithProviders(<RiverSection now={NOW} />)
    await screen.findByText('3,12 m')
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('region', { name: 'Pronóstico del río' })).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('current 404: "Sin lecturas"', async () => {
    mockFetch(routes({ 'rivers/stations/5/current': notFound }))
    renderWithProviders(<RiverSection now={NOW} />)
    expect(await screen.findByText('Sin lecturas')).toBeInTheDocument()
  })

  it('si no hay estación San Fernando no muestra nada', async () => {
    const fetchMock = mockFetch(routes({ 'rivers/stations': stations([station({ name: 'Rosario', id: 1 })]) }))
    const { container } = renderWithProviders(<RiverSection now={NOW} />)
    await new Promise((r) => setTimeout(r, 50))
    expect(container).toBeEmptyDOMElement()
    expect(fetchMock).not.toHaveBeenCalledWith('/api/smn/rivers/stations/1/current')
  })

  it('error del listado: aviso con reintento', async () => {
    mockFetch(routes({ 'rivers/stations': { status: 502, body: { error: { code: 'upstream_error', message: 'x' } } } }))
    renderWithProviders(<RiverSection now={NOW} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los datos')
  })
})
