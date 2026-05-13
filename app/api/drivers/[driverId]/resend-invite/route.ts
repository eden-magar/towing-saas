import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/app/lib/auth'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ driverId: string }> }
) {
  try {
    const currentUser = await getAuthUser(request)
    if (!currentUser) return unauthorizedResponse()
    if (currentUser.role !== 'company_admin' && currentUser.role !== 'super_admin') {
      return forbiddenResponse()
    }

    const { driverId } = await params

    if (!driverId) {
      return NextResponse.json({ error: 'חסר מזהה נהג' }, { status: 400 })
    }

    const { data: driverRow, error: driverError } = await supabaseAdmin
      .from('drivers')
      .select('id, company_id, user_id')
      .eq('id', driverId)
      .single()

    if (driverError || !driverRow) {
      return NextResponse.json({ error: 'נהג לא נמצא' }, { status: 404 })
    }

    if (currentUser.role !== 'super_admin' && driverRow.company_id !== currentUser.company_id) {
      return forbiddenResponse()
    }

    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, full_name')
      .eq('id', driverRow.user_id)
      .single()

    if (userError || !targetUser?.email) {
      return NextResponse.json({ error: 'לא נמצא מייל לנהג' }, { status: 400 })
    }

    const fullName = targetUser.full_name

    const { data: resetData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: targetUser.email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
      },
    })

    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 400 })
    }

    const resetLink = resetData?.properties?.action_link
    if (!resetLink) {
      return NextResponse.json({ error: 'לא ניתן ליצור קישור' }, { status: 500 })
    }

    try {
      await resend.emails.send({
        from: 'מגרר <noreply@magrar-crm.com>',
        to: targetUser.email,
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
    } catch (emailErr: unknown) {
      const message = emailErr instanceof Error ? emailErr.message : 'שגיאה בשליחת המייל'
      return NextResponse.json({ error: message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'הקישור נשלח שוב למייל',
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
