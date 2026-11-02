# Geolocalización, íconos del clima y viento SE Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sumar íconos del clima, resaltar en rojo el viento del sudeste y agregar un botón "Usar mi ubicación" que elige la estación más cercana vía `/stations/nearest`.

**Architecture:** Lógica pura en `lib/` (`skyIcon`, `isDaytime`, `isSoutheast`, `geolocation`, `nearestQuery`), componentes finos en `features/weather/` (`Wind`, `StationPicker` con el botón). El proxy de Next valida y reenvía solo `lat`/`lon` a `stations/nearest`. La estación elegida se guarda con `setStationId` existente (localStorage), sin estado nuevo global.

**Tech Stack:** Next 16, React 19, TypeScript, zod, Vitest + Testing Library (jsdom), `react-icons` (`react-icons/wi`).

## Global Constraints

Copiadas del spec `docs/superpowers/specs/2026-11-02-geolocation-icons-design.md`:

- Librería de íconos: `react-icons/wi` (no `weather-icons-react`).
- `SMN_API_KEY` y `SMN_API_URL` nunca llegan al navegador ni llevan prefijo `NEXT_PUBLIC_`.
- El permiso de ubicación se pide solo al tocar el botón, nunca al abrir la app.
- El cliente redondea lat/lon a 2 decimales antes de enviarlas.
- El proxy reenvía solo `lat` y `lon` (decimal estricto, `lat` en [-90, 90], `lon` en [-180, 180]); descarta cualquier otro parámetro; inválidos → 400 sin llamar al upstream.
- Ante cualquier error de geolocalización o de API, la estación activa no cambia.
- Timeout de posición: 10 s.
- Día = 7 a 19 h en `America/Argentina/Buenos_Aires` (UTC-3), aproximación deliberada.
- "con … en la hora anterior" no cuenta como fenómeno actual: se mapea solo el cielo base.
- El pronóstico no trae cielo: solo ícono de gota cuando `precip_mm_total > 0`, nunca sol ni nubes inventados.
- Viento variable, sin dirección o sin velocidad: nunca rojo. El texto ("Sudeste" / "SE") sigue visible (el color no es la única señal).
- Estilo del repo: sin punto y coma, comillas simples, 2 espacios; comentarios solo cuando aclaran un porqué; textos de UI en español rioplatense.
- Commits con `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` al final. Trabajar en la rama `dev`.

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `lib/skyIcon.ts` (nuevo) | `skyIcon(sky, isDay)`: texto de cielo → componente de ícono |
| `lib/format.ts` (mod) | + `isDaytime(iso)`, + `isSoutheast(dir)` |
| `features/weather/Wind.tsx` (nuevo) | Renderiza viento; clase `wind--se` si viene del sudeste |
| `features/weather/CurrentCard.tsx` (mod) | Ícono grande + `Wind` |
| `features/weather/ForecastDays.tsx` (mod) | Gota si hay lluvia + `Wind` |
| `lib/proxyAllowlist.ts` (mod) | + ruta `stations/nearest`, + `nearestQuery(params)` |
| `app/api/smn/[...path]/route.ts` (mod) | Reenvía `lat`/`lon` validados en `nearest` |
| `lib/geolocation.ts` (nuevo) | `GeoError`, `roundCoord`, `geolocationSupported`, `getPosition` |
| `lib/api.ts` (mod) | + `getNearestStation(lat, lon)` |
| `features/weather/errorMessage.ts` (mod) | + `geoErrorMessage(err)` |
| `features/weather/StationPicker.tsx` (mod) | Botón "Usar mi ubicación" y estados |
| `app/globals.css` (mod) | Estilos de ícono, `wind--se`, botón y error |
| `scripts/refresh-fixtures.ts` (mod) | + `nearest.json` |

---

### Task 1: Íconos del clima

**Files:**
- Create: `lib/skyIcon.ts`
- Create: `test/sky-icon.test.ts`
- Modify: `lib/format.ts` (agregar `isDaytime` al final de la sección de fechas, después de `todayArt`)
- Modify: `features/weather/CurrentCard.tsx`
- Modify: `features/weather/ForecastDays.tsx`
- Modify: `app/globals.css`
- Modify: `test/weather-components.test.tsx`, `test/format.test.ts`
- Modify: `package.json`, `package-lock.json` (por `npm install`)

**Interfaces:**
- Produces: `skyIcon(sky: string | null, isDay: boolean): IconType | null` (null solo si `sky` es null); `isDaytime(iso: string): boolean`.

- [ ] **Step 1: Instalar la librería y verificar los nombres de los íconos**

Run:
```bash
npm install react-icons
node -e "const w=require('react-icons/wi'); for (const n of ['WiDaySunny','WiNightClear','WiDayCloudy','WiNightAltCloudy','WiCloud','WiCloudy','WiThunderstorm','WiSnow','WiRain','WiFog','WiNa','WiRaindrop']) console.log(n, typeof w[n])"
```
Expected: las 12 líneas terminan en `function` (o `object`, según el empaquetado). Si alguna dice `undefined`, buscar el nombre equivalente con `node -e "console.log(Object.keys(require('react-icons/wi')).filter(k=>/cloud|rain|fog|snow|thunder/i.test(k)).join(' '))"` y usar ese nombre en todo el plan.

