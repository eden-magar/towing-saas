import { supabase } from '../supabase'

export interface ExpiryAlert {
  id: string
  type: 'truck_license' | 'truck_insurance' | 'driver_license'
  entityName: string  // שם הגרר או הנהג
  entityId: string
  expiryDate: string
  daysLeft: number    // ימים שנשארו (שלילי = פג)
  severity: 'expired' | 'critical' | 'warning'  // פג / פחות משבוע / פחות מחודש
}

export async function getExpiryAlerts(companyId: string): Promise<ExpiryAlert[]> {
  const alerts: ExpiryAlert[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  // שליפת גררים עם תאריכים שפגים בקרוב
  const { data: trucks } = await supabase
    .from('tow_trucks')
    .select('id, plate_number, license_expiry, insurance_expiry')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .or(`license_expiry.lte.${thirtyDaysFromNow.toISOString().split('T')[0]},insurance_expiry.lte.${thirtyDaysFromNow.toISOString().split('T')[0]}`)

  // שליפת נהגים עם רישיון שפג בקרוב
  const { data: drivers } = await supabase
    .from('drivers')
    .select(`
      id,
      license_expiry,
      user:users!user_id (full_name)
    `)
    .eq('company_id', companyId)
    .not('license_expiry', 'is', null)
    .lte('license_expiry', thirtyDaysFromNow.toISOString().split('T')[0])

  // עיבוד גררים
  trucks?.forEach(truck => {
    if (truck.license_expiry) {
      const expiry = new Date(truck.license_expiry)
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysLeft <= 30) {
        alerts.push({
          id: `truck_license_${truck.id}`,
          type: 'truck_license',
          entityName: truck.plate_number,
          entityId: truck.id,
          expiryDate: truck.license_expiry,
          daysLeft,
          severity: daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'critical' : 'warning'
        })
      }
    }

    if (truck.insurance_expiry) {
      const expiry = new Date(truck.insurance_expiry)
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysLeft <= 30) {
        alerts.push({
          id: `truck_insurance_${truck.id}`,
          type: 'truck_insurance',
          entityName: truck.plate_number,
          entityId: truck.id,
          expiryDate: truck.insurance_expiry,
          daysLeft,
          severity: daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'critical' : 'warning'
        })
      }
    }
  })

  // עיבוד נהגים
  drivers?.forEach(driver => {
    if (driver.license_expiry) {
      const expiry = new Date(driver.license_expiry)
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const user = driver.user as unknown as { full_name: string }
      
      if (daysLeft <= 30) {
        alerts.push({
          id: `driver_license_${driver.id}`,
          type: 'driver_license',
          entityName: user?.full_name || 'נהג',
          entityId: driver.id,
          expiryDate: driver.license_expiry,
          daysLeft,
          severity: daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'critical' : 'warning'
        })
      }
    }
  })

  // מיון לפי חומרה ואז לפי ימים
  return alerts.sort((a, b) => {
    const severityOrder = { expired: 0, critical: 1, warning: 2 }
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity]
    }
    return a.daysLeft - b.daysLeft
  })
}