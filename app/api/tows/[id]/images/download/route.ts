import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import {
  getAuthUser,
  unauthorizedResponse,
} from '@/app/lib/auth'
import {
  TOW_IMAGES_BUCKET,
  normalizeTowImagePath,
} from '@/app/lib/queries/tow-images-storage'

/**
 * Auth + company scope mirrored from:
 * app/api/integrations/legacy-calendar/sync/route.ts
 * (getAuthUser → load tow via service role → same-company check; cross-tenant → 404)
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type TowImageRow = {
  id: string
  image_url: string
  image_type: string | null
}

function sanitizeFilenamePart(value: string): string {
  const cleaned = value.replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
  return cleaned || 'tow'
}

function uniqueZipName(used: Set<string>, base: string): string {
  if (!used.has(base)) {
    used.add(base)
    return base
  }
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  const ext = dot > 0 ? base.slice(dot) : ''
  let n = 2
  while (used.has(`${stem}_${n}${ext}`)) n += 1
  const next = `${stem}_${n}${ext}`
  used.add(next)
  return next
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getAuthUser(request)
    if (!currentUser) return unauthorizedResponse()

    const { id: towId } = await context.params
    if (!towId?.trim()) {
      return NextResponse.json({ error: 'tow id required' }, { status: 400 })
    }

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

    let imagesQuery = supabaseAdmin
      .from('tow_images')
      .select('id, image_url, image_type')
      .eq('tow_id', towId)
      .order('created_at', { ascending: true })

    if (idFilter.length > 0) {
      imagesQuery = imagesQuery.in('id', idFilter)
    }

    const { data: images, error: imagesError } = await imagesQuery

    if (imagesError) {
      console.error('[tow-images-download] images load failed', imagesError)
      return NextResponse.json({ error: 'שגיאה בטעינת התמונות' }, { status: 500 })
    }

    const rows = (images ?? []) as TowImageRow[]
    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'אין תמונות להורדה' },
        { status: 404 }
      )
    }

    const orderSlug = sanitizeFilenamePart(
      typeof tow.order_number === 'string' && tow.order_number.trim()
        ? tow.order_number.trim()
        : towId.slice(0, 8)
    )

    const zip = new JSZip()
    const usedNames = new Set<string>()
    let included = 0
    let skipped = 0
    const typeCounters: Record<string, number> = {}

    for (const row of rows) {
      const path = normalizeTowImagePath(row.image_url)
      if (!path) {
        skipped += 1
        continue
      }

      const { data: file, error: downloadError } = await supabaseAdmin.storage
        .from(TOW_IMAGES_BUCKET)
        .download(path)

      if (downloadError || !file) {
        console.error('[tow-images-download] storage download failed', {
          path,
          error: downloadError,
        })
        skipped += 1
        continue
      }

      const imageType = sanitizeFilenamePart(row.image_type || 'other')
      typeCounters[imageType] = (typeCounters[imageType] ?? 0) + 1
      const n = typeCounters[imageType]
      const baseName = `${orderSlug}_${imageType}_${n}.jpg`
      const zipName = uniqueZipName(usedNames, baseName)

      const bytes = Buffer.from(await file.arrayBuffer())
      zip.file(zipName, bytes)
      included += 1
    }

    if (included === 0) {
      return NextResponse.json(
        {
          error: 'לא ניתן להוריד את התמונות',
          skipped,
        },
        { status: 502 }
      )
    }

    const zipBytes = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    const filename = `tow_${orderSlug}_photos.zip`

    return new NextResponse(Buffer.from(zipBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Photos-Included': String(included),
        'X-Photos-Skipped': String(skipped),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[tow-images-download] unexpected error', err)
    return NextResponse.json({ error: 'שגיאה בהורדת התמונות' }, { status: 500 })
  }
}
