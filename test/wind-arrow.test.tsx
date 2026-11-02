import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Wind } from '@/features/weather/Wind'
import { WindArrow } from '@/features/weather/WindArrow'
import { windDegrees } from '@/lib/format'

describe('windDegrees', () => {
  it.each([
    ['Norte', 0], ['Noreste', 45], ['Este', 90], ['Sudeste', 135],
    ['Sur', 180], ['Sudoeste', 225], ['Oeste', 270], ['Noroeste', 315],
    [' sudeste ', 135],
  ])('%s → %s', (dir, deg) => {
    expect(windDegrees(dir)).toBe(deg)
  })
  it.each(['SE', 'Variable', '', null])('%s → null', (dir) => {
    expect(windDegrees(dir)).toBeNull()
  })
})

describe('WindArrow', () => {
  it('viento del sudeste (135°) apunta al noroeste: rota 315°', () => {
    const { container } = render(<WindArrow from={135} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg?.getAttribute('style')).toContain('rotate(315deg)')
  })
  it('viento del norte apunta al sur: rota 180°', () => {
    const { container } = render(<WindArrow from={0} />)
    expect(container.querySelector('svg')?.getAttribute('style')).toContain('rotate(180deg)')
  })
  it('normaliza grados fuera de rango', () => {
    const { container } = render(<WindArrow from={450} />)
    expect(container.querySelector('svg')?.getAttribute('style')).toContain('rotate(270deg)')
  })
})

describe('Wind con flecha', () => {
  it('estado actual: deriva los grados del texto', () => {
    const { container } = render(<Wind dir="Sudeste" kmh={14} />)
    expect(container.querySelector('svg')?.getAttribute('style')).toContain('rotate(315deg)')
    expect(screen.getByText('Sudeste 14 km/h')).toBeInTheDocument()
  })
  it('pronóstico: usa los grados recibidos', () => {
    const { container } = render(<Wind dir="SE" deg={135} kmh={20} />)
    expect(container.querySelector('svg')?.getAttribute('style')).toContain('rotate(315deg)')
  })
  it('variable, sin velocidad o sin dirección: sin flecha', () => {
    expect(render(<Wind dir="Sudeste" kmh={5} variable />).container.querySelector('svg')).toBeNull()
    expect(render(<Wind dir="Sudeste" kmh={null} />).container.querySelector('svg')).toBeNull()
    expect(render(<Wind dir={null} kmh={5} />).container.querySelector('svg')).toBeNull()
  })
  it('la flecha va dentro del span rojo con viento SE', () => {
    const { container } = render(<Wind dir="Sudeste" kmh={14} />)
    expect(container.querySelector('.wind--se svg')).not.toBeNull()
  })
})
