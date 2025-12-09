import { supabase } from '../supabase'

export interface ExpiryAlert {
  id: string
  type: 'truck_license' | 'truck_insurance' | 'driver_license' | 'tachograph' | 'engineer_report' | 'winter_inspection'
  entityName: string  // שם הגרר או הנהג
  entityId: string
  expiryDate: string
  daysLeft: number    // ימים שנשארו (שלילי = פג)
  severity: 'expired' | 'critical' | 'warning' | 'info'  // פג / פחות משבוע / פחות מחודש / מידע
}

export async function getExpiryAlerts(companyId: string): Promise<ExpiryAlert[]> {
  const alerts: ExpiryAlert[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  // שליפת כל הגררים הפעילים
  const { data: trucks } = await supabase
    .from('tow_trucks')
    .select('id, plate_number, license_expiry, insurance_expiry, tachograph_expiry, engineer_report_expiry, last_winter_inspection')
    .eq('company_id', companyId)
    .eq('is_active', true)

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

  // בדיקת בדיקת חורף - מ-1 בספטמבר עד שמסמנים שבוצע
  const currentYear = today.getFullYear()
  const winterCheckStart = new Date(currentYear, 8, 1) // 1 בספטמבר
  const winterCheckDeadline = new Date(currentYear, 9, 1) // 1 באוקטובר
  
  // אם עברנו את 1 באוקטובר, נבדוק לשנה הבאה
  const isAfterDeadline = today >= winterCheckDeadline
  const relevantYear = isAfterDeadline ? currentYear : currentYear
  const showWinterAlert = today >= winterCheckStart || isAfterDeadline

  // עיבוד גררים
  trucks?.forEach(truck => {
    // רישיון רכב
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

    // ביטוח
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

    // טכוגרף
    if (truck.tachograph_expiry) {
      const expiry = new Date(truck.tachograph_expiry)
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysLeft <= 30) {
        alerts.push({
          id: `tachograph_${truck.id}`,
          type: 'tachograph',
          entityName: truck.plate_number,
          entityId: truck.id,
          expiryDate: truck.tachograph_expiry,
          daysLeft,
          severity: daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'critical' : 'warning'
        })
      }
    }

    // תסקיר מהנדס
    if (truck.engineer_report_expiry) {
      const expiry = new Date(truck.engineer_report_expiry)
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysLeft <= 30) {
        alerts.push({
          id: `engineer_report_${truck.id}`,
          type: 'engineer_report',
          entityName: truck.plate_number,
          entityId: truck.id,
          expiryDate: truck.engineer_report_expiry,
          daysLeft,
          severity: daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'critical' : 'warning'
        })
      }
    }

    // בדיקת חורף - מציג מ-1 בספטמבר
    if (showWinterAlert) {
      const lastInspection = truck.last_winter_inspection ? new Date(truck.last_winter_inspection) : null
      const lastInspectionYear = lastInspection ? lastInspection.getFullYear() : 0
      
      // אם לא בוצעה בדיקה השנה
      if (lastInspectionYear < relevantYear) {
        const daysUntilDeadline = Math.ceil((winterCheckDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        alerts.push({
          id: `winter_inspection_${truck.id}`,
          type: 'winter_inspection',
          entityName: truck.plate_number,
          entityId: truck.id,
          expiryDate: winterCheckDeadline.toISOString().split('T')[0],
          daysLeft: daysUntilDeadline,
          severity: daysUntilDeadline < 0 ? 'expired' : daysUntilDeadline <= 7 ? 'critical' : daysUntilDeadline <= 30 ? 'warning' : 'info'
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
    const severityOrder = { expired: 0, critical: 1, warning: 2, info: 3 }
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity]
    }
    return a.daysLeft - b.daysLeft
  })
}