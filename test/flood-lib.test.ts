import { describe, expect, it } from 'vitest'
import { evaluateFlood, type FloodInput } from '@/lib/flood'

const NOW = Date.parse('2026-11-04T18:00:00.000Z')
const iso = (hoursFromNow: number) => new Date(NOW + hoursFromNow * 3600_000).toISOString()

const tide = (h: number, ageH = 0.5) => ({
  id: 2, name: 'San Fernando', at: iso(-ageH), height_m: h, updated_at: iso(-ageH), trend: 'steady' as const, change_m_per_hour: 0,
})
const river = (over: Record<string, unknown> = {}) => ({
  id: 5, name: 'San Fernando', river: 'Luján', at: iso(-0.5), height_m: 1.5, updated_at: iso(-0.5), change_24h_m: 0.1,
  thresholds: null, level_band: 'normal' as const, levels: { alert_m: 3, evacuation_m: 3.5, low_water_m: null },
  official_level: 'normal' as const, ...over,
})
const hist = (n: number, dir: number | null, kmh: number | null) =>
  Array.from({ length: n }, (_, i) => ({
    at: iso(-(n - 1 - i)), temp_c: 15, humidity_pct: 80, pressure_hpa: 1005, wind_dir_deg: dir, wind_kmh: kmh,
  }))
const step = (h: number, dir: number, kmh: number, mm: number) => ({
  locality: 'x', at: iso(h), temp_c: 15, wind_dir_deg: dir, wind_kmh: kmh, precip_mm: mm, updated_at: iso(-3),
})

const base = (over: Partial<FloodInput> = {}): FloodInput => ({
  now: NOW,
  tide: { current: tide(1.2), events: [] },
  river: { current: river(), forecast: null },
  wind: { history: hist(12, 20, 10), steps: [step(3, 20, 10, 0)] },
  upstream: [{ name: 'Rosario', current: river({ at: iso(-5) }) }],
  ...over,
})

