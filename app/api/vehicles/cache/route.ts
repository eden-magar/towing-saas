import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/app/lib/auth'
import type { VehicleLookupResult } from '@/app/lib/types'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type CacheVehicleBody = {
  licenseNumber?: string
  sourceType?: string
  mappedData?: VehicleLookupResult['data']
  rawData?: unknown
  /** When true, record a negative lookup miss (plate not in registry). */
  isMiss?: boolean
  /** Optional TTL override in milliseconds (default 24h). */
  missTtlMs?: number
  /** @deprecated Prefer missTtlMs. */
  missTtlDays?: number
}

export async function POST(request: NextRequest) {
  const currentUser = await getAuthUser(request)
  if (!currentUser) return unauthorizedResponse()

  let body: CacheVehicleBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { licenseNumber, sourceType, mappedData, rawData, isMiss, missTtlMs, missTtlDays } = body
  if (!licenseNumber?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'licenseNumber is required' },
      { status: 400 }
    )
  }

  const cleanLicense = licenseNumber.replace(/\D/g, '')

  if (isMiss) {
    const DEFAULT_MISS_TTL_MS = 24 * 60 * 60 * 1000
    let ttlMs = DEFAULT_MISS_TTL_MS
    if (Number.isFinite(missTtlMs) && (missTtlMs ?? 0) > 0) {
      ttlMs = missTtlMs!
    } else if (Number.isFinite(missTtlDays) && (missTtlDays ?? 0) > 0) {
      ttlMs = missTtlDays! * 24 * 60 * 60 * 1000
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlMs)

    const { error } = await supabaseAdmin.from('vehicle_lookup_misses').upsert(
      {
        license_number: cleanLicense,
        checked_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'license_number' },
    )

    if (error) {
      console.error('[vehicles/cache] miss upsert failed', error)
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  }

  if (!sourceType?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'sourceType is required for positive cache writes' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin.from('vehicles').upsert(
    {
      license_number: cleanLicense,
      source_type: sourceType,
      manufacturer: mappedData?.manufacturer,
      model: mappedData?.model,
      year: mappedData?.year,
      color: mappedData?.color,
      fuel_type: mappedData?.fuelType,
      total_weight: mappedData?.totalWeight,
      vehicle_type: mappedData?.vehicleType,
      drive_type: mappedData?.driveType,
      drive_technology: mappedData?.driveTechnology,
      gear_type: mappedData?.gearType,
      chassis: mappedData?.chassis,
      import_type: mappedData?.importType,
      raw_data: rawData,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'license_number' }
  )

  if (error) {
    console.error('[vehicles/cache] upsert failed', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  // Clear any stale negative-cache row for this plate (service-role; client cannot DELETE under RLS).
  const { error: missClearError } = await supabaseAdmin
    .from('vehicle_lookup_misses')
    .delete()
    .eq('license_number', cleanLicense)
  if (missClearError) {
    console.warn('[vehicles/cache] miss clear failed', missClearError)
  }

  return NextResponse.json({ ok: true })
}
