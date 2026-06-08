import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/app/lib/auth'
import {
  mapEventToSpecialEventPayload,
  type EventForLegacyMapping,
} from '@/app/lib/integrations/legacy-calendar/event-mapper'
import { sendToLegacyCalendar } from '@/app/lib/integrations/legacy-calendar/sender'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type LegacyCalendarCompanySettings = {
  legacy_calendar_enabled: boolean | null
  legacy_calendar_url: string | null
}

type SyncEventRequestBody = {
  event_id?: unknown
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
    console.error('[legacy-calendar-sync-event] company_settings load failed', error)
    throw error
  }

  return data as LegacyCalendarCompanySettings | null
}

async function loadEventForLegacyMapping(
  eventId: string
): Promise<(EventForLegacyMapping & { company_id: string; status: string }) | null> {
  const { data: eventRow, error: eventError } = await supabaseAdmin
    .from('events')
    .select(
      `
      *,
      customer:customers (
        id,
        name,
        phone
      ),
      driver:drivers (
        id,
        user:users (
          full_name
        )
      )
    `
    )
    .eq('id', eventId)
    .maybeSingle()

  if (eventError) {
    console.error('[legacy-calendar-sync-event] event load failed', eventError)
    throw eventError
  }

  if (!eventRow) {
    return null
  }

  return eventRow as EventForLegacyMapping & { company_id: string; status: string }
}

export async function POST(request: NextRequest) {
  try {
    let body: SyncEventRequestBody
    try {
      body = (await request.json()) as SyncEventRequestBody
    } catch {
      return NextResponse.json({ ok: false, error: 'event_id required' }, { status: 400 })
    }

    const eventId =
      typeof body.event_id === 'string' ? body.event_id.trim() : ''

    if (!eventId) {
      return NextResponse.json({ ok: false, error: 'event_id required' }, { status: 400 })
    }

    const currentUser = await getAuthUser(request)
    if (!currentUser) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }

    const event = await loadEventForLegacyMapping(eventId)

    if (!event) {
      return NextResponse.json({ ok: false, error: 'event not found' }, { status: 404 })
    }

    if (
      currentUser.role !== 'super_admin' &&
      currentUser.company_id !== event.company_id
    ) {
      return NextResponse.json({ ok: false, error: 'event not found' }, { status: 404 })
    }

    if (event.status !== 'approved') {
      return NextResponse.json({ ok: true, synced: false, reason: 'not_approved' })
    }

    const settings = await loadLegacyCalendarSettings(event.company_id)

    if (settings?.legacy_calendar_enabled !== true) {
      return NextResponse.json({ ok: true, synced: false, reason: 'disabled' })
    }

    const calendarUrl = settings.legacy_calendar_url?.trim() ?? ''
    if (!calendarUrl) {
      return NextResponse.json({ ok: true, synced: false, reason: 'no_url' })
    }

    const payload = mapEventToSpecialEventPayload(event)
    const result = await sendToLegacyCalendar(calendarUrl, payload)

    if (result.ok) {
      return NextResponse.json({
        ok: true,
        synced: true,
        status: result.status,
      })
    }

    console.error('[legacy-calendar-sync-event] send failed', {
      event_id: eventId,
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
    console.error('[legacy-calendar-sync-event] internal error', err)
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 })
  }
}
