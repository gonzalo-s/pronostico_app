import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Banner } from '@/components/ui/Banner'
import { BottomNav } from '@/components/ui/BottomNav'
import { BottomSheet } from '@/components/ui/BottomSheet'

vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('Banner', () => {
  it('error: role alert y botón Reintentar', async () => {
    const onRetry = vi.fn()
    render(<Banner tone="error" onRetry={onRetry}>Falló</Banner>)
    expect(screen.getByRole('alert')).toHaveTextContent('Falló')
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
  it('warn: role status y sin botón si no hay onRetry', () => {
    render(<Banner tone="warn">Aviso</Banner>)
    expect(screen.getByRole('status')).toHaveTextContent('Aviso')
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('BottomSheet', () => {
  it('no renderiza cerrada', () => {
    render(<BottomSheet open={false} title="T" onClose={() => {}}>contenido</BottomSheet>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('abierta muestra el diálogo y cierra con Escape y con el fondo', async () => {
    const onClose = vi.fn()
    render(<BottomSheet open title="Elegir" onClose={onClose}>contenido</BottomSheet>)
    expect(screen.getByRole('dialog', { name: 'Elegir' })).toHaveTextContent('contenido')
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
  it('clic dentro del panel no cierra', async () => {
    const onClose = vi.fn()
    render(<BottomSheet open title="T" onClose={onClose}>contenido</BottomSheet>)
    await userEvent.click(screen.getByText('contenido'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('BottomNav', () => {
  it('con una sola pestaña no renderiza nada', () => {
    const { container } = render(<BottomNav tabs={[{ href: '/', label: 'Clima' }]} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('con varias pestañas marca la actual', () => {
    render(<BottomNav tabs={[{ href: '/', label: 'Clima' }, { href: '/history', label: 'Histórico' }]} />)
    expect(screen.getByRole('link', { name: 'Clima' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Histórico' })).not.toHaveAttribute('aria-current')
  })
})
