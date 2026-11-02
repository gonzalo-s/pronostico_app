# Pronóstico App: diseño (v1)

PWA mobile-first que consume la API del SMN (`workspace/pronostico`, Hono en Vercel). La v1 muestra clima actual y pronóstico a 5 días de una estación elegida. La estructura queda preparada para sumar después histórico, geolocalización y búsqueda/favoritas, sin implementarlas ahora.

## Decisiones

- **Plataforma:** PWA web (manifest + service worker), instalable, sin tiendas.
- **Stack:** Next.js (App Router) + TypeScript, desplegada en Vercel.
- **API key:** nunca llega al navegador. La app llama a un proxy propio (`/api/smn/...`) que agrega `X-API-Key` desde variables de entorno.
- **Alcance v1:** clima actual + pronóstico 5 días; selector de estación que recuerda la última (default: Buenos Aires).
- **Fuera de la v1:** geolocalización, búsqueda/favoritas, histórico/gráfico, notificaciones.
- **Idioma:** español (Argentina). Horas en ART (UTC-3 fijo).

## Arquitectura

### Proxy server-side

Route handler `app/api/smn/[...path]/route.ts`. Reenvía solo rutas de una lista blanca única (tabla en `lib/proxyAllowlist.ts`), inyectando `X-API-Key`. Cualquier otra ruta responde 404. No reenvía cabeceras del cliente ni expone mensajes internos o la clave; ante fallo upstream devuelve un error genérico.

Lista blanca v1 (GET): `stations`, `stations/:id/current`, `stations/:id/forecast`. Para las funciones futuras se agrega una línea por ruta (`stations/nearest`, `stations/:id/history`). `:id` se valida como entero positivo antes de reenviar.

Variables de entorno: `SMN_API_URL` (sin barra final), `SMN_API_KEY`. Solo en entorno (Vercel o terminal local); nunca versionadas. Se incluye `.env.example` sin valores reales.

### Estructura del repo

```
app/
  layout.tsx, page.tsx            # v1 vive en "/"
  api/smn/[...path]/route.ts      # proxy
features/
  weather/                        # v1: CurrentCard, ForecastDays, StationPicker, hooks
lib/
  api.ts                          # fetch tipado (v1 + tipos de history/nearest ya definidos)
  format.ts                       # formato de números, hora ART, viento
  proxyAllowlist.ts
  useStation.tsx                  # estación activa (contexto + localStorage)
components/ui/                    # piezas compartidas (BottomSheet, Banner, Skeleton)
```

Funciones futuras entran como `features/history`, `features/geolocation`, `features/stations-search`, con rutas propias (`/history`, `/stations`) y navegación inferior por tabs que arranca con una sola pestaña.

### Estado y datos

- TanStack Query para caché, reintentos y estados de carga/error.
- `useStation` expone la estación activa y `setStation`; hoy lee/escribe `localStorage`, mañana puede alimentarse de geolocalización o favoritas sin tocar las pantallas.
- Carga: lista de estaciones → estación guardada/default → `current` y `forecast` en paralelo.

### PWA

`manifest` (nombre, íconos, `display: standalone`, tema) y service worker que cachea el shell y la última respuesta de cada endpoint, para abrir offline con datos viejos claramente marcados.

## Pantalla v1 (única, mobile-first)

- **Header:** nombre de la estación; al tocarlo abre una hoja inferior con el selector (lista con filtro de texto sobre las estaciones).
- **CurrentCard:** temperatura grande, cielo, sensación térmica, humedad, viento (dirección + km/h), presión, visibilidad y hora de observación.
- **ForecastDays:** 5 días con mínima/máxima y lluvia total (`data.days`); al tocar un día se expande a los pasos de 3 h (`data.steps`).
- **Footer:** "Fuente: SMN", `updated_at` y la nota obligatoria: "Pronóstico basado en un modelo numérico; puede diferir del pronóstico oficial del SMN." (se muestra la `meta.note` que devuelve la API).

## Errores y casos borde

- Valores nulos (sensación térmica no calculada, precipitación nula) se muestran como "—" sin romper la tarjeta.
- 404 de una estación: mensaje "Sin datos para esta estación", con el selector accesible.
- Fallo de red o 5xx: banner con "Reintentar"; si hay datos en caché se muestran con aviso.
- Datos desactualizados: si `updated_at` tiene más de 6 horas, aviso "Datos desactualizados".

## Testing

- Vitest + Testing Library: formateadores, expansión de días/pasos, estados nulo/error/desactualizado de los componentes, y `useStation` (persistencia, default).
- Tests del proxy: solo rutas de la lista blanca, inyección de `X-API-Key`, rechazo de rutas no permitidas e `id` inválido, error genérico ante fallo upstream, y que la clave no aparezca en la respuesta.
- Verificación visual en viewport móvil (375×812) antes de dar la v1 por terminada.

## Contrato de la API usada

Todas las respuestas de datos: `{ data, meta: { source, updated_at, note? } }`; los errores: `{ error: { code, message } }`.

- `GET /v1/stations` → `[{ id, name, province, lat, lon, altitude_m }]`
- `GET /v1/stations/:id/current` → `{ id, name, province, observed_at, sky, visibility_km, temp_c, feels_like_c, humidity_pct, wind_dir, wind_kmh, wind_variable, pressure_hpa, updated_at }`
- `GET /v1/stations/:id/forecast` → `{ steps: [{ locality, at, temp_c, wind_dir_deg, wind_kmh, precip_mm, updated_at }], days: [{ date, temp_min_c, temp_max_c, precip_mm_total }] }` + `meta.note`

Particularidades verificadas en la API (ver README del repo `pronostico`): la 7.ª columna de `tiepre` (`feels_like_c`) no está documentada por el SMN, y la ventana de `precip_mm` por paso es incierta (1 h vs 3 h). La UI debe presentarlos sin sobreafirmar (por ejemplo, "lluvia prevista" sin prometer un acumulado exacto).
