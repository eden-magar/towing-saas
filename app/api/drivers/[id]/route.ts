import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/app/lib/auth'

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

    const { id: driverId } = await params

    if (!driverId) {
      return NextResponse.json({ error: 'חסר מזהה נהג' }, { status: 400 })
    }

    const { data: driver, error: driverFetchError } = await supabaseAdmin
      .from('drivers')
      .select('id, user_id')
      .eq('id', driverId)
      .single()

    if (driverFetchError || !driver) {
      return NextResponse.json({ error: 'נהג לא נמצא' }, { status: 404 })
    }

    const { count: towCount, error: towCountError } = await supabaseAdmin
      .from('tows')
      .select('id', { count: 'exact', head: true })
      .eq('driver_id', driverId)

    if (towCountError) {
      return NextResponse.json(
        { error: towCountError.message || 'שגיאה בבדיקת גרירות הנהג' },
        { status: 500 }
      )
    }

    if ((towCount || 0) > 0) {
      return NextResponse.json(
        { error: 'לא ניתן למחוק נהג עם גרירות קיימות. נא למחוק קודם את הגרירות.' },
        { status: 400 }
      )
    }

    const userId = driver.user_id

    const { error: assignmentsDeleteError } = await supabaseAdmin
      .from('driver_truck_assignments')
      .delete()
      .eq('driver_id', driverId)

    if (assignmentsDeleteError) {
      return NextResponse.json(
        { error: assignmentsDeleteError.message || 'שגיאה במחיקת שיוכי גרר' },
        { status: 500 }
      )
    }

    const { error: driverDeleteError } = await supabaseAdmin
      .from('drivers')
      .delete()
      .eq('id', driverId)

    if (driverDeleteError) {
      return NextResponse.json(
        { error: driverDeleteError.message || 'שגיאה במחיקת הנהג' },
        { status: 500 }
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
      { error: err.message || 'שגיאה במחיקת הנהג' },
      { status: 500 }
    )
  }
}
