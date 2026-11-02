import { isAllowedPath } from '@/lib/proxyAllowlist'

const UPSTREAM_TIMEOUT_MS = 10_000
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' }

function errorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers: JSON_HEADERS })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params
  const route = path.join('/')
  if (!isAllowedPath(route)) return errorResponse(404, 'not_found', 'Ruta no encontrada')

  const base = process.env.SMN_API_URL
  const apiKey = process.env.SMN_API_KEY
  if (!base || !apiKey) {
    console.error('proxy: faltan SMN_API_URL o SMN_API_KEY')
    return errorResponse(500, 'config_error', 'Servicio mal configurado')
  }

  try {
    const upstream = await fetch(`${base}/v1/${route}`, {
      headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      cache: 'no-store',
      redirect: 'error',
    })
    if (upstream.status === 200) {
      return new Response(await upstream.text(), {
        status: 200,
        headers: { ...JSON_HEADERS, 'cache-control': 'public, s-maxage=300, stale-while-revalidate=600' },
      })
    }
    if (upstream.status === 404) {
      return new Response(await upstream.text(), { status: 404, headers: JSON_HEADERS })
    }
    console.error(`proxy: upstream respondió ${upstream.status} para ${route}`)
  } catch {
    console.error(`proxy: fallo de red para ${route}`)
  }
  return errorResponse(502, 'upstream_error', 'No se pudo obtener datos del servicio')
}
