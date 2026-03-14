import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser, unauthorizedResponse, forbiddenResponse } from '@/app/lib/auth'


const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(request: NextRequest) {
  try {

    // === AUTH CHECK ===
    const currentUser = await getAuthUser(request)
    if (!currentUser) return unauthorizedResponse()
    if (currentUser.role !== 'super_admin') {
      return forbiddenResponse('רק סופר אדמין יכול למחוק חברה')
    }
    // === END AUTH CHECK ===
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'חסר מזהה חברה' }, { status: 400 })
    }

    console.log('Deactivating company:', companyId)

      const { error } = await supabaseAdmin
    .from('companies')
    .update({ is_active: false })
    .eq('id', companyId)

  if (error) {
    console.error('Error deactivating company:', error)
    return NextResponse.json({ error: 'שגיאה בביטול החברה' }, { status: 500 })
  }
  return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in delete company:', error)
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 })
  }
}