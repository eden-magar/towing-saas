import { supabase } from '../supabase'

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

  if (shift.ended_at !== null) {
    // TODO: remove debug logs once cause confirmed
    console.error('[editShift] shift already closed:', { id: shift.id, ended_at: shift.ended_at })
    throw new Error('המשמרת כבר נסגרה')
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

  const closedShift = edits.some(e => e.field_name === 'ended_at')
  if (closedShift) {
    const { error: driverError } = await supabase
      .from('drivers')
      .update({ status: 'unavailable' })
      .eq('id', shift.driver_id)
    if (driverError) throw driverError
  }

  return true
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
      driver:drivers!inner (
        id,
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

export async function getDriverHourlyLocations(
  companyId: string,
  startDate: string,
  endDate: string,
  driverId?: string
) {
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
  return data || []
}