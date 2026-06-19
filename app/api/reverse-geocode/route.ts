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

async function reverseGeocodeAddress(lat: number, lng: number): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    return null
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
    console.error('[reverse-geocode] geocode failed', err)
  }

  return null
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

    const address = await reverseGeocodeAddress(lat, lng)
    if (!address) {
      return NextResponse.json({ ok: false })
    }

    return NextResponse.json({ ok: true, address })
  } catch (err) {
    console.error('[reverse-geocode] request failed', err)
    return NextResponse.json({ ok: false, error: 'server error' }, { status: 500 })
  }
}
