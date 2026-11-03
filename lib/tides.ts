/** Alturas (m) desde las que la marea se marca en rojo, cada vez más intenso */
export const TIDE_LEVELS: readonly number[] = [2, 2.5, 3, 3.5]

/** 0 = bajo el primer umbral; 1..4 = rojo creciente */
export const levelOf = (v: number): number => TIDE_LEVELS.filter((th) => v >= th).length

const TRENDS = {
  rising: { arrow: '↑', label: 'Subiendo' },
  falling: { arrow: '↓', label: 'Bajando' },
  steady: { arrow: '→', label: 'Estable' },
} as const

/** Texto de tendencia ("Subiendo · +0,12 m/h"); null si la API no pudo calcularla */
export function trendInfo(
  trend: 'rising' | 'falling' | 'steady' | 'unknown',
  changeMPerHour: number | null,
): { arrow: string; text: string } | null {
  if (trend === 'unknown') return null
  const { arrow, label } = TRENDS[trend]
  if (changeMPerHour === null) return { arrow, text: label }
  const sign = changeMPerHour > 0 ? '+' : changeMPerHour < 0 ? '−' : ''
  return { arrow, text: `${label} · ${sign}${Math.abs(changeMPerHour).toFixed(2).replace('.', ',')} m/h` }
}

interface P {
  x: number
  y: number
  v: number
  seg: number
}

export interface Piece {
  level: number
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Parte la línea en tramos de un solo nivel, cortando justo donde la marea cruza cada umbral */
export function splitByLevel(points: readonly P[]): Piece[] {
  const pieces: Piece[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (a.seg !== b.seg) continue
    const cuts = TIDE_LEVELS.filter((th) => (th - a.v) * (th - b.v) < 0)
      .map((th) => (th - a.v) / (b.v - a.v))
      .sort((p, q) => p - q)
    const fs = [0, ...cuts, 1]
    const at = (f: number) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
    for (let k = 1; k < fs.length; k++) {
      const p = at(fs[k - 1])
      const q = at(fs[k])
      const mid = a.v + (b.v - a.v) * ((fs[k - 1] + fs[k]) / 2)
      pieces.push({ level: levelOf(mid), x1: p.x, y1: p.y, x2: q.x, y2: q.y })
    }
  }
  return pieces
}
