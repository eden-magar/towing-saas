import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/app/lib/auth'

type ResolveMapLinkBody = {
  url?: unknown
}

/** Decimal patterns in priority order (map @ center is separate, last). */
const COORD_PATTERNS: RegExp[] = [
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  /\/place\/(-?\d+(?:\.\d+)?),[+\s]*(-?\d+(?:\.\d+)?)/,
  /\/search\/(-?\d+(?:\.\d+)?),[+\s]*(-?\d+(?:\.\d+)?)/,
  /[?&](?:q|query)=(-?\d+(?:\.\d+)?),[+\s]*(-?\d+(?:\.\d+)?)/,
  /(?:to=ll\.|ll[.=])(-?\d+(?:\.\d+)?),[+\s]*(-?\d+(?:\.\d+)?)/,
]

/** Map viewport center — fallback only after place pin / DMS. */
const MAP_CENTER_PATTERN = /@(-?\d+(?:\.\d+)?),[+\s]*(-?\d+(?:\.\d+)?)/

const DMS_PATTERN =
  /(\d+)°(\d+)'([\d.]+)"([NS])[+\s]+(\d+)°(\d+)'([\d.]+)"([EW])/i

/** Waze live-map HTML embeds venue coords as JSON (no ll= in final URL). */
const WAZE_JSON_COORD_PATTERN =
  /"lat"\s*:\s*(-?\d+(?:\.\d+)?)[\s\S]{0,200}?"lng"\s*:\s*(-?\d+(?:\.\d+)?)/

function dmsToDecimal(deg: number, min: number, sec: number, hemisphere: string): number {
  let decimal = deg + min / 60 + sec / 3600
  const h = hemisphere.toUpperCase()
  if (h === 'S' || h === 'W') decimal = -decimal
  return decimal
}

function extractDmsCoords(text: string): { lat: number; lng: number } | null {
  const match = text.match(DMS_PATTERN)
  if (!match) return null

  const lat = dmsToDecimal(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    match[4]
  )
  const lng = dmsToDecimal(
    Number(match[5]),
    Number(match[6]),
    Number(match[7]),
    match[8]
  )
  if (isValidLatLng(lat, lng)) {
    return { lat, lng }
  }
  return null
}

function matchDecimalPair(
  pattern: RegExp,
  text: string
): { lat: number; lng: number } | null {
  const match = text.match(pattern)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (isValidLatLng(lat, lng)) {
    return { lat, lng }
  }
  return null
}

function isSupportedMapLink(urlString: string): boolean {
  try {
    const parsed = new URL(urlString)
    const host = parsed.hostname.toLowerCase()
    const path = parsed.pathname.toLowerCase()

    if (host === 'maps.app.goo.gl') return true
    if (host === 'goo.gl' && path.startsWith('/maps')) return true
    if (host.startsWith('maps.google.')) return true
    if (host.startsWith('google.') && path.includes('/maps')) return true
    if (host === 'ul.waze.com') return true
    if (host === 'waze.com' || host === 'www.waze.com') return true

    return false
  } catch {
    return false
  }
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

function extractCoordsFromText(text: string): { lat: number; lng: number } | null {
  let decoded = text
  try {
    decoded = decodeURIComponent(text)
  } catch {
    decoded = text
  }

  for (const candidate of [decoded, text]) {
    for (const pattern of COORD_PATTERNS) {
      const coords = matchDecimalPair(pattern, candidate)
      if (coords) return coords
    }

    const dms = extractDmsCoords(candidate)
    if (dms) return dms

    const center = matchDecimalPair(MAP_CENTER_PATTERN, candidate)
    if (center) return center
  }

  return null
}

function extractCoords(finalUrl: string, originalUrl: string): { lat: number; lng: number } | null {
  for (const candidate of [finalUrl, originalUrl]) {
    const coords = extractCoordsFromText(candidate)
    if (coords) return coords
  }
  return null
}

function extractCoordsFromWazeJson(html: string): { lat: number; lng: number } | null {
  const match = html.match(WAZE_JSON_COORD_PATTERN)
  if (!match) return null
  const lat = Number(match[1])
  const lng = Number(match[2])
  if (isValidLatLng(lat, lng)) {
    return { lat, lng }
  }
  return null
}

type GeocodeAddressComponent = {
  long_name?: string
  short_name?: string
  types?: string[]
}

type GeocodeResult = {
  formatted_address?: string
  types?: string[]
  address_components?: GeocodeAddressComponent[]
  geometry?: {
    location?: { lat: number; lng: number }
  }
}

/** City label from address_components: locality, else administrative_area_level_2. */
function cityFromGeocodeResult(result: GeocodeResult): string | null {
  const components = result.address_components ?? []
  const locality = components.find((c) => c.types?.includes('locality'))
  if (locality?.long_name?.trim()) return locality.long_name.trim()
  const admin2 = components.find((c) =>
    c.types?.includes('administrative_area_level_2')
  )
  if (admin2?.long_name?.trim()) return admin2.long_name.trim()
  return null
}

/** Equirectangular distance in meters — fine for nearby geocode candidates. */
function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const x = toRad(lng2 - lng1) * Math.cos(toRad((lat1 + lat2) / 2))
  const y = toRad(lat2 - lat1)
  return Math.sqrt(x * x + y * y) * 6371000
}

