import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/app/lib/auth'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)


// Admin client with service role (server-side only!)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {

    // === AUTH CHECK ===
    const currentUser = await getAuthUser(request)
    if (!currentUser) return unauthorizedResponse()
    if (currentUser.role !== 'company_admin' && currentUser.role !== 'super_admin') {
      return forbiddenResponse()
    }
    // === END AUTH CHECK ===

    const body = await request.json()
    const {
      companyId,
      email,
      phone,
      fullName,
      idNumber,
      address,
      licenseNumber,
      licenseType,
      licenseCategories,
      licensePermits,
      licenseExpiry,
      yearsExperience,
      work_hours_start,
      work_hours_end,
      notes,
      initialStatus,
      truckIds: truckIdsBody,
      truckId: legacyTruckId,
    } = body

    const truckIds: string[] = Array.isArray(truckIdsBody)
      ? truckIdsBody.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : legacyTruckId
        ? [legacyTruckId]
        : []

    const categories: string[] = Array.isArray(licenseCategories)
      ? licenseCategories.filter((c: unknown): c is string => typeof c === 'string' && c.length > 0)
      : licenseType
        ? [licenseType]
        : []
    const permits: string[] = Array.isArray(licensePermits)
      ? licensePermits.filter((p: unknown): p is string => typeof p === 'string' && p.length > 0)
      : []

    // 1. יצירת משתמש ב-Auth (עם סיסמה זמנית)
    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!'
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true // מאשר את האימייל אוטומטית
    })

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. יצירת רשומה ב-public.users
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        phone,
        full_name: fullName,
        id_number: idNumber || null,
        address: address || null,
        role: 'driver',
        company_id: companyId,
        is_active: true
      })

    if (userError) {
      // ניקוי - מחיקת משתמש ה-auth שנוצר
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      console.error('User error:', userError)
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }

    // 3. יצירת רשומה ב-drivers
    const { data: driver, error: driverError } = await supabaseAdmin
      .from('drivers')
      .insert({
        user_id: authUser.user.id,
        company_id: companyId,
        license_number: licenseNumber,
        license_type: categories[0] ?? licenseType ?? null,
        license_categories: categories,
        license_permits: permits,
        license_expiry: licenseExpiry,
        years_experience: yearsExperience || 0,
        work_hours_start: work_hours_start || null,
        work_hours_end: work_hours_end || null,
        notes: notes || null,
        status: initialStatus || 'available'
      })
      .select()
      .single()

    if (driverError) {
      // ניקוי
      await supabaseAdmin.from('users').delete().eq('id', authUser.user.id)
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      console.error('Driver error:', driverError)
      return NextResponse.json({ error: driverError.message }, { status: 400 })
    }

    // 4. שיוך גררים (אם נבחרו)
    if (truckIds.length > 0) {
      const now = new Date().toISOString()
      const { error: assignError } = await supabaseAdmin
        .from('driver_truck_assignments')
        .insert(
          truckIds.map((truck_id) => ({
            driver_id: driver.id,
            truck_id,
            is_current: true,
            assigned_at: now,
          }))
        )

      if (assignError) {
        console.error('Driver truck assignment error:', assignError)
        return NextResponse.json({ error: assignError.message }, { status: 400 })
      }
    }

    // 5. שלח מייל עם לינק להגדרת סיסמה
    try {
      const { data: resetData } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
        },
      })

      const resetLink = resetData?.properties?.action_link || `${process.env.NEXT_PUBLIC_APP_URL}/login`

      await resend.emails.send({
        from: 'מגרר <noreply@magrar-crm.com>',
        to: email,
        subject: 'הוזמנת להצטרף כנהג — מגרר',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #8b5cf6;">ברוכים הבאים למגרר! 🚗</h1>
            <p>שלום ${fullName},</p>
            <p>נוספת כנהג במערכת מגרר לניהול גרירות.</p>
            <p>לחץ/י על הכפתור להגדרת הסיסמה שלך והתחברות:</p>
            <a href="${resetLink}" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
              הגדר סיסמה והתחבר
            </a>
            <p style="color: #666; font-size: 14px;">אם הכפתור לא עובד, העתק/י את הקישור:</p>
            <p style="color: #666; font-size: 12px; word-break: break-all;">${resetLink}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="color: #999; font-size: 12px;">מגרר - ניהול גרירות חכם</p>
          </div>
        `,
      })
    } catch (emailErr) {
      console.error('Failed to send driver invite email:', emailErr)
    }

    return NextResponse.json({
      success: true,
      driver,
    })

  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
