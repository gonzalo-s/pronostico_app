import type { ReactNode } from 'react'

interface Props {
  tone: 'warn' | 'error'
  children: ReactNode
  onRetry?: () => void
}

export function Banner({ tone, children, onRetry }: Props) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`banner banner--${tone}`}>
      <span>{children}</span>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  )
}
