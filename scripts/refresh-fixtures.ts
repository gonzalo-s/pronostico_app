import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { currentResponse, forecastResponse, nearestStationResponse, stationsResponse } from '../lib/schemas'
import { pickDefaultStation } from '../lib/stations'

const base = process.env.SMN_API_URL
const apiKey = process.env.SMN_API_KEY
if (!base || !apiKey) {
  console.error('Definí SMN_API_URL y SMN_API_KEY en el entorno de la terminal.')
  process.exit(1)
}

async function get(route: string): Promise<unknown> {
  const res = await fetch(`${base}/v1/${route}`, { headers: { 'X-API-Key': apiKey as string } })
  if (!res.ok) throw new Error(`GET ${route} -> ${res.status}`)
  return res.json()
}

async function main() {
  const stations = stationsResponse.parse(await get('stations'))
  const station = pickDefaultStation(stations.data)
  if (!station) throw new Error('La API no devolvió estaciones')
  const current = currentResponse.parse(await get(`stations/${station.id}/current`))
  const forecast = forecastResponse.parse(await get(`stations/${station.id}/forecast`))
  const nearest = nearestStationResponse.parse(
    await get(`stations/nearest?lat=${station.lat.toFixed(2)}&lon=${station.lon.toFixed(2)}`),
  )

  const subset = [station, ...stations.data.filter((s) => s.id !== station.id)].slice(0, 10)
  const dir = path.join(process.cwd(), 'test', 'fixtures')
  mkdirSync(dir, { recursive: true })
  const write = (file: string, body: unknown) =>
    writeFileSync(path.join(dir, file), `${JSON.stringify(body, null, 2)}\n`)
  write('stations.json', { data: subset, meta: stations.meta })
  write('current.json', current)
  write('forecast.json', forecast)
  write('nearest.json', nearest)
  console.log(`Fixtures actualizados para "${station.name}" (id ${station.id}): ${subset.length} estaciones, ${forecast.data.steps.length} pasos.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : 'error desconocido')
  process.exit(1)
})
