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
      results?: Array<{ formatted_address?: string }>
    }

    if (data.results?.[0]?.formatted_address) {
      return data.results[0].formatted_address
    }
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

    const coords = extractCoords(finalUrl, url)
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
