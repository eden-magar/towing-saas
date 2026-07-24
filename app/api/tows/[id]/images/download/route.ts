import { NextRequest, NextResponse } from 'next/server'
import {
  getAuthUser,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/app/lib/auth'
import { getSupabaseAdmin } from '@/app/lib/server/supabase-admin'
import { buildTowImagesZip } from '@/app/lib/server/tow-images-zip'

/**
 * Auth + company scope mirrored from:
 * app/api/integrations/legacy-calendar/sync/route.ts
 * (getAuthUser → load tow via service role → same-company check; cross-tenant → 404)
 *
 * Role gate: dashboard staff only. Portal customers do not call this route
 * (ZIP download lives on /dashboard/tows/[id]); public share uses
 * /api/share/tow/[token]/download instead.
 */
const IMAGE_DOWNLOAD_ROLES = new Set([
  'dispatcher',
  'company_admin',
  'super_admin',
])

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthUser(request)
    if (!currentUser) return unauthorizedResponse()
    if (!IMAGE_DOWNLOAD_ROLES.has(currentUser.role)) {
      return forbiddenResponse()
    }

    const { id: towId } = await context.params
    if (!towId?.trim()) {
      return NextResponse.json({ error: 'tow id required' }, { status: 400 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: tow, error: towError } = await supabaseAdmin
      .from('tows')
      .select('id, company_id, order_number')
      .eq('id', towId)
      .maybeSingle()

    if (towError) {
      console.error('[tow-images-download] tow load failed', towError)
      return NextResponse.json({ error: 'שגיאה בטעינת הגרירה' }, { status: 500 })
    }

    if (!tow) {
      return NextResponse.json({ error: 'הגרירה לא נמצאה' }, { status: 404 })
    }

    // Hide cross-tenant existence from non–super-admins (same as legacy-calendar sync)
    if (
      currentUser.role !== 'super_admin' &&
      currentUser.company_id !== tow.company_id
    ) {
      return NextResponse.json({ error: 'הגרירה לא נמצאה' }, { status: 404 })
    }

    const idsParam = request.nextUrl.searchParams.get('ids')
    const idFilter =
      idsParam
        ?.split(',')
        .map((s) => s.trim())
        .filter(Boolean) ?? []

    const zipResult = await buildTowImagesZip({
      towId,
      imageIds: idFilter.length > 0 ? idFilter : undefined,
      orderNumber:
        typeof tow.order_number === 'string' ? tow.order_number : null,
    })

    if (!zipResult.ok) {
      return NextResponse.json(
        {
          error: zipResult.error,
          ...(zipResult.skipped != null ? { skipped: zipResult.skipped } : {}),
        },
        { status: zipResult.status }
      )
    }

    return new NextResponse(new Uint8Array(zipResult.bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipResult.filename}"`,
        'X-Photos-Included': String(zipResult.included),
        'X-Photos-Skipped': String(zipResult.skipped),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[tow-images-download] unexpected error', err)
    return NextResponse.json({ error: 'שגיאה בהורדת התמונות' }, { status: 500 })
  }
}