- [ ] **Step 2: Escribir el test que falla de `skyIcon`**

Crear `test/sky-icon.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  WiCloud, WiCloudy, WiDayCloudy, WiDaySunny, WiFog, WiNa, WiNightAltCloudy, WiNightClear, WiRain, WiSnow,
  WiThunderstorm,
} from 'react-icons/wi'
import { skyIcon } from '@/lib/skyIcon'

describe('skyIcon', () => {
  it.each([
    ['Despejado', true, WiDaySunny],
    ['Despejado', false, WiNightClear],
    ['Algo nublado', true, WiDayCloudy],
    ['Algo nublado', false, WiNightAltCloudy],
    ['Parcialmente nublado', true, WiDayCloudy],
    ['Parcialmente nublado', false, WiNightAltCloudy],
    ['Nublado', true, WiCloud],
    ['Cubierto', true, WiCloudy],
    ['Cubierto con neblina', true, WiFog],
    ['Cubierto con niebla', false, WiFog],
    ['Cubierto con llovizna', true, WiRain],
    ['Cubierto con tormenta', true, WiThunderstorm],
    ['Nublado con tormenta', true, WiThunderstorm],
    ['Nublado con tormenta sin precipitación', true, WiThunderstorm],
  ])('%s (día: %s)', (sky, isDay, icon) => {
    expect(skyIcon(sky, isDay)).toBe(icon)
  })

  it('"en la hora anterior" se ignora: solo cuenta el cielo base', () => {
    expect(skyIcon('Despejado con lluvia en la hora anterior', true)).toBe(WiDaySunny)
    expect(skyIcon('Nublado con nevada en la hora anterior', true)).toBe(WiCloud)
  })

  it('nevada actual → nieve', () => {
    expect(skyIcon('Cubierto con nevada', true)).toBe(WiSnow)
  })

  it('ignora mayúsculas y tildes', () => {
    expect(skyIcon('CUBIERTO CON NEBLINA', true)).toBe(WiFog)
  })

  it('texto desconocido → ícono neutro; null → null', () => {
    expect(skyIcon('Algo nuevo del SMN', true)).toBe(WiNa)
    expect(skyIcon(null, true)).toBeNull()
  })
})
```

- [ ] **Step 3: Verificar que falla**

Run: `npx vitest run test/sky-icon.test.ts`
Expected: FAIL (`Failed to resolve import "@/lib/skyIcon"`).

- [ ] **Step 4: Implementar `skyIcon`**

Crear `lib/skyIcon.ts`:

```ts
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
```

- [ ] **Step 5: Verificar que pasa**

Run: `npx vitest run test/sky-icon.test.ts`
Expected: PASS, todos los casos.

- [ ] **Step 6: Test que falla de `isDaytime`**

En `test/format.test.ts`, agregar `isDaytime` al import desde `@/lib/format` (la línea 4 ya importa `formatValue, isStale, titleCase, todayArt, windText` entre otros) y este bloque al final del archivo:

```ts
describe('isDaytime', () => {
  it.each([
    ['2026-11-02T10:00:00.000Z', true],  // 07:00 ART
    ['2026-11-02T21:59:00.000Z', true],  // 18:59 ART
    ['2026-11-02T22:00:00.000Z', false], // 19:00 ART
    ['2026-11-02T09:59:00.000Z', false], // 06:59 ART
    ['2026-11-02T03:00:00.000Z', false], // 00:00 ART
  ])('%s → %s', (iso, expected) => {
    expect(isDaytime(iso)).toBe(expected)
  })
})
```

Run: `npx vitest run test/format.test.ts`
Expected: FAIL (`isDaytime is not a function` o error de import).

- [ ] **Step 7: Implementar `isDaytime`**

En `lib/format.ts`, justo después de `export const todayArt = ...`:

```ts
// Aproximación deliberada: día entre las 7 y las 19 h de Argentina, sin cálculo astronómico
export function isDaytime(iso: string): boolean {
  const hour = new Date(Date.parse(iso) - ART_OFFSET_MS).getUTCHours()
  return hour >= 7 && hour < 19
}
```

Run: `npx vitest run test/format.test.ts`
Expected: PASS.

- [ ] **Step 8: Tests que fallan de los componentes**

En `test/weather-components.test.tsx`, dentro de `describe('CurrentCard', ...)` agregar:

```tsx
  it('muestra un ícono decorativo según el cielo', () => {
    const { container } = render(<CurrentCard current={makeCurrent({ sky: 'Despejado' })} />)
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  })
  it('sin dato de cielo no muestra ícono', () => {
    const { container } = render(<CurrentCard current={makeCurrent({ sky: null })} />)
    expect(container.querySelector('svg')).toBeNull()
  })
```

Y dentro de `describe('ForecastDays', ...)`:

```tsx
  it('muestra la gota solo cuando hay lluvia prevista', () => {
    const { container } = render(<ForecastDays days={days} steps={steps} today="2026-11-02" />)
    // days[0] sin lluvia, days[1] con 2,5 mm → una sola gota
    expect(container.querySelectorAll('svg')).toHaveLength(1)
  })
```

