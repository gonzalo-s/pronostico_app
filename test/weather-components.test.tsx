import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CurrentCard } from '@/features/weather/CurrentCard'
import { ForecastDays } from '@/features/weather/ForecastDays'
import { StationPicker } from '@/features/weather/StationPicker'
import { errorMessage } from '@/features/weather/errorMessage'
import { ApiError } from '@/lib/api'
import { makeCurrent, makeDay, makeStation, makeStep } from './factories'

describe('CurrentCard', () => {
  it('muestra los valores formateados', () => {
    render(<CurrentCard current={makeCurrent({ temp_c: 22.4, sky: 'Despejado', humidity_pct: 58, observed_at: '2026-11-02T17:30:00.000Z' })} />)
    expect(screen.getByText('22°')).toBeInTheDocument()
    expect(screen.getByText('Despejado')).toBeInTheDocument()
    expect(screen.getByText('58 %')).toBeInTheDocument()
    expect(screen.getByText('Norte 14 km/h')).toBeInTheDocument()
    expect(screen.getByText('1013,2 hPa')).toBeInTheDocument()
    expect(screen.getByText(/Observado a las 14:30/)).toBeInTheDocument()
  })
  it('nulos → "—" sin romper', () => {
    const { container } = render(
      <CurrentCard current={makeCurrent({
        sky: null, visibility_km: null, temp_c: null, feels_like_c: null, humidity_pct: null,
        wind_dir: null, wind_kmh: null, pressure_hpa: null,
      })} />,
    )
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(5)
    expect(container).not.toHaveTextContent(/null|NaN|undefined/)
  })
  it('muestra un ícono decorativo según el cielo', () => {
    const { container } = render(<CurrentCard current={makeCurrent({ sky: 'Despejado' })} />)
    expect(container.querySelector('.current__icon[aria-hidden="true"]')).not.toBeNull()
  })
  it('sin dato de cielo no muestra ícono', () => {
    const { container } = render(<CurrentCard current={makeCurrent({ sky: null })} />)
    expect(container.querySelector('.current__icon')).toBeNull()
  })
})

describe('ForecastDays', () => {
  const days = [makeDay({ date: '2026-11-02' }), makeDay({ date: '2026-11-03', precip_mm_total: 2.5 })]
  const steps = [
    makeStep({ at: '2026-11-02T18:00:00.000Z', temp_c: 24 }),
    makeStep({ at: '2026-11-02T21:00:00.000Z' }),
    makeStep({ at: '2026-11-03T03:00:00.000Z', precip_mm: null, temp_c: null, wind_kmh: null }),
  ]
  it('rotula días y resume lluvia', () => {
    render(<ForecastDays days={days} steps={steps} today="2026-11-02" />)
    expect(screen.getByRole('button', { name: /Hoy/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mañana/ })).toHaveTextContent('Lluvia prevista 2,5 mm')
    expect(screen.getByRole('button', { name: /Hoy/ })).toHaveTextContent('Sin lluvia prevista')
  })
  it('muestra la gota solo cuando hay lluvia prevista', () => {
    const { container } = render(<ForecastDays days={days} steps={steps} today="2026-11-02" />)
    // days[0] sin lluvia, days[1] con 2,5 mm → una sola gota
    expect(container.querySelectorAll('svg')).toHaveLength(1)
  })
  it('expande y colapsa los pasos de 3 h del día', async () => {
    render(<ForecastDays days={days} steps={steps} today="2026-11-02" />)
    expect(screen.queryByText('15:00')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Hoy/ }))
    expect(screen.getByRole('button', { name: /Hoy/ })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('15:00')).toBeInTheDocument()
    expect(screen.getByText('18:00')).toBeInTheDocument()
    expect(screen.queryByText('00:00')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Hoy/ }))
    expect(screen.queryByText('15:00')).toBeNull()
  })
  it('pasos sin lluvia dicen "Sin lluvia" en vez de "0,0 mm"', async () => {
    render(<ForecastDays days={days} steps={steps} today="2026-11-02" />)
    await userEvent.click(screen.getByRole('button', { name: /Hoy/ }))
    const list = within(screen.getByRole('list', { name: 'Pasos de 3 horas' }))
    expect(list.getAllByText('Sin lluvia').length).toBeGreaterThan(0)
    expect(list.queryByText('0,0 mm')).toBeNull()
  })
  it('pasos con nulos muestran "—"', async () => {
    render(<ForecastDays days={days} steps={steps} today="2026-11-02" />)
    await userEvent.click(screen.getByRole('button', { name: /Mañana/ }))
    expect(within(screen.getByRole('list', { name: 'Pasos de 3 horas' })).getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })
})

describe('StationPicker', () => {
  const stations = [
    makeStation({ id: 1, name: 'BUENOS AIRES', province: 'CAPITAL FEDERAL' }),
    makeStation({ id: 2, name: 'CÓRDOBA AERO', province: 'CORDOBA' }),
    makeStation({ id: 3, name: 'USHUAIA AERO', province: 'TIERRA DEL FUEGO' }),
  ]
  const setup = (over: Partial<Parameters<typeof StationPicker>[0]> = {}) => {
    const props = { open: true, stations, selectedId: 1, onSelect: vi.fn(), onClose: vi.fn(), ...over }
    render(<StationPicker {...props} />)
    return props
  }
  it('lista todas y marca la seleccionada', () => {
    setup()
    expect(screen.getAllByRole('button')).toHaveLength(3)
    expect(screen.getByText('Buenos Aires').closest('button')).toHaveAttribute('aria-current', 'true')
  })
  it('filtra por texto ignorando tildes y mayúsculas', async () => {
    setup()
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar estación' }), 'cordoba')
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByText('Córdoba Aero')).toBeInTheDocument()
  })
  it('sin resultados', async () => {
    setup()
    await userEvent.type(screen.getByRole('searchbox'), 'zzz')
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })
  it('seleccionar llama onSelect y onClose', async () => {
    const props = setup()
    await userEvent.click(screen.getByText('Ushuaia Aero'))
    expect(props.onSelect).toHaveBeenCalledWith(3)
    expect(props.onClose).toHaveBeenCalled()
  })
})

describe('errorMessage', () => {
  it('mapea cada tipo de error', () => {
    expect(errorMessage(new ApiError('not_found', 'x'))).toBe('Sin datos para esta estación')
    expect(errorMessage(new ApiError('contract', 'x'))).toBe('Respuesta inesperada de la API')
    expect(errorMessage(new ApiError('network', 'x'))).toBe('Sin conexión')
    expect(errorMessage(new ApiError('upstream', 'x'))).toBe('No se pudieron cargar los datos')
    expect(errorMessage(new Error('x'))).toBe('No se pudieron cargar los datos')
  })
})
