import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// בדיקת auth ב-API route — מחזיר את ה-user או null
export async function getAuthUser() {
  try {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      }
    )

    const { data: { session }, error } = await supabase.auth.getSession()

    if (error || !session) {
      return null
    }

    // שליפת פרטי המשתמש מטבלת users
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, company_id, is_active')
      .eq('id', session.user.id)
      .single()

    if (userError || !user || !user.is_active) {
      return null
    }

    return user
  } catch {
    return null
  }
}

// 401 — לא מחובר
export function unauthorizedResponse(message = 'לא מחובר') {
  return NextResponse.json({ error: message }, { status: 401 })
}

// 403 — אין הרשאה
export function forbiddenResponse(message = 'אין הרשאה') {
  return NextResponse.json({ error: message }, { status: 403 })
}