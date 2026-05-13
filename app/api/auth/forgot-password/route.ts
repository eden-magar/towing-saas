import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PUBLIC_SUCCESS = {
  success: true,
  message: 'אם המייל קיים במערכת, נשלח אליו קישור לאיפוס סיסמה',
}

export async function POST(request: NextRequest) {
  try {
    let body: { email?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'בקשה לא תקינה' }, { status: 400 })
    }

    const emailRaw = body.email
    const email = typeof emailRaw === 'string' ? emailRaw.trim() : ''

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ error: 'כתובת אימייל לא תקינה' }, { status: 400 })
    }

    const { data: resetData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
      },
    })

    if (linkError || !resetData?.properties?.action_link) {
      return NextResponse.json(PUBLIC_SUCCESS)
    }

    const resetLink = resetData.properties.action_link

    try {
      await resend.emails.send({
        from: 'מגרר <noreply@magrar-crm.com>',
        to: email,
        subject: 'איפוס סיסמה - מגרר CRM',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #8b5cf6;">איפוס סיסמה</h1>
            <p>התקבלה בקשה לאיפוס הסיסמה לחשבונך במערכת. לחצי על הקישור כדי לקבוע סיסמה חדשה.</p>
            <a href="${resetLink}" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
              קביעת סיסמה חדשה
            </a>
            <p style="color: #666; font-size: 14px;">אם הכפתור לא עובד, העתק/י את הקישור:</p>
            <p style="color: #666; font-size: 12px; word-break: break-all;">${resetLink}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="color: #666; font-size: 14px;">אם לא ביקשת איפוס סיסמה, אפשר להתעלם ממייל זה.</p>
            <p style="color: #999; font-size: 12px;">מגרר - ניהול גרירות חכם</p>
          </div>
        `,
      })
    } catch {
      // לא חושפים כישלון ללקוח
    }

    return NextResponse.json(PUBLIC_SUCCESS)
  } catch {
    return NextResponse.json({ error: 'שגיאה בעיבוד הבקשה' }, { status: 500 })
  }
}