Run: `npx vitest run test/weather-components.test.tsx`
Expected: FAIL en los tres tests nuevos (no hay `svg`).

- [ ] **Step 9: Implementar en `CurrentCard` y `ForecastDays`**

En `features/weather/CurrentCard.tsx`, reemplazar los imports y el cuerpo de `CurrentCard`:

```tsx
import { EMPTY, formatTemp, formatTime, formatValue, isDaytime, windText } from '@/lib/format'
import type { Current } from '@/lib/schemas'
import { skyIcon } from '@/lib/skyIcon'
```

```tsx
export function CurrentCard({ current }: { current: Current }) {
  const Icon = skyIcon(current.sky, isDaytime(current.observed_at))
  return (
    <section className="card" aria-labelledby="current-title">
      <h2 id="current-title" className="card__title">Ahora</h2>
      <div className="current__main">
        <p className="current__temp">{formatTemp(current.temp_c)}</p>
        {Icon && <Icon className="current__icon" aria-hidden="true" />}
      </div>
      <p className="current__sky">{current.sky ?? EMPTY}</p>
```

(el resto del componente queda igual; `windText` sigue en uso hasta la Task 2).

En `features/weather/ForecastDays.tsx`, agregar el import `import { WiRaindrop } from 'react-icons/wi'` y reemplazar el span `day__rain`:

```tsx
                <span className="day__rain">
                  {day.precip_mm_total > 0 ? (
                    <>
                      <WiRaindrop className="day__icon" aria-hidden="true" />
                      {`Lluvia prevista ${formatValue(day.precip_mm_total, 'mm', 1)}`}
                    </>
                  ) : (
                    'Sin lluvia prevista'
                  )}
                </span>
```

En `app/globals.css`, después de la línea `.current__temp { ... }` agregar:

```css
.current__main { display: flex; align-items: center; justify-content: space-between; }
.current__icon { width: 4.5rem; height: 4.5rem; color: var(--accent); }
.day__icon { margin-right: 2px; font-size: 1.25rem; vertical-align: -0.25em; }
```

- [ ] **Step 10: Verificar que pasa todo**

Run: `npm run typecheck && npm test`
Expected: typecheck sin errores; todos los tests pasan (los anteriores 100 + los nuevos).

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json lib/skyIcon.ts lib/format.ts features/weather/CurrentCard.tsx features/weather/ForecastDays.tsx app/globals.css test/sky-icon.test.ts test/format.test.ts test/weather-components.test.tsx
git commit -m "feat: weather icons for current sky and forecast rain" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Viento del sudeste en rojo

**Files:**
- Create: `features/weather/Wind.tsx`
- Create: `test/wind.test.tsx`
- Modify: `lib/format.ts` (agregar `isSoutheast` después de `windText`)
- Modify: `features/weather/CurrentCard.tsx`, `features/weather/ForecastDays.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `isSoutheast(dir: string | null): boolean`; `<Wind dir kmh variable? />` que renderiza un único `<span class="wind [wind--se]">` con el mismo texto que `windText`.
- Consumes: `windText(dir, kmh, variable)` de `lib/format.ts`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `test/wind.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CurrentCard } from '@/features/weather/CurrentCard'
import { ForecastDays } from '@/features/weather/ForecastDays'
import { Wind } from '@/features/weather/Wind'
import { isSoutheast } from '@/lib/format'
import { makeCurrent, makeDay, makeStep } from './factories'

describe('isSoutheast', () => {
  it.each(['Sudeste', 'sudeste', ' SE ', 'SE'])('%s → true', (dir) => {
    expect(isSoutheast(dir)).toBe(true)
  })
  it.each(['Sudoeste', 'SO', 'Sur', 'Este', 'Noreste', 'Norte', '', null])('%s → false', (dir) => {
    expect(isSoutheast(dir)).toBe(false)
  })
})

describe('Wind', () => {
  it('sudeste con velocidad → rojo, texto completo', () => {
    render(<Wind dir="Sudeste" kmh={14} />)
    const el = screen.getByText('Sudeste 14 km/h')
    expect(el).toHaveClass('wind', 'wind--se')
  })
  it('otras direcciones → sin rojo', () => {
    render(<Wind dir="Sudoeste" kmh={14} />)
    expect(screen.getByText('Sudoeste 14 km/h')).not.toHaveClass('wind--se')
  })
  it('variable → nunca rojo', () => {
    render(<Wind dir="Sudeste" kmh={5} variable />)
    expect(screen.getByText('Variable 5 km/h')).not.toHaveClass('wind--se')
  })
  it('sin velocidad → "—" y sin rojo', () => {
    render(<Wind dir="Sudeste" kmh={null} />)
    expect(screen.getByText('—')).not.toHaveClass('wind--se')
  })
})

