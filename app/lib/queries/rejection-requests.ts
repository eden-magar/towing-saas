import { supabase } from '../supabase'
import { getDriverDisplayName, hebrewTowStatusLabel, logTowAction } from './tow-change-log'

export type RejectionReason = 'break' | 'vehicle_issue' | 'too_far' | 'personal' | 'other'

export const REJECTION_REASONS = [
  { key: 'break' as const, label: 'בהפסקה', icon: '☕' },
  { key: 'vehicle_issue' as const, label: 'תקלה בגרר', icon: '🔧' },
  { key: 'too_far' as const, label: 'רחוק מדי', icon: '📍' },
  { key: 'personal' as const, label: 'סיבה אישית', icon: '👤' },
  { key: 'other' as const, label: 'אחר', icon: '💬' },
]

// יצירת בקשת דחייה
export async function createRejectionRequest(
  towId: string,
  driverId: string,
  companyId: string,
  reason: RejectionReason,
  reasonNote?: string
) {
  const { data, error } = await supabase
    .from('tow_rejection_requests')
    .insert({
      tow_id: towId,
      driver_id: driverId,
      company_id: companyId,
      reason,
      reason_note: reasonNote || null
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// בדיקה אם יש בקשה ממתינה
export async function getPendingRejectionRequest(towId: string, driverId: string) {
  const { data } = await supabase
    .from('tow_rejection_requests')
    .select('*')
    .eq('tow_id', towId)
    .eq('driver_id', driverId)
    .eq('status', 'pending')
    .single()

  return data || null
}

// ספירת בקשות ממתינות
export async function countPendingRejectionRequests(companyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('tow_rejection_requests')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('status', 'pending')

  if (error) {
    console.error('Error counting pending requests:', error)
    return 0
  }

  return count || 0
}

// שליפת בקשות ממתינות עם פרטים
export async function getPendingRejectionRequests(companyId: string) {
  const { data, error } = await supabase
    .from('tow_rejection_requests')
    .select('*')
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching pending rejection requests:', error)
    return []
  }

  if (!data || data.length === 0) return []

  // שליפת פרטי נהגים בנפרד
  const driverIds = data.map(r => r.driver_id)
  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, user_id')
    .in('id', driverIds)

  const userIds = drivers?.map(d => d.user_id) || []
  const { data: users } = await supabase
    .from('users')
    .select('id, full_name, phone')
    .in('id', userIds)

  const towIds = data.map(r => r.tow_id).filter(Boolean)
  const { data: tows } = await supabase
    .from('tows')
    .select('id, order_number, customer:customers(id, name)')
    .in('id', towIds)

  return data.map(request => ({
    ...request,
    driver: {
      id: request.driver_id,
      user: users?.find(u => u.id === drivers?.find(d => d.id === request.driver_id)?.user_id) || null
    },
    tow: tows?.find(t => t.id === request.tow_id) || null
  }))
}
// אישור בקשת דחייה
export async function approveRejectionRequest(
  requestId: string,
  reviewerId: string,
  reassignToDriverId?: string
): Promise<boolean> {
  const { data: request, error: fetchError } = await supabase
    .from('tow_rejection_requests')
    .select('tow_id')
    .eq('id', requestId)
    .single()

  if (fetchError || !request) {
    console.error('Error fetching request:', fetchError)
    return false
  }

  // עדכון הבקשה
  const { error: updateError } = await supabase
    .from('tow_rejection_requests')
    .update({
      status: 'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      reassigned_to: reassignToDriverId || null
    })
    .eq('id', requestId)

  if (updateError) {
    console.error('Error approving request:', updateError)
    return false
  }

  // עדכון הגרירה
  if (reassignToDriverId) {
    await supabase
      .from('tows')
      .update({ 
        driver_id: reassignToDriverId,
        status: 'assigned'
      })
      .eq('id', request.tow_id)
  } else {
    await supabase
      .from('tows')
      .update({ 
        driver_id: null,
        status: 'pending'
      })
      .eq('id', request.tow_id)
  }

  const newDriverName = reassignToDriverId
    ? await getDriverDisplayName(reassignToDriverId)
    : null
  await logTowAction(
    request.tow_id,
    [
      {
        field_name: 'אישור דחייה',
        old_value: null,
        new_value: reassignToDriverId
          ? `הועבר לנהג ${newDriverName ?? ''} (${hebrewTowStatusLabel('assigned')})`
          : `הוחזר לתור (${hebrewTowStatusLabel('pending')})`,
      },
    ],
    reviewerId
  )

  return true
}

// דחיית בקשת דחייה
export async function denyRejectionRequest(
  requestId: string,
  reviewerId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('tow_rejection_requests')
    .update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', requestId)

  if (error) {
    console.error('Error denying request:', error)
    return false
  }

  return true
}

export async function cancelRejectionRequest(requestId: string) {
  const { error } = await supabase
    .from('tow_rejection_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
  if (error) throw error
  return true
}

export async function getApprovedRejectionRequestsForDriver(driverId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('tow_rejection_requests')
    .select('id, tow_id, reviewed_at, tow:tows(order_number)')
    .eq('driver_id', driverId)
    .eq('status', 'approved')
    .gte('reviewed_at', since)
  return data || []
}

export async function getRejectionRequestsForTow(towId: string) {
  const { data, error } = await supabase
    .from('tow_rejection_requests')
    .select('*')
    .eq('tow_id', towId)
    .order('created_at', { ascending: true })

  if (error) return []
  if (!data || data.length === 0) return []

  const driverIds = data.map(r => r.driver_id).filter(Boolean)
  const reviewerIds = data.map(r => r.reviewed_by).filter(Boolean)
  const userIds = [...new Set([...driverIds, ...reviewerIds])]

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, user_id')
    .in('id', driverIds)

  const { data: users } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', userIds.length > 0 ? userIds : ['none'])

  return data.map(r => ({
    ...r,
    driverName: users?.find(u => u.id === drivers?.find(d => d.id === r.driver_id)?.user_id)?.full_name || null,
    reviewerName: users?.find(u => u.id === r.reviewed_by)?.full_name || null,
  }))
}