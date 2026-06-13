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

  const { licenseNumber, sourceType, mappedData, rawData } = body
  if (!licenseNumber?.trim() || !sourceType?.trim()) {
    return NextResponse.json(
      { ok: false, error: 'licenseNumber and sourceType are required' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin.from('vehicles').upsert(
    {
      license_number: licenseNumber,
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

  return NextResponse.json({ ok: true })
}
