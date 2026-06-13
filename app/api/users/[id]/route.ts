import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
  assertCompanyAccess,
} from '@/app/lib/auth'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthUser(request)
    if (!currentUser) return unauthorizedResponse()
    if (currentUser.role !== 'company_admin' && currentUser.role !== 'super_admin') {
      return forbiddenResponse()
    }

    const { id: userId } = await params

    if (!userId) {
      return NextResponse.json({ error: 'חסר מזהה משתמש' }, { status: 400 })
    }

    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('users')
      .select('id, role, company_id')
      .eq('id', userId)
      .single()

    if (targetUserError || !targetUser) {
      return NextResponse.json({ error: 'משתמש לא נמצא' }, { status: 404 })
    }

    if (!assertCompanyAccess(currentUser, targetUser.company_id)) {
      return forbiddenResponse()
    }

    if (targetUser.role === 'driver' || targetUser.role === 'customer') {
      return NextResponse.json(
        { error: 'משתמש מסוג נהג/לקוח יש למחוק דרך הדף המתאים' },
        { status: 400 }
      )
    }

    const { error: userDeleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userId)

    if (userDeleteError) {
      return NextResponse.json(
        { error: userDeleteError.message || 'שגיאה במחיקת המשתמש' },
        { status: 500 }
      )
    }

    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      return NextResponse.json(
        { error: authDeleteError.message || 'שגיאה במחיקת auth user' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'שגיאה במחיקת המשתמש' },
      { status: 500 }
    )
  }
}
