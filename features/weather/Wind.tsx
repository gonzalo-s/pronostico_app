import { isSoutheast, windText } from '@/lib/format'

interface Props {
  dir: string | null
  kmh: number | null
  variable?: boolean
}

export function Wind({ dir, kmh, variable = false }: Props) {
  const southeast = !variable && kmh !== null && isSoutheast(dir)
  return <span className={southeast ? 'wind wind--se' : 'wind'}>{windText(dir, kmh, variable)}</span>
}
