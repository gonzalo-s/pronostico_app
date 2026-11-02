import type { IconType } from 'react-icons'
import {
  WiCloud, WiCloudy, WiDayCloudy, WiDaySunny, WiFog, WiNa, WiNightAltCloudy, WiNightClear, WiRain, WiSnow,
  WiThunderstorm,
} from 'react-icons/wi'

const normalize = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export function skyIcon(sky: string | null, isDay: boolean): IconType | null {
  if (sky === null) return null
  // "… con lluvia en la hora anterior": el fenómeno ya pasó, solo cuenta el cielo base
  const t = normalize(sky).replace(/\bcon\b.*en la hora anterior.*$/, '').trim()
  if (t.includes('tormenta')) return WiThunderstorm
  if (/nieve|nevada/.test(t)) return WiSnow
  if (/lluvia|llovizna|chaparr/.test(t)) return WiRain
  if (/neblina|niebla|bruma/.test(t)) return WiFog
  if (t.startsWith('cubierto')) return WiCloudy
  if (/^(algo|parcialmente) nublado/.test(t)) return isDay ? WiDayCloudy : WiNightAltCloudy
  if (t.startsWith('nublado')) return WiCloud
  if (t.startsWith('despejado')) return isDay ? WiDaySunny : WiNightClear
  return WiNa
}
