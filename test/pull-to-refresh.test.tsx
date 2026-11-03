import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PullToRefresh } from '@/components/PullToRefresh'

function setup() {
  const client = new QueryClient()
  const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue()
  render(
    <QueryClientProvider client={client}>
      <PullToRefresh />
      <div data-testid="content">contenido</div>
      <div className="sheet"><span data-testid="in-sheet">hoja</span></div>
    </QueryClientProvider>,
  )
  return spy
}

const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y: number, target: Element | Document = document) =>
  act(() => {
    fireEvent[type](target, { touches: type === 'touchEnd' ? [] : [{ clientY: y }] })
  })

const pull = (from: number, to: number, target?: Element) => {
  touch('touchStart', from, target)
  touch('touchMove', to, target)
  touch('touchEnd', to, target)
}

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
})

describe('PullToRefresh', () => {
  it('arrastrar hacia abajo más que el umbral estando arriba de todo recarga los datos', () => {
    const spy = setup()
    pull(10, 200)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('un arrastre corto no recarga', () => {
    const spy = setup()
    pull(10, 60)
    expect(spy).not.toHaveBeenCalled()
  })

  it('con la página scrolleada no recarga', () => {
    Object.defineProperty(window, 'scrollY', { value: 120, configurable: true })
    const spy = setup()
    pull(10, 200)
    expect(spy).not.toHaveBeenCalled()
  })

  it('arrastrar hacia arriba no recarga', () => {
    const spy = setup()
    pull(300, 50)
    expect(spy).not.toHaveBeenCalled()
  })

  it('un gesto dentro de la hoja del selector no recarga', () => {
    const spy = setup()
    pull(10, 200, screen.getByTestId('in-sheet'))
    expect(spy).not.toHaveBeenCalled()
  })

  it('muestra el aviso mientras se arrastra y lo oculta al soltar', () => {
    setup()
    touch('touchStart', 10)
    touch('touchMove', 200)
    expect(screen.getByRole('status')).toHaveTextContent('Soltá para actualizar')
    touch('touchEnd', 200)
    expect(screen.queryByText('Soltá para actualizar')).toBeNull()
  })
})