describe('integración del viento SE', () => {
  it('CurrentCard resalta Sudeste', () => {
    render(<CurrentCard current={makeCurrent({ wind_dir: 'Sudeste', wind_kmh: 22 })} />)
    expect(screen.getByText('Sudeste 22 km/h')).toHaveClass('wind--se')
  })
  it('ForecastDays resalta SE (135°) en los pasos', async () => {
    render(
      <ForecastDays
        days={[makeDay({ date: '2026-11-02' })]}
        steps={[makeStep({ at: '2026-11-02T18:00:00.000Z', wind_dir_deg: 135, wind_kmh: 20 })]}
        today="2026-11-02"
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /Hoy/ }))
    expect(screen.getByText('SE 20 km/h')).toHaveClass('wind--se')
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run test/wind.test.tsx`
Expected: FAIL (`Failed to resolve import "@/features/weather/Wind"`).

- [ ] **Step 3: Implementar `isSoutheast` y `Wind`**

En `lib/format.ts`, después de `windText`:

```ts
export function isSoutheast(dir: string | null): boolean {
  const t = dir?.trim().toLowerCase()
  return t === 'sudeste' || t === 'se'
}
```

Crear `features/weather/Wind.tsx`:

```tsx
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
```

- [ ] **Step 4: Usar `Wind` en las dos pantallas**

En `features/weather/CurrentCard.tsx`:
- cambiar el import a `import { EMPTY, formatTemp, formatTime, formatValue, isDaytime } from '@/lib/format'` y agregar `import { Wind } from './Wind'`.
- `Stat` pasa a aceptar nodos: cambiar la firma a `function Stat({ label, value }: { label: string; value: ReactNode })` y agregar `import type { ReactNode } from 'react'` arriba.
- reemplazar la línea del viento por:

```tsx
        <Stat label="Viento" value={<Wind dir={current.wind_dir} kmh={current.wind_kmh} variable={current.wind_variable} />} />
```

En `features/weather/ForecastDays.tsx`:
- import: `import { EMPTY, artDate, compass, formatDayLabel, formatTemp, formatTime, formatValue } from '@/lib/format'` y `import { Wind } from './Wind'`.
- reemplazar el span del viento por `<Wind dir={compass(s.wind_dir_deg)} kmh={s.wind_kmh} />`. El `Wind` ya es un `<span>`, así que la grilla `.step` no cambia.

En `app/globals.css`, agregar `--wind-se: #c62828;` dentro del bloque `:root` claro (línea 2, junto a las otras variables) y `--wind-se: #ff6b6b;` dentro del `:root` del `@media (prefers-color-scheme: dark)`. Luego, después de `.muted { ... }`:

```css
.wind--se { color: var(--wind-se); font-weight: 600; }
```

- [ ] **Step 5: Verificar que pasa todo**

Run: `npm run typecheck && npm test`
Expected: sin errores de tipos; todos los tests pasan (incluye los existentes `Norte 14 km/h` y `Variable 5 km/h`, que siguen siendo texto en un único elemento).

- [ ] **Step 6: Commit**

```bash
git add lib/format.ts features/weather/Wind.tsx features/weather/CurrentCard.tsx features/weather/ForecastDays.tsx app/globals.css test/wind.test.tsx
git commit -m "feat: highlight southeast wind in red" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Proxy para `stations/nearest`

**Files:**
- Modify: `lib/proxyAllowlist.ts`
- Modify: `app/api/smn/[...path]/route.ts`
- Modify: `test/proxy.test.ts`

**Interfaces:**
- Produces: ruta permitida `stations/nearest`; `nearestQuery(params: URLSearchParams): string | null` (devuelve `lat=<x>&lon=<y>` o `null` si es inválido).

- [ ] **Step 1: Actualizar y agregar los tests que fallan**

En `test/proxy.test.ts`:

1. Cambiar el import: `import { isAllowedPath, nearestQuery } from '@/lib/proxyAllowlist'`.
2. En `it.each(['stations', 'stations/5/current', 'stations/123/forecast'])` agregar `'stations/nearest'` a la lista de permitidas.
3. En la lista de rechazadas, **quitar** `'stations/nearest'` y agregar `'stations/nearest/extra'` y `'stations/Nearest'`.
4. Agregar un helper debajo de `call`:

```ts
const callQ = (path: string[], query: string) =>
  GET(new Request(`http://localhost/api/smn/${path.join('/')}?${query}`), { params: Promise.resolve({ path }) })
```

5. Agregar estos bloques al final del archivo:

```ts
describe('nearestQuery', () => {
  const q = (s: string) => nearestQuery(new URLSearchParams(s))
  it('acepta coordenadas decimales válidas y descarta el resto', () => {
    expect(q('lat=-34.6&lon=-58.38')).toBe('lat=-34.6&lon=-58.38')
    expect(q('lat=-34.6&lon=-58.38&key=zz&x=1')).toBe('lat=-34.6&lon=-58.38')
    expect(q('lat=90&lon=-180')).toBe('lat=90&lon=-180')
  })
  it.each([
    'lat=abc&lon=1', 'lat=1&lon=', 'lat=1', 'lon=1', '', 'lat=91&lon=1', 'lat=1&lon=181', 'lat=-90.1&lon=1',
    'lat=1e2&lon=1', 'lat=1&lon=1;drop', 'lat=%2034&lon=1', 'lat=1.1234567&lon=1', 'lat=+1&lon=1',
  ])('rechaza %s', (s) => {
    expect(q(s)).toBeNull()
  })
})

describe('GET stations/nearest', () => {
  it('reenvía solo lat/lon validados, con X-API-Key', async () => {
    const fetchMock = vi.fn(async () => new Response('{"data":{"id":7}}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const res = await callQ(['stations', 'nearest'], 'lat=-34.6&lon=-58.38&key=zz&x=1')
    expect(res.status).toBe(200)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.test/v1/stations/nearest?lat=-34.6&lon=-58.38')
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe('secret-test-key')
  })
  it('coordenadas inválidas → 400 sin llamar al upstream', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const res = await callQ(['stations', 'nearest'], 'lat=100&lon=1')
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await res.json()).toEqual({ error: { code: 'bad_request', message: 'Coordenadas inválidas' } })
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run test/proxy.test.ts`
Expected: FAIL (`nearestQuery` no existe; `stations/nearest` aún se rechaza).

- [ ] **Step 3: Implementar la lista blanca y `nearestQuery`**

Reemplazar `lib/proxyAllowlist.ts`:

```ts
const ID = '[1-9]\\d{0,9}'

export const ALLOWED_ROUTES: readonly RegExp[] = [
  /^stations$/,
  /^stations\/nearest$/,
  new RegExp(`^stations/${ID}/current$`),
  new RegExp(`^stations/${ID}/forecast$`),
]

export function isAllowedPath(path: string): boolean {
  return ALLOWED_ROUTES.some((route) => route.test(path))
}

// Decimal estricto (sin exponente, signo + ni espacios): lo que pasa el regex es seguro de interpolar
const COORD = /^-?\d{1,3}(\.\d{1,6})?$/

export function nearestQuery(params: URLSearchParams): string | null {
  const lat = params.get('lat')
  const lon = params.get('lon')
  if (lat === null || lon === null || !COORD.test(lat) || !COORD.test(lon)) return null
  if (Math.abs(Number(lat)) > 90 || Math.abs(Number(lon)) > 180) return null
  return `lat=${lat}&lon=${lon}`
}
```

- [ ] **Step 4: Reenviar la consulta en el route handler**

En `app/api/smn/[...path]/route.ts`:

- import: `import { isAllowedPath, nearestQuery } from '@/lib/proxyAllowlist'`
- renombrar `_req` a `req` en la firma de `GET`.
- después de `if (!isAllowedPath(route)) return errorResponse(404, ...)` agregar:

```ts
  let query = ''
  if (route === 'stations/nearest') {
    const q = nearestQuery(new URL(req.url).searchParams)
    if (q === null) return errorResponse(400, 'bad_request', 'Coordenadas inválidas')
    query = `?${q}`
  }
```

- cambiar la URL del fetch a `` `${base}/v1/${route}${query}` ``.

- [ ] **Step 5: Verificar que pasa**

Run: `npx vitest run test/proxy.test.ts`
Expected: PASS (incluido el test existente "sin query string" de `stations/5/current`).

- [ ] **Step 6: Commit**

```bash
git add lib/proxyAllowlist.ts "app/api/smn/[...path]/route.ts" test/proxy.test.ts
git commit -m "feat: proxy forwards validated lat/lon to stations/nearest" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Librería de geolocalización y cliente `getNearestStation`

**Files:**
- Create: `lib/geolocation.ts`
- Create: `test/geolocation.test.ts`
- Modify: `lib/api.ts`
- Modify: `test/api.test.ts`

**Interfaces:**
- Produces:
  - `type GeoErrorKind = 'denied' | 'unavailable' | 'timeout'`; `class GeoError extends Error { kind: GeoErrorKind }`
  - `roundCoord(n: number): number` (2 decimales)
  - `geolocationSupported(): boolean`
  - `getPosition(): Promise<{ lat: number; lon: number }>` (rechaza con `GeoError`)
  - `getNearestStation(lat: number, lon: number)` → respuesta validada con `nearestStationResponse` (`{ data: Station & { distance_km }, meta }`)
- Consumes: `nearestStationResponse` de `lib/schemas.ts`, `getJson` de `lib/api.ts`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `test/geolocation.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GeoError, geolocationSupported, getPosition, roundCoord } from '@/lib/geolocation'

function stubGeolocation(getCurrentPosition: unknown) {
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation')
})

describe('roundCoord', () => {
  it.each([
    [-34.6037, -34.6],
    [-58.3816, -58.38],
    [-34.555, -34.56],
    [0.004, 0],
  ])('%s → %s', (input, expected) => {
    expect(roundCoord(input)).toBe(expected)
  })
})

describe('geolocationSupported', () => {
  it('false sin navigator.geolocation, true con él', () => {
    expect(geolocationSupported()).toBe(false)
    stubGeolocation(vi.fn())
    expect(geolocationSupported()).toBe(true)
  })
})

describe('getPosition', () => {
  it('resuelve lat/lon', async () => {
    stubGeolocation((ok: (p: unknown) => void) => ok({ coords: { latitude: -34.6, longitude: -58.4 } }))
    await expect(getPosition()).resolves.toEqual({ lat: -34.6, lon: -58.4 })
  })
  it.each([
    [1, 'denied'],
    [2, 'unavailable'],
    [3, 'timeout'],
  ])('código %s → GeoError %s', async (code, kind) => {
    stubGeolocation((_ok: unknown, fail: (e: unknown) => void) => fail({ code }))
    const err = await getPosition().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(GeoError)
    expect(err).toMatchObject({ kind })
  })
  it('pide timeout de 10 s', async () => {
    const spy = vi.fn((ok: (p: unknown) => void) => ok({ coords: { latitude: 0, longitude: 0 } }))
    stubGeolocation(spy)
    await getPosition()
    expect((spy.mock.calls[0] as unknown[])[2]).toMatchObject({ timeout: 10_000 })
  })
})
```

En `test/api.test.ts`, agregar `getNearestStation` al import desde `@/lib/api` y este test dentro del `describe('cliente de la API', ...)`:

```ts
  it('getNearestStation redondea las coordenadas y valida la respuesta', async () => {
    const body = {
      data: { id: 7, name: 'AEROPARQUE AERO', province: 'CAPITAL FEDERAL', lat: -34.55, lon: -58.41, altitude_m: 6, distance_km: 3.2 },
      meta: { source: 'SMN', updated_at: null },
    }
    const fetchMock = mockFetch({ 'stations/nearest?lat=-34.6&lon=-58.38': { body } })
    const res = await getNearestStation(-34.6037, -58.3816)
    expect(res.data.id).toBe(7)
    expect(res.data.distance_km).toBe(3.2)
    expect(fetchMock).toHaveBeenCalledWith('/api/smn/stations/nearest?lat=-34.6&lon=-58.38')
  })
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run test/geolocation.test.ts test/api.test.ts`
Expected: FAIL (módulo `@/lib/geolocation` inexistente; `getNearestStation` no exportada).

- [ ] **Step 3: Implementar `lib/geolocation.ts`**

```ts
export type GeoErrorKind = 'denied' | 'unavailable' | 'timeout'

export class GeoError extends Error {
  constructor(readonly kind: GeoErrorKind) {
    super(kind)
    this.name = 'GeoError'
  }
}

// ~1 km: las estaciones distan decenas de km, no hace falta enviar la posición exacta
export const roundCoord = (n: number): number => Number(n.toFixed(2))

export function geolocationSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

const TIMEOUT_MS = 10_000

export function getPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new GeoError(e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable')),
      { timeout: TIMEOUT_MS, maximumAge: 300_000 },
    )
  })
}
```

- [ ] **Step 4: Implementar `getNearestStation` en `lib/api.ts`**

Cambiar el import de schemas a `import { currentResponse, forecastResponse, nearestStationResponse, stationsResponse } from '@/lib/schemas'`, agregar `import { roundCoord } from '@/lib/geolocation'` y, junto a los otros `get*`:

```ts
export const getNearestStation = (lat: number, lon: number) =>
  getJson(`stations/nearest?lat=${roundCoord(lat)}&lon=${roundCoord(lon)}`, nearestStationResponse)
```

- [ ] **Step 5: Verificar que pasa**

Run: `npx vitest run test/geolocation.test.ts test/api.test.ts && npm run typecheck`
Expected: PASS y typecheck sin errores. (Si `roundCoord(-34.555)` da `-34.55` por redondeo binario, cambiar ese caso del test por uno sin empate, por ejemplo `[-34.557, -34.56]`; no cambiar la implementación.)

- [ ] **Step 6: Commit**

```bash
git add lib/geolocation.ts lib/api.ts test/geolocation.test.ts test/api.test.ts
git commit -m "feat: geolocation helper and nearest-station API client" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Botón "Usar mi ubicación" en el selector

**Files:**
- Modify: `features/weather/errorMessage.ts`
- Modify: `features/weather/StationPicker.tsx`
- Modify: `app/globals.css`
- Create: `test/locate.test.tsx`

**Interfaces:**
- Consumes: `getPosition`, `geolocationSupported`, `GeoError` (`lib/geolocation.ts`); `getNearestStation` (`lib/api.ts`); props existentes de `StationPicker` (`onSelect(id)`, `onClose()`).
- Produces: `geoErrorMessage(err: unknown): string` en `features/weather/errorMessage.ts`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `test/locate.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StationPicker } from '@/features/weather/StationPicker'
import { geoErrorMessage } from '@/features/weather/errorMessage'
import { GeoError } from '@/lib/geolocation'
import { makeStation } from './factories'
import { mockFetch } from './helpers'

const NEAREST_ROUTE = 'stations/nearest?lat=-34.6&lon=-58.38'
const nearestBody = {
  data: { ...makeStation({ id: 7, name: 'AEROPARQUE AERO' }), distance_km: 3.2 },
  meta: { source: 'SMN', updated_at: null },
}

function stubGeolocation(getCurrentPosition: unknown) {
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true })
}
const position = (ok: (p: unknown) => void) => ok({ coords: { latitude: -34.6037, longitude: -58.3816 } })

afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation')
})

function setup() {
  const props = { open: true, stations: [makeStation({ id: 1 }), makeStation({ id: 7, name: 'AEROPARQUE AERO' })], selectedId: 1, onSelect: vi.fn(), onClose: vi.fn() }
  render(<StationPicker {...props} />)
  return props
}

describe('StationPicker: usar mi ubicación', () => {
  it('sin geolocalización en el navegador no muestra el botón', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Usar mi ubicación' })).toBeNull()
  })

  it('no pide la ubicación hasta que se toca el botón', () => {
    const spy = vi.fn()
    stubGeolocation(spy)
    setup()
    expect(spy).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Usar mi ubicación' })).toBeEnabled()
  })

  it('éxito: selecciona la estación más cercana y cierra', async () => {
    stubGeolocation(position)
    mockFetch({ [NEAREST_ROUTE]: { body: nearestBody } })
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    await vi.waitFor(() => expect(props.onSelect).toHaveBeenCalledWith(7))
    expect(props.onClose).toHaveBeenCalled()
  })

  it('mientras busca muestra "Buscando…" y deshabilita el botón', async () => {
    stubGeolocation(() => {})
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    expect(screen.getByRole('button', { name: 'Buscando…' })).toBeDisabled()
    expect(props.onSelect).not.toHaveBeenCalled()
  })

  it('permiso denegado: mensaje y la estación no cambia', async () => {
    stubGeolocation((_ok: unknown, fail: (e: unknown) => void) => fail({ code: 1 }))
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos acceder a tu ubicación. Elegí una estación de la lista.',
    )
    expect(props.onSelect).not.toHaveBeenCalled()
    expect(props.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Usar mi ubicación' })).toBeEnabled()
  })

  it('timeout: mensaje de reintento', async () => {
    stubGeolocation((_ok: unknown, fail: (e: unknown) => void) => fail({ code: 3 }))
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo obtener tu ubicación. Probá de nuevo.')
  })

  it('API caída: mensaje genérico y la estación no cambia', async () => {
    stubGeolocation(position)
    mockFetch({ [NEAREST_ROUTE]: { status: 502, body: { error: { code: 'upstream_error', message: 'x' } } } })
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar los datos')
    expect(props.onSelect).not.toHaveBeenCalled()
  })
})

