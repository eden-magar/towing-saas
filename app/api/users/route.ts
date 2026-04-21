import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/app/lib/auth'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getAuthUser(request)
    if (!currentUser) return unauthorizedResponse()
    if (currentUser.role !== 'company_admin' && currentUser.role !== 'super_admin') {
      return forbiddenResponse()
    }

    const { email, full_name, phone, role, company_id } = await request.json()

    if (!email || !full_name || !role || !company_id) {
      return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'כתובת אימייל לא תקינה' }, { status: 400 })
    }

    if (role !== 'company_admin' && role !== 'dispatcher') {
      return NextResponse.json({ error: 'תפקיד לא תקין ליצירת משתמש' }, { status: 400 })
    }

    const tempPassword = Math.random().toString(36).slice(-16) + 'A1!'

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    })

    if (authError) {
      const status = authError.message?.includes('already been registered') ? 409 : 400
      return NextResponse.json({ error: authError.message }, { status })
    }

    const { data: createdUserRow, error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        full_name,
        phone: phone || null,
        role,
        company_id,
        is_active: true,
      })
      .select()
      .single()

    if (userError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json({ error: userError.message }, { status: 400 })
    }

    const { data: companyData } = await supabaseAdmin
      .from('companies')
      .select('name')
      .eq('id', company_id)
      .single()

    const companyName = companyData?.name || 'החברה'
    const roleLabel = role === 'company_admin' ? 'מנהל' : 'מוקדן'

    let emailSent = false
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
        subject: 'הוזמנת להצטרף — מגרר',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #8b5cf6;">ברוכים הבאים למערכת מגרר</h1>
            <p>שלום ${full_name},</p>
            <p>הוזמנת לצוות הניהול של ${companyName} כ${roleLabel}.</p>
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

      emailSent = true
    } catch (emailErr) {
      console.error('Failed to send user invite email:', emailErr)
    }

    return NextResponse.json({
      success: true,
      user: createdUserRow,
      emailSent,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
