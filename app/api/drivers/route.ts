import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Admin client with service role (server-side only!)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
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
      licenseExpiry,
      yearsExperience,
      notes,
      initialStatus,
      truckId
    } = body

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
        license_type: licenseType,
        license_expiry: licenseExpiry,
        years_experience: yearsExperience || 0,
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

    // 4. שיוך גרר (אם נבחר)
    if (truckId) {
      await supabaseAdmin
        .from('driver_truck_assignments')
        .insert({
          driver_id: driver.id,
          truck_id: truckId,
          is_current: true,
          assigned_at: new Date().toISOString()
        })
    }

    return NextResponse.json({
      success: true,
      driver,
      tempPassword // בפרודקשן: לשלוח ב-SMS, לא להחזיר ל-client
    })

  } catch (error) {
    console.error('Server error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
