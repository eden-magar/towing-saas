import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/app/lib/auth'


const resend = new Resend(process.env.RESEND_API_KEY)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {

    // === AUTH CHECK ===
    const currentUser = await getAuthUser()
    if (!currentUser) return unauthorizedResponse()
    if (currentUser.role !== 'super_admin') {
      return forbiddenResponse('רק סופר אדמין יכול ליצור חברה')
    }
    // === END AUTH CHECK ===
    console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY)
    
    const body = await request.json()
    const { 
      companyName,
      companyEmail,
      companyPhone,
      companyAddress,
      businessNumber,
      website,
      planId,
      adminName,
      adminEmail,
      adminPhone,
      sendInvite,
      adminPassword
    } = body

    // 0. Validate business number is unique (if provided)
    if (businessNumber) {
      const { data: existingCompany } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('business_number', businessNumber)
        .maybeSingle()

      if (existingCompany) {
        return NextResponse.json({ error: 'מספר ח.פ. כבר קיים במערכת' }, { status: 400 })
      }
    }

    // 0.5 Validate admin email is unique
    const { data: existingAuth } = await supabaseAdmin.auth.admin.listUsers()
    const emailExists = existingAuth.users.some(u => u.email === adminEmail)
    if (emailExists) {
      return NextResponse.json({ error: 'כתובת המייל כבר רשומה במערכת' }, { status: 400 })
    }

    // 1. Create company
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        email: companyEmail,
        phone: companyPhone || null,
        address: companyAddress || null,
        business_number: businessNumber || null,
        website: website || null,
        status: 'trial',
        is_active: true
      })
      .select()
      .single()

    if (companyError) {
      console.error('Error creating company:', companyError)
      return NextResponse.json({ error: 'שגיאה ביצירת החברה' }, { status: 500 })
    }

    // 2. Create subscription
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 14)

    const { error: subError } = await supabaseAdmin
      .from('company_subscriptions')
      .insert({
        company_id: company.id,
        plan_id: planId,
        status: 'trial',
        trial_started_at: new Date().toISOString(),
        trial_ends_at: trialEndsAt.toISOString()
      })

    if (subError) {
      console.error('Error creating subscription:', subError)
      // Rollback
      await supabaseAdmin.from('companies').delete().eq('id', company.id)
      return NextResponse.json({ error: 'שגיאה ביצירת המנוי' }, { status: 500 })
    }

    // 3. Create admin user
    let authUser
    
    if (sendInvite) {
      // Create user with random password, then send invite email
      const tempPassword = Math.random().toString(36).slice(-12)
      
      const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: adminName
        }
      })

      if (authError) {
        console.error('Error creating auth user:', authError)
        // Rollback - delete company and subscription
        await supabaseAdmin.from('company_subscriptions').delete().eq('company_id', company.id)
        await supabaseAdmin.from('companies').delete().eq('id', company.id)
        
        if (authError.code === 'email_exists') {
          return NextResponse.json({ error: 'כתובת המייל כבר רשומה במערכת' }, { status: 400 })
        }
        return NextResponse.json({ error: 'שגיאה ביצירת המשתמש' }, { status: 500 })
      }

      authUser = newUser.user

      // Generate password reset link
      const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: adminEmail
      })

      if (resetError) {
        console.error('Error generating reset link:', resetError)
      }

      // Send invite email via Resend
      const inviteLink = resetData?.properties?.action_link || `${process.env.NEXT_PUBLIC_APP_URL}/login`
      
      console.log('Sending email to:', adminEmail)
      console.log('Invite link:', inviteLink)
      
      const emailResult = await resend.emails.send({
        from: 'מגרר <onboarding@resend.dev>',
        to: adminEmail,
        subject: `הוזמנת להצטרף ל-${companyName} במגרר`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #8b5cf6;">ברוכים הבאים למגרר! 🚗</h1>
            <p>שלום ${adminName},</p>
            <p>הוזמנת להיות מנהל/ת של <strong>${companyName}</strong> במערכת מגרר לניהול גרירות.</p>
            <p>לחץ/י על הכפתור להגדרת הסיסמה שלך והתחברות:</p>
            <a href="${inviteLink}" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
              הגדר סיסמה והתחבר
            </a>
            <p style="color: #666; font-size: 14px;">אם הכפתור לא עובד, העתק/י את הקישור:</p>
            <p style="color: #666; font-size: 12px; word-break: break-all;">${inviteLink}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
            <p style="color: #999; font-size: 12px;">מגרר - ניהול גרירות חכם</p>
          </div>
        `
      })

      console.log('Email result:', emailResult)

    } else {
      // Create user with provided password
      const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          full_name: adminName
        }
      })

      if (authError) {
        console.error('Error creating auth user:', authError)
        // Rollback - delete company and subscription
        await supabaseAdmin.from('company_subscriptions').delete().eq('company_id', company.id)
        await supabaseAdmin.from('companies').delete().eq('id', company.id)
        
        if (authError.code === 'email_exists') {
          return NextResponse.json({ error: 'כתובת המייל כבר רשומה במערכת' }, { status: 400 })
        }
        return NextResponse.json({ error: 'שגיאה ביצירת המשתמש' }, { status: 500 })
      }

      authUser = newUser.user
    }

    // 4. Create user record in users table
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.id,
        email: adminEmail,
        full_name: adminName,
        phone: adminPhone || null,
        company_id: company.id,
        role: 'company_admin',
        is_active: true
      })

    if (userError) {
      console.error('Error creating user record:', userError)
    }

    // 5. Create company_settings
    await supabaseAdmin
      .from('company_settings')
      .insert({ company_id: company.id })

    return NextResponse.json({ 
      success: true, 
      companyId: company.id,
      message: sendInvite ? 'החברה נוצרה והזמנה נשלחה' : 'החברה נוצרה בהצלחה'
    })

  } catch (error) {
    console.error('Error in create company:', error)
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 })
  }
}