describe('geoErrorMessage', () => {
  it('mapea cada tipo de GeoError y delega el resto', () => {
    expect(geoErrorMessage(new GeoError('denied'))).toMatch(/No pudimos acceder/)
    expect(geoErrorMessage(new GeoError('unavailable'))).toMatch(/Probá de nuevo/)
    expect(geoErrorMessage(new GeoError('timeout'))).toMatch(/Probá de nuevo/)
    expect(geoErrorMessage(new Error('x'))).toBe('No se pudieron cargar los datos')
  })
})
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run test/locate.test.tsx`
Expected: FAIL (`geoErrorMessage` no exportada; no existe el botón).

- [ ] **Step 3: Implementar `geoErrorMessage`**

En `features/weather/errorMessage.ts`, agregar `import { GeoError } from '@/lib/geolocation'` y al final:

```ts
export function geoErrorMessage(err: unknown): string {
  if (err instanceof GeoError) {
    return err.kind === 'denied'
      ? 'No pudimos acceder a tu ubicación. Elegí una estación de la lista.'
      : 'No se pudo obtener tu ubicación. Probá de nuevo.'
  }
  return errorMessage(err)
}
```

- [ ] **Step 4: Implementar el botón en `StationPicker`**

En `features/weather/StationPicker.tsx`:

- imports nuevos:

```tsx
import { getNearestStation } from '@/lib/api'
import { geolocationSupported, getPosition } from '@/lib/geolocation'
import { geoErrorMessage } from './errorMessage'
```

- dentro del componente, después de `const [query, setQuery] = useState('')`:

```tsx
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
```

- reemplazar el `useEffect` de reseteo por:

```tsx
  useEffect(() => {
    if (!open) {
      setQuery('')
      setLocateError(null)
    }
  }, [open])
