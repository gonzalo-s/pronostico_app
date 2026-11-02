# Pronóstico App

PWA mobile-first que muestra clima actual y pronóstico a 5 días con datos abiertos del SMN (Argentina). Consume la API del repo `pronostico` a través de un proxy server-side, de modo que la `X-API-Key` nunca llega al navegador.

**Datos: Servicio Meteorológico Nacional (SMN), datos abiertos.** El pronóstico proviene de un modelo numérico y puede diferir del oficial del SMN.

## Contexto del proyecto

- **API:** repo `pronostico` (Hono + Postgres/Neon en Vercel), local en `workspace/pronostico`. URL de producción: `https://pronosticoapi-api-ten.vercel.app` (`/v1/health` es público y muestra la última ingesta por fuente). La ingesta corre desde GitHub Actions cada 2 h (minuto 17 UTC; GitHub puede demorar u omitir corridas) con un cron diario de respaldo en Vercel.
- **Decisiones (v1):** PWA con Next.js; proxy server-side para que la clave no llegue al navegador; alcance = clima actual + pronóstico 5 días; selector de estación que recuerda la última (default Buenos Aires); horas en ART (UTC-3 fijo); valores nulos como "—"; aviso de datos desactualizados si `updated_at` tiene más de 6 h.
- **Fuera de la v1 (estructura ya preparada, sin implementar):** histórico, geolocalización (la API ya tiene `/stations/nearest`), búsqueda/favoritas, notificaciones. Los esquemas de `history` y `nearest` ya están en `lib/schemas.ts`.
- **Diseño y plan:** `docs/superpowers/specs/2026-11-02-pronostico-app-design.md` y `docs/superpowers/plans/2026-11-02-pronostico-app-v1.md`.
- **Estaciones:** el SMN no tiene estación en cada localidad; se elige la más cercana. Ejemplo: para Tigre, "San Fernando Aero" (SADF).

## Variables de entorno

| Variable | Contenido |
|---|---|
| `SMN_API_URL` | URL base de la API, sin barra final |
| `SMN_API_KEY` | Clave para `X-API-Key` (solo servidor) |

Para desarrollo local, crear `.env.local` (ignorado por git) con ambas. Nunca versionar ni imprimir la clave. Ver `.env.example`.

## Desarrollo

```bash
npm install
npm run dev         # http://localhost:3000
npm test
npm run typecheck
npm run build && npm start   # el service worker solo se registra en producción
```

## Pruebas en el navegador (agent-browser)

`agent-browser` (devDependency) maneja un Chrome real para pruebas manuales o guiadas por un agente. Una sola vez: `npx agent-browser install` (descarga Chrome). Con `npm run dev` o `npm start` corriendo:

```bash
npx agent-browser open http://localhost:3000
npx agent-browser set viewport 375 812  # viewport móvil de referencia
npx agent-browser snapshot -i           # elementos interactivos con refs (@e1, ...)
npx agent-browser screenshot mobile.png
npx agent-browser close
```

También sirve contra producción (pasar la URL del dominio). Guía completa: `npx agent-browser skills get core`. No guardar capturas con datos sensibles en el repo.

## Flujo dev → prod

- `main` es producción (Vercel, con el dominio de producción). `dev` es solo de trabajo local: se prueba con `npm run dev`, sin dominio propio. Ambos usan la misma API.
- Se trabaja en `dev` y se prueba en local.
- Con todo ok en local (`npm test`, `npm run typecheck`, revisión en viewport móvil), PR `dev` → `main`; al mergear, Vercel despliega producción.
- No se pushea directo a `main`.

## Estructura

- `app/api/smn/[...path]`: proxy con lista blanca (`lib/proxyAllowlist.ts`). Una línea por ruta nueva.
- `lib/schemas.ts`: contrato con la API (zod). Cada respuesta se valida; si no cumple, la UI muestra "Respuesta inesperada de la API".
- `features/weather`: pantalla v1. Funciones futuras (`history`, `geolocation`, `stations-search`) entran como `features/<nombre>` con su ruta y una entrada en `lib/navigation.ts` (con 2 o más pestañas aparece la barra inferior).
- `public/sw.js`: service worker: `/api/smn/*` y las navegaciones son network-first (caché solo si falla la petición); `/_next/static/*` y `/icons/*` son cache-first.

## Contrato con la API

La API (`/v1`) es la dueña del contrato; esta app solo consume `/v1`. Para refrescar los fixtures desde la API en vivo (también valida el contrato), en tu terminal:

```bash
SMN_API_URL="<url de la API>" SMN_API_KEY="<tu clave>" npm run refresh-fixtures
```

Revisar el diff de `test/fixtures` antes de commitear. Si un test de contrato falla, la API cambió.

## Despliegue (Vercel)

Crear un proyecto en Vercel apuntando a este repo, con `main` como rama de producción y el dominio de producción asignado. Definir `SMN_API_URL` y `SMN_API_KEY` en las variables de entorno de **Production** (solo servidor, nunca `NEXT_PUBLIC_`). Opcional: desactivar los previews de ramas distintas de `main` en Settings → Git, ya que `dev` se prueba en local.

## Estado y próximos pasos

**Estado:** v1 publicada en Vercel (`https://pronostico-sml.vercel.app/`) y verificada contra la API real. En `dev`: íconos del clima, viento del sudeste en rojo y botón "Usar mi ubicación" (`/stations/nearest`); 181 tests, `typecheck` ok. Repo: `gonzalo-s/pronostico_app` (público; nunca commitear claves).

**Pendiente, en orden:**

1. Merge de `dev` a `main` (dispara el deploy a producción) y probar en el celular: íconos, viento SE en rojo y el botón de ubicación (el permiso se pide solo al tocarlo).
2. Generar `test/fixtures/nearest.json` con la API real (`npm run refresh-fixtures`; en PowerShell: `$env:SMN_API_URL = '...'` y `$env:SMN_API_KEY = '...'` antes) y sumar un test de contrato en `test/api.test.ts` que lo valide con `nearestStationResponse`. Los fixtures `*-nulls` son manuales y el script no los toca.
3. Siguiente funcionalidad (a elegir): pantalla de histórico, búsqueda/favoritas.

**Mejoras menores identificadas (no bloqueantes):**

- Service worker: sin fallback ante 5xx o timeout del upstream; caché de `/icons` y de chunks viejos sin versionado.
- Accesibilidad: `BottomSheet` sin trampa de foco; no hay `h1`.
- La etiqueta "Sensación" no aclara que `feels_like_c` no está documentado por el SMN.
- Lista de estaciones vacía: no muestra mensaje.
- `refresh-fixtures` sin timeout ni verificación de https; `titleCase` no trata apóstrofes; algunos tests de borde son finos.
- Caché pública del proxy ante un 200 que no sea JSON.

## Limitaciones conocidas

- El proxy es público (sin autenticación de usuario): cualquiera puede consultar las 3 rutas permitidas a través de él. Los datos son públicos (SMN), pero el consumo cuenta contra el rate limit de la API; si hace falta, agregar rate limiting al proxy.
- `feels_like_c` (sensación) y la ventana de `precip_mm` por paso (1 h vs 3 h) no están documentados por el SMN; la UI no promete acumulados exactos.
- Offline: se muestran las últimas respuestas guardadas por el service worker; sin una primera visita online no hay datos.
- El service worker es mínimo: `/api/smn/*` y las navegaciones son network-first (solo recurren a la caché cuando la petición de red falla) y `/_next/static/*` e `/icons/*` son cache-first; las entradas de caché de `/icons/*` y de chunks antiguos de `/_next/static/*` no tienen versionado ni se limpian.
