import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/app/lib/auth'
import { mapTowToLegacyPayload, type TowForLegacyMapping } from '@/app/lib/integrations/legacy-calendar/mapper'
import { sendToLegacyCalendar } from '@/app/lib/integrations/legacy-calendar/sender'
import type { TowPointWithDetails, TowWithDetails } from '@/app/lib/queries/tows'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type LegacyCalendarCompanySettings = {
  legacy_calendar_enabled: boolean | null
  legacy_calendar_url: string | null
}

type SyncRequestBody = {
  tow_id?: unknown
}

async function loadLegacyCalendarSettings(
  companyId: string
): Promise<LegacyCalendarCompanySettings | null> {
  const { data, error } = await supabaseAdmin
    .from('company_settings')
    .select('legacy_calendar_enabled, legacy_calendar_url')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    console.error('[legacy-calendar-sync] company_settings load failed', error)
    throw error
  }

  return data as LegacyCalendarCompanySettings | null
}

/**
 * Loads tow + vehicles + points (with point↔vehicle links), customer, company name,
 * and creator email for {@link mapTowToLegacyPayload}. Uses service role to avoid RLS gaps.
 */
async function loadTowForLegacyMapping(towId: string): Promise<TowForLegacyMapping | null> {
  const { data: towRow, error: towError } = await supabaseAdmin
    .from('tows')
    .select(
      `
      *,
      customer:customers (
        id,
        name,
        phone,
        email,
        address
      )
    `
    )
    .eq('id', towId)
    .maybeSingle()

  if (towError) {
    console.error('[legacy-calendar-sync] tow load failed', towError)
    throw towError
  }

  if (!towRow) {
    return null
  }

  const { data: vehicles, error: vehiclesError } = await supabaseAdmin
    .from('tow_vehicles')
    .select('*')
    .eq('tow_id', towId)
    .order('order_index', { ascending: true })

  if (vehiclesError) {
    console.error('[legacy-calendar-sync] tow_vehicles load failed', vehiclesError)
    throw vehiclesError
  }

  const { data: points, error: pointsError } = await supabaseAdmin
    .from('tow_points')
    .select(
      `
      *,
      vehicles:tow_point_vehicles (
        id,
        action,
        vehicle:tow_vehicles (
          id,
          plate_number,
          manufacturer,
          model,
          year,
          color,
          is_working,
          vehicle_type,
          tow_reason,
          notes,
          order_index,
          vehicle_code,
          fuel_type,
          drive_type,
          gear_type,
          drive_technology,
          total_weight
        )
      )
    `
    )
    .eq('tow_id', towId)
    .order('point_order', { ascending: true })

  if (pointsError) {
    console.error('[legacy-calendar-sync] tow_points load failed', pointsError)
    throw pointsError
  }

  const companyId = towRow.company_id as string

  const { data: companyRow, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('name')
    .eq('id', companyId)
    .maybeSingle()

  if (companyError) {
    console.error('[legacy-calendar-sync] company load failed', companyError)
    throw companyError
  }

  let creatorEmail = ''
  const createdBy = towRow.created_by as string | null
  if (createdBy) {
    const { data: creatorRow, error: creatorError } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', createdBy)
      .maybeSingle()

    if (creatorError) {
      console.error('[legacy-calendar-sync] creator load failed', creatorError)
      throw creatorError
    }

    creatorEmail = creatorRow?.email ?? ''
  }

  const tow: TowWithDetails = {
    ...(towRow as TowWithDetails),
    customer: towRow.customer as TowWithDetails['customer'],
    driver: null,
    second_driver: null,
    truck: null,
    vehicles: vehicles ?? [],
    legs: [],
    points: (points ?? []) as TowPointWithDetails[],
  }

  return {
    ...tow,
    vehicles: vehicles ?? [],
    company: companyRow ? { name: companyRow.name as string } : null,
    creator: { email: creatorEmail },
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: SyncRequestBody
    try {
      body = (await request.json()) as SyncRequestBody
    } catch {
      return NextResponse.json({ ok: false, error: 'tow_id required' }, { status: 400 })
    }

    const towId =
      typeof body.tow_id === 'string' ? body.tow_id.trim() : ''

    if (!towId) {
      return NextResponse.json({ ok: false, error: 'tow_id required' }, { status: 400 })
    }

    const currentUser = await getAuthUser(request)
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const tow = await loadTowForLegacyMapping(towId)

    if (!tow) {
      return NextResponse.json({ ok: false, error: 'tow not found' }, { status: 404 })
    }

    // Hide cross-tenant existence from non–super-admins
    if (
      currentUser.role !== 'super_admin' &&
      currentUser.company_id !== tow.company_id
    ) {
      return NextResponse.json({ ok: false, error: 'tow not found' }, { status: 404 })
    }

    if (tow.status === 'quote') {
      return NextResponse.json({ ok: true, synced: false, reason: 'quote' })
    }

    const settings = await loadLegacyCalendarSettings(tow.company_id)

    if (settings?.legacy_calendar_enabled !== true) {
      return NextResponse.json({ ok: true, synced: false, reason: 'disabled' })
    }

    const calendarUrl = settings.legacy_calendar_url?.trim() ?? ''
    if (!calendarUrl) {
      return NextResponse.json({ ok: true, synced: false, reason: 'no_url' })
    }

    const payload = mapTowToLegacyPayload(tow)
    const result = await sendToLegacyCalendar(calendarUrl, payload)

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        synced: true,
        status: result.status,
      })
    }

    console.error('[legacy-calendar-sync] send failed', {
      tow_id: towId,
      sender_status: result.status,
      error: result.error,
    })

    return NextResponse.json({
      ok: true,
      synced: false,
      reason: 'send_failed',
      sender_status: result.status,
      error: result.error,
    })
  } catch (err) {
    console.error('[legacy-calendar-sync] internal error', err)
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 })
  }
}
