import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/app/lib/auth'


const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {

    // === AUTH CHECK ===
    const currentUser = await getAuthUser()
    if (!currentUser) return unauthorizedResponse()
    if (currentUser.role !== 'company_admin' && currentUser.role !== 'super_admin') {
      return forbiddenResponse()
    }
    // === END AUTH CHECK ===
    const body = await request.json()
    const { userId, method, newPassword, userEmail, userName } = body

    if (!userId) {
      return NextResponse.json({ error: 'חסר מזהה משתמש' }, { status: 400 })
    }

    // Method 1: Send reset email
    if (method === 'email') {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: userEmail
      })

      if (error) {
        console.error('Error generating reset link:', error)
        return NextResponse.json({ error: 'שגיאה ביצירת קישור איפוס' }, { status: 500 })
      }

      const resetLink = data?.properties?.action_link

      // Send email via Resend
      await resend.emails.send({
        from: 'מגרר <onboarding@resend.dev>',
        to: userEmail,
        subject: 'איפוס סיסמה - מגרר',
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #8b5cf6;">איפוס סיסמה 🔐</h1>
            <p>שלום ${userName || 'משתמש'},</p>
            <p>קיבלנו בקשה לאיפוס הסיסמה שלך.</p>
            <p>לחץ/י על הכפתור להגדרת סיסמה חדשה:</p>
            <a href="${resetLink}" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
              הגדר סיסמה חדשה
            </a>
            <p style="color: #666; font-size: 14px;">אם לא ביקשת איפוס סיסמה, התעלם/י מהודעה זו.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="color: #999; font-size: 12px;">מגרר - ניהול גרירות חכם</p>
          </div>
        `
      })

      return NextResponse.json({ success: true, message: 'מייל איפוס נשלח בהצלחה' })
    }

    // Method 2: Set password directly
    if (method === 'manual') {
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ error: 'סיסמה חייבת להיות לפחות 6 תווים' }, { status: 400 })
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword
      })

      if (error) {
        console.error('Error updating password:', error)
        return NextResponse.json({ error: 'שגיאה בעדכון הסיסמה' }, { status: 500 })
      }

      return NextResponse.json({ success: true, message: 'הסיסמה עודכנה בהצלחה' })
    }

    return NextResponse.json({ error: 'שיטה לא חוקית' }, { status: 400 })

  } catch (error) {
    console.error('Error in reset password:', error)
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 })
  }
}