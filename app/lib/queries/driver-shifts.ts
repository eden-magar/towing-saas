import { supabase } from '../supabase'

export async function startShift(driverId: string, companyId: string, lat?: number, lng?: number) {
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

export async function endShift(shiftId: string) {
  const { error } = await supabase
    .from('driver_shifts')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', shiftId)
  if (error) throw error
  return true
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
  await supabase
    .from('driver_locations')
    .insert({ driver_id: driverId, company_id: companyId, shift_id: shiftId, lat, lng })

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
  return data || []
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