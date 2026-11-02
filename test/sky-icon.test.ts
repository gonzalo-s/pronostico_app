import { describe, expect, it } from 'vitest'
import {
  WiCloud, WiCloudy, WiDayCloudy, WiDaySunny, WiFog, WiNa, WiNightAltCloudy, WiNightClear, WiRain, WiSnow,
  WiThunderstorm,
} from 'react-icons/wi'
import { skyIcon } from '@/lib/skyIcon'

describe('skyIcon', () => {
  it.each([
    ['Despejado', true, WiDaySunny],
    ['Despejado', false, WiNightClear],
    ['Algo nublado', true, WiDayCloudy],
    ['Algo nublado', false, WiNightAltCloudy],
    ['Parcialmente nublado', true, WiDayCloudy],
    ['Parcialmente nublado', false, WiNightAltCloudy],
    ['Nublado', true, WiCloud],
    ['Cubierto', true, WiCloudy],
    ['Cubierto con neblina', true, WiFog],
    ['Cubierto con niebla', false, WiFog],
    ['Cubierto con llovizna', true, WiRain],
    ['Cubierto con tormenta', true, WiThunderstorm],
    ['Nublado con tormenta', true, WiThunderstorm],
    ['Nublado con tormenta sin precipitación', true, WiThunderstorm],
  ])('%s (día: %s)', (sky, isDay, icon) => {
    expect(skyIcon(sky, isDay)).toBe(icon)
  })

  it('"en la hora anterior" se ignora: solo cuenta el cielo base', () => {
    expect(skyIcon('Despejado con lluvia en la hora anterior', true)).toBe(WiDaySunny)
    expect(skyIcon('Nublado con nevada en la hora anterior', true)).toBe(WiCloud)
  })

  it('nevada actual → nieve', () => {
    expect(skyIcon('Cubierto con nevada', true)).toBe(WiSnow)
  })

  it('ignora mayúsculas y tildes', () => {
    expect(skyIcon('CUBIERTO CON NEBLINA', true)).toBe(WiFog)
  })

  it('texto desconocido → ícono neutro; null → null', () => {
    expect(skyIcon('Algo nuevo del SMN', true)).toBe(WiNa)
    expect(skyIcon(null, true)).toBeNull()
  })
})
