import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StationBar } from '@/features/weather/StationBar'
import { makeStation } from './factories'
import { mockFetch, renderWithProviders } from './helpers'

const stations = [
  makeStation({ id: 1, name: 'BUENOS AIRES', province: 'CAPITAL FEDERAL', altitude_m: 25 }),
  makeStation({ id: 7, name: 'AEROPARQUE AERO', province: 'CAPITAL FEDERAL', altitude_m: null }),
]

function stubGeolocation(getCurrentPosition: unknown) {
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation')
})

describe('StationBar', () => {
  it('muestra provincia y altitud bajo el nombre', () => {
    renderWithProviders(<StationBar stations={stations} station={stations[0]} />)
    expect(screen.getByText('Buenos Aires', { selector: '.station-btn__name' })).toBeInTheDocument()
    expect(screen.getByText('Capital Federal · 25 m s. n. m.')).toBeInTheDocument()
  })
  it('sin altitud solo muestra la provincia', () => {
    renderWithProviders(<StationBar stations={stations} station={stations[1]} />)
    expect(screen.getByText('Capital Federal')).toBeInTheDocument()
  })
  it('sin estaciones: botón deshabilitado y "Cargando…"', () => {
    renderWithProviders(<StationBar stations={undefined} station={undefined} />)
    expect(screen.getByRole('button', { name: /Cargando/ })).toBeDisabled()
  })
  it('sin ubicación no muestra la distancia', () => {
    renderWithProviders(<StationBar stations={stations} station={stations[0]} />)
    expect(screen.queryByText(/de vos/)).toBeNull()
  })
  it('tras usar la ubicación muestra la distancia y la borra al elegir a mano', async () => {
    stubGeolocation((ok: (p: unknown) => void) => ok({ coords: { latitude: -34.6037, longitude: -58.3816 } }))
    mockFetch({
      'stations/nearest?lat=-34.6&lon=-58.38': {
        body: { data: { ...stations[1], distance_km: 3.2 }, meta: { source: 'SMN', updated_at: null } },
      },
    })
    renderWithProviders(<StationBar stations={stations} station={stations[0]} />)
    await userEvent.click(screen.getByRole('button', { name: /Buenos Aires/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    expect(await screen.findByText('A 3,2 km de vos')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Buenos Aires/ }))
    await userEvent.click(screen.getByRole('button', { name: /Aeroparque/ }))
    expect(screen.queryByText(/de vos/)).toBeNull()
  })
})