function isStreetOrRoute(result: GeocodeResult): boolean {
  const types = result.types ?? []
  return types.includes('street_address') || types.includes('route')
}

function isPlusCode(result: GeocodeResult): boolean {
  return (result.types ?? []).includes('plus_code')
}

function closestResult(
  pool: GeocodeResult[],
  lat: number,
  lng: number
): GeocodeResult {
  let best = pool[0]
  let bestDist = Infinity
  for (const result of pool) {
    const loc = result.geometry?.location
    const dist =
      loc != null ? distanceMeters(lat, lng, loc.lat, loc.lng) : Infinity
    if (dist < bestDist) {
      best = result
      bestDist = dist
    }
  }
  return best
}

/**
 * Pick readable address text:
 * majority city → usable street types (street_address / route) → nearest of those.
 * Falls back to closest non-plus_code in that city, then results[0].
 */
function pickFormattedAddress(
  results: GeocodeResult[],
  lat: number,
  lng: number
): string | null {
  if (results.length === 0) return null

  const withAddress = results.filter((r) => r.formatted_address?.trim())
  if (withAddress.length === 0) return null

  const cityCounts = new Map<string, number>()
  for (const result of withAddress) {
    const city = cityFromGeocodeResult(result)
    if (!city) continue
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1)
  }

  let majorityCity: string | null = null
  let majorityCount = 0
  for (const [city, count] of cityCounts) {
    if (count > majorityCount) {
      majorityCity = city
      majorityCount = count
    }
  }

  // No locality/admin2 on any result → keep legacy first-result behavior.
  if (majorityCity == null) {
    return withAddress[0].formatted_address?.trim() || null
  }

  const cityResults = withAddress.filter(
    (r) => cityFromGeocodeResult(r) === majorityCity
  )
  if (cityResults.length === 0) {
    return withAddress[0].formatted_address?.trim() || null
  }

  const usable = cityResults.filter(isStreetOrRoute)
  if (usable.length > 0) {
    return (
      closestResult(usable, lat, lng).formatted_address?.trim() ||
      withAddress[0].formatted_address ||
      null
    )
  }

  // No street/route in majority city: closest of any type, avoiding plus_code
  // when another candidate exists.
  const nonPlus = cityResults.filter((r) => !isPlusCode(r))
  const fallbackPool = nonPlus.length > 0 ? nonPlus : cityResults
  return (
    closestResult(fallbackPool, lat, lng).formatted_address?.trim() ||
    withAddress[0].formatted_address ||
    null
  )
}

async function reverseGeocodeAddress(lat: number, lng: number): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return `${lat},${lng}`
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=he`
    )
    const data = (await res.json()) as {
      results?: GeocodeResult[]
    }

    const picked = pickFormattedAddress(data.results ?? [], lat, lng)
    if (picked) return picked
  } catch (err) {
    console.error('[resolve-map-link] geocode failed', err)
  }

  return `${lat},${lng}`
}

export async function POST(request: NextRequest) {
  try {
    let body: ResolveMapLinkBody
    try {
      body = (await request.json()) as ResolveMapLinkBody
    } catch {
      return NextResponse.json({ ok: false, error: 'url required' }, { status: 400 })
    }

    const url = typeof body.url === 'string' ? body.url.trim() : ''
    if (!url) {
      return NextResponse.json({ ok: false, error: 'url required' }, { status: 400 })
    }

    const currentUser = await getAuthUser(request)
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    if (!isSupportedMapLink(url)) {
      return NextResponse.json({ ok: false, error: 'unsupported link' }, { status: 400 })
    }

    const res = await fetch(url, { redirect: 'follow' })
    const finalUrl = res.url || url

    let coords = extractCoords(finalUrl, url)
    if (!coords) {
      const bodyText = await res.text()
      coords = extractCoordsFromWazeJson(bodyText)
    }
    if (!coords) {
      return NextResponse.json({ ok: false, error: 'could_not_resolve' }, { status: 422 })
    }

    const address = await reverseGeocodeAddress(coords.lat, coords.lng)

    return NextResponse.json({
      ok: true,
      address,
      lat: coords.lat,
      lng: coords.lng,
    })
  } catch (err) {
    console.error('[resolve-map-link] resolve_failed', err)
    return NextResponse.json({ ok: false, error: 'resolve_failed' }, { status: 500 })
  }
}