```

- agregar la función (antes del `return`):

```tsx
  async function locate() {
    setLocating(true)
    setLocateError(null)
    try {
      const { lat, lon } = await getPosition()
      const nearest = await getNearestStation(lat, lon)
      onSelect(nearest.data.id)
      onClose()
    } catch (err) {
      setLocateError(geoErrorMessage(err))
    } finally {
      setLocating(false)
    }
  }
```

- dentro de `<BottomSheet>`, **antes** del `<input type="search" ...>`:

```tsx
      {geolocationSupported() && (
        <button type="button" className="locate" onClick={() => void locate()} disabled={locating}>
          {locating ? 'Buscando…' : 'Usar mi ubicación'}
        </button>
      )}
      {locateError && <p role="alert" className="muted locate__error">{locateError}</p>}
```

En `app/globals.css`, después de la línea `.search { ... }` (y su continuación):

```css
.locate { width: 100%; min-height: 44px; margin-bottom: 8px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--accent);
  background: none; color: var(--accent); font: inherit; font-weight: 600; cursor: pointer; }
.locate:disabled { opacity: 0.6; cursor: default; }
.locate__error { margin: 0 0 8px; }
```

- [ ] **Step 5: Verificar que pasa todo**

Run: `npm run typecheck && npm test`
Expected: sin errores; todos los tests pasan (los tests existentes de `StationPicker` no se ven afectados porque jsdom no define `navigator.geolocation`, así que el botón no aparece).

- [ ] **Step 6: Commit**

```bash
git add features/weather/errorMessage.ts features/weather/StationPicker.tsx app/globals.css test/locate.test.tsx
git commit -m "feat: use-my-location button picks the nearest station" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Fixture `nearest`, README y spec alineado