describe('evaluateFlood', () => {
  it('todo tranquilo → Normal, sin razones', () => {
    const r = evaluateFlood(base())
    expect(r.level).toBe(0)
    expect(r.reasons).toEqual([])
    expect(r.partial).toBe(false)
  })

  it('sin datos recientes de marea ni de río → null (no se evalúa)', () => {
    const r = evaluateFlood(base({ tide: { current: tide(1.2, 10), events: null }, river: { current: river({ updated_at: iso(-10) }), forecast: null } }))
    expect(r.level).toBeNull()
  })

  it('un dato viejo no cuenta: el otro sigue evaluando y queda parcial', () => {
    const r = evaluateFlood(base({ tide: { current: tide(3.2, 10), events: null } }))
    expect(r.level).toBe(0)
    expect(r.partial).toBe(true)
    expect(r.signals.find((s) => s.key === 'tide')?.state).toBe('nodata')
  })

  it.each([
    [2.4, 0],
    [2.5, 2],
    [3, 3],
    [3.5, 4],
  ])('marea %s m → nivel %s', (h, level) => {
    expect(evaluateFlood(base({ tide: { current: tide(h), events: [] } })).level).toBe(level)
  })

  it('la pleamar prevista cuenta con margen de prudencia (+0,25 m)', () => {
    // 2,3 + 0,25 = 2,55 ≥ 2,5 → moderado aunque la prevista no llegue
    const events = [{ kind: 'high' as const, at: iso(4), height_m: 2.3 }]
    const r = evaluateFlood(base({ tide: { current: tide(1.5), events } }))
    expect(r.level).toBe(2)
    expect(r.signals[0].lines.join(' ')).toMatch(/margen de prudencia/)
  })

  it('ignora pleamares pasadas o a más de 24 h', () => {
    const events = [
      { kind: 'high' as const, at: iso(-2), height_m: 3.4 },
      { kind: 'high' as const, at: iso(30), height_m: 3.4 },
    ]
    expect(evaluateFlood(base({ tide: { current: tide(1.5), events } })).level).toBe(0)
  })

  it('río con nivel oficial de alerta → moderado a intenso; evacuación → intenso', () => {
    expect(evaluateFlood(base({ river: { current: river({ official_level: 'alert' }), forecast: null } })).level).toBe(3)
    expect(evaluateFlood(base({ river: { current: river({ official_level: 'evacuation' }), forecast: null } })).level).toBe(4)
  })

  it('usa la banda alta del pronóstico del río, no la línea central', () => {
    const forecast = {
      issued_at: iso(-15), model: 'm', levels: { alert_m: 3, evacuation_m: 3.5, low_water_m: null },
      points: [{ at: iso(10), main_m: 2.8, p05_m: 2.58, p25_m: 2.71, p75_m: 2.9, p95_m: 3.03 }],
    }
    const r = evaluateFlood(base({ river: { current: river(), forecast } }))
    expect(r.level).toBe(2) // p95 ≥ alerta → moderado
    expect(r.signals.find((s) => s.key === 'river')?.state).toBe('active')
  })

  it('sudestada + lluvia + nivel alto sin llegar a umbrales → Atención', () => {
    const r = evaluateFlood(
      base({
        tide: { current: tide(2.1), events: [] }, // alto (≥ 2,0) pero < 2,5
        wind: { history: hist(8, 135, 30), steps: [step(3, 135, 30, 12), step(6, 135, 30, 12), step(9, 135, 30, 12)] },
      }),
    )
    expect(r.level).toBe(1)
    expect(r.reasons).toEqual(['Sudestada (viento del SE)', 'Lluvia'])
  })

  it('sudestada + lluvia pero nivel bajo → Normal (no alarma sin agua alta)', () => {
    const r = evaluateFlood(
      base({ wind: { history: hist(8, 135, 30), steps: [step(3, 135, 30, 25)] } }),
    )
    expect(r.level).toBe(0)
    expect(r.reasons).toEqual(['Sudestada (viento del SE)', 'Lluvia'])
  })

  it('dos o más agravantes suben un nivel el estado por altura', () => {
    const wind = { history: hist(8, 135, 30), steps: [step(3, 135, 30, 25)] }
    expect(evaluateFlood(base({ tide: { current: tide(2.6), events: [] } })).level).toBe(2)
    expect(evaluateFlood(base({ tide: { current: tide(2.6), events: [] }, wind })).level).toBe(3)
  })

  it('el nivel nunca pasa de Intenso', () => {
    const wind = { history: hist(8, 135, 30), steps: [step(3, 135, 30, 25)] }
    expect(evaluateFlood(base({ tide: { current: tide(3.6), events: [] }, wind })).level).toBe(4)
  })

  describe('viento', () => {
    const wind = (r: ReturnType<typeof evaluateFlood>) => r.signals.find((s) => s.key === 'wind')!
    it('cuenta las horas seguidas de SE hacia atrás y se corta ante una hora que no lo es', () => {
      const h = hist(10, 135, 30)
      h[3] = { ...h[3], wind_dir_deg: 270 } // corta la racha: quedan 6 horas seguidas (índices 4..9)
      const r = evaluateFlood(base({ wind: { history: h, steps: null } }))
      expect(wind(r).lines[0]).toBe('Viento del SE (≥ 20 km/h) sostenido hace 6 h')
      expect(wind(r).state).toBe('active') // 6 h ≥ umbral
    })
    it('menos de 6 h observadas y sin previsión → sin señal', () => {
      const r = evaluateFlood(base({ wind: { history: hist(4, 135, 30), steps: [step(3, 20, 10, 0)] } }))
      expect(wind(r).state).toBe('inactive')
    })
    it('viento del SE débil o de otra dirección no cuenta', () => {
      expect(wind(evaluateFlood(base({ wind: { history: hist(12, 135, 15), steps: null } }))).state).toBe('inactive')
      expect(wind(evaluateFlood(base({ wind: { history: hist(12, 200, 40), steps: null } }))).state).toBe('inactive')
    })
    it('la previsión de SE activa por sí sola (≥ 12 h en 48 h)', () => {
      const steps = [3, 6, 9, 12].map((h) => step(h, 135, 30, 0))
      expect(wind(evaluateFlood(base({ wind: { history: hist(2, 20, 5), steps } }))).state).toBe('active')
    })
    it('sin datos de viento → sin datos', () => {
      expect(wind(evaluateFlood(base({ wind: { history: null, steps: null } }))).state).toBe('nodata')
    })
  })

  describe('lluvia', () => {
    const rain = (r: ReturnType<typeof evaluateFlood>) => r.signals.find((s) => s.key === 'rain')!
    it('20 mm en 24 h o 50 mm en 72 h activan', () => {
      expect(rain(evaluateFlood(base({ wind: { history: null, steps: [step(5, 0, 0, 20)] } }))).state).toBe('active')
      const steps = [step(5, 0, 0, 10), step(30, 0, 0, 20), step(60, 0, 0, 20)]
      expect(rain(evaluateFlood(base({ wind: { history: null, steps } }))).state).toBe('active')
    })
    it('menos que eso no activa, y lo pasado o a más de 72 h no suma', () => {
      const steps = [step(-3, 0, 0, 40), step(5, 0, 0, 10), step(80, 0, 0, 90)]
      const r = rain(evaluateFlood(base({ wind: { history: null, steps } })))
      expect(r.state).toBe('inactive')
      expect(r.lines[0]).toBe('Prevista: 10 mm en 24 h y 10 mm en 72 h')
    })
    it('avisa que no hay lluvia observada', () => {
      expect(rain(evaluateFlood(base())).lines.join(' ')).toMatch(/No hay lluvia observada/)
    })
  })

  describe('Paraná aguas arriba', () => {
    const up = (r: ReturnType<typeof evaluateFlood>) => r.signals.find((s) => s.key === 'upstream')!
    const station = (name: string, band: 'normal' | 'above_p90' | 'above_p99', ageH = 20) => ({
      name, current: river({ name, at: iso(-ageH), level_band: band, change_24h_m: 0.3, height_m: 5.1 }),
    })
    it('sobre p90 en cualquier escala activa y lista cada estación', () => {
      const r = evaluateFlood(base({ upstream: [station('Rosario', 'above_p90'), station('Zárate', 'normal')] }))
      expect(up(r).state).toBe('active')
      expect(up(r).lines[0]).toBe('Rosario: 5,10 m, sobre el p90 del día · +0,30 m en 24 h')
    })
    it('lecturas de más de 36 h se descartan', () => {
      expect(up(evaluateFlood(base({ upstream: [station('Rosario', 'above_p99', 40)] }))).state).toBe('nodata')
    })
    it('todo habitual → sin señal', () => {
      expect(up(evaluateFlood(base({ upstream: [station('Rosario', 'normal')] }))).state).toBe('inactive')
    })
  })
})
