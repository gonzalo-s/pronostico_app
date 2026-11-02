import { describe, expect, it } from 'vitest'
import { pickDefaultStation } from '@/lib/stations'
import { makeStation } from './factories'

describe('pickDefaultStation', () => {
  it('prefiere el nombre exacto "BUENOS AIRES"', () => {
    const list = [
      makeStation({ id: 2, name: 'CORDOBA AERO' }),
      makeStation({ id: 3, name: 'BUENOS AIRES AERO' }),
      makeStation({ id: 4, name: 'BUENOS AIRES' }),
    ]
    expect(pickDefaultStation(list)?.id).toBe(4)
  })
  it('si no hay exacta, la primera que empieza con "BUENOS AIRES"', () => {
    const list = [makeStation({ id: 2, name: 'CORDOBA AERO' }), makeStation({ id: 3, name: 'BUENOS AIRES AERO' })]
    expect(pickDefaultStation(list)?.id).toBe(3)
  })
  it('si no hay ninguna, la primera de la lista', () => {
    expect(pickDefaultStation([makeStation({ id: 9, name: 'USHUAIA AERO' })])?.id).toBe(9)
  })
  it('lista vacía → undefined', () => {
    expect(pickDefaultStation([])).toBeUndefined()
  })
})
