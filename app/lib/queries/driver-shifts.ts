import { supabase } from '../supabase'

const JERUSALEM_TZ = 'Asia/Jerusalem'

export type DriverHourlyLocationRow = {
  driver_id: string
  driver_name: string
  date: string
  hour: number
  timestamp: string
  lat: number | null
  lng: number | null
  address: string | null
  shift_id: string | null
}

function getJerusalemDateAndHour(isoTimestamp: string): { date: string; hour: number } {
  const d = new Date(isoTimestamp)
  const date = d.toLocaleDateString('sv-SE', { timeZone: JERUSALEM_TZ })
  const hour = parseInt(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: JERUSALEM_TZ,
      hour: '2-digit',
      hour12: false,
    }).format(d),
    10
  )
  return { date, hour }
}

function aggregateDriverHourlyLocations(rows: any[]): DriverHourlyLocationRow[] {
  const byBucket = new Map<string, DriverHourlyLocationRow>()

  for (const row of rows) {
    if (!row.timestamp || !row.driver_id) continue

    const { date, hour } = getJerusalemDateAndHour(row.timestamp)
    const key = `${row.driver_id}|${date}|${hour}`
    const driver = row.driver as { user?: { full_name?: string } } | null
    const driverName = driver?.user?.full_name || '—'
    const rowMs = new Date(row.timestamp).getTime()

    const existing = byBucket.get(key)
    if (!existing || rowMs > new Date(existing.timestamp).getTime()) {
      byBucket.set(key, {
        driver_id: row.driver_id,
        driver_name: driverName,
        date,
        hour,
        timestamp: row.timestamp,
        lat: row.lat ?? null,
        lng: row.lng ?? null,
        address: row.address ?? null,
        shift_id: row.shift_id ?? null,
      })
    }
  }

  return Array.from(byBucket.values()).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date)
    if (a.hour !== b.hour) return b.hour - a.hour
    return a.driver_name.localeCompare(b.driver_name, 'he')
  })
}

