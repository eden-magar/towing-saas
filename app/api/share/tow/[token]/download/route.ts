import { NextRequest, NextResponse } from 'next/server'
import { getValidShareLink } from '@/app/lib/server/tow-share-links'
import { buildTowImagesZip } from '@/app/lib/server/tow-images-zip'

/**
 * Public ZIP download for a share token.
 * Auth = token validity only (no session). Tow is derived from the token — never from client input.
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params
    const link = await getValidShareLink(token ?? '')
    if (!link) {
      return NextResponse.json({ error: 'לא נמצא' }, { status: 404 })
    }

    const zipResult = await buildTowImagesZip({
      towId: link.tow_id,
      orderNumber: null,
    })

    if (!zipResult.ok) {
      return NextResponse.json(
        { error: zipResult.error },
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
    console.error('[share-tow-download] unexpected error', err)
    return NextResponse.json({ error: 'שגיאה בהורדת התמונות' }, { status: 500 })
  }
}
