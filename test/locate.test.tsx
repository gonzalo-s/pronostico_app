import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StationPicker } from '@/features/weather/StationPicker'
import { geoErrorMessage } from '@/features/weather/errorMessage'
import { GeoError } from '@/lib/geolocation'
import { makeStation } from './factories'
import { mockFetch } from './helpers'

const NEAREST_ROUTE = 'stations/nearest?lat=-34.6&lon=-58.38'
const nearestBody = {
  data: { ...makeStation({ id: 7, name: 'AEROPARQUE AERO' }), distance_km: 3.2 },
  meta: { source: 'SMN', updated_at: null },
}

function stubGeolocation(getCurrentPosition: unknown) {
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
}
const position = (ok: (p: unknown) => void) => ok({ coords: { latitude: -34.6037, longitude: -58.3816 } })

afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation')
})

function setup() {
  const props = {
    open: true,
    stations: [makeStation({ id: 1 }), makeStation({ id: 7, name: 'AEROPARQUE AERO' })],
    selectedId: 1,
    onSelect: vi.fn(),
    onClose: vi.fn(),
  }
  render(<StationPicker {...props} />)
  return props
}

describe('StationPicker: usar mi ubicación', () => {
  it('sin geolocalización en el navegador no muestra el botón', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Usar mi ubicación' })).toBeNull()
  })

  it('no pide la ubicación hasta que se toca el botón', () => {
    const spy = vi.fn()
    stubGeolocation(spy)
    setup()
    expect(spy).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Usar mi ubicación' })).toBeEnabled()
  })

  it('éxito: selecciona la estación más cercana y cierra', async () => {
    stubGeolocation(position)
    mockFetch({ [NEAREST_ROUTE]: { body: nearestBody } })
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    await vi.waitFor(() => expect(props.onSelect).toHaveBeenCalledWith(7, 3.2))
    expect(props.onClose).toHaveBeenCalled()
  })

  it('mientras busca muestra "Buscando…" y deshabilita el botón', async () => {
    stubGeolocation(() => {})
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    expect(screen.getByRole('button', { name: 'Buscando…' })).toBeDisabled()
    expect(props.onSelect).not.toHaveBeenCalled()
  })

  it('permiso denegado: mensaje y la estación no cambia', async () => {
    stubGeolocation((_ok: unknown, fail: (e: unknown) => void) => fail({ code: 1 }))
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos acceder a tu ubicación. Elegí una estación de la lista.',
    )
    expect(props.onSelect).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Usar mi ubicación' })).toBeEnabled()
  })

  it('timeout: mensaje de reintento', async () => {
    stubGeolocation((_ok: unknown, fail: (e: unknown) => void) => fail({ code: 3 }))
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo obtener tu ubicación. Probá de nuevo.')
  })

  it('API caída: mensaje genérico y la estación no cambia', async () => {
    stubGeolocation(position)
    mockFetch({ [NEAREST_ROUTE]: { status: 502, body: { error: { code: 'upstream_error', message: 'x' } } } })
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los datos')
    expect(props.onSelect).not.toHaveBeenCalled()
  })
})

describe('geoErrorMessage', () => {
  it('mapea cada tipo de GeoError y delega el resto', () => {
    expect(geoErrorMessage(new GeoError('denied'))).toMatch(/No pudimos acceder/)
    expect(geoErrorMessage(new GeoError('unavailable'))).toMatch(/Probá de nuevo/)
    expect(geoErrorMessage(new GeoError('timeout'))).toMatch(/Probá de nuevo/)
    expect(geoErrorMessage(new Error('x'))).toBe('No se pudieron cargar los datos')
  })
})
