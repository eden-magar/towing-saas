import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getAuthUser(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }

    const token = authHeader.replace('Bearer ', '')

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return null
    }

    const { data: dbUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, company_id, is_active')
      .eq('id', user.id)
      .single()

    if (userError || !dbUser || !dbUser.is_active) {
      return null
    }

    return dbUser
  } catch {
    return null
  }
}

export function unauthorizedResponse(message = 'לא מחובר') {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function forbiddenResponse(message = 'אין הרשאה') {
  return NextResponse.json({ error: message }, { status: 403 })
}