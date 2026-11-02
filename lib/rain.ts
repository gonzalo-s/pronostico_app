import type { IconType } from 'react-icons'
import { WiRain, WiShowers, WiSprinkle, WiStormShowers } from 'react-icons/wi'

export type RainLevel = 'llovizna' | 'debil' | 'lluvia' | 'fuerte'

// Umbrales orientativos en mm: la ventana de `precip_mm` por paso del pronóstico es incierta (1 h o 3 h)
const THRESHOLDS = {
  step: [0.5, 2.5, 7.5],
  day: [1, 5, 15],
} as const

const LEVELS: readonly RainLevel[] = ['llovizna', 'debil', 'lluvia', 'fuerte']

export function rainLevel(mm: number | null, scale: 'step' | 'day'): RainLevel | null {
  if (mm === null || mm <= 0) return null
  const idx = THRESHOLDS[scale].findIndex((limit) => mm < limit)
  return LEVELS[idx === -1 ? LEVELS.length - 1 : idx]
}

const ICONS: Record<RainLevel, { Icon: IconType; label: string }> = {
  llovizna: { Icon: WiSprinkle, label: 'Llovizna' },
  debil: { Icon: WiShowers, label: 'Lluvia débil' },
  lluvia: { Icon: WiRain, label: 'Lluvia' },
  fuerte: { Icon: WiStormShowers, label: 'Lluvia fuerte' },
}

export const rainIcon = (level: RainLevel) => ICONS[level]
