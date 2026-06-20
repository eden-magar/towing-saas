import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/app/lib/auth'

type ReverseGeocodeBody = {
  lat?: unknown
  lng?: unknown
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

type ReverseGeocodeOutcome = {
  address: string | null
  error?: string
}

async function reverseGeocodeAddress(lat: number, lng: number): Promise<ReverseGeocodeOutcome> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return { address: null, error: 'missing_api_key' }
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=he`
    )
    const data = (await res.json()) as {
      results?: Array<{ formatted_address?: string }>
      status?: string
      error_message?: string
    }

    if (data.results?.[0]?.formatted_address) {
      return { address: data.results[0].formatted_address }
    }

    return {
      address: null,
      error: data.error_message || data.status || 'zero_results',
    }
  } catch (err) {
    console.error('[reverse-geocode] geocode failed', err)
    return {
      address: null,
      error: err instanceof Error ? err.message : 'geocode_request_failed',
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser(request)
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    let body: ReverseGeocodeBody
    try {
      body = (await request.json()) as ReverseGeocodeBody
    } catch {
      return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 })
    }

    const lat = typeof body.lat === 'number' ? body.lat : Number(body.lat)
    const lng = typeof body.lng === 'number' ? body.lng : Number(body.lng)

    if (!isValidLatLng(lat, lng)) {
      return NextResponse.json({ ok: false, error: 'invalid coordinates' }, { status: 400 })
    }

    const { address, error } = await reverseGeocodeAddress(lat, lng)
    if (!address) {
      return NextResponse.json({ ok: false, error: error || 'geocode_failed' })
    }

    return NextResponse.json({ ok: true, address })
  } catch (err) {
    console.error('[reverse-geocode] request failed', err)
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 })
  }
}