**Files:**
- Modify: `scripts/refresh-fixtures.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-11-02-geolocation-icons-design.md`

- [ ] **Step 1: Agregar `nearest.json` al script de refresco**

En `scripts/refresh-fixtures.ts`:

- import: `import { currentResponse, forecastResponse, nearestStationResponse, stationsResponse } from '../lib/schemas'`
- en `main()`, después de `const forecast = ...`:

```ts
  const nearest = nearestStationResponse.parse(
    await get(`stations/nearest?lat=${station.lat.toFixed(2)}&lon=${station.lon.toFixed(2)}`),
  )
```

- después de `write('forecast.json', forecast)`: `write('nearest.json', nearest)`.

Run: `npm run typecheck`
Expected: sin errores.

- [ ] **Step 2: Alinear el spec con las decisiones de implementación**

En `docs/superpowers/specs/2026-11-02-geolocation-icons-design.md`:
- En "Íconos → Mapeo de `sky`", punto 9: cambiar "ícono neutro (nube con interrogación)" por "ícono neutro (`WiNa`)".
- En "Dónde": reemplazar "con `aria-label` igual al texto de `sky`" por "decorativo (`aria-hidden`), porque el texto de `sky` ya se muestra al lado".
- En "Viento → Código": reemplazar "renderiza `<span>`s; aplica la clase `wind-se`" por "renderiza un único `<span class=\"wind\">` con el mismo texto que `windText` y le suma la clase `wind--se`".

