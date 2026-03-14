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
    if (currentUser.role !== 'company_admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'customer') {
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
      .select('user_id, customer_id')
      .eq('id', customerUserId)
      .single()

    if (cuError || !cu) {
      return NextResponse.json({ error: 'משתמש לא נמצא' }, { status: 404 })
    }

    // Verify company access
    if (currentUser.role === 'company_admin') {
      const { data: relation } = await supabaseAdmin
        .from('customer_company')
        .select('id')
        .eq('customer_id', cu.customer_id)
        .eq('company_id', currentUser.company_id)
        .maybeSingle()
      if (!relation) {
        return forbiddenResponse('אין הרשאה למחוק משתמש מלקוח מחברה אחרת')
      }
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
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return unauthorizedResponse()
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) return unauthorizedResponse()

    // בדוק אם admin בפורטל
    const { data: customerUser } = await supabaseAdmin
      .from('customer_users')
      .select('role, customer_id')
      .eq('user_id', user.id)
      .single()

    // בדוק אם company_admin בדשבורד
    const { data: dashboardUser } = await supabaseAdmin
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    const isPortalAdmin = customerUser?.role === 'admin'
    const isDashboardAdmin = dashboardUser?.role === 'company_admin' || dashboardUser?.role === 'super_admin'

    if (!isPortalAdmin && !isDashboardAdmin) return forbiddenResponse()
    const { customerUserId, role, is_active } = await req.json()
      // Fetch target customer_user with customer_id
    const { data: targetCu, error: targetError } = await supabaseAdmin
      .from('customer_users')
      .select('id, customer_id')
      .eq('id', customerUserId)
      .single()

    if (targetError || !targetCu) {
      return NextResponse.json({ error: 'משתמש לא נמצא' }, { status: 404 })
    }

    // Verify company/customer access
    if (isDashboardAdmin && dashboardUser?.role !== 'super_admin') {
      const { data: relation } = await supabaseAdmin
        .from('customer_company')
        .select('id')
        .eq('customer_id', targetCu.customer_id)
        .eq('company_id', dashboardUser.company_id)
        .maybeSingle()
      if (!relation) {
        return forbiddenResponse('אין הרשאה לעדכן משתמש מלקוח מחברה אחרת')
      }
    } else if (isPortalAdmin) {
      if (targetCu.customer_id !== customerUser.customer_id) {
        return forbiddenResponse('אין הרשאה לעדכן משתמש מלקוח אחר')
      }
    }
if (!customerUserId || (role === undefined && is_active === undefined)) {
  return NextResponse.json({ error: 'חסרים פרמטרים' }, { status: 400 })
}
const updateData: any = { updated_at: new Date().toISOString() }
if (role !== undefined) updateData.role = role
if (is_active !== undefined) updateData.is_active = is_active

const { error } = await supabaseAdmin
  .from('customer_users')
  .update(updateData)
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
