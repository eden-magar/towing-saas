import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'חסר מזהה חברה' }, { status: 400 })
    }

    console.log('Deleting company:', companyId)

    // Delete in order (foreign keys)
    await supabaseAdmin.from('impersonation_sessions').delete().eq('target_company_id', companyId)
    await supabaseAdmin.from('audit_log').delete().eq('company_id', companyId)
    await supabaseAdmin.from('billing_history').delete().eq('company_id', companyId)
    await supabaseAdmin.from('tows').delete().eq('company_id', companyId)
    await supabaseAdmin.from('drivers').delete().eq('company_id', companyId)
    await supabaseAdmin.from('tow_trucks').delete().eq('company_id', companyId)
    await supabaseAdmin.from('company_settings').delete().eq('company_id', companyId)
    await supabaseAdmin.from('users').delete().eq('company_id', companyId)
    await supabaseAdmin.from('company_subscriptions').delete().eq('company_id', companyId)
    
    const { error } = await supabaseAdmin.from('companies').delete().eq('id', companyId)
    
    if (error) {
      console.error('Error deleting company:', error)
      return NextResponse.json({ error: 'שגיאה במחיקת החברה' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in delete company:', error)
    return NextResponse.json({ error: 'שגיאה בשרת' }, { status: 500 })
  }
}