- [ ] **Step 3: Actualizar el README**

En `README.md`, sección "Estado y próximos pasos":
- Cambiar "Falta publicar en Vercel." por "Publicada en Vercel (`https://pronostico-sml.vercel.app/`)." y quitar de "Pendiente" los puntos 1 y 2 (Vercel y verificación de producción), que ya están hechos.
- Reemplazar el punto de fixtures por: "Correr `npm run refresh-fixtures` otra vez para generar `test/fixtures/nearest.json` (requiere la clave en PowerShell: `$env:SMN_API_URL = '...'` y `$env:SMN_API_KEY = '...'`), y sumar un test de contrato en `test/api.test.ts` que lea `nearest.json` con `nearestStationResponse`."
- En "Siguiente funcionalidad", quitar "geolocalización con `/stations/nearest`" (ya implementada) y dejar "pantalla de histórico, búsqueda/favoritas".
- Mantener la lista de "Mejoras menores".

- [ ] **Step 4: Verificación completa**

Run: `npm run typecheck && npm test && npm run build`
Expected: typecheck sin errores; todos los tests pasan; `next build` termina sin errores.

- [ ] **Step 5: Commit**

```bash
git add scripts/refresh-fixtures.ts README.md docs/superpowers/specs/2026-11-02-geolocation-icons-design.md
git commit -m "docs: align spec and README; refresh script writes nearest fixture" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Paso manual del usuario (no automatizable: requiere la clave)**

Con las variables en la terminal PowerShell del usuario, correr `npm run refresh-fixtures`; revisar `git diff test/fixtures/nearest.json` (sin datos sensibles) y commitear. Después agregar en `test/api.test.ts`:

```ts
import nearest from './fixtures/nearest.json'
// …
  it('el fixture nearest cumple el contrato', () => {
    expect(nearestStationResponse.parse(nearest).data.distance_km).toBeGreaterThanOrEqual(0)
  })
```

(con `import { nearestStationResponse } from '@/lib/schemas'`). Luego: probar en el celular o en viewport móvil (375×812) que el botón pide permiso solo al tocarlo, que el viento SE sale en rojo y que se ven los íconos. **El merge a `main` dispara el deploy a producción: pedirle confirmación al usuario antes de hacerlo.**

---

## Self-Review

**Cobertura del spec**
- Geolocalización: botón, flujo, estados y mensajes → Task 5; proxy y privacidad (lista blanca, solo lat/lon, validación, 400, redondeo) → Tasks 3 y 4; `getNearestStation`, `getPosition`, `roundCoord` → Task 4; fixture → Task 6.
- Íconos: librería, mapeo con prioridad y "hora anterior", día/noche, ícono en `CurrentCard`, gota en pronóstico → Task 1.
- Viento SE: detección, `Wind`, variable/sin dirección, CSS con contraste → Task 2.
- Tests listados en el spec → incluidos en cada task. Sin brechas.

**Placeholders:** ninguno; cada paso de código muestra el código.

**Consistencia de tipos:** `skyIcon(sky, isDay)` y `isDaytime(iso)` (Task 1) se usan igual en `CurrentCard`; `Wind` props `dir/kmh/variable` (Task 2) coinciden en ambos usos; `nearestQuery` (Task 3) devuelve `string | null` y el handler lo trata así; `getNearestStation(lat, lon)` y `roundCoord` (Task 4) coinciden con el test de la Task 5 (`stations/nearest?lat=-34.6&lon=-58.38`); `geoErrorMessage` definida en Task 5 antes de usarse.
