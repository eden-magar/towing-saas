import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { email, fullName, phone, customerId, role } = await req.json()

    if (!email || !fullName || !customerId) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
    }

    // 1. צור user ב-Auth
    const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

    if (authError) {
      if (authError.message.includes('already been registered')) {
        return NextResponse.json({ error: 'כתובת האימייל כבר רשומה במערכת' }, { status: 400 })
      }
      throw authError
    }

    const userId = authData.user.id

    // 2. צור רשומה בטבלת users
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email,
        full_name: fullName,
        phone: phone || null,
        role: 'customer',
        is_active: true,
      })

    if (userError) {
      // נקה את ה-auth user אם נכשל
      await supabaseAdmin.auth.admin.deleteUser(userId)
      throw userError
    }

    // 3. צור רשומה ב-customer_users
    const { error: cuError } = await supabaseAdmin
      .from('customer_users')
      .insert({
        customer_id: customerId,
        user_id: userId,
        role: role || 'viewer',
        is_active: true,
      })

    if (cuError) {
      await supabaseAdmin.auth.admin.deleteUser(userId)
      await supabaseAdmin.from('users').delete().eq('id', userId)
      throw cuError
    }

    return NextResponse.json({
      success: true,
      userId,
      tempPassword,
    })
  } catch (err: any) {
    console.error('Error creating customer user:', err)
    return NextResponse.json(
      { error: err.message || 'שגיאה ביצירת המשתמש' },
      { status: 500 }
    )
  }
}