import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/app/lib/auth'

type ResolveMapLinkBody = {
  url?: unknown
}

const COORD_PATTERNS: RegExp[] = [
  /\/place\/(-?\d+(?:\.\d+)?),[+\s]*(-?\d+(?:\.\d+)?)/,
  /\/search\/(-?\d+(?:\.\d+)?),[+\s]*(-?\d+(?:\.\d+)?)/,
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  /[?&](?:q|query)=(-?\d+(?:\.\d+)?),[+\s]*(-?\d+(?:\.\d+)?)/,
  /@(-?\d+(?:\.\d+)?),[+\s]*(-?\d+(?:\.\d+)?)/,
  /(?:to=ll\.|ll[.=])(-?\d+(?:\.\d+)?),[+\s]*(-?\d+(?:\.\d+)?)/,
]

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
      const match = candidate.match(pattern)
      if (!match) continue

      const lat = Number(match[1])
      const lng = Number(match[2])
      if (isValidLatLng(lat, lng)) {
        return { lat, lng }
      }
    }
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
