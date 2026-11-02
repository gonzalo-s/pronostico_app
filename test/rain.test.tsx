import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { WiRain, WiShowers, WiSprinkle, WiStormShowers } from 'react-icons/wi'
import { ForecastDays } from '@/features/weather/ForecastDays'
import { rainIcon, rainLevel } from '@/lib/rain'
import { makeDay, makeStep } from './factories'

describe('rainLevel por paso', () => {
  it.each([
    [0, null], [0.4, 'llovizna'], [0.5, 'debil'], [2.4, 'debil'], [2.5, 'lluvia'], [7.4, 'lluvia'], [7.5, 'fuerte'], [30, 'fuerte'],
  ])('%s mm → %s', (mm, level) => {
    expect(rainLevel(mm, 'step')).toBe(level)
  })
  it('null → null', () => {
    expect(rainLevel(null, 'step')).toBeNull()
  })
})

describe('rainLevel por día', () => {
  it.each([
    [0, null], [0.9, 'llovizna'], [1, 'debil'], [4.9, 'debil'], [5, 'lluvia'], [14.9, 'lluvia'], [15, 'fuerte'],
  ])('%s mm → %s', (mm, level) => {
    expect(rainLevel(mm, 'day')).toBe(level)
  })
})

describe('rainIcon', () => {
  it('ícono y etiqueta por nivel', () => {
    expect(rainIcon('llovizna')).toEqual({ Icon: WiSprinkle, label: 'Llovizna' })
    expect(rainIcon('debil')).toEqual({ Icon: WiShowers, label: 'Lluvia débil' })
    expect(rainIcon('lluvia')).toEqual({ Icon: WiRain, label: 'Lluvia' })
    expect(rainIcon('fuerte')).toEqual({ Icon: WiStormShowers, label: 'Lluvia fuerte' })
  })
})

describe('ForecastDays con íconos de lluvia', () => {
  const today = '2026-11-02'
  it('el día muestra la etiqueta según el total', () => {
    render(<ForecastDays days={[makeDay({ date: today, precip_mm_total: 20 })]} steps={[]} today={today} />)
    expect(screen.getByRole('button', { name: /Hoy/ })).toHaveTextContent('Lluvia prevista 20,0 mm')
    expect(screen.getByRole('img', { name: 'Lluvia fuerte' })).toBeInTheDocument()
  })
  it('sin lluvia: sin ícono', () => {
    render(<ForecastDays days={[makeDay({ date: today, precip_mm_total: 0 })]} steps={[]} today={today} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByRole('button', { name: /Hoy/ })).toHaveTextContent('Sin lluvia prevista')
  })
  it('cada paso muestra su ícono según los mm', async () => {
    render(
      <ForecastDays
        days={[makeDay({ date: today, precip_mm_total: 3 })]}
        steps={[
          makeStep({ at: '2026-11-02T18:00:00.000Z', precip_mm: 0.2 }),
          makeStep({ at: '2026-11-02T21:00:00.000Z', precip_mm: 3 }),
          makeStep({ at: '2026-11-02T23:00:00.000Z', precip_mm: 0 }),
        ]}
        today={today}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Hoy/ }))
    expect(screen.getByRole('img', { name: 'Llovizna' })).toBeInTheDocument() // paso de 0,2 mm
    expect(screen.getByRole('img', { name: 'Lluvia' })).toBeInTheDocument() // paso de 3 mm
    expect(screen.getByRole('img', { name: 'Lluvia débil' })).toBeInTheDocument() // total del día: 3 mm
    expect(screen.getAllByRole('img')).toHaveLength(3) // el paso sin lluvia no lleva ícono
  })
})