export async function startShift(driverId: string, companyId: string, lat?: number, lng?: number) {
  const { data: existingShift } = await supabase
    .from('driver_shifts')
    .select('id')
    .eq('driver_id', driverId)
    .is('ended_at', null)
    .maybeSingle()

  if (existingShift) return existingShift

  const { data, error } = await supabase
    .from('driver_shifts')
    .insert({
      driver_id: driverId,
      company_id: companyId,
      started_at: new Date().toISOString(),
      start_lat: lat ?? null,
      start_lng: lng ?? null
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function endShift(shiftId: string, lat?: number, lng?: number) {
  const updateData: any = { ended_at: new Date().toISOString() }
  
  if (lat && lng) {
    updateData.end_lat = lat
    updateData.end_lng = lng
    try {
      updateData.end_address = await getAddressFromCoords(lat, lng)
    } catch {
      updateData.end_address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    }
  }

  const { error } = await supabase
    .from('driver_shifts')
    .update(updateData)
    .eq('id', shiftId)
  if (error) throw error

  // עדכון סטטוס נהג ל"לא זמין" בסיום משמרת
  const { data: shiftData } = await supabase
    .from('driver_shifts')
    .select('driver_id')
    .eq('id', shiftId)
    .single()
  if (shiftData?.driver_id) {
    await supabase
      .from('drivers')
      .update({ status: 'unavailable' })
      .eq('id', shiftData.driver_id)
  }

  return true
}

export async function endShiftManually(shiftId: string, endedAt: string, lat?: number, lng?: number) {
  const updateData: any = { ended_at: endedAt }

  if (lat && lng) {
    updateData.end_lat = lat
    updateData.end_lng = lng
    try {
      updateData.end_address = await getAddressFromCoords(lat, lng)
    } catch {
      updateData.end_address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    }
  }

  const { data, error } = await supabase
    .from('driver_shifts')
    .update(updateData)
    .eq('id', shiftId)
    .select('id, driver_id')

  if (error) throw error
  if (!data || data.length === 0) {
    throw new Error('לא נמצאה משמרת לעדכון (ייתכן שאין הרשאה או שהמשמרת כבר סגורה)')
  }

  const { error: driverError } = await supabase
    .from('drivers')
    .update({ status: 'unavailable' })
    .eq('id', data[0].driver_id)

  if (driverError) throw driverError

  return true
}

export async function editShift(params: {
  shiftId: string
  newStartedAt: string | null
  newEndedAt: string | null
  reason: string
}): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('משתמש לא מחובר')

  const { data: shift, error: fetchError } = await supabase
    .from('driver_shifts')
    .select('id, company_id, driver_id, started_at, ended_at')
    .eq('id', params.shiftId)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (!shift) {
    // TODO: remove debug logs once cause confirmed
    console.error('[editShift] shift not found:', { shiftId: params.shiftId })
    throw new Error('המשמרת לא נמצאה')
  }

  const updates: { started_at?: string; ended_at?: string } = {}
  const edits: {
    field_name: 'started_at' | 'ended_at'
    old_value: string | null
    new_value: string
  }[] = []

  if (params.newStartedAt !== null) {
    const oldMs = new Date(shift.started_at).getTime()
    const newMs = new Date(params.newStartedAt).getTime()
    if (oldMs !== newMs) {
      updates.started_at = params.newStartedAt
      edits.push({
        field_name: 'started_at',
        old_value: shift.started_at,
        new_value: params.newStartedAt,
      })
    }
  }

  if (params.newEndedAt !== null) {
    const oldEnded = shift.ended_at
    const oldMs = oldEnded ? new Date(oldEnded).getTime() : null
    const newMs = new Date(params.newEndedAt).getTime()
    if (oldMs !== newMs) {
      updates.ended_at = params.newEndedAt
      edits.push({
        field_name: 'ended_at',
        old_value: oldEnded,
        new_value: params.newEndedAt,
      })
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('לא בוצעו שינויים')
  }

  const { data: updated, error: updateError } = await supabase
    .from('driver_shifts')
    .update(updates)
    .eq('id', params.shiftId)
    .select('id, driver_id')

  if (updateError) throw updateError
  if (!updated || updated.length === 0) {
    // TODO: remove debug logs once cause confirmed
    console.error('[editShift] update returned 0 rows:', {
      shiftId: params.shiftId,
      ended_at: shift.ended_at,
    })
    throw new Error('לא נמצאה משמרת לעדכון (ייתכן שאין הרשאה או שהמשמרת כבר סגורה)')
  }

  for (const edit of edits) {
    const { error: insertError } = await supabase.from('shift_edits').insert({
      shift_id: params.shiftId,
      company_id: shift.company_id,
      edited_by: user.id,
      field_name: edit.field_name,
      old_value: edit.old_value,
      new_value: edit.new_value,
      reason: params.reason,
    })
    if (insertError) throw insertError
  }

  const isClosingOpenShift =
    shift.ended_at === null && edits.some(e => e.field_name === 'ended_at')
  if (isClosingOpenShift) {
    const { error: driverError } = await supabase
      .from('drivers')
      .update({ status: 'unavailable' })
      .eq('id', shift.driver_id)
    if (driverError) throw driverError
  }

  return true
}

export interface ShiftEdit {
  id: string
  shift_id: string
  edited_at: string
  edited_by_name: string
  field_name: 'started_at' | 'ended_at'
  old_value: string | null
  new_value: string
  reason: string
}

export interface ShiftEditSummary {
  shift_id: string
  last_edited_at: string
  last_edited_by_name: string
  edit_count: number
}

const SHIFT_EDIT_USER_SELECT = `
  editor:users!shift_edits_edited_by_fkey (
    full_name
  )
`

type ShiftEditUserJoin = { full_name?: string } | { full_name?: string }[] | null

function editorNameFromJoin(editor: ShiftEditUserJoin | undefined): string {
  if (!editor) return '—'
  if (Array.isArray(editor)) return editor[0]?.full_name || '—'
  return editor.full_name || '—'
}

function mapShiftEditRow(row: {
  id: string
  shift_id: string
  edited_at: string
  field_name: string
  old_value: string | null
  new_value: string
  reason: string
  editor?: ShiftEditUserJoin
}): ShiftEdit {
  return {
    id: row.id,
    shift_id: row.shift_id,
    edited_at: row.edited_at,
    edited_by_name: editorNameFromJoin(row.editor),
    field_name: row.field_name as ShiftEdit['field_name'],
    old_value: row.old_value,
    new_value: row.new_value,
    reason: row.reason,
  }
}

export async function getShiftEdits(shiftId: string): Promise<ShiftEdit[]> {
  const { data, error } = await supabase
    .from('shift_edits')
    .select(`
      id,
      shift_id,
      edited_at,
      field_name,
      old_value,
      new_value,
      reason,
      ${SHIFT_EDIT_USER_SELECT}
    `)
    .eq('shift_id', shiftId)
    .order('edited_at', { ascending: false })

  if (error) throw error
  if (!data || data.length === 0) return []

  return data.map(row => mapShiftEditRow(row as {
    id: string
    shift_id: string
    edited_at: string
    field_name: string
    old_value: string | null
    new_value: string
    reason: string
    editor?: ShiftEditUserJoin
  }))
}

export async function getShiftEditSummaries(
  shiftIds: string[]
): Promise<Map<string, ShiftEditSummary>> {
  if (shiftIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('shift_edits')
    .select(`
      shift_id,
      edited_at,
      ${SHIFT_EDIT_USER_SELECT}
    `)
    .in('shift_id', shiftIds)
    .order('edited_at', { ascending: false })

  if (error) throw error
  if (!data || data.length === 0) return new Map()

  const summaries = new Map<string, ShiftEditSummary>()
  for (const row of data) {
    const r = row as {
      shift_id: string
      edited_at: string
      editor?: ShiftEditUserJoin
    }
    const existing = summaries.get(r.shift_id)
    if (!existing) {
      summaries.set(r.shift_id, {
        shift_id: r.shift_id,
        last_edited_at: r.edited_at,
        last_edited_by_name: editorNameFromJoin(r.editor),
        edit_count: 1,
      })
    } else {
      existing.edit_count += 1
    }
  }

  return summaries
}

export async function getDriversOvertime(companyId: string) {
  const { data, error } = await supabase
    .from('driver_shifts')
    .select(`
      id,
      started_at,
      driver:drivers!inner (
        id,
        work_hours_end,
        user:users!user_id (full_name, phone)
      )
    `)
    .eq('company_id', companyId)
    .is('ended_at', null)

  if (error) throw error
  if (!data) return []

  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const todayStr = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' })

  return data
    .map((shift: any) => {
      const driver = shift.driver as any
      const shiftDateStr = new Date(shift.started_at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' })
      const isFromPreviousDay = shiftDateStr < todayStr

      if (isFromPreviousDay) {
        return { ...shift, overtimeType: 'previous_day' }
      }

      if (!driver?.work_hours_end) return null
      const [endHour, endMin] = driver.work_hours_end.split(':').map(Number)
      const endMinutes = endHour * 60 + endMin
      if (currentMinutes > endMinutes) {
        return { ...shift, overtimeType: 'today' }
      }

      return null
    })
    .filter(Boolean)
}

export async function getActiveShift(driverId: string) {
  const { data } = await supabase
    .from('driver_shifts')
    .select('*')
    .eq('driver_id', driverId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

export async function insertLocation(
  driverId: string,
  companyId: string,
  shiftId: string,
  lat: number,
  lng: number
) {
  let address: string | null = null
  try {
    address = await getAddressFromCoords(lat, lng)
  } catch {
    address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }

  await supabase
    .from('driver_locations')
    .insert({ driver_id: driverId, company_id: companyId, shift_id: shiftId, lat, lng, address })

  await supabase
    .from('drivers')
    .update({ last_lat: lat, last_lng: lng, last_seen_at: new Date().toISOString() })
    .eq('id', driverId)
}

export async function getDriverLocationsForShift(shiftId: string) {
  const { data } = await supabase
    .from('driver_locations')
    .select('*')
    .eq('shift_id', shiftId)
    .order('timestamp', { ascending: true })
  return data || []
}

export async function getActiveDriversWithLocation(companyId: string) {
  const { data } = await supabase
    .from('driver_shifts')
    .select(`
      id,
      driver_id,
      started_at,
      driver:drivers!inner (
        id,
        last_lat,
        last_lng,
        last_seen_at,
        status,
        user:users!user_id (id, full_name, phone)
      )
    `)
    .eq('company_id', companyId)
    .is('ended_at', null)
  return data || []
}

export async function getDriverHoursReport(
  companyId: string,
  startDate: string,
  endDate: string,
  driverId?: string
) {
  let query = supabase
    .from('driver_shifts')
    .select(`
      id,
      started_at,
      ended_at,
      status,
      start_address,
      start_lat,
      start_lng,
      end_address,
      end_lat,
      end_lng,
      driver_id,
      driver:drivers!inner (
        id,
        work_hours_end,
        user:users!user_id (full_name, phone)
      )
    `)
    .eq('company_id', companyId)
    .gte('started_at', startDate)
    .lte('started_at', endDate)
    .order('started_at', { ascending: false })

  if (driverId) {
    query = query.eq('driver_id', driverId)
  }

  const { data, error } = await query
  if (error) throw error

  const shifts = data || []

  // לכל משמרת — שולפים את הגרירה האחרונה של הנהג באותו יום
  const shiftsWithLastTow = await Promise.all(shifts.map(async (shift: any) => {
    const dayStart = new Date(shift.started_at)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(shift.started_at)
    dayEnd.setHours(23, 59, 59, 999)

    const { data: towData } = await supabase
      .from('tows')
      .select('id, status, updated_at, tow_points(address)')
      .eq('driver_id', (shift.driver as any).id)
      .gte('created_at', dayStart.toISOString())
      .lte('created_at', dayEnd.toISOString())
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      ...shift,
      last_tow: towData || null
    }
  }))

  return shiftsWithLastTow
}

export async function getAddressFromCoords(lat: number, lng: number): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=he`
  )
  const data = await res.json()
  if (data.results && data.results.length > 0) {
    return data.results[0].formatted_address
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

const COORD_SHAPED_ADDRESS = /^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+\s*$/

export function isCoordShapedAddress(address: string | null | undefined): boolean {
  if (!address) return false
  return COORD_SHAPED_ADDRESS.test(address)
}

function needsLocationAddressBackfill(address: string | null | undefined): boolean {
  return address == null || isCoordShapedAddress(address)
}

function roundedCoordKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

async function geocodeToRealAddress(lat: number, lng: number): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return null

    const res = await fetch('/api/reverse-geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ lat, lng }),
    })

    if (!res.ok) return null

    const data = (await res.json()) as { ok?: boolean; address?: string }
    if (!data.ok || !data.address) return null
    if (isCoordShapedAddress(data.address)) return null
    return data.address
  } catch {
    return null
  }
}

type LocationPingRow = {
  id: string
  lat: number
  lng: number
  address: string | null
}

type ShiftStartRow = {
  id: string
  start_lat: number | null
  start_lng: number | null
}

/** Resolve lat/lng → address once per distinct spot; persist to driver_locations.address. */
export async function backfillLocationAddresses(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const { data, error } = await supabase
    .from('driver_locations')
    .select('id, lat, lng, address')
    .eq('company_id', companyId)
    .gte('timestamp', startDate)
    .lte('timestamp', endDate)
    .not('lat', 'is', null)
    .not('lng', 'is', null)

  if (error) throw error

  const rows = (data ?? []).filter(
    (row): row is LocationPingRow =>
      row.lat != null &&
      row.lng != null &&
      needsLocationAddressBackfill(row.address)
  )

  const byCoord = new Map<string, { lat: number; lng: number; ids: string[] }>()
  for (const row of rows) {
    const key = roundedCoordKey(row.lat, row.lng)
    const bucket = byCoord.get(key)
    if (bucket) {
      bucket.ids.push(row.id)
    } else {
      byCoord.set(key, { lat: row.lat, lng: row.lng, ids: [row.id] })
    }
  }

  let rowsUpdated = 0

  for (const { lat, lng, ids } of byCoord.values()) {
    try {
      const address = await geocodeToRealAddress(lat, lng)
      if (!address) continue

      const { error: updateError } = await supabase
        .from('driver_locations')
        .update({ address })
        .in('id', ids)

      if (updateError) {
        console.error('[backfillLocationAddresses] update failed:', updateError)
        continue
      }

      rowsUpdated += ids.length
    } catch (err) {
      console.error('[backfillLocationAddresses] geocode failed:', err)
    }
  }

  return rowsUpdated
}

/** Persist driver_shifts.start_address from shift coords or first location ping. end_address not handled yet. */
export async function backfillShiftStartAddresses(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const { data, error } = await supabase
    .from('driver_shifts')
    .select('id, start_lat, start_lng')
    .eq('company_id', companyId)
    .gte('started_at', startDate)
    .lte('started_at', endDate)
    .is('start_address', null)

  if (error) throw error

  const shifts = (data ?? []) as ShiftStartRow[]
  if (shifts.length === 0) return 0

  const shiftsNeedingPing = shifts.filter(s => s.start_lat == null || s.start_lng == null)
  const firstPingByShiftId = new Map<string, { lat: number; lng: number; address: string | null }>()

  if (shiftsNeedingPing.length > 0) {
    const shiftIds = shiftsNeedingPing.map(s => s.id)
    const { data: pings, error: pingsError } = await supabase
      .from('driver_locations')
      .select('shift_id, lat, lng, address, timestamp')
      .in('shift_id', shiftIds)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('timestamp', { ascending: true })

    if (pingsError) throw pingsError

    for (const ping of pings ?? []) {
      if (!ping.shift_id || firstPingByShiftId.has(ping.shift_id)) continue
      firstPingByShiftId.set(ping.shift_id, {
        lat: ping.lat,
        lng: ping.lng,
        address: ping.address ?? null,
      })
    }
  }

  let shiftsUpdated = 0

  for (const shift of shifts) {
    try {
      let address: string | null = null

      if (shift.start_lat != null && shift.start_lng != null) {
        address = await geocodeToRealAddress(shift.start_lat, shift.start_lng)
      } else {
        const firstPing = firstPingByShiftId.get(shift.id)
        if (!firstPing) continue

        if (firstPing.address && !isCoordShapedAddress(firstPing.address)) {
          address = firstPing.address
        } else {
          address = await geocodeToRealAddress(firstPing.lat, firstPing.lng)
        }
      }

      if (!address) continue

      const { error: updateError } = await supabase
        .from('driver_shifts')
        .update({ start_address: address })
        .eq('id', shift.id)

      if (updateError) {
        console.error('[backfillShiftStartAddresses] update failed:', updateError)
        continue
      }

      shiftsUpdated += 1
    } catch (err) {
      console.error('[backfillShiftStartAddresses] shift failed:', shift.id, err)
    }
  }

  return shiftsUpdated
}

export async function getDriverHourlyLocations(
  companyId: string,
  startDate: string,
  endDate: string,
  driverId?: string
): Promise<DriverHourlyLocationRow[]> {
  let query = supabase
    .from('driver_locations')
    .select(`
      id,
      lat,
      lng,
      timestamp,
      address,
      driver_id,
      shift_id,
      driver:drivers!inner (
        id,
        user:users!user_id (full_name, phone)
      )
    `)
    .eq('company_id', companyId)
    .gte('timestamp', startDate)
    .lte('timestamp', endDate)
    .order('timestamp', { ascending: false })

  if (driverId) {
    query = query.eq('driver_id', driverId)
  }

  const { data, error } = await query
  if (error) throw error
  if (!data || data.length === 0) return []

  return aggregateDriverHourlyLocations(data)
}