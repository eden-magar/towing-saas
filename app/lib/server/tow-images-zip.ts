import 'server-only'
import JSZip from 'jszip'
import {
  TOW_IMAGES_BUCKET,
  normalizeTowImagePath,
} from '@/app/lib/queries/tow-images-storage'
import { getSupabaseAdmin } from '@/app/lib/server/supabase-admin'

export type TowImageZipRow = {
  id: string
  image_url: string
  image_type: string | null
}

export type BuildTowImagesZipOk = {
  ok: true
  bytes: Buffer
  filename: string
  included: number
  skipped: number
}

export type BuildTowImagesZipErr = {
  ok: false
  status: number
  error: string
  skipped?: number
}

export type BuildTowImagesZipResult = BuildTowImagesZipOk | BuildTowImagesZipErr

function sanitizeFilenamePart(value: string): string {
  const cleaned = value
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
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

/**
 * Download tow photo bytes via service role and pack into a ZIP.
 * Callers must already authorize (session company check or valid share token).
 */
export async function buildTowImagesZip(options: {
  towId: string
  /** When set, only these tow_images.id values (still scoped to towId). */
  imageIds?: string[]
  /** Used in zip entry / download filenames; defaults to towId prefix. */
  orderNumber?: string | null
}): Promise<BuildTowImagesZipResult> {
  const { towId, imageIds, orderNumber } = options
  const supabaseAdmin = getSupabaseAdmin()

  let imagesQuery = supabaseAdmin
    .from('tow_images')
    .select('id, image_url, image_type')
    .eq('tow_id', towId)
    .order('created_at', { ascending: true })

  if (imageIds && imageIds.length > 0) {
    imagesQuery = imagesQuery.in('id', imageIds)
  }

  const { data: images, error: imagesError } = await imagesQuery

  if (imagesError) {
    console.error('[tow-images-zip] images load failed', imagesError)
    return { ok: false, status: 500, error: 'שגיאה בטעינת התמונות' }
  }

  const rows = (images ?? []) as TowImageZipRow[]
  if (rows.length === 0) {
    return { ok: false, status: 404, error: 'אין תמונות להורדה' }
  }

  const orderSlug = sanitizeFilenamePart(
    typeof orderNumber === 'string' && orderNumber.trim()
      ? orderNumber.trim()
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
      console.error('[tow-images-zip] storage download failed', {
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
    return {
      ok: false,
      status: 502,
      error: 'לא ניתן להוריד את התמונות',
      skipped,
    }
  }

  const zipBytes = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  return {
    ok: true,
    bytes: Buffer.from(zipBytes),
    filename: `tow_${orderSlug}_photos.zip`,
    included,
    skipped,
  }
}
