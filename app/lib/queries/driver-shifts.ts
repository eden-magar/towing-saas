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

function needsShiftAddressBackfill(address: string | null | undefined): boolean {
  return needsLocationAddressBackfill(address)
}

function roundedCoordKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

type GeocodeResult = {
  address: string | null
  error?: string
}

async function geocodeToRealAddress(lat: number, lng: number): Promise<GeocodeResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      return { address: null, error: 'no_session' }
    }

    const res = await fetch('/api/reverse-geocode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ lat, lng }),
    })

    const data = (await res.json()) as { ok?: boolean; address?: string; error?: string }

    if (!res.ok) {
      return { address: null, error: data.error || `http_${res.status}` }
    }
    if (!data.ok || !data.address) {
      return { address: null, error: data.error || 'no_address' }
    }
    if (isCoordShapedAddress(data.address)) {
      return { address: null, error: 'coord_shaped_result' }
    }
    return { address: data.address }
  } catch (err) {
    return {
      address: null,
      error: err instanceof Error ? err.message : 'network_error',
    }
  }
}

function bumpGeocodeError(counts: Record<string, number>, reason: string) {
  counts[reason] = (counts[reason] ?? 0) + 1
}

const DRIVER_LOCATIONS_BACKFILL_PAGE_SIZE = 1000

type LocationPingRow = {
  id: string
  lat: number
  lng: number
  address: string | null
}

type DriverLocationBackfillScan = {
  rowsNeedingBackfill: LocationPingRow[]
  byCoord: Map<string, { lat: number; lng: number; ids: string[] }>
  totalRowsScanned: number
  pagesLoaded: number
  scanComplete: boolean
}

