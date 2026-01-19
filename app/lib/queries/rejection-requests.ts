import { supabase } from '../supabase'

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

  return data.map(request => ({
    ...request,
    driver: {
      id: request.driver_id,
      user: users?.find(u => u.id === drivers?.find(d => d.id === request.driver_id)?.user_id) || null
    }
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