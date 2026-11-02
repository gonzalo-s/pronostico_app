import { isSoutheast, windDegrees, windText } from '@/lib/format'
import { WindArrow } from './WindArrow'

interface Props {
  dir: string | null
  kmh: number | null
  variable?: boolean
  /** Grados de origen, si la fuente los trae (pronóstico); si no, se derivan de `dir` */
  deg?: number | null
}

export function Wind({ dir, kmh, variable = false, deg }: Props) {
  const moving = !variable && kmh !== null
  const southeast = moving && isSoutheast(dir)
  const degrees = deg ?? windDegrees(dir)
  return (
    <span className={southeast ? 'wind wind--se' : 'wind'}>
      {moving && degrees !== null && <WindArrow from={degrees} />}
      {windText(dir, kmh, variable)}
    </span>
  )
}
