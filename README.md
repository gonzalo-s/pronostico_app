# Pronóstico App

PWA mobile-first que muestra clima actual y pronóstico a 5 días con datos abiertos del SMN (Argentina). Consume la API del repo `pronostico` a través de un proxy server-side, de modo que la `X-API-Key` nunca llega al navegador.

**Datos: Servicio Meteorológico Nacional (SMN), datos abiertos.** El pronóstico proviene de un modelo numérico y puede diferir del oficial del SMN.

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

También sirve contra el preview de `dev` o producción (pasar la URL de Vercel). Guía completa: `npx agent-browser skills get core`. No guardar capturas con datos sensibles en el repo.

## Flujo dev → prod

- `main` es producción (Vercel, URL fija). `dev` es el preview con URL estable. Ambos usan la misma API.
- Se trabaja en `dev` (local con `npm run dev`); cada push a `dev` genera un preview.
- Con el preview ok (tests, `npm run typecheck`, revisión en viewport móvil), PR `dev` → `main`; al mergear, Vercel despliega producción.
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

Crear un proyecto en Vercel apuntando a este repo, con `main` como rama de producción. Definir `SMN_API_URL` y `SMN_API_KEY` en las variables de entorno para **Production** y **Preview** (solo servidor, nunca `NEXT_PUBLIC_`). Asignar un dominio estable a la rama `dev` en Settings → Domains.

## Limitaciones conocidas

- El proxy es público (sin autenticación de usuario): cualquiera puede consultar las 3 rutas permitidas a través de él. Los datos son públicos (SMN), pero el consumo cuenta contra el rate limit de la API; si hace falta, agregar rate limiting al proxy.
- `feels_like_c` (sensación) y la ventana de `precip_mm` por paso (1 h vs 3 h) no están documentados por el SMN; la UI no promete acumulados exactos.
- Offline: se muestran las últimas respuestas guardadas por el service worker; sin una primera visita online no hay datos.
- El service worker es mínimo: `/api/smn/*` y las navegaciones son network-first (solo recurren a la caché cuando la petición de red falla) y `/_next/static/*` e `/icons/*` son cache-first; las entradas de caché de `/icons/*` y de chunks antiguos de `/_next/static/*` no tienen versionado ni se limpian.