async function scanDriverLocationsForBackfill(
  companyId: string,
  startDate: string,
  endDate: string,
  maxCoordBuckets?: number
): Promise<DriverLocationBackfillScan> {
  const rowsNeedingBackfill: LocationPingRow[] = []
  const byCoord = new Map<string, { lat: number; lng: number; ids: string[] }>()
  let totalRowsScanned = 0
  let pagesLoaded = 0
  let from = 0
  let scanComplete = false

  while (true) {
    const to = from + DRIVER_LOCATIONS_BACKFILL_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('driver_locations')
      .select('id, lat, lng, address')
      .eq('company_id', companyId)
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('timestamp', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (error) throw error

    const page = data ?? []
    pagesLoaded += 1
    totalRowsScanned += page.length

    for (const row of page) {
      if (
        row.lat == null ||
        row.lng == null ||
        !needsLocationAddressBackfill(row.address)
      ) {
        continue
      }

      const ping = row as LocationPingRow
      const key = roundedCoordKey(ping.lat, ping.lng)
      const bucket = byCoord.get(key)

      if (bucket) {
        bucket.ids.push(ping.id)
        rowsNeedingBackfill.push(ping)
        continue
      }

      if (maxCoordBuckets != null && byCoord.size >= maxCoordBuckets) {
        continue
      }

      byCoord.set(key, { lat: ping.lat, lng: ping.lng, ids: [ping.id] })
      rowsNeedingBackfill.push(ping)
    }

    if (page.length < DRIVER_LOCATIONS_BACKFILL_PAGE_SIZE) {
      scanComplete = true
      break
    }

    if (maxCoordBuckets != null && byCoord.size >= maxCoordBuckets) {
      break
    }

    from += DRIVER_LOCATIONS_BACKFILL_PAGE_SIZE
  }

  return {
    rowsNeedingBackfill,
    byCoord,
    totalRowsScanned,
    pagesLoaded,
    scanComplete,
  }
}

async function countLocationRowsNeedingBackfill(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  let remaining = 0
  let totalRowsScanned = 0
  let pagesLoaded = 0
  let from = 0

  while (true) {
    const to = from + DRIVER_LOCATIONS_BACKFILL_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('driver_locations')
      .select('id, address')
      .eq('company_id', companyId)
      .gte('timestamp', startDate)
      .lte('timestamp', endDate)
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .order('timestamp', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (error) throw error

    const page = data ?? []
    pagesLoaded += 1
    totalRowsScanned += page.length

    for (const row of page) {
      if (needsLocationAddressBackfill(row.address)) {
        remaining += 1
      }
    }

    if (page.length < DRIVER_LOCATIONS_BACKFILL_PAGE_SIZE) break
    from += DRIVER_LOCATIONS_BACKFILL_PAGE_SIZE
  }

  console.log('[countLocationRowsNeedingBackfill]', {
    totalRowsScanned,
    pagesLoaded,
    remainingRowsNeedingBackfill: remaining,
  })

  return remaining
}

export type BackfillLocationAddressesOptions = {
  /** Max distinct coord buckets to geocode in this run. */
  maxCoordBuckets?: number
  /** Skip full paginated recount after updates (faster batches). */
  skipRemainingCount?: boolean
}

export type BackfillLocationAddressesResult = {
  rowsNeedingBackfill: number
  coordBuckets: number
  coordBucketsProcessed: number
  rowsUpdated: number
  failedGeocodes: number
  failedUpdates: number
  remainingRowsNeedingBackfill: number
  geocodeErrors: Record<string, number>
}

type ShiftAddressBackfillRow = {
  id: string
  start_lat: number | null
  start_lng: number | null
  start_address: string | null
  end_lat: number | null
  end_lng: number | null
  end_address: string | null
}

type ShiftAddressBackfillScan = {
  shifts: ShiftAddressBackfillRow[]
  totalRowsScanned: number
  pagesLoaded: number
}

function shiftNeedsStartAddressBackfill(shift: ShiftAddressBackfillRow): boolean {
  return needsShiftAddressBackfill(shift.start_address)
}

function shiftNeedsEndAddressBackfill(shift: ShiftAddressBackfillRow): boolean {
  return (
    needsShiftAddressBackfill(shift.end_address) &&
    shift.end_lat != null &&
    shift.end_lng != null
  )
}

function countShiftAddressFieldsNeedingBackfill(shifts: ShiftAddressBackfillRow[]): number {
  let count = 0
  for (const shift of shifts) {
    if (shiftNeedsStartAddressBackfill(shift)) count += 1
    if (shiftNeedsEndAddressBackfill(shift)) count += 1
  }
  return count
}

async function scanShiftsForAddressBackfill(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<ShiftAddressBackfillScan> {
  const shifts: ShiftAddressBackfillRow[] = []
  let totalRowsScanned = 0
  let pagesLoaded = 0
  let from = 0

  while (true) {
    const to = from + DRIVER_LOCATIONS_BACKFILL_PAGE_SIZE - 1
    const { data, error } = await supabase
      .from('driver_shifts')
      .select('id, start_lat, start_lng, start_address, end_lat, end_lng, end_address')
      .eq('company_id', companyId)
      .gte('started_at', startDate)
      .lte('started_at', endDate)
      .order('started_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)

    if (error) throw error

    const page = (data ?? []) as ShiftAddressBackfillRow[]
    pagesLoaded += 1
    totalRowsScanned += page.length

    for (const shift of page) {
      if (
        shiftNeedsStartAddressBackfill(shift) ||
        shiftNeedsEndAddressBackfill(shift)
      ) {
        shifts.push(shift)
      }
    }

    if (page.length < DRIVER_LOCATIONS_BACKFILL_PAGE_SIZE) break
    from += DRIVER_LOCATIONS_BACKFILL_PAGE_SIZE
  }

  return { shifts, totalRowsScanned, pagesLoaded }
}

async function countShiftAddressFieldsNeedingBackfillInRange(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<number> {
  const { shifts } = await scanShiftsForAddressBackfill(companyId, startDate, endDate)
  return countShiftAddressFieldsNeedingBackfill(shifts)
}

export type BackfillShiftAddressesResult = {
  totalRowsScanned: number
  pagesLoaded: number
  rowsNeedingBackfill: number
  rowsUpdated: number
  failedGeocodes: number
  failedUpdates: number
  remainingRowsNeedingBackfill: number
  geocodeErrors: Record<string, number>
}

async function resolveStartAddressForShift(
  shift: ShiftAddressBackfillRow,
  firstPingByShiftId: Map<string, { lat: number; lng: number; address: string | null }>
): Promise<{ address: string | null; error?: string }> {
  if (shift.start_lat != null && shift.start_lng != null) {
    const result = await geocodeToRealAddress(shift.start_lat, shift.start_lng)
    return { address: result.address, error: result.error }
  }

  const firstPing = firstPingByShiftId.get(shift.id)
  if (!firstPing) {
    return { address: null, error: 'no_start_coords_or_ping' }
  }

  if (firstPing.address && !isCoordShapedAddress(firstPing.address)) {
    return { address: firstPing.address }
  }

  const result = await geocodeToRealAddress(firstPing.lat, firstPing.lng)
  return { address: result.address, error: result.error }
}

/** Backfill driver_shifts.start_address and end_address from coords or first location ping. */
export async function backfillShiftStartAddresses(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<BackfillShiftAddressesResult> {
  const { shifts, totalRowsScanned, pagesLoaded } = await scanShiftsForAddressBackfill(
    companyId,
    startDate,
    endDate
  )

  const rowsNeedingBackfill = countShiftAddressFieldsNeedingBackfill(shifts)
  const geocodeErrors: Record<string, number> = {}

  if (rowsNeedingBackfill === 0) {
    const result: BackfillShiftAddressesResult = {
      totalRowsScanned,
      pagesLoaded,
      rowsNeedingBackfill: 0,
      rowsUpdated: 0,
      failedGeocodes: 0,
      failedUpdates: 0,
      remainingRowsNeedingBackfill: 0,
      geocodeErrors,
    }
    console.log('[backfillShiftStartAddresses]', result)
    return result
  }

  const shiftsNeedingPing = shifts.filter(
    (shift) =>
      shiftNeedsStartAddressBackfill(shift) &&
      (shift.start_lat == null || shift.start_lng == null)
  )
  const firstPingByShiftId = new Map<string, { lat: number; lng: number; address: string | null }>()

  if (shiftsNeedingPing.length > 0) {
    const shiftIds = shiftsNeedingPing.map((shift) => shift.id)
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

  let rowsUpdated = 0
  let failedGeocodes = 0
  let failedUpdates = 0

  for (const shift of shifts) {
    const updateData: { start_address?: string; end_address?: string } = {}

    if (shiftNeedsStartAddressBackfill(shift)) {
      try {
        const { address, error: geocodeError } = await resolveStartAddressForShift(
          shift,
          firstPingByShiftId
        )
        if (!address) {
          failedGeocodes += 1
          bumpGeocodeError(geocodeErrors, geocodeError || 'unknown_start_geocode_failure')
        } else {
          updateData.start_address = address
        }
      } catch (err) {
        failedGeocodes += 1
        const message = err instanceof Error ? err.message : 'unexpected_start_geocode_error'
        bumpGeocodeError(geocodeErrors, message)
        console.error('[backfillShiftStartAddresses] start geocode failed:', shift.id, err)
      }
    }

    if (shiftNeedsEndAddressBackfill(shift)) {
      try {
        const { address, error: geocodeError } = await geocodeToRealAddress(
          shift.end_lat!,
          shift.end_lng!
        )
        if (!address) {
          failedGeocodes += 1
          bumpGeocodeError(geocodeErrors, geocodeError || 'unknown_end_geocode_failure')
        } else {
          updateData.end_address = address
        }
      } catch (err) {
        failedGeocodes += 1
        const message = err instanceof Error ? err.message : 'unexpected_end_geocode_error'
        bumpGeocodeError(geocodeErrors, message)
        console.error('[backfillShiftStartAddresses] end geocode failed:', shift.id, err)
      }
    }

    if (Object.keys(updateData).length === 0) continue

    const { error: updateError } = await supabase
      .from('driver_shifts')
      .update(updateData)
      .eq('id', shift.id)

    if (updateError) {
      failedUpdates += Object.keys(updateData).length
      bumpGeocodeError(geocodeErrors, `update_failed:${updateError.message}`)
      console.error('[backfillShiftStartAddresses] update failed:', updateError)
      continue
    }

    rowsUpdated += Object.keys(updateData).length
  }

  const remainingRowsNeedingBackfill = await countShiftAddressFieldsNeedingBackfillInRange(
    companyId,
    startDate,
    endDate
  )

  const result: BackfillShiftAddressesResult = {
    totalRowsScanned,
    pagesLoaded,
    rowsNeedingBackfill,
    rowsUpdated,
    failedGeocodes,
    failedUpdates,
    remainingRowsNeedingBackfill,
    geocodeErrors,
  }

  console.log('[backfillShiftStartAddresses]', result)

  return result
}

export async function backfillLocationAddresses(
  companyId: string,
  startDate: string,
  endDate: string,
  options?: BackfillLocationAddressesOptions
): Promise<BackfillLocationAddressesResult> {
  const maxCoordBuckets = options?.maxCoordBuckets
  const {
    rowsNeedingBackfill: rows,
    byCoord,
    totalRowsScanned,
    pagesLoaded,
    scanComplete,
  } = await scanDriverLocationsForBackfill(
    companyId,
    startDate,
    endDate,
    maxCoordBuckets
  )

  const rowsNeedingBackfill = rows.length
  const geocodeErrors: Record<string, number> = {}
  const coordBuckets = byCoord.size

  if (rowsNeedingBackfill === 0) {
    const result: BackfillLocationAddressesResult = {
      rowsNeedingBackfill: 0,
      coordBuckets: 0,
      coordBucketsProcessed: 0,
      rowsUpdated: 0,
      failedGeocodes: 0,
      failedUpdates: 0,
      remainingRowsNeedingBackfill: 0,
      geocodeErrors,
    }
    console.log('[backfillLocationAddresses]', {
      ...result,
      totalRowsScanned,
      pagesLoaded,
      scanComplete,
    })
    return result
  }

  let rowsUpdated = 0
  let failedGeocodes = 0
  let failedUpdates = 0
  let coordBucketsProcessed = 0

  for (const { lat, lng, ids } of byCoord.values()) {
    try {
      const { address, error: geocodeError } = await geocodeToRealAddress(lat, lng)
      if (!address) {
        failedGeocodes += ids.length
        bumpGeocodeError(geocodeErrors, geocodeError || 'unknown_geocode_failure')
        coordBucketsProcessed += 1
        continue
      }

      const { error: updateError } = await supabase
        .from('driver_locations')
        .update({ address })
        .in('id', ids)

      if (updateError) {
        failedUpdates += ids.length
        bumpGeocodeError(geocodeErrors, `update_failed:${updateError.message}`)
        console.error('[backfillLocationAddresses] update failed:', updateError)
        coordBucketsProcessed += 1
        continue
      }

      rowsUpdated += ids.length
      coordBucketsProcessed += 1
    } catch (err) {
      failedGeocodes += ids.length
      const message = err instanceof Error ? err.message : 'unexpected_geocode_error'
      bumpGeocodeError(geocodeErrors, message)
      console.error('[backfillLocationAddresses] geocode failed:', err)
      coordBucketsProcessed += 1
    }
  }

  let remainingRowsNeedingBackfill = 0
  if (options?.skipRemainingCount) {
    remainingRowsNeedingBackfill = Math.max(0, rowsNeedingBackfill - rowsUpdated)
    if (!scanComplete) {
      remainingRowsNeedingBackfill = Math.max(remainingRowsNeedingBackfill, 1)
    }
  } else {
    remainingRowsNeedingBackfill = await countLocationRowsNeedingBackfill(
      companyId,
      startDate,
      endDate
    )
  }

  const result: BackfillLocationAddressesResult = {
    rowsNeedingBackfill,
    coordBuckets,
    coordBucketsProcessed,
    rowsUpdated,
    failedGeocodes,
    failedUpdates,
    remainingRowsNeedingBackfill,
    geocodeErrors,
  }

  console.log('[backfillLocationAddresses]', {
    ...result,
    totalRowsScanned,
    pagesLoaded,
    scanComplete,
    maxCoordBuckets: maxCoordBuckets ?? null,
  })

  return result
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