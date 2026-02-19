import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/app/lib/auth'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)


const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {

    // === AUTH CHECK ===
    const authUser = await getAuthUser(req)
    if (!authUser) return unauthorizedResponse()
    if (authUser.role !== 'company_admin' && authUser.role !== 'super_admin') {
      return forbiddenResponse()
    }
    // === END AUTH CHECK ===
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

    // 4. שלח מייל עם לינק להגדרת סיסמה
    try {
      const { data: resetData } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email,
      })

      const resetLink = resetData?.properties?.action_link || `${process.env.NEXT_PUBLIC_APP_URL}/login`

      await resend.emails.send({
        from: 'מגרר <onboarding@resend.dev>',
        to: email,
        subject: 'הוזמנת לפורטל הלקוח — מגרר',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #8b5cf6;">ברוכים הבאים למגרר! 🚗</h1>
            <p>שלום ${fullName},</p>
            <p>הוזמנת לפורטל הלקוח של מערכת מגרר לניהול גרירות.</p>
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
      console.error('Failed to send invite email:', emailErr)
      // לא מכשילים את היצירה — המשתמש נוצר בהצלחה
    }

    return NextResponse.json({
      success: true,
      userId,
    })
  } catch (err: any) {
    console.error('Error creating customer user:', err)
    return NextResponse.json(
      { error: err.message || 'שגיאה ביצירת המשתמש' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // === AUTH CHECK ===
    const currentUser = await getAuthUser(req)
    if (!currentUser) return unauthorizedResponse()
    if (currentUser.role !== 'company_admin' && currentUser.role !== 'super_admin') {
      return forbiddenResponse()
    }
    // === END AUTH CHECK ===

    const { customerUserId } = await req.json()

    if (!customerUserId) {
      return NextResponse.json({ error: 'חסר מזהה משתמש' }, { status: 400 })
    }

    // 1. שליפת ה-user_id לפני מחיקה
    const { data: cu, error: cuError } = await supabaseAdmin
      .from('customer_users')
      .select('user_id')
      .eq('id', customerUserId)
      .single()

    if (cuError || !cu) {
      return NextResponse.json({ error: 'משתמש לא נמצא' }, { status: 404 })
    }

    const userId = cu.user_id

    // 2. מחיקה מ-customer_users
    await supabaseAdmin
      .from('customer_users')
      .delete()
      .eq('id', customerUserId)

    // 3. מחיקה מ-users
    await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId)

    // 4. מחיקה מ-auth.users
    await supabaseAdmin.auth.admin.deleteUser(userId)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error deleting customer user:', err)
    return NextResponse.json(
      { error: err.message || 'שגיאה במחיקת המשתמש' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const currentUser = await getAuthUser(req)
    if (!currentUser) return unauthorizedResponse()
    if (currentUser.role !== 'company_admin' && currentUser.role !== 'super_admin') {
      return forbiddenResponse()
    }
    const { customerUserId, role } = await req.json()
    if (!customerUserId || !role) {
      return NextResponse.json({ error: 'חסרים פרמטרים' }, { status: 400 })
    }
    const { error } = await supabaseAdmin
      .from('customer_users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', customerUserId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error updating customer user role:', err)
    return NextResponse.json(
      { error: err.message || 'שגיאה בעדכון תפקיד' },
      { status: 500 }
    )
  }
}
