import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CurrentCard } from '@/features/weather/CurrentCard'
import { ForecastDays } from '@/features/weather/ForecastDays'
import { Wind } from '@/features/weather/Wind'
import { isSoutheast } from '@/lib/format'
import { makeCurrent, makeDay, makeStep } from './factories'

describe('isSoutheast', () => {
  it.each(['Sudeste', 'sudeste', ' SE ', 'SE'])('%s → true', (dir) => {
    expect(isSoutheast(dir)).toBe(true)
  })
  it.each(['Sudoeste', 'SO', 'Sur', 'Este', 'Noreste', 'Norte', '', null])('%s → false', (dir) => {
    expect(isSoutheast(dir)).toBe(false)
  })
})

describe('Wind', () => {
  it('sudeste con velocidad → rojo, texto completo', () => {
    render(<Wind dir="Sudeste" kmh={14} />)
    const el = screen.getByText('Sudeste 14 km/h')
    expect(el).toHaveClass('wind', 'wind--se')
  })
  it('otras direcciones → sin rojo', () => {
    render(<Wind dir="Sudoeste" kmh={14} />)
    expect(screen.getByText('Sudoeste 14 km/h')).not.toHaveClass('wind--se')
  })
  it('variable → nunca rojo', () => {
    render(<Wind dir="Sudeste" kmh={5} variable />)
    expect(screen.getByText('Variable 5 km/h')).not.toHaveClass('wind--se')
  })
  it('sin velocidad → "—" y sin rojo', () => {
    render(<Wind dir="Sudeste" kmh={null} />)
    expect(screen.getByText('—')).not.toHaveClass('wind--se')
  })
})

describe('integración del viento SE', () => {
  it('CurrentCard resalta Sudeste', () => {
    render(<CurrentCard current={makeCurrent({ wind_dir: 'Sudeste', wind_kmh: 22 })} />)
    expect(screen.getByText('Sudeste 22 km/h')).toHaveClass('wind--se')
  })
  it('ForecastDays resalta SE (135°) en los pasos', async () => {
    render(
      <ForecastDays
        days={[makeDay({ date: '2026-11-02' })]}
        steps={[makeStep({ at: '2026-11-02T18:00:00.000Z', wind_dir_deg: 135, wind_kmh: 20 })]}
        today="2026-11-02"
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Hoy/ }))
    expect(screen.getByText('SE 20 km/h')).toHaveClass('wind--se')
  })
